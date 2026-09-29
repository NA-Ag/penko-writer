import { test, expect, Page } from '@playwright/test';
import { editorReady } from './helpers';

/** Real page layout: page boundaries, per-page headers/footers, page count and print fidelity. */

const long = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ';

const setup = async (page: Page) => {
  await editorReady(page);
  await page.evaluate(
    long =>
      window.__penkoEditor.commands.setContent(
        '<h1>Report</h1>' +
          Array.from({ length: 40 }, (_, i) => `<p>${i}. ${long.repeat(3)}</p>`).join('') +
          '<div data-type="page-break"></div><h2>Appendix</h2><p>End.</p>',
      ),
    long,
  );
  await page.waitForTimeout(800);
};

const pageCount = (page: Page) => page.evaluate(() => Number(document.querySelector<HTMLElement>('.penko-page')!.dataset.pageCount));

test('document is laid out on real pages with headers, footers and page numbers', async ({ page }) => {
  await setup(page);
  const pages = await pageCount(page);
  expect(pages).toBeGreaterThanOrEqual(4);

  // Page boundaries are decorations only — never saved
  expect(await page.evaluate(() => window.__penkoEditor.getHTML())).not.toContain('penko-page');

  // Every page starts exactly one page-stride below the previous one
  const errors = await page.evaluate(() => {
    const root = document.querySelector('#editor-content .ProseMirror')!;
    const rr = root.getBoundingClientRect();
    const P = Number(document.querySelector<HTMLElement>('.penko-page')!.dataset.pageHeight);
    return Array.from(root.querySelectorAll<HTMLElement>('.penko-page-boundary')).map(w => Math.abs(w.getBoundingClientRect().bottom - rr.top - Number(w.dataset.page) * (P + 24)));
  });
  expect(Math.max(...errors)).toBeLessThan(1);

  // The forced page break starts a new page
  const appendixOffset = await page.evaluate(() => {
    const root = document.querySelector('#editor-content .ProseMirror')!;
    const P = Number(document.querySelector<HTMLElement>('.penko-page')!.dataset.pageHeight);
    const h2 = Array.from(root.querySelectorAll('h2')).find(h => h.textContent === 'Appendix')!;
    const stride = P + 24;
    const mod = (h2.getBoundingClientRect().top - root.getBoundingClientRect().top) % stride;
    // distance from the nearest page top (sub-pixel rounding can land just above it)
    return Math.min(mod, stride - mod);
  });
  expect(appendixOffset).toBeLessThan(40);

  // Header/footer via double-click on the top margin
  await page.locator('.penko-first-header').dblclick();
  await page.locator('[role=dialog] .ProseMirror').first().click();
  await page.keyboard.type('Quarterly Report');
  await page.locator('[role=dialog] input[type=checkbox]').first().check();
  await page.locator('[role=dialog] select').first().selectOption('page-of');
  await page.getByRole('button', { name: /save|apply/i }).last().click();
  await page.waitForTimeout(800);

  const total = await pageCount(page);
  const chrome = await page.evaluate(() => ({
    first: document.querySelector('.penko-first-header')!.textContent,
    headers: Array.from(document.querySelectorAll('.penko-page-header-zone')).map(z => z.textContent),
    footers: Array.from(document.querySelectorAll('.penko-page-footer-zone')).map(z => z.textContent),
    last: document.querySelector('.penko-last-footer')!.textContent,
  }));
  expect(chrome.first).toContain('Quarterly Report');
  expect(chrome.headers.every(h => h?.includes('Quarterly Report'))).toBe(true);
  chrome.footers.forEach((f, i) => expect(f).toBe(`Page ${i + 1} of ${total}`));
  expect(chrome.last).toBe(`Page ${total} of ${total}`);
  await expect(page.getByText(new RegExp(`Page \\d+ of ${total}`)).last()).toBeVisible();
});

test('printing produces exactly one printed page per screen page', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'PDF generation needs Chromium');
  await setup(page);
  const screenPages = await pageCount(page);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(async () => {
      // Vite serves source modules by URL in dev
      const m = await import(/* @vite-ignore */ '/utils/print.ts' as string);
      const el = document.querySelector<HTMLElement>('.penko-page')!;
      const w = window.open('', '_blank')!;
      w.document.open();
      w.document.write('<!doctype html><html><head></head><body></body></html>');
      w.document.close();
      m.populatePrintDocument(w.document, el, m.currentPrintGeometry(el));
    }),
  ]);
  await popup.waitForLoadState('networkidle');
  await popup.evaluate(() => document.fonts.ready);
  const pdf = await popup.pdf({ preferCSSPageSize: true, printBackground: true });
  const printed = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  expect(printed).toBe(screenPages);
});

test('footnotes appear at the bottom of the page that references them', async ({ page }) => {
  await editorReady(page);
  await page.evaluate(long => {
    const note = (i: number) => `<sup data-type="footnote" data-note-type="footnote" data-content="Note ${i} ${'with some longer explanatory text '.repeat((i % 3) + 1)}"></sup>`;
    window.__penkoEditor.commands.setContent(
      '<h1>Notes</h1>' + Array.from({ length: 40 }, (_, i) => `<p>${i}. ${long.repeat(2)}${i % 3 === 0 ? note(i) : ''} end.</p>`).join(''),
    );
  }, long);
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const root = document.querySelector('#editor-content .ProseMirror')!;
    const rr = root.getBoundingClientRect();
    const P = Number(document.querySelector<HTMLElement>('.penko-page')!.dataset.pageHeight);
    const stride = P + 24;
    const total = Number(document.querySelector<HTMLElement>('.penko-page')!.dataset.pageCount);
    const refPage: Record<string, number> = {};
    root.querySelectorAll('sup.penko-note-ref').forEach(el => (refPage[el.textContent!] = Math.floor((el.getBoundingClientRect().top - rr.top) / stride) + 1));
    const notePage: Record<string, number> = {};
    root.querySelectorAll<HTMLElement>('.penko-page-boundary').forEach(w => w.querySelectorAll('.penko-page-note sup').forEach(s => (notePage[s.textContent!] = Number(w.dataset.page))));
    document.querySelectorAll('.penko-last-notes .penko-page-note sup').forEach(s => (notePage[s.textContent!] = total));
    // text never runs into a page's notes area
    const overlaps = Array.from(root.querySelectorAll<HTMLElement>('.penko-page-notes-zone')).filter(z => {
      const top = z.getBoundingClientRect().top;
      const boundary = z.closest('.penko-page-boundary')!;
      const prev = boundary.previousSibling as HTMLElement | null;
      return prev && prev.getBoundingClientRect && prev.getBoundingClientRect().bottom > top + 1;
    }).length;
    return { refPage, notePage, overlaps, total };
  });
  expect(Object.keys(r.refPage).length).toBeGreaterThan(10);
  expect(r.notePage).toEqual(r.refPage);
  expect(r.overlaps).toBe(0);
});

test('section breaks: own header, restarted numbering, different first page', async ({ page }) => {
  await editorReady(page);
  await page.evaluate(long => {
    window.__penkoEditor.commands.setContent('<h1>Title page</h1><div data-type="section-break"></div><h1>Chapter</h1>' + Array.from({ length: 30 }, (_, i) => `<p>${i}. ${long.repeat(3)}</p>`).join(''));
  }, long);
  await page.waitForTimeout(800);
  // First section: page numbers on, nothing on the title page
  await page.locator('.penko-first-header').dblclick();
  await page.locator('[role=dialog] input[type=checkbox]').first().check();
  await page.getByLabel(/different first page/i).check();
  await page.getByRole('button', { name: /save|apply/i }).last().click();
  await page.waitForTimeout(600);
  // Second section: own header, numbering restarts at 1
  await page.locator('.penko-page-header-zone').first().dblclick();
  await expect(page.locator('#header-footer-dialog-title')).toContainText(/2/);
  await page.getByLabel(/same as previous section/i).first().uncheck();
  await page.locator('[role=dialog] .ProseMirror').first().click();
  await page.keyboard.type('Chapter header');
  await page.getByLabel(/different first page/i).uncheck();
  await page.getByLabel(/restart numbering at/i).first().check();
  await page.getByRole('button', { name: /save|apply/i }).last().click();
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => ({
    firstHeader: document.querySelector('.penko-first-header')!.textContent,
    headers: Array.from(document.querySelectorAll('.penko-page-header-zone')).map(z => z.textContent),
    footers: Array.from(document.querySelectorAll('.penko-page-footer-zone')).map(z => z.textContent),
    last: document.querySelector('.penko-last-footer')!.textContent,
    total: Number(document.querySelector<HTMLElement>('.penko-page')!.dataset.pageCount),
  }));
  expect(r.firstHeader).toBe('');
  expect(r.headers.every(h => h === 'Chapter header')).toBe(true);
  expect(r.footers[0]).toBe(''); // title page
  expect(r.footers.slice(1)).toEqual(r.footers.slice(1).map((_, i) => String(i + 1)));
  expect(r.last).toBe(String(r.total - 1));
});

test('a landscape section in a portrait document: page sizes on screen and in print', async ({ page }) => {
  await editorReady(page);
  await page.evaluate(long => {
    const para = (tag: string, n: number) => Array.from({ length: n }, (_, i) => `<p>${tag} ${i}. ${long.repeat(3)}</p>`).join('');
    window.__penkoEditor.commands.setContent(
      '<h1>Intro</h1>' + para('Intro', 4) + '<div data-type="section-break"></div><h1>Wide</h1>' + para('Wide', 14) + '<div data-type="section-break"></div><h1>Outro</h1>' + para('Outro', 3),
    );
  }, long);
  await page.waitForTimeout(800);
  // Layout > Orientation > Landscape with the cursor in the middle section changes only that section
  await page.evaluate(() => {
    const e = window.__penkoEditor;
    let at = 0;
    e.state.doc.descendants((n, pos) => {
      if (!at && n.isText && n.text!.startsWith('Wide 2')) at = pos + 1;
    });
    e.chain().focus().setTextSelection(at).run();
  });
  await page.getByRole('button', { name: 'Layout', exact: true }).first().click();
  await page.getByRole('button', { name: /orientation/i }).click();
  await page.getByRole('menuitemradio', { name: /landscape/i }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /orientation/i }).click();
  await expect(page.getByRole('menuitemradio', { name: /landscape/i })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');

  const r = await page.evaluate(async () => {
    const pg = document.querySelector<HTMLElement>('.penko-page')!;
    const box = pg.getBoundingClientRect();
    const scale = box.width / parseFloat(getComputedStyle(pg).width);
    const rel = (el: Element) => {
      const b = el.getBoundingClientRect();
      return { left: (b.left - box.left) / scale, width: b.width / scale, top: (b.top - box.top) / scale };
    };
    const para = (prefix: string) => rel(Array.from(document.querySelectorAll('.ProseMirror > p')).find(p => p.textContent!.startsWith(prefix))!);
    const m: typeof import('../../utils/print') = await import('/utils/print.ts' as string);
    const doc = document.implementation.createHTMLDocument('print');
    m.populatePrintDocument(doc, pg, m.currentPrintGeometry(pg));
    const printed = Array.from(doc.querySelectorAll<HTMLElement>('.penko-print-page'));
    return {
      alt: pg.dataset.pageAlt,
      pageWidth: Number(pg.dataset.pageWidth),
      pageHeight: Number(pg.dataset.pageHeight),
      intro: para('Intro 1'),
      wide: para('Wide 1'),
      outro: para('Outro 1'),
      headerTops: Array.from(document.querySelectorAll('.penko-page-header-zone')).map(z => rel(z).top),
      footers: Array.from(document.querySelectorAll('.penko-page-footer-zone')).map(z => rel(z)),
      printed: printed.map(p => ({ alt: p.classList.contains('penko-print-alt'), width: parseFloat(p.style.width), text: p.textContent!.slice(0, 40) })),
      css: doc.querySelector('style:last-of-type')!.textContent!.includes('@page penko-alt'),
    };
  });
  const { pageWidth: W, pageHeight: H } = r;
  expect(r.alt).toMatch(/^01+0$/);
  // blocks in the landscape section are as wide as its page's content area, centred on the portrait pages
  expect(r.intro.width).toBeCloseTo(r.outro.width, 0);
  expect(r.wide.width - r.intro.width).toBeCloseTo(H - W, 0);
  expect(r.wide.left).toBeCloseTo(r.intro.left - (H - W) / 2, 0);
  // pages follow each other with their own heights (landscape pages are W high)
  const alts = Array.from(r.alt!, c => c === '1');
  let y = 0;
  const expectedTops = alts.slice(0, -1).map(a => (y += (a ? W : H) + 24));
  // each page's header zone starts exactly at its page's top edge
  expect(r.headerTops.length).toBe(expectedTops.length);
  r.headerTops.forEach((top, i) => expect(Math.abs(top - expectedTops[i])).toBeLessThan(1.5));
  // footer zones of landscape pages span the landscape width
  r.footers.forEach((f, i) => expect(f.width).toBeCloseTo(alts[i] ? H : W, 0));
  // print: one page per screen page, landscape ones marked for the landscape @page
  expect(r.printed.map(p => p.alt)).toEqual(alts);
  r.printed.forEach((p, i) => expect(p.width).toBeCloseTo(alts[i] ? H : W, 0));
  expect(r.css).toBe(true);
  expect(r.printed[alts.indexOf(true)].text).toContain('Wide');
});
