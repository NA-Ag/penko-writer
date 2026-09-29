import { test, expect, type Page } from '@playwright/test';
import { editorReady, failOnNativeDialogs } from './helpers';

/**
 * Regressions found while testing in Firefox (Gecko). Every test runs in both
 * browsers: the fixes are browser-agnostic, Gecko just exposed them.
 */

failOnNativeDialogs();

const long = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ';

/** 5+ pages of headings, paragraphs, lists and tables. */
const richDoc = () => {
  let h = '<h1>Report</h1>';
  for (let s = 0; s < 6; s++) {
    h += `<h2>Section ${s}</h2>`;
    h += Array.from({ length: 5 }, (_, i) => `<p>${s}.${i} ${long.repeat(1 + (i % 3))}</p>`).join('');
    h += '<ul>' + Array.from({ length: 6 }, (_, i) => `<li><p>item ${i} ${long.slice(0, 40 + i * 12)}</p></li>`).join('') + '</ul>';
    h += '<ol>' + Array.from({ length: 4 }, (_, i) => `<li><p>num ${i} ${long}</p></li>`).join('') + '</ol>';
    h += '<table><tbody>' + Array.from({ length: 5 }, (_, r) => `<tr><td><p>r${r} ${long.slice(0, 30)}</p></td><td><p>c2</p></td><td><p>${long.slice(0, 60)}</p></td></tr>`).join('') + '</tbody></table>';
    h += `<h3>Sub ${s}</h3><blockquote><p>${long}</p></blockquote>`;
  }
  return h;
};

const setRichDoc = async (page: Page) => {
  await editorReady(page);
  await page.evaluate(h => window.__penkoEditor.commands.setContent(h, { emitUpdate: true }), richDoc());
  await page.waitForTimeout(1500);
};

/** How far (unscaled px) each page boundary is from where its page should start. */
const boundaryErrors = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('#editor-content .ProseMirror')!;
    const rr = root.getBoundingClientRect();
    const scale = rr.width / parseFloat(getComputedStyle(root).width);
    const stride = Number(document.querySelector<HTMLElement>('.penko-page')!.dataset.pageHeight) + 24;
    return Array.from(root.querySelectorAll<HTMLElement>('.penko-page-boundary')).map(w =>
      Math.abs((w.getBoundingClientRect().bottom - rr.top) / scale - Number(w.dataset.page) * stride),
    );
  });

test('page boundaries stay aligned on long mixed documents at any zoom (fractional A4 width)', async ({ page }) => {
  // offsetWidth/Height are rounded; Gecko lays A4 out at 793.7px, which used to skew the
  // zoom factor and let every page drift a little further (4px by page 8)
  await setRichDoc(page);
  const zoomLabel = page.locator('span[aria-live=polite]', { hasText: '%' }).first();
  for (const zoom of [100, 70, 130]) {
    while (parseInt((await zoomLabel.textContent())!) !== zoom) {
      await page.getByLabel(parseInt((await zoomLabel.textContent())!) < zoom ? 'Zoom in' : 'Zoom out').click();
    }
    await page.waitForTimeout(800);
    const errors = await boundaryErrors(page);
    expect(errors.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...errors), `zoom ${zoom}: ${errors.map(e => e.toFixed(2)).join(', ')}`).toBeLessThan(1);
  }
});

test('the print document has one page per screen page, cut at the same blocks', async ({ page }) => {
  await setRichDoc(page);
  const result = await page.evaluate(async () => {
    const m: typeof import('../../utils/print') = await import('/utils/print.ts' as string);
    const pageEl = document.querySelector<HTMLElement>('.penko-page')!;
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write('<!doctype html><html><head></head><body></body></html>');
    doc.close();
    const geometry = m.currentPrintGeometry(pageEl);
    m.populatePrintDocument(doc, pageEl, geometry);
    const root = pageEl.querySelector<HTMLElement>('.ProseMirror')!;
    // first text after every on-screen page boundary must be printed on that page
    const starts = Array.from(root.querySelectorAll<HTMLElement>('.penko-page-boundary')).map(w => {
      const next = w.nextElementSibling || w.parentElement!.nextElementSibling;
      return { page: Number(w.dataset.page), text: (next?.textContent || '').trim().slice(0, 12) };
    });
    const printed = Array.from(doc.querySelectorAll<HTMLElement>('.penko-print-page'));
    const widths = Array.from(doc.querySelectorAll<HTMLElement>('.penko-print-shell > div:last-child')).map(el => el.style.width);
    const out = {
      pageCount: geometry.pageCount,
      printed: printed.length,
      starts: starts.map(s => (s.text ? printed[s.page]?.textContent?.includes(s.text) : true)),
      widths: [...new Set(widths)],
      layoutWidth: getComputedStyle(root).width,
    };
    frame.remove();
    return out;
  });
  expect(result.printed).toBe(result.pageCount);
  expect(result.pageCount).toBeGreaterThanOrEqual(5);
  expect(result.starts.every(Boolean)).toBe(true);
  // the cloned content keeps the exact (unrounded) text width, so lines wrap as on screen
  expect(result.widths).toEqual([result.layoutWidth]);
});

test('documents persist through the localStorage fallback when IndexedDB is unusable', async ({ browser }) => {
  // Firefox private windows (before v115) and some hardened profiles reject indexedDB.open
  const context = await browser.newContext();
  await context.addInitScript(() => {
    IDBFactory.prototype.open = function () {
      const req: any = { error: new DOMException('IndexedDB is disabled', 'InvalidStateError'), addEventListener() {}, removeEventListener() {} };
      setTimeout(() => req.onerror?.({ target: req, preventDefault() {} }));
      return req;
    };
  });
  const page = await context.newPage();
  page.on('dialog', d => {
    throw new Error('native dialog shown: ' + d.message());
  });
  await editorReady(page);
  await page.getByTitle('New', { exact: true }).click();
  await page.evaluate(() => window.__penkoEditor.commands.setContent('<p>Survives without IndexedDB</p>', { emitUpdate: true }));
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForFunction(() => !!window.__penkoEditor);
  await expect.poll(() => page.evaluate(() => window.__penkoEditor.getText())).toContain('Survives without IndexedDB');
  await context.close();
});

test('browser shortcuts are taken over inside the editor (Ctrl+K, Ctrl+O, Ctrl+S, Ctrl+Shift+S, Ctrl+Shift+H)', async ({ page }) => {
  // Firefox binds Ctrl+K (web search), Ctrl+Shift+S (screenshot), Ctrl+Shift+H (history)…
  await editorReady(page);
  await page.evaluate(() => {
    (window as any).__keys = [];
    window.addEventListener('keydown', e => {
      if (e.key.length === 1) setTimeout(() => (window as any).__keys.push(`${e.shiftKey ? 'S-' : ''}${e.key.toLowerCase()}:${e.defaultPrevented}`));
    });
  });
  for (const key of ['Control+k', 'Control+o', 'Control+s', 'Control+Shift+s', 'Control+Shift+h']) {
    await page.evaluate(() => window.__penkoEditor.commands.focus('start'));
    await page.waitForFunction(() => document.activeElement?.classList.contains('ProseMirror'));
    await page.keyboard.press(key);
    if (key === 'Control+k') await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  expect(await page.evaluate(() => (window as any).__keys)).toEqual(['k:true', 'o:true', 's:true', 'S-s:true', 'S-h:true']);
});

test('scrollbars are styled without ::-webkit-scrollbar (Firefox) and follow dark mode', async ({ page, browserName }) => {
  test.skip(browserName === 'chromium', 'Chromium keeps its ::-webkit-scrollbar styling');
  await editorReady(page);
  const color = () => page.evaluate(() => getComputedStyle(document.querySelector('#editor-scroll-container')!).scrollbarColor);
  const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  expect(await color()).toBe(dark ? 'rgb(51, 51, 51) rgba(0, 0, 0, 0)' : 'rgb(203, 213, 225) rgba(0, 0, 0, 0)');
  await page.getByRole('button', { name: dark ? /^Light/ : /^Dark/ }).first().click();
  // (the scroll container has transition-all: the colour animates)
  await expect.poll(color).toBe(dark ? 'rgb(203, 213, 225) rgba(0, 0, 0, 0)' : 'rgb(51, 51, 51) rgba(0, 0, 0, 0)');
});
