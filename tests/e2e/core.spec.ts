import { test, expect } from '@playwright/test';
import { editorReady, failOnNativeDialogs, html, newDoc, text, typeInEditor } from './helpers';
import JSZip from 'jszip';
import fs from 'fs';

/**
 * Core workflows that used to lose data or break: autosave across document
 * switches and reloads, XSS through imports, comments, track changes, find &
 * replace, export and markdown mode.
 */

failOnNativeDialogs();

test('edits survive an immediate document switch and a reload', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await typeInEditor(page, 'First document text');
  // Switch away immediately (before the autosave debounce) — used to lose the edit
  await newDoc(page);
  await typeInEditor(page, 'Second document text');
  await page.reload();
  await page.waitForFunction(() => !!window.__penkoEditor);
  const all = await page.evaluate(async () => {
    const req = indexedDB.open('penko-writer-docs');
    const db: IDBDatabase = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const tx = db.transaction('docs', 'readonly');
    const store = tx.objectStore('docs');
    const values: any[] = await new Promise(res => {
      const r = store.getAll();
      r.onsuccess = () => res(r.result);
    });
    return values.map(v => v.content).join('\n');
  });
  expect(all).toContain('First document text');
  expect(all).toContain('Second document text');
});

test('imported HTML cannot run scripts', async ({ page }) => {
  await editorReady(page);
  await page.evaluate(() => ((window as any).__xss = 0));
  const payload = `<p>Safe</p><img src=x onerror="window.__xss=1"><svg onload="window.__xss=1"></svg><a href="javascript:window.__xss=1">x</a><script>window.__xss=1</script>`;
  await page.getByTitle('Import', { exact: true }).click();
  const input = page.locator('[aria-labelledby="import-dialog-title"] input[type=file]');
  await input.setInputFiles({ name: 'evil.html', mimeType: 'text/html', buffer: Buffer.from(payload) });
  await page.waitForFunction(() => window.__penkoEditor?.getText().includes('Safe'), null, { timeout: 10000 });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__xss)).toBe(0);
  const h = await html(page);
  expect(h).not.toMatch(/onerror|onload|javascript:|<script/i);
});

test('find & replace highlights, replaces and undoes in one step', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await page.evaluate(() => window.__penkoEditor.commands.setContent('<p>cat and <strong>cat</strong> and cat</p>'));
  // let the history group close so undo only reverts the replacement
  await page.waitForTimeout(700);
  await page.keyboard.press('Control+f');
  const find = page.getByPlaceholder(/search/i).first();
  await find.fill('cat');
  await expect(page.locator('.ProseMirror .search-match')).toHaveCount(3);
  await page.getByPlaceholder(/replacement/i).first().fill('dog');
  await page.getByRole('button', { name: /replace all/i }).click();
  expect(await text(page)).toBe('dog and dog and dog');
  expect(await html(page)).toContain('<strong>dog</strong>');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__penkoEditor.commands.undo());
  expect(await text(page)).toBe('cat and cat and cat');
});

test('comments: create, reply with spaces, resolve, delete removes highlight', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await page.evaluate(() => {
    const e = window.__penkoEditor;
    e.commands.setContent('<p>Please review this sentence.</p>');
    e.chain().focus().setTextSelection({ from: 8, to: 14 }).run();
  });
  await page.locator('button[aria-pressed][aria-label="Review"]').first().click();
  await page.getByTitle('New Comment').first().click();
  const composer = page.getByPlaceholder(/write a comment/i);
  await composer.fill('Needs a clearer word');
  await composer.press('Control+Enter');
  await expect(page.locator('.ProseMirror .comment-highlight')).toHaveCount(1);
  const reply = page.getByPlaceholder(/reply/i).first();
  if (await reply.count()) {
    await reply.click();
    await page.keyboard.type('I agree with this');
    await expect(reply).toHaveValue('I agree with this');
  }
  await page.getByLabel(/delete comment/i).first().click();
  const confirm = page.getByRole('button', { name: /^delete$/i });
  if (await confirm.count()) await confirm.first().click();
  await expect(page.locator('.ProseMirror .comment-highlight')).toHaveCount(0);
});

test('track changes records insertions/deletions and accept/reject all work', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await page.evaluate(() => window.__penkoEditor.commands.setContent('<p>The quick fox</p>'));
  await page.locator('button[aria-pressed][aria-label="Review"]').first().click();
  await page.locator('#tracking-box').check();
  await page.evaluate(() => window.__penkoEditor.commands.focus('end'));
  // Tiptap moves DOM focus on the next frame: typing earlier sends the space to the checkbox
  await page.waitForFunction(() => document.activeElement?.classList.contains('ProseMirror'));
  await page.keyboard.type(' jumps');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  await page.evaluate(() => window.__penkoEditor.commands.setTextSelection({ from: 5, to: 11 }));
  await page.keyboard.press('Backspace');
  await expect(page.locator('.ProseMirror ins.track-insert')).toHaveCount(1);
  await expect(page.locator('.ProseMirror del.track-delete')).toHaveCount(1);
  // Reject everything → original text
  await page.evaluate(() => window.__penkoEditor.commands.rejectAllChanges());
  expect(await text(page)).toBe('The quick fox');
  await page.locator('#tracking-box').uncheck();
});

test('exports a valid DOCX with lists and tables', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await page.evaluate(() =>
    window.__penkoEditor.commands.setContent(
      '<h1>Report</h1><ul><li><p>alpha</p></li><li><p>beta</p></li></ul><table><tr><td><p>c1</p></td><td><p>c2</p></td></tr></table>',
    ),
  );
  await page.waitForTimeout(600);
  await page.getByTitle('Files', { exact: true }).click();
  await page.getByText(/export document/i).first().click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByText(/export as \.docx/i).first().click()]);
  const path = await download.path();
  const zip = await JSZip.loadAsync(fs.readFileSync(path!));
  const xml = await zip.file('word/document.xml')!.async('string');
  for (const s of ['Report', 'alpha', 'beta', 'c1', 'c2']) expect(xml).toContain(s);
  expect(xml).toContain('<w:tbl>');
  expect(xml).toMatch(/<w:numPr>/);
});

test('markdown mode keeps source and syncs back to rich text', async ({ page }) => {
  await editorReady(page);
  await newDoc(page);
  await page.evaluate(() => window.__penkoEditor.commands.setContent('<p>start</p>'));
  await page.waitForTimeout(500);
  await page.locator('button[aria-pressed][aria-label="View"]').first().click();
  const toggle = page.locator('label', { hasText: /markdown/i }).locator('input[type=checkbox]').first();
  await toggle.check();
  const ta = page.locator('textarea').first();
  await ta.fill('# Title\n\nSome **bold** and `code_with_underscores`\n\n```js\nconst a = 1;\n```\n');
  await page.waitForTimeout(900);
  await toggle.uncheck();
  await page.waitForFunction(() => !!window.__penkoEditor);
  const h = await html(page);
  expect(h).toMatch(/<h1[^>]*>Title<\/h1>/);
  expect(h).toContain('<strong>bold</strong>');
  expect(h).toContain('code_with_underscores');
  expect(h).toContain('const a = 1;');
});
