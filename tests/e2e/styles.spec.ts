import { test, expect, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { editorReady, failOnNativeDialogs, html, newDoc, readDownload, setDoc, toastText } from './helpers';

/**
 * Named paragraph styles: the Home tab style gallery, Modify / Update to
 * match / New style / Clear formatting, the Styles dialog, persistence and
 * DOCX export.
 */

failOnNativeDialogs();

const gallery = (page: Page) => page.getByRole('button', { name: 'Paragraph style', exact: true });
const openGallery = async (page: Page) => {
  await gallery(page).click();
  await expect(page.getByRole('menu', { name: 'Paragraph style' })).toBeVisible();
};
const pickStyle = async (page: Page, id: string) => {
  await openGallery(page);
  await page.locator(`[data-style-option="${id}"]`).click();
};
const menuAction = async (page: Page, name: string | RegExp) => {
  await openGallery(page);
  await page.getByRole('menuitem', { name }).click();
};
/** Caret into the n-th top-level block. */
const caretIn = async (page: Page, index: number) => {
  await page.evaluate(i => {
    const e = window.__penkoEditor;
    let pos = 0;
    e.state.doc.forEach((node: any, offset: number, n: number) => {
      if (n === i) pos = offset + 1 + Math.min(1, node.content.size);
    });
    e.chain().focus().setTextSelection(pos).run();
  }, index);
  await page.waitForTimeout(50);
};
/** Computed values (px rounded to 0.1: Chromium and Firefox round sub-pixel sizes differently). */
const computed = (page: Page, selector: string, prop: string) =>
  page.evaluate(
    ([s, p]) =>
      Array.from(document.querySelectorAll<HTMLElement>(`#editor-content .ProseMirror ${s}`)).map(el => {
        const v = getComputedStyle(el).getPropertyValue(p);
        return /^[\d.]+px$/.test(v) ? `${Math.round(parseFloat(v) * 10) / 10}px` : v;
      }),
    [selector, prop] as const,
  );
const storedStyles = (page: Page) =>
  page.evaluate(async () => {
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
    const current = all.sort((a, b) => b.lastModified - a.lastModified)[0];
    return { styles: current?.styles || [] };
  });
const dialog = (page: Page) => page.getByRole('dialog').filter({ has: page.locator('#styles-dialog-title') });

test('applying styles from the gallery and with Ctrl+Alt+digit', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await setDoc(page, '<p>Report</p><p>Intro</p><p>Body</p>');
  await caretIn(page, 0);
  await pickStyle(page, 'title');
  expect(await html(page)).toMatch(/^<p data-style="title">Report<\/p>/);
  await expect(gallery(page)).toHaveAttribute('data-style-current', 'title');
  expect((await computed(page, '[data-style="title"]', 'font-size'))[0]).toBe('34.7px'); // 26pt

  await caretIn(page, 1);
  await pickStyle(page, 'heading2');
  expect(await html(page)).toMatch(/<h2 id="[^"]+">Intro<\/h2>/);
  await caretIn(page, 2);
  await pickStyle(page, 'quote');
  expect(await html(page)).toMatch(/<blockquote><p>Body<\/p><\/blockquote>/);
  await pickStyle(page, 'normal');
  expect(await html(page)).toMatch(/<p>Body<\/p>(<p><\/p>)?$/);

  // keyboard: Ctrl+Alt+1 heading, Ctrl+Alt+0 back to Normal (also clears Title)
  await page.keyboard.press('Control+Alt+1');
  expect(await html(page)).toMatch(/<h1 id="[^"]+">Body<\/h1>/);
  await caretIn(page, 0);
  await page.keyboard.press('Control+Alt+0');
  expect(await html(page)).toMatch(/^<p>Report<\/p>/);

  // Enter at the end of a Title starts a Normal paragraph
  await pickStyle(page, 'title');
  await page.evaluate(() => window.__penkoEditor.chain().focus().setTextSelection(7).run());
  await page.waitForFunction(() => document.activeElement?.classList.contains('ProseMirror'));
  await page.keyboard.press('Enter');
  await page.keyboard.type('Next');
  expect(await html(page)).toMatch(/^<p data-style="title">Report<\/p><p>Next<\/p>/);
});

test('modify style restyles every paragraph and survives a reload', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await setDoc(page, '<h1>One</h1><p>text</p><h1>Two</h1><h1 style="font-size: 12pt">Direct</h1>');
  await caretIn(page, 0);
  await menuAction(page, 'Modify style…');
  const d = dialog(page);
  await expect(d).toBeVisible();
  await expect(d.getByLabel('Style name')).toHaveValue('Heading 1');
  await d.getByLabel('Font size').fill('30');
  await d.getByLabel('Italic').check();
  await d.getByLabel('Automatic').uncheck();
  await d.locator('#style-color').fill('#1f4e79');
  await expect(d.getByTestId('style-preview')).toHaveCSS('font-style', 'italic');
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(d).toBeHidden();
  await expect(toastText(page, /updated/i).first()).toBeVisible();

  // both headings change, the one with direct formatting keeps its own size; no inline styles were added
  expect(await computed(page, 'h1', 'font-size')).toEqual(['40px', '40px', '16px']);
  expect(await computed(page, 'h1', 'color')).toEqual(['rgb(31, 78, 121)', 'rgb(31, 78, 121)', 'rgb(31, 78, 121)']);
  expect(await computed(page, 'h1', 'font-style')).toEqual(['italic', 'italic', 'italic']);
  expect(await html(page)).toMatch(/^<h1 id="[^"]+">One<\/h1>/);
  // Normal paragraphs are untouched
  expect(new Set(await computed(page, 'p', 'font-size'))).toEqual(new Set(['14.7px']));

  await page.waitForTimeout(700);
  await page.reload();
  await page.waitForFunction(() => !!window.__penkoEditor);
  await expect.poll(() => computed(page, 'h1', 'font-size')).toEqual(['40px', '40px', '16px']);
  const { styles } = await storedStyles(page);
  expect(styles).toEqual([expect.objectContaining({ id: 'heading1', fontSize: 30, italic: true, color: '#1f4e79' })]);

  // reset the built-in from the Styles dialog
  await menuAction(page, 'Manage styles…');
  await dialog(page).getByRole('button', { name: 'Reset to default Heading 1' }).click();
  await expect.poll(() => computed(page, 'h1', 'font-size')).toEqual(['29.3px', '29.3px', '16px']);
  await dialog(page).getByRole('button', { name: 'Close' }).click();
  await expect(dialog(page)).toBeHidden();
});

test('update style to match selection, clear formatting keeps the style', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await setDoc(page, '<p><span style="font-family: Georgia; font-size: 16pt">Source</span></p><p>Other</p><p>Third <strong>bold</strong></p>');
  await caretIn(page, 0);
  await menuAction(page, /Update “Normal” to match selection/);
  await expect(toastText(page, /updated/i).first()).toBeVisible();
  expect(new Set(await computed(page, 'p', 'font-size'))).toEqual(new Set(['21.3px']));
  expect((await computed(page, 'p', 'font-family'))[1]).toMatch(/Georgia/);
  // the source paragraph's direct formatting was absorbed into the style
  expect(await html(page)).toMatch(/^<p>Source<\/p><p>Other<\/p>/);

  // Clear formatting: direct formatting goes, the named style stays
  await setDoc(page, '<p data-style="subtitle" style="text-align: center"><strong>Keep</strong> me</p>');
  await caretIn(page, 0);
  await menuAction(page, 'Clear Formatting');
  expect(await html(page)).toBe('<p data-style="subtitle">Keep me</p>');
  await page.keyboard.press('Control+z');
  expect(await html(page)).toMatch(/<strong>Keep<\/strong>/);
});

test('new style from the selection, then delete it', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await setDoc(page, '<p style="color: #c00000"><em>Callout text</em></p><p>plain</p>');
  await caretIn(page, 0);
  await menuAction(page, 'New style…');
  const d = dialog(page);
  await expect(d.getByLabel('Italic')).toBeChecked(); // captured from the paragraph
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(d.getByRole('alert')).toHaveText('Enter a style name');
  await d.getByLabel('Style name').fill('normal');
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(d.getByRole('alert')).toHaveText('A style with this name already exists');
  await d.getByLabel('Style name').fill('Callout');
  await d.getByLabel('Space after (pt)').fill('12');
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(d).toBeHidden();

  expect(await html(page)).toMatch(/^<p data-style="u-callout">Callout text<\/p><p>plain<\/p>$/);
  expect(await computed(page, '[data-style="u-callout"]', 'color')).toEqual(['rgb(192, 0, 0)']);
  expect(await computed(page, '[data-style="u-callout"]', 'margin-bottom')).toEqual(['16px']);
  await expect(gallery(page)).toContainText('Callout');

  // apply it to the other paragraph from the gallery
  await caretIn(page, 1);
  await pickStyle(page, 'u-callout');
  expect(await computed(page, '[data-style="u-callout"]', 'font-style')).toEqual(['italic', 'italic']);

  // delete: paragraphs fall back to Normal
  await menuAction(page, 'Manage styles…');
  await dialog(page).getByRole('button', { name: 'Delete Callout' }).click();
  await expect(dialog(page).locator('[data-style-row="u-callout"]')).toHaveCount(0);
  expect(await html(page)).toBe('<p>Callout text</p><p>plain</p>');
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
});

test('styles as defaults for new documents, and DOCX export has Word styles', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await setDoc(page, '<p>Title text</p><h2>Section</h2><p>Body</p>');
  await caretIn(page, 0);
  await pickStyle(page, 'title');
  await caretIn(page, 1);
  await menuAction(page, 'Modify style…');
  await dialog(page).getByLabel('Font size').fill('20');
  await dialog(page).getByRole('button', { name: 'Save' }).click();
  await expect(dialog(page)).toBeHidden();

  // DOCX: styles.xml has the changed Heading 2 and the Title style; paragraphs reference them
  const opener = page.getByRole('button', { name: /export document/i });
  if (!(await opener.isVisible())) await page.getByTitle('Files', { exact: true }).click();
  await opener.click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menu').getByRole('menuitem', { name: /\.docx/i }).click()]);
  const zip = await JSZip.loadAsync(await readDownload(download));
  const stylesXml = await zip.file('word/styles.xml')!.async('string');
  const docXml = await zip.file('word/document.xml')!.async('string');
  expect(stylesXml).toMatch(/w:styleId="Heading2"[\s\S]*?<w:sz w:val="40"\/>/);
  expect(stylesXml).toContain('w:styleId="Title"');
  expect(docXml).toContain('<w:pStyle w:val="Title"/>');
  expect(docXml).toContain('<w:pStyle w:val="Heading2"/>');
  await page.keyboard.press('Escape');

  // save as default -> a new blank document starts with the changed Heading 2
  await menuAction(page, 'Manage styles…');
  await dialog(page).getByRole('button', { name: 'Use for new documents' }).click();
  await expect(toastText(page, /default for new documents/i).first()).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Close' }).click();
  await newDoc(page);
  await setDoc(page, '<h2>Fresh</h2>');
  await expect.poll(() => computed(page, 'h2', 'font-size')).toEqual(['26.7px']);
  await page.evaluate(() => localStorage.removeItem('penko_writer_default_styles'));
});

test('style gallery and dialog work in dark mode and at phone width', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await page.getByRole('button', { name: 'Dark Mode' }).click();
  await expect(page.locator('#editor-content')).toHaveClass(/penko-doc-dark/);
  await setDoc(page, '<p>x</p>');
  await caretIn(page, 0);
  await menuAction(page, 'Manage styles…');
  const d = dialog(page);
  await expect(d.locator('[data-style-row]')).toHaveCount(11);
  await d.getByRole('button', { name: 'Modify style… Title' }).click();
  await expect(d.getByLabel('Style name')).toHaveValue('Title');
  await d.getByRole('button', { name: 'Cancel' }).click();
  await expect(d.locator('[data-style-row]')).toHaveCount(11);
  await page.setViewportSize({ width: 375, height: 800 });
  const box = await d.locator('> div').boundingBox();
  expect(box && box.width <= 375).toBeTruthy();
});
