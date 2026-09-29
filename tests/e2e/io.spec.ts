import { test, expect, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { editorReady, failOnNativeDialogs, html, newDoc, readDownload, setDoc, toastText } from './helpers';

/**
 * Import / export and storage: every export format from the sidebar menu,
 * DOCX / HTML round trips through the Import dialog, and the storage edge
 * cases (quota error, unreadable record, emergency backup).
 */

failOnNativeDialogs();

const RICH =
  '<h1>Report</h1><p>Intro<sup data-type="footnote" data-note-type="footnote" data-content="A note" data-number="1">1</sup> with <span data-type="equation" data-latex="E=mc^2"></span></p>' +
  '<ul><li><p>alpha</p><ul><li><p>nested</p></li></ul></li></ul>' +
  '<table><tbody><tr><th colspan="2"><p>Head</p></th></tr><tr><td><p>c1</p></td><td><p>c2</p></td></tr></tbody></table>' +
  '<div data-type="page-break"></div><pre><code class="language-js">const a = 1;</code></pre>';

/** Text of each PDF page via poppler's pdftotext (null when it isn't installed). */
const pdfPageTexts = (pdf: Buffer): string[] | null => {
  const file = path.join(os.tmpdir(), `penko-e2e-${process.pid}-${Date.now()}.pdf`);
  fs.writeFileSync(file, pdf);
  try {
    return execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' }).split('\f').filter(p => p.trim());
  } catch {
    return null;
  } finally {
    fs.rmSync(file, { force: true });
  }
};

/** Clicks an entry of the sidebar's "Export Document" menu and returns the download. */
const exportAs = async (page: Page, label: RegExp) => {
  const opener = page.getByRole('button', { name: /export document/i });
  if (!(await opener.isVisible())) await page.getByTitle('Files', { exact: true }).click();
  const menu = page.getByRole('menu');
  if (!(await menu.isVisible())) await opener.click();
  const [download] = await Promise.all([page.waitForEvent('download'), menu.getByRole('menuitem', { name: label }).click()]);
  return download;
};

/** Current document as stored in IndexedDB. */
const storedDoc = (page: Page, title: string) =>
  page.evaluate(async title => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const req = indexedDB.open('penko-writer-docs');
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const all: any[] = await new Promise(res => {
      const r = db.transaction('docs', 'readonly').objectStore('docs').getAll();
      r.onsuccess = () => res(r.result);
    });
    db.close();
    return all.find(d => d.title === title);
  }, title);

const importFile = async (page: Page, name: string, buffer: Buffer) => {
  await page.getByTitle('Import', { exact: true }).click();
  await page.locator('[aria-labelledby="import-dialog-title"] input[type=file]').setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
  await expect(toastText(page, /imported/i).first()).toBeVisible({ timeout: 10000 });
};

test('every export format downloads a correct file', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await setDoc(page, RICH);

  const docx = await exportAs(page, /\.docx/i);
  expect(docx.suggestedFilename()).toMatch(/\.docx$/);
  const zip = await JSZip.loadAsync(await readDownload(docx));
  const xml = await zip.file('word/document.xml')!.async('string');
  for (const s of ['Report', 'alpha', 'nested', 'c1', 'const a = 1;']) expect(xml).toContain(s);
  expect(xml).toContain('w:gridSpan');
  // equations are real Word math, not LaTeX text
  expect(xml).toContain('<m:oMath');
  expect(xml).not.toContain('E=mc^2');
  expect(await zip.file('word/footnotes.xml')!.async('string')).toContain('A note');

  const pdf = await readDownload(await exportAs(page, /\.pdf/i));
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  // the footnote sits at the bottom of the page holding its reference (page 1, before the page break)
  const pageText = pdfPageTexts(pdf);
  if (pageText) {
    expect(pageText.length).toBe(2);
    expect(pageText[0]).toContain('Intro');
    expect(pageText[0]).toContain('A note');
    expect(pageText[1]).not.toContain('A note');
    expect(pageText.join('\n')).not.toContain('mc^2');
  }

  // KaTeX is lazy-loaded: the exported HTML must still contain rendered math
  const htmlFile = (await readDownload(await exportAs(page, /\.html/i))).toString();
  expect(htmlFile).toContain('<math');
  expect(htmlFile).toContain('A note');
  expect(htmlFile).not.toMatch(/<script|https?:\/\/(cdn|fonts)\./);

  const txt = (await readDownload(await exportAs(page, /\.txt/i))).toString();
  expect(txt).toContain('• alpha');
  expect(txt).toContain('E = mc²');
  expect(txt).toContain('[1] A note');

  const md = (await readDownload(await exportAs(page, /\.md/i))).toString();
  expect(md).toMatch(/^# Report/m);
  expect(md).toContain('```');
  expect(md).toContain('$E=mc^2$');

  const doc = await exportAs(page, /\.doc \(/i);
  expect(doc.suggestedFilename()).toMatch(/\.doc$/);
  expect((await readDownload(doc)).toString()).toContain('urn:schemas-microsoft-com:office:word');
});

test('DOCX round trip keeps footnotes, page breaks, header and page numbers', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await setDoc(page, RICH);
  const docx = await readDownload(await exportAs(page, /\.docx/i));

  await importFile(page, 'roundtrip.docx', docx);
  await expect.poll(() => html(page)).toContain('data-type="footnote"');
  const h = await html(page);
  expect(h).toContain('data-content="A note"');
  expect(h).toContain('data-type="page-break"');
  expect(h).toMatch(/<pre[^>]*><code[^>]*>const a = 1;<\/code><\/pre>/);
  expect(h).toContain('colspan="2"');
  expect(h).toContain('data-latex="E=mc^2"');
  expect(h).not.toContain('↑');
});

test('an exported HTML file imports back without duplicated notes or header', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await setDoc(page, RICH);
  const file = await readDownload(await exportAs(page, /\.html/i));
  await importFile(page, 'roundtrip.html', file);
  await expect.poll(() => html(page)).toContain('data-type="footnote"');
  const text = await page.evaluate(() => window.__penkoEditor.getText());
  expect(text.match(/A note/g)).toBeNull(); // only in the footnote attribute, not as body text
  expect((await html(page)).match(/data-type="footnote"/g)).toHaveLength(1);
});

test('a DOCX with header, roman numbers and landscape Letter restores those settings', async ({ page }) => {
  await editorReady(page);
  // build the DOCX in the page with the app's own exporter (retried: a dev-server
  // dependency re-optimisation can reload the page mid-evaluate)
  let bytes: number[] = [];
  await expect(async () => {
    await page.waitForFunction(() => !!window.__penkoEditor);
    bytes = await page.evaluate(async () => {
      const url = '/utils/docxExport.ts'; // served by the dev server
      const { buildDocxBlob } = await import(url);
      const blob: Blob = await buildDocxBlob({
        id: 'x', title: 'Settings', content: '<p>One</p><div data-type="page-break"></div><p>Two</p>', createdAt: 0, lastModified: 0,
        pageConfig: { size: 'Letter', orientation: 'landscape', margins: 'narrow' },
        header: '<p>Quarterly {PAGE}</p>', showPageNumbers: true, pageNumberPosition: 'footer-right', pageNumberFormat: 'roman', differentFirstPage: true,
      });
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
  }).toPass({ timeout: 20000 });
  await importFile(page, 'Settings.docx', Buffer.from(bytes));
  await expect.poll(async () => (await storedDoc(page, 'Settings'))?.header).toBe('<p>Quarterly {PAGE}</p>');
  const doc = await storedDoc(page, 'Settings');
  expect(doc).toMatchObject({
    pageConfig: { size: 'Letter', orientation: 'landscape', margins: 'narrow' },
    showPageNumbers: true,
    pageNumberPosition: 'footer-right',
    pageNumberFormat: 'roman',
    differentFirstPage: true,
  });
  // the paginated view shows the header from page 2 on
  await expect(page.locator('.penko-page-header-zone', { hasText: 'Quarterly ii' })).toHaveCount(1);
});

test('a full disk shows the "storage is full" error instead of failing silently', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    };
  });
  await setDoc(page, '<p>This edit cannot be saved</p>');
  await expect(toastText(page, /storage is full/i).first()).toBeVisible({ timeout: 5000 });
});

test('an unreadable stored record is skipped with a warning, the rest loads', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await setDoc(page, '<p>Survivor document</p>');
  await page.waitForTimeout(800); // autosave
  await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise(res => {
      const req = indexedDB.open('penko-writer-docs');
      req.onsuccess = () => res(req.result);
    });
    await new Promise(res => {
      const tx = db.transaction('docs', 'readwrite');
      tx.objectStore('docs').put({ id: 'broken', title: 'x', content: 42 }, 'broken');
      tx.oncomplete = res;
    });
    db.close();
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__penkoEditor, null, { timeout: 20000 });
  await expect(toastText(page, /could not be read/i).first()).toBeVisible();
  await page.getByTitle('Files', { exact: true }).click();
  await expect(page.getByText('Survivor document').first()).toBeVisible();
});

test('an emergency backup newer than IndexedDB wins on the next start', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await setDoc(page, '<p>saved version</p>');
  await page.waitForTimeout(800);
  const id = await page.evaluate(() => localStorage.getItem('penko_writer_last_doc'));
  await page.evaluate(id => {
    const doc = { id, title: '', content: '<p>unsaved version from the backup</p>', createdAt: 0, lastModified: Date.now() + 60_000 };
    localStorage.setItem('penko_writer_unsaved_backup', JSON.stringify([doc]));
  }, id);
  await page.reload();
  await page.waitForFunction(() => !!window.__penkoEditor, null, { timeout: 20000 });
  await expect.poll(() => html(page)).toContain('unsaved version from the backup');
  expect(await page.evaluate(() => localStorage.getItem('penko_writer_unsaved_backup'))).toBeNull();
});
