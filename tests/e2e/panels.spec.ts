import { test, expect, Page, Download } from '@playwright/test';
import JSZip from 'jszip';
import { Document as DocxDocument, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Side panels and app-level dialogs: sidebar rail + document list, export /
 * backup, comments, track changes, history, spell check, outline, image
 * toolbar + gallery, stats, settings, find & replace, import and toasts.
 */

const editorReady = async (page: Page) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__penkoEditor, null, { timeout: 20000 });
};
const html = (page: Page): Promise<string> => page.evaluate(() => window.__penkoEditor.getHTML());
const text = (page: Page): Promise<string> => page.evaluate(() => window.__penkoEditor.getText());
const setDoc = async (page: Page, h: string) => {
  await page.evaluate(h => window.__penkoEditor.commands.setContent(h, { emitUpdate: true }), h);
  await page.waitForTimeout(50);
};
const newDoc = async (page: Page) => {
  const before = await page.evaluate(() => window.__penkoEditor);
  await page.getByTitle('New', { exact: true }).click();
  await page.waitForFunction(prev => window.__penkoEditor && window.__penkoEditor !== prev, before);
};
/** Rows of the sidebar's document list. */
const docItems = (page: Page) => page.getByRole('list', { name: 'Documents' }).getByRole('listitem');
/** Type at the end of the document once the editor really has focus (Tiptap focuses on the next frame). */
const typeAtEnd = async (page: Page, s: string) => {
  await page.evaluate(() => window.__penkoEditor.commands.focus('end'));
  await page.waitForFunction(() => document.activeElement?.classList.contains('ProseMirror'));
  await page.keyboard.type(s);
};
const reviewTab = (page: Page) => page.locator('button[aria-pressed][aria-label="Review"]').first().click();
const viewTab = (page: Page) => page.locator('button[aria-pressed][aria-label="View"]').first().click();
const readDownload = async (d: Download) => fs.readFileSync((await d.path())!);
/** Visible toast with this text (the sr-only live region duplicates it). */
const toastText = (page: Page, re: RegExp) => page.locator('div.fixed.top-4.right-4 p', { hasText: re });
const fixture = (name: string) => path.join(HERE, '..', 'unit', 'fixtures', name);

test.beforeEach(async ({ page }) => {
  page.on('dialog', d => {
    throw new Error('native dialog shown: ' + d.message());
  });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  (page as any).__errors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as any).__errors, 'uncaught page errors').toEqual([]);
});

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

test.describe('sidebar', () => {
  test('rail buttons open their dialogs and toggle the theme', async ({ page }) => {
    await editorReady(page);
    const files = page.getByTitle('Files', { exact: true });
    await files.click();
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
    await files.click();
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeHidden();

    await page.getByTitle('Templates', { exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByTitle('Import', { exact: true }).click();
    await expect(page.locator('[aria-labelledby="import-dialog-title"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[aria-labelledby="import-dialog-title"]')).toHaveCount(0);

    await page.getByTitle('Collaborate', { exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByTitle('Settings', { exact: true }).click();
    await expect(page.locator('[aria-labelledby="settings-dialog-title"]')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('[aria-labelledby="settings-dialog-title"]')).toHaveCount(0);

    await page.getByTitle('Show Stats').click();
    await expect(page.locator('[aria-labelledby="stats-dialog-title"]')).toBeVisible();
    await page.keyboard.press('Escape');

    const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await page.getByTitle(dark ? 'Light Mode' : 'Dark Mode', { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(!dark);
    await page.getByTitle(!dark ? 'Light Mode' : 'Dark Mode', { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(dark);
  });

  test('document list: new, open, active highlight, delete with confirm', async ({ page }) => {
    await editorReady(page);
    await setDoc(page, '<p>Doc A body</p>');
    await page.evaluate(() => window.__penkoEditor.commands.focus());
    await newDoc(page);
    await setDoc(page, '<p>Doc B body</p>');
    await page.getByTitle('Files', { exact: true }).click();
    const items = docItems(page);
    const count = await items.count();
    expect(count).toBe(2);
    // Newest (current) first and highlighted
    await expect(items.first().locator('button[aria-current="true"]')).toHaveClass(/bg-blue-50|bg-white\/10/);
    await expect(items.locator('button[aria-current="true"]')).toHaveCount(1);
    // Open the other document
    await items.nth(1).locator('button').first().click();
    await page.waitForFunction(() => window.__penkoEditor?.getText().includes('Doc A body'));
    // Delete the open document: first click asks for confirmation, cancel keeps it
    await page.getByTitle('Files', { exact: true }).click();
    const row = docItems(page).filter({ has: page.locator('[aria-current]') });
    await row.hover();
    await row.getByLabel('Remove from History').click();
    await row.getByTitle('Cancel').click();
    await expect(items).toHaveCount(count);
    await row.hover();
    await row.getByLabel('Remove from History').click();
    await row.getByTitle('Delete').click();
    await expect(items).toHaveCount(1);
    // deleting the open document opens the remaining one
    await page.waitForFunction(() => window.__penkoEditor?.getText().includes('Doc B body'));
    // deleting the last document leaves a fresh empty one
    await docItems(page).first().hover();
    await docItems(page).first().getByLabel('Remove from History').click();
    await docItems(page).first().getByTitle('Delete').click();
    await expect(items).toHaveCount(1);
    await page.waitForFunction(() => window.__penkoEditor && window.__penkoEditor.getText() === '');
  });

  test('every export format downloads a valid file', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await setDoc(page, '<h1>Export Title</h1><p>Hello <strong>world</strong></p><ul><li><p>item</p></li></ul>');
    await page.getByTitle('Files', { exact: true }).click();
    const exportBtn = page.getByRole('button', { name: /export document/i });
    const grab = async (label: RegExp) => {
      if ((await exportBtn.getAttribute('aria-expanded')) !== 'true') await exportBtn.click();
      const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: label }).click()]);
      return { name: d.suggestedFilename(), buf: await readDownload(d) };
    };

    const doc = await grab(/\.DOC \(Word/);
    expect(doc.name).toMatch(/\.doc$/);
    expect(doc.buf.toString('utf8')).toMatch(/<html[\s\S]*Export Title[\s\S]*<strong>world<\/strong>/);

    const docx = await grab(/\.DOCX/);
    expect(docx.name).toMatch(/\.docx$/);
    expect(docx.buf.subarray(0, 2).toString()).toBe('PK');
    const xml = await (await JSZip.loadAsync(docx.buf)).file('word/document.xml')!.async('string');
    expect(xml).toContain('Export Title');

    const pdf = await grab(/\.PDF/);
    expect(pdf.name).toMatch(/\.pdf$/);
    expect(pdf.buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.buf.length).toBeGreaterThan(1000);

    const htmlFile = await grab(/\.HTML/);
    expect(htmlFile.name).toMatch(/\.html$/);
    expect(htmlFile.buf.toString('utf8')).toMatch(/^<!DOCTYPE html>[\s\S]*<h1[^>]*>Export Title<\/h1>/i);

    const txt = await grab(/\.TXT/);
    expect(txt.name).toMatch(/\.txt$/);
    expect(txt.buf.toString('utf8')).toContain('Export Title');
    expect(txt.buf.toString('utf8')).toContain('Hello world');

    const md = await grab(/\.MD/);
    expect(md.name).toMatch(/\.md$/);
    expect(md.buf.toString('utf8')).toMatch(/# Export Title[\s\S]*\*\*world\*\*[\s\S]*-\s+item/);
  });

  test('backup ZIP round-trips through Import Archive', async ({ page }) => {
    await editorReady(page);
    await setDoc(page, '<p>Backup one</p>');
    await newDoc(page);
    await setDoc(page, '<p>Backup two</p>');
    await page.getByTitle('Files', { exact: true }).click();
    await page.getByRole('button', { name: /export document/i }).click();
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /export all as zip/i }).click()]);
    const buf = await readDownload(d);
    expect(buf.subarray(0, 2).toString()).toBe('PK');
    const zip = await JSZip.loadAsync(buf);
    const jsons = Object.keys(zip.files).filter(n => n.endsWith('.json') && !n.endsWith('metadata.json'));
    const all = (await Promise.all(jsons.map(n => zip.file(n)!.async('string')))).join('\n');
    expect(all).toContain('Backup one');
    expect(all).toContain('Backup two');
    await expect(toastText(page, /exported \d+ document/i)).toBeVisible();

    const items = docItems(page);
    const before = await items.count();
    await page.locator('input[type=file][accept=".zip"]').setInputFiles({ name: 'backup.zip', mimeType: 'application/zip', buffer: buf });
    await expect(toastText(page, /restored \d+ document/i)).toBeVisible();
    await page.getByTitle('Files', { exact: true }).click();
    await expect(items).toHaveCount(before + jsons.length);

    // An invalid archive shows an error toast
    await page.locator('input[type=file][accept=".zip"]').setInputFiles({ name: 'bad.zip', mimeType: 'application/zip', buffer: Buffer.from('nope') });
    await expect(page.locator('[role="alert"] p').last()).toHaveText(/.+/);
  });
});

/* ------------------------------------------------------------------ */
/* Comments                                                            */
/* ------------------------------------------------------------------ */

test.describe('comments panel', () => {
  const startComment = async (page: Page, from: number, to: number) => {
    await page.evaluate(([f, t]) => window.__penkoEditor.chain().focus().setTextSelection({ from: f, to: t }).run(), [from, to]);
    // the open panel covers the ribbon: use its own "New Comment" button then
    const inPanel = page.locator('[aria-labelledby="comments-panel-title"]').getByTitle('New Comment');
    if (await inPanel.count()) await inPanel.click();
    else await page.getByTitle('New Comment').first().click();
  };

  test('compose (Esc cancels, Ctrl+Enter posts), reply, resolve, reopen, delete', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await setDoc(page, '<p>First sentence here. Second sentence there.</p>');
    await reviewTab(page);

    // Esc in the composer cancels and removes the pending highlight
    await startComment(page, 1, 6);
    const composer = page.getByPlaceholder('Write a comment...');
    await expect(composer).toBeFocused();
    await expect(page.locator('.ProseMirror .comment-highlight')).toHaveCount(1);
    await composer.press('Escape');
    await expect(composer).toHaveCount(0);
    await expect(page.locator('.ProseMirror .comment-highlight')).toHaveCount(0);
    // the panel stays open (Esc was consumed by the composer)
    await expect(page.locator('#comments-panel-title')).toBeVisible();

    // Ctrl+Enter posts
    await startComment(page, 1, 6);
    await page.getByPlaceholder('Write a comment...').fill('Check this');
    await page.getByPlaceholder('Write a comment...').press('Control+Enter');
    await expect(page.locator('#comments-panel-title')).toHaveText('Comments (1)');
    const card = page.locator('[data-panel-comment]').first();
    await expect(card).toContainText('Check this');

    // Reply with Ctrl+Enter
    await card.getByRole('button', { name: 'Reply' }).click();
    const reply = page.getByPlaceholder('Write a reply...');
    await reply.fill('Agreed');
    await reply.press('Control+Enter');
    await expect(card).toContainText('Agreed');
    // Esc on an open reply box closes only the box
    await card.getByRole('button', { name: 'Reply' }).click();
    await page.getByPlaceholder('Write a reply...').press('Escape');
    await expect(page.getByPlaceholder('Write a reply...')).toHaveCount(0);
    await expect(page.locator('#comments-panel-title')).toBeVisible();

    // Clicking the card selects the commented text
    await card.click();
    expect(await page.evaluate(() => { const { from, to } = window.__penkoEditor.state.selection; return [from, to]; })).toEqual([1, 6]);

    // Resolve → moves to the Resolved section; highlight dimmed
    await card.getByLabel('Resolve comment').click();
    await expect(page.locator('#comments-panel-title')).toHaveText('Comments (0)');
    await expect(page.locator('style[data-penko-resolved-comments]')).toHaveCount(1);
    await page.getByRole('button', { name: /Resolved \(1\)/ }).click();
    await page.getByRole('button', { name: 'Reopen' }).click();
    await expect(page.locator('#comments-panel-title')).toHaveText('Comments (1)');
    await expect(page.locator('style[data-penko-resolved-comments]')).toHaveCount(0);

    // Delete asks first; Cancel keeps it
    await page.getByLabel('Delete comment').first().click();
    await page.locator('[data-panel-comment]').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('[data-panel-comment]')).toHaveCount(1);
    await page.getByLabel('Delete comment').first().click();
    await page.locator('[data-panel-comment]').getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('[data-panel-comment]')).toHaveCount(0);
    await expect(page.locator('.ProseMirror .comment-highlight')).toHaveCount(0);
    await expect(page.getByText('No comments yet')).toBeVisible();

    // Esc on the panel closes it
    await page.locator('#comments-panel-title').click();
    await page.getByLabel('Close comments panel').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#comments-panel-title')).toHaveCount(0);
  });

  test('clicking a highlight focuses its comment; deleted text shows as orphaned', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await setDoc(page, '<p>Alpha beta gamma</p><p>Delta epsilon</p>');
    await reviewTab(page);
    await startComment(page, 1, 6);
    await page.getByPlaceholder('Write a comment...').fill('On alpha');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await page.getByLabel('Close comments panel').click();
    await expect(page.locator('#comments-panel-title')).toHaveCount(0);

    await page.locator('.ProseMirror .comment-highlight').click();
    await expect(page.locator('#comments-panel-title')).toBeVisible();
    await expect(page.locator('[data-panel-comment]').first()).toHaveClass(/ring-2/);

    // Delete the commented text → orphaned warning
    await page.evaluate(() => window.__penkoEditor.chain().setTextSelection({ from: 1, to: 7 }).deleteSelection().run());
    await expect(page.getByText('The commented text was deleted')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/* Track changes                                                       */
/* ------------------------------------------------------------------ */

test.describe('track changes panel', () => {
  test('toggle, filters, jump, accept/reject single and all', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await setDoc(page, '<p>The quick fox</p>');
    await reviewTab(page);
    await page.getByTitle('Track Changes', { exact: true }).click();
    const panel = page.locator('[data-track-changes-panel]');
    await expect(panel.getByText('Track Changes is disabled')).toBeVisible();
    await panel.getByRole('checkbox').check();
    await expect(page.locator('#tracking-box')).toBeChecked();
    await expect(panel.getByText('No pending changes')).toBeVisible();

    await typeAtEnd(page, ' jumps');
    await page.evaluate(() => window.__penkoEditor.commands.setTextSelection({ from: 5, to: 11 }));
    await page.keyboard.press('Backspace');
    const cards = panel.locator('[role="button"][aria-label]');
    await expect(cards).toHaveCount(2);
    await expect(page.locator('#track-changes-panel-title')).toHaveText('Track Changes (2)');

    await panel.getByRole('button', { name: 'Insertions' }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('jumps');
    await panel.getByRole('button', { name: 'Deletions' }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('quick');
    // Jump: clicking a change selects it in the document
    await cards.first().click();
    expect(await page.evaluate(() => { const s = window.__penkoEditor.state; return s.doc.textBetween(s.selection.from, s.selection.to); })).toBe('quick ');
    await panel.getByRole('button', { name: 'All', exact: true }).click();
    await expect(cards).toHaveCount(2);

    // Reject the deletion (text comes back), accept the insertion
    await panel.getByRole('button', { name: 'Deletions' }).click();
    await cards.first().getByLabel('Reject').click();
    await panel.getByRole('button', { name: 'All', exact: true }).click();
    await expect(cards).toHaveCount(1);
    await cards.first().getByLabel('Accept').click();
    await expect(cards).toHaveCount(0);
    expect(await text(page)).toBe('The quick fox jumps');
    expect(await html(page)).not.toMatch(/<ins|<del/);

    // Accept all / reject all
    await typeAtEnd(page, ' high');
    await expect(cards).toHaveCount(1);
    await panel.getByRole('button', { name: 'Reject All' }).click();
    await expect(cards).toHaveCount(0);
    expect(await text(page)).toBe('The quick fox jumps');
    await typeAtEnd(page, ' now');
    await panel.getByRole('button', { name: 'Accept All' }).click();
    await expect(cards).toHaveCount(0);
    expect(await text(page)).toBe('The quick fox jumps now');

    await panel.getByRole('checkbox').uncheck();
    await expect(page.locator('#tracking-box')).not.toBeChecked();
    await panel.getByLabel('Close track changes panel').click();
    await expect(panel).toHaveCount(0);
  });
});

/* ------------------------------------------------------------------ */
/* Version history                                                     */
/* ------------------------------------------------------------------ */

test.describe('version history', () => {
  const openHistory = async (page: Page) => {
    const files = page.getByTitle('Files', { exact: true });
    if ((await files.getAttribute('aria-pressed')) !== 'true') await files.click();
    await page.getByRole('button', { name: 'Version History' }).click();
    await expect(page.locator('#history-dialog-title')).toBeVisible();
  };

  test('empty state, compare, per-block merge and restore', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await openHistory(page);
    await expect(page.getByText('No history available for this document yet.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#history-dialog-title')).toHaveCount(0);

    // Snapshots are taken after 15 s idle: seed two directly (same module instance as the app)
    const ORIGINAL = '<p>Original paragraph number one here.</p><p>Second original paragraph stays.</p>';
    await page.evaluate(async original => {
      const id = localStorage.getItem('penko_writer_last_doc')!;
      const { saveSnapshot } = await import('/utils/history.ts' as string);
      await saveSnapshot({ id, title: 'Snap', content: original }, { force: true });
      await new Promise(r => setTimeout(r, 5));
      await saveSnapshot({ id, title: 'Snap', content: original.replace('stays', 'remains') }, { force: true });
    }, ORIGINAL);
    await setDoc(page, '<p>Edited paragraph number one, quite different now.</p><p>Second original paragraph stays.</p><p>Brand new third paragraph.</p>');

    await openHistory(page);
    const rows = page.locator('[aria-labelledby="history-dialog-title"] .group');
    await expect(rows).toHaveCount(2);
    // oldest snapshot is last
    await rows.last().hover();
    await rows.last().getByRole('button', { name: 'Preview' }).click();
    await expect(page.locator('#history-compare-title')).toBeVisible();
    await expect(page.getByText('Brand new third paragraph.').first()).toBeVisible();
    await page.getByRole('button', { name: /Side-by-Side/i }).click();
    await expect(page.getByText('Old Version')).toBeVisible();
    await page.getByRole('button', { name: /Unified/i }).first().click();

    // Esc goes back to the list, not closing the dialog
    await page.keyboard.press('Escape');
    await expect(page.locator('#history-dialog-title')).toBeVisible();
    await rows.last().hover();
    await rows.last().getByRole('button', { name: 'Preview' }).click();

    // Merge: take the snapshot's first paragraph, keep the new third paragraph
    await expect(page.getByRole('button', { name: 'Apply Selected Changes' })).toHaveCount(0);
    await page.getByLabel('Use the snapshot version of this block').first().click();
    await page.getByLabel('Keep the current version of this block').last().click();
    await page.getByRole('button', { name: 'Apply Selected Changes' }).click();
    await expect(page.locator('[aria-labelledby="history-compare-title"]')).toHaveCount(0);
    await page.waitForFunction(() => window.__penkoEditor?.getText().includes('Original paragraph number one'));
    expect(await text(page)).toContain('Brand new third paragraph.');
    expect(await text(page)).not.toContain('Edited paragraph');

    // Restore the oldest version completely
    await openHistory(page);
    await rows.last().hover();
    await rows.last().getByRole('button', { name: 'Preview' }).click();
    await page.getByRole('button', { name: 'Restore' }).click();
    await page.waitForFunction(() => !window.__penkoEditor?.getText().includes('Brand new'));
    expect(await text(page)).toContain('Original paragraph number one here.');
  });
});

/* ------------------------------------------------------------------ */
/* Spell & grammar (LanguageTool mocked)                               */
/* ------------------------------------------------------------------ */

test.describe('spell checker', () => {
  const ltMatch = (offset: number, length: number, replacement: string, message = 'Possible spelling mistake found.') => ({
    message,
    shortMessage: 'Spelling mistake',
    offset,
    length,
    replacements: [{ value: replacement }, { value: 'tech' }],
    rule: { id: 'MORFOLOGIK_RULE_EN_US', description: 'Possible spelling mistake', issueType: 'misspelling', category: { id: 'TYPOS', name: 'Possible Typo' } },
    context: { text: '...', offset: 0, length: 3 },
  });

  test('consent, fix at the right occurrence, ignore, counters, network errors', async ({ page }) => {
    let requests = 0;
    let mode: 'ok' | 'fail' = 'ok';
    // "teh cat. teh dog." — both "teh" are flagged; fixing the SECOND must not touch the first
    await page.route('**/v2/check', async route => {
      requests++;
      if (mode === 'fail') return route.abort('internetdisconnected');
      const sent = new URLSearchParams(route.request().postData() || '').get('text') || '';
      if (requests === 1) expect(sent).toBe('teh cat.\nteh dog.');
      const matches = [...sent.matchAll(/teh/g)].map(m => ltMatch(m.index!, 3, 'the'));
      await route.fulfill({ json: { matches } });
    });
    await editorReady(page);
    await newDoc(page);
    await setDoc(page, '<p>teh cat.</p><p>teh dog.</p>');
    await reviewTab(page);
    await page.getByTitle('Spell & Grammar', { exact: true }).click();
    // Nothing is sent before consent
    await expect(page.getByText('Check grammar online with LanguageTool?')).toBeVisible();
    expect(requests).toBe(0);
    await page.getByRole('button', { name: 'Check with LanguageTool' }).click();
    await expect(page.getByText('1 of 2 issues')).toBeVisible();
    expect(requests).toBe(1);

    await page.getByLabel('Next issue').click();
    await expect(page.getByText('2 of 2 issues')).toBeVisible();
    await page.getByRole('button', { name: 'the', exact: true }).click();
    expect(await text(page)).toBe('teh cat.\n\nthe dog.');
    await expect(page.getByText('1 of 1 issues')).toBeVisible();
    await page.getByRole('button', { name: 'Ignore' }).click();
    await expect(page.getByText('All issues reviewed!')).toBeVisible();
    await expect(page.getByText('1 fixed, 1 ignored')).toBeVisible();
    expect(await text(page)).toBe('teh cat.\n\nthe dog.');

    // Reopen: consent remembered, check runs immediately; network failure → error + retry
    await page.getByLabel('Close', { exact: true }).click();
    mode = 'fail';
    await page.getByTitle('Spell & Grammar', { exact: true }).click();
    await expect(page.locator('[aria-labelledby="spellcheck-title"] [role="alert"]').filter({ hasText: 'Could not reach the LanguageTool server' })).toBeVisible();
    mode = 'ok';
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText('1 of 1 issues')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#spellcheck-title')).toHaveCount(0);
  });

  test('HTTP errors and an empty replacement (duplicate word) are handled', async ({ page }) => {
    let status = 429;
    await page.route('**/v2/check', route =>
      status !== 200
        ? route.fulfill({ status, body: 'err' })
        : route.fulfill({ json: { matches: [{ ...ltMatch(4, 4, ''), replacements: [{ value: '' }] }] } }),
    );
    await editorReady(page);
    await page.evaluate(() => localStorage.setItem('penko_writer_languagetool_consent', 'https://api.languagetool.org'));
    await newDoc(page);
    await setDoc(page, '<p>the the end</p>');
    await reviewTab(page);
    await page.getByTitle('Spell & Grammar', { exact: true }).click();
    await expect(page.locator('[aria-labelledby="spellcheck-title"] [role="alert"]').filter({ hasText: 'too many requests' })).toBeVisible();
    status = 500;
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('[aria-labelledby="spellcheck-title"] [role="alert"]').filter({ hasText: 'HTTP 500' })).toBeVisible();
    status = 200;
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText('1 of 1 issues')).toBeVisible();
    await page.locator('[aria-labelledby="spellcheck-title"] button.bg-green-600').first().click();
    expect(await text(page)).toBe('the end');
  });
});

/* ------------------------------------------------------------------ */
/* Outline                                                             */
/* ------------------------------------------------------------------ */

test.describe('document outline', () => {
  test('lists headings live, jumps on click, collapses, reorders sections by drag', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await setDoc(page, '<h1>Alpha</h1><p>a text</p><h2>Alpha child</h2><p>c text</p><h1>Beta</h1><p>b text</p>');
    await viewTab(page);
    await page.locator('label', { hasText: 'Document Outline' }).locator('input').check();
    const panel = page.locator('[data-outline-panel]');
    const items = panel.locator('[role="button"][aria-level]');
    await expect(items).toHaveText(['Alpha', 'Alpha child', 'Beta']);

    // live update
    await page.evaluate(() => window.__penkoEditor.chain().focus('end').insertContent('<h2>Gamma</h2>').run());
    await expect(items).toHaveText(['Alpha', 'Alpha child', 'Beta', 'Gamma']);

    // click → caret at the end of the heading
    await items.nth(2).click();
    expect(await page.evaluate(() => window.__penkoEditor.state.selection.$from.parent.textContent)).toBe('Beta');

    // collapse / expand
    await panel.getByLabel('Collapse section').first().click();
    await expect(items).toHaveText(['Alpha', 'Beta', 'Gamma']);
    await panel.getByLabel('Expand section').first().click();
    await expect(items).toHaveText(['Alpha', 'Alpha child', 'Beta', 'Gamma']);

    // drag "Beta" (with its content) before "Alpha"
    await panel.locator('[draggable="true"]').nth(2).dragTo(panel.locator('[draggable="true"]').nth(0), { targetPosition: { x: 20, y: 2 } });
    await expect(items).toHaveText(['Beta', 'Gamma', 'Alpha', 'Alpha child']);
    expect((await text(page)).split(/\n+/)).toEqual(['Beta', 'b text', 'Gamma', 'Alpha', 'a text', 'Alpha child', 'c text']);
    // one undo step restores the order
    await page.evaluate(() => window.__penkoEditor.commands.undo());
    await expect(items).toHaveText(['Alpha', 'Alpha child', 'Beta', 'Gamma']);

    // empty state and Esc
    await setDoc(page, '<p>no headings</p>');
    await expect(panel.getByText(/No headings found/)).toBeVisible();
    await panel.getByRole('button', { name: 'Close' }).focus();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
  });

  test('right-hand panels replace each other instead of stacking', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await setDoc(page, '<p>word one</p><h1>Head</h1>');
    await reviewTab(page);
    // a comment to click on later
    await page.evaluate(() => window.__penkoEditor.chain().focus().setTextSelection({ from: 1, to: 5 }).run());
    await page.getByTitle('New Comment').first().click();
    await page.getByPlaceholder('Write a comment...').fill('note');
    await page.getByPlaceholder('Write a comment...').press('Control+Enter');
    await page.getByLabel('Close comments panel').click();

    await page.getByTitle('Track Changes', { exact: true }).click();
    await expect(page.locator('[data-track-changes-panel]')).toBeVisible();
    // clicking a comment highlight opens the comments panel in its place
    await page.locator('.ProseMirror .comment-highlight').click();
    await expect(page.locator('#comments-panel-title')).toBeVisible();
    await expect(page.locator('[data-track-changes-panel]')).toHaveCount(0);

    // start a new comment, then open another panel (keyboard users can still reach the ribbon)
    await page.evaluate(() => window.__penkoEditor.chain().focus().setTextSelection({ from: 6, to: 9 }).run());
    await page.locator('[aria-labelledby="comments-panel-title"]').getByTitle('New Comment').click();
    await expect(page.locator('.ProseMirror .comment-highlight')).toHaveCount(2);
    await page.getByTitle('Track Changes', { exact: true }).evaluate((el: HTMLElement) => el.click());
    await expect(page.locator('[data-track-changes-panel]')).toBeVisible();
    await expect(page.locator('#comments-panel-title')).toHaveCount(0);
    // the unsaved comment's highlight is dropped, the saved one stays
    await expect(page.locator('.ProseMirror .comment-highlight')).toHaveCount(1);

    await page.locator('button[aria-pressed][aria-label="View"]').first().evaluate((el: HTMLElement) => el.click());
    await page.locator('label', { hasText: 'Document Outline' }).locator('input').evaluate((el: HTMLElement) => el.click());
    await expect(page.locator('[data-outline-panel]')).toBeVisible();
    await expect(page.locator('[data-track-changes-panel]')).toHaveCount(0);
  });
});

/* ------------------------------------------------------------------ */
/* Image toolbar & gallery                                             */
/* ------------------------------------------------------------------ */

test.describe('images', () => {
  const PNG = 'data:image/png;base64,' + fs.readFileSync(path.join(HERE, 'fixtures', 'test.png')).toString('base64');
  const imgAttr = (page: Page, name: string) =>
    page.evaluate(n => {
      let v: any = null;
      window.__penkoEditor.state.doc.descendants((node: any) => {
        if (node.type.name === 'image' && v === null) v = node.attrs[n] ?? '';
      });
      return v as string;
    }, name);

  test('toolbar: every button edits the image and positions itself', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await setDoc(page, `<p>Before</p><p><img src="${PNG}" alt="pic" style="width: 200px"></p><p>After</p>`);
    await page.locator('.ProseMirror img[src^="data:"]').click();
    const bar = page.getByRole('toolbar', { name: 'Image tools' });
    await expect(bar).toBeVisible();

    // toolbar sits next to the image
    const imgBox = (await page.locator('.ProseMirror img[src^="data:"]').boundingBox())!;
    let barBox = (await bar.boundingBox())!;
    expect(Math.abs(barBox.y + barBox.height - imgBox.y) < 20 || Math.abs(barBox.y - (imgBox.y + imgBox.height)) < 20).toBe(true);

    const b = (label: string) => bar.getByRole('button', { name: label, exact: true });
    await b('Float left with text wrap').click();
    expect(await imgAttr(page, 'style')).toMatch(/float: left/);
    await expect(b('Float left with text wrap')).toHaveAttribute('aria-pressed', 'true');
    await b('Float right with text wrap').click();
    expect(await imgAttr(page, 'style')).toMatch(/float: right/);
    await b('Centered').click();
    expect(await imgAttr(page, 'style')).toMatch(/display: block/);
    expect(await imgAttr(page, 'style')).not.toMatch(/float/);
    await b('Inline with text').click();
    expect(await imgAttr(page, 'style')).not.toMatch(/float|display/);

    await bar.getByRole('button', { name: 'Resize to 50%' }).click();
    expect(await imgAttr(page, 'style')).toMatch(/width: 50%/);
    await bar.getByRole('button', { name: 'Resize to 25%' }).click();
    expect(await imgAttr(page, 'style')).toMatch(/width: 25%/);
    await b('100%').click();
    expect(await imgAttr(page, 'style')).toMatch(/width: 100%/);
    await b('Rotate 90°').click();
    expect(await imgAttr(page, 'style')).toMatch(/rotate\(90deg\)/);
    await b('Rotate 90°').click();
    expect(await imgAttr(page, 'style')).toMatch(/rotate\(180deg\)/);

    for (const [menu, item, re] of [
      ['Effects', 'Grayscale', /filter: grayscale/],
      ['Effects', 'Sepia', /filter: sepia/],
      ['Effects', 'Brighter', /brightness\(150%\)/],
      ['Effects', 'Darker', /brightness\(50%\)/],
      ['Effects', 'No effect', /^(?![\s\S]*filter)/],
      ['Border', 'Thick border', /border: 6px/],
      ['Border', 'Medium border', /border: 3px/],
      ['Border', 'Thin border', /border: 1px/],
      ['Border', 'No border', /^(?![\s\S]*border)/],
      ['Shadow', 'Large shadow', /box-shadow: 0 8px/],
      ['Shadow', 'Medium shadow', /box-shadow: 0 4px/],
      ['Shadow', 'Small shadow', /box-shadow: 0 2px/],
      ['Shadow', 'No shadow', /^(?![\s\S]*box-shadow)/],
    ] as const) {
      await b(menu).click();
      await bar.getByRole('menuitem', { name: item }).click();
      expect(await imgAttr(page, 'style'), `${menu} → ${item}`).toMatch(re);
      await expect(bar.getByRole('menu')).toHaveCount(0);
    }
    // Esc closes an open menu but keeps the toolbar
    await b('Effects').click();
    await page.keyboard.press('Escape');
    await expect(bar.getByRole('menu')).toHaveCount(0);
    await expect(bar).toBeVisible();

    // alt text: Enter saves, Cancel discards (pause so it is its own undo step)
    await page.waitForTimeout(600);
    await b('Add alt text (accessibility)').click();
    await expect(bar.getByLabel('Add alt text (accessibility)', { exact: true }).last()).toHaveValue('pic');
    await page.locator('#image-alt-input').fill('A small test picture');
    await page.locator('#image-alt-input').press('Enter');
    expect(await imgAttr(page, 'alt')).toBe('A small test picture');
    await b('Add alt text (accessibility)').click();
    await page.locator('#image-alt-input').fill('discard me');
    await bar.getByRole('button', { name: 'Cancel' }).click();
    expect(await imgAttr(page, 'alt')).toBe('A small test picture');

    // undo reverts just the alt text
    await page.evaluate(() => window.__penkoEditor.commands.undo());
    expect(await imgAttr(page, 'alt')).toBe('pic');
    await page.evaluate(() => window.__penkoEditor.commands.redo());

    // repositions on scroll and zoom
    await page.locator('.ProseMirror img[src^="data:"]').click();
    await setDoc(page, `<p>x</p>`.repeat(60) + (await html(page)) + `<p>y</p>`.repeat(60));
    await page.locator('.ProseMirror img[src^="data:"]').scrollIntoViewIfNeeded();
    await page.locator('.ProseMirror img[src^="data:"]').click();
    const place = async () => {
      const i = (await page.locator('.ProseMirror img[src^="data:"]').boundingBox())!;
      const t = (await bar.boundingBox())!;
      const vw = page.viewportSize()!.width;
      return { dy: Math.min(Math.abs(t.y + t.height + 8 - i.y), Math.abs(t.y - i.y - i.height - 8)), dx: Math.abs(t.x - Math.max(8, Math.min(i.x, vw - t.width - 8))) };
    };
    expect((await place()).dy).toBeLessThan(4);
    await page.locator('#editor-scroll-container').evaluate(el => el.scrollBy(0, 120));
    await page.waitForTimeout(100);
    expect((await place()).dy).toBeLessThan(4);
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.waitForTimeout(400);
    const p2 = await place();
    expect(p2.dy).toBeLessThan(4);
    expect(p2.dx).toBeLessThan(4);

    // replace: picks a new file for the same image node
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), b('Replace Image').click()]);
    await chooser.setFiles({ name: 'new.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(HERE, 'fixtures', 'test.png')) });
    await expect.poll(() => imgAttr(page, 'alt')).toBe('A small test picture');
    expect(await imgAttr(page, 'src')).toMatch(/^data:image\/png;base64,/);

    // delete asks for confirmation
    await page.locator('.ProseMirror img[src^="data:"]').click();
    await b('Delete').click();
    await bar.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
    expect(await html(page)).toContain('<img');
    await b('Delete').click();
    await bar.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    expect(await html(page)).not.toContain('<img');
    await expect(bar).toHaveCount(0);
  });

  test('gallery lists images live, selects, filters and deletes with confirm', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await setDoc(page, `<p><img src="${PNG}" alt="first cat"></p><p>text</p><p><img src="${PNG}" alt="second dog" style="float: left"></p>`);
    await page.locator('.ProseMirror img[src^="data:"]').first().click();
    await page.getByRole('toolbar', { name: 'Image tools' }).getByRole('button', { name: 'Image Gallery' }).click();
    const gallery = page.locator('[data-image-gallery]');
    const cards = gallery.locator('[role="button"]');
    await expect(cards).toHaveCount(2);
    await expect(gallery).toContainText('Float left with text wrap');
    await expect(gallery.getByText(/\d+ × \d+/).first()).toBeVisible();
    await expect(gallery.getByText(/KB/).first()).toBeVisible();

    await gallery.getByPlaceholder('Search images by alt text...').fill('dog');
    await expect(cards).toHaveCount(1);
    await gallery.getByPlaceholder('Search images by alt text...').fill('zebra');
    await expect(gallery.getByText('No images found')).toBeVisible();
    await gallery.getByPlaceholder('Search images by alt text...').fill('');

    await cards.nth(1).click();
    expect(await page.evaluate(() => (window.__penkoEditor.state.selection as any).node?.attrs.alt)).toBe('second dog');

    // live: inserting an image updates the list
    await page.evaluate(src => window.__penkoEditor.chain().focus('end').setImage({ src, alt: 'third' }).run(), PNG);
    await expect(cards).toHaveCount(3);

    await cards.first().getByLabel('Delete').click();
    await cards.first().getByRole('button', { name: 'Cancel' }).click();
    await expect(cards).toHaveCount(3);
    await cards.first().getByLabel('Delete').click();
    await cards.first().getByRole('button', { name: 'Delete' }).click();
    await expect(cards).toHaveCount(2);
    expect(await html(page)).not.toContain('first cat');

    await gallery.getByLabel('Close').click();
    await expect(gallery).toHaveCount(0);
  });
});

/* ------------------------------------------------------------------ */
/* Stats & settings                                                    */
/* ------------------------------------------------------------------ */

test.describe('stats and settings', () => {
  test('statistics dialog shows live counts', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await setDoc(page, '<p>One two three. Four five!</p><p>Six</p>');
    await page.waitForTimeout(500);
    await viewTab(page);
    await page.getByTitle('Stats', { exact: true }).click();
    const dlg = page.locator('[aria-labelledby="stats-dialog-title"]');
    const value = (label: string) => dlg.locator('div.p-3', { hasText: label }).locator('.font-bold');
    await expect(value('Words')).toHaveText('6');
    await expect(value('Characters')).toHaveText('28');
    await expect(dlg.getByText('(no spaces: 24)')).toHaveCount(1);
    await expect(value('Paragraphs')).toHaveText('2');
    await expect(value('Sentences')).toHaveText('3');
    await expect(value('Reading Time')).toHaveText(/~1/);
    await dlg.getByRole('button', { name: 'Close' }).last().click();
    await expect(dlg).toHaveCount(0);
    // empty document
    await setDoc(page, '<p></p>');
    await page.waitForTimeout(500);
    await page.getByTitle('Stats', { exact: true }).click();
    await expect(value('Words')).toHaveText('0');
    await expect(value('Reading Time')).toHaveText(/~0/);
  });

  test('every setting takes effect and persists', async ({ page }) => {
    await editorReady(page);
    const open = async () => {
      await page.getByTitle('Settings', { exact: true }).click();
      await expect(page.locator('#settings-dialog-title')).toBeVisible();
    };
    await open();
    // display name → used as comment author
    await page.locator('#settings-display-name').fill('Ada Lovelace');
    await page.locator('#settings-display-name').press('Enter');
    // ruler + paste as plain text switches
    const ruler = page.getByRole('switch', { name: 'Show Ruler' });
    const plain = page.getByRole('switch', { name: 'Paste as Plain Text' });
    const rulerOn = (await ruler.getAttribute('aria-checked')) === 'true';
    await ruler.click();
    await expect(ruler).toHaveAttribute('aria-checked', String(!rulerOn));
    await plain.click();
    await expect(plain).toHaveAttribute('aria-checked', 'true');
    // grammar server: invalid URL rejected, valid one stored (consent is per server)
    await page.locator('#settings-lt-server').fill('ftp://nope');
    await page.locator('#settings-lt-server').press('Enter');
    await expect(toastText(page, /valid http\(s\) URL/)).toBeVisible();
    await page.locator('#settings-lt-server').fill('http://localhost:8010/lt/');
    // storage info + backup
    await expect(page.getByText(/used of .* available|not available in this browser/)).toBeVisible();
    const [backup] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Back up all documents' }).click()]);
    expect(backup.suggestedFilename()).toMatch(/^penko-writer-backup-.*\.zip$/);
    expect((await readDownload(backup)).subarray(0, 2).toString()).toBe('PK');
    // Esc closes (and commits the still-focused server field)
    await page.locator('#settings-lt-server').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings-dialog-title')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('penko_writer_languagetool_server'))).toBe('http://localhost:8010/lt');

    // effects
    await expect(page.locator('#editor-scroll-container > div.sticky')).toHaveCount(rulerOn ? 0 : 1);
    await newDoc(page);
    await page.evaluate(() => window.__penkoEditor.commands.focus());
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/html', '<p><strong>Bold</strong> <em>pasted</em></p>');
      dt.setData('text/plain', 'Bold pasted');
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      // Gecko ignores `clipboardData` in the constructor (the event gets an empty one): attach ours
      if (!ev.clipboardData?.types.length) Object.defineProperty(ev, 'clipboardData', { value: dt });
      window.__penkoEditor.view.dom.dispatchEvent(ev);
    });
    await expect.poll(() => text(page)).toContain('Bold pasted');
    expect(await html(page)).not.toContain('<strong>');
    await setDoc(page, '<p>Comment me</p>');
    await page.evaluate(() => window.__penkoEditor.chain().focus().setTextSelection({ from: 1, to: 8 }).run());
    await reviewTab(page);
    await page.getByTitle('New Comment').first().click();
    await page.getByPlaceholder('Write a comment...').fill('x');
    await page.getByPlaceholder('Write a comment...').press('Control+Enter');
    await expect(page.locator('[data-panel-comment]').first()).toContainText('Ada Lovelace');
    await page.getByLabel('Close comments panel').click();

    // language
    await open();
    await page.getByLabel('Interface Language').selectOption('es');
    await expect(page.locator('#settings-dialog-title')).not.toHaveText('Settings');
    await page.locator('#settings-dialog-title').click();
    await page.keyboard.press('Escape');

    // everything survives a reload
    await page.reload();
    await page.waitForFunction(() => !!window.__penkoEditor);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('es');
    await expect(page.getByTitle('Settings', { exact: true })).toHaveCount(0);
    await page.evaluate(() => localStorage.setItem('penko_writer_ui_lang', 'en-US'));
    await page.reload();
    await page.waitForFunction(() => !!window.__penkoEditor);
    await open();
    await expect(page.locator('#settings-display-name')).toHaveValue('Ada Lovelace');
    await expect(page.locator('[role="switch"]').nth(0)).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[role="switch"]').nth(1)).toHaveAttribute('aria-checked', String(!rulerOn));
    await expect(page.locator('#settings-lt-server')).toHaveValue('http://localhost:8010/lt');
  });

  test('a custom grammar server needs its own consent and receives the request', async ({ page }) => {
    let hits = 0;
    // not a browser-banned port (e.g. 9): Firefox refuses those before page.route can intercept
    await page.route('http://localhost:8010/lt/v2/check', route => {
      hits++;
      return route.fulfill({ json: { matches: [] } });
    });
    await editorReady(page);
    await page.evaluate(() => {
      localStorage.setItem('penko_writer_languagetool_consent', 'https://api.languagetool.org');
      localStorage.setItem('penko_writer_languagetool_server', 'http://localhost:8010/lt');
    });
    await setDoc(page, '<p>Fine text.</p>');
    await reviewTab(page);
    await page.getByTitle('Spell & Grammar', { exact: true }).click();
    await expect(page.getByText('Check grammar online with LanguageTool?')).toBeVisible();
    await expect(page.getByText(/localhost:8010\/lt/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Check with LanguageTool' }).click();
    await expect(page.getByText('No issues found! Your text looks good.')).toBeVisible();
    expect(hits).toBe(1);
    await page.keyboard.press('Escape');
    // revoke from settings → asked again
    await page.getByTitle('Settings', { exact: true }).click();
    await page.getByRole('button', { name: 'Revoke' }).click();
    await expect(page.getByText('You will be asked before any text is sent.')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTitle('Spell & Grammar', { exact: true }).click();
    await expect(page.getByText('Check grammar online with LanguageTool?')).toBeVisible();
    expect(hits).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* Find & replace                                                      */
/* ------------------------------------------------------------------ */

test.describe('find & replace', () => {
  test('all options, navigation, replace, regex groups, selection scope', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await setDoc(page, '<p>Cat cat category. cat</p><p>Dog cat</p>');
    await page.waitForTimeout(600);
    // opening with a selection prefills the search
    await page.evaluate(() => window.__penkoEditor.chain().focus().setTextSelection({ from: 1, to: 4 }).run());
    await page.keyboard.press('Control+f');
    const dlg = page.locator('[aria-labelledby="find-replace-title"]');
    const find = dlg.locator('#find-replace-find');
    await expect(find).toHaveValue('Cat');
    const matches = page.locator('.ProseMirror .search-match');
    const status = dlg.locator('#find-replace-status');
    await find.fill('cat');
    await expect(matches).toHaveCount(5);
    await dlg.getByLabel('Case Sensitive').check();
    await expect(matches).toHaveCount(4);
    await dlg.getByLabel('Whole Word').check();
    await expect(matches).toHaveCount(3);
    await dlg.getByLabel('Case Sensitive').uncheck();
    await expect(matches).toHaveCount(4);
    await dlg.getByLabel('Whole Word').uncheck();

    // navigation: Enter / Shift+Enter / buttons wrap around
    await expect(status).toHaveText(/of 5 matches/);
    const cur = async () => Number((await status.textContent())!.split(' ')[0]);
    const first = await cur();
    await find.press('Enter');
    expect(await cur()).toBe((first % 5) + 1);
    await find.press('Shift+Enter');
    expect(await cur()).toBe(first);
    await dlg.getByLabel('Next Match').click();
    expect(await cur()).toBe((first % 5) + 1);
    await dlg.getByLabel('Previous Match').click();
    expect(await cur()).toBe(first);
    await expect(page.locator('.ProseMirror .search-match-current')).toHaveCount(1);

    // regex: invalid shows an error; groups work in replacements
    await dlg.getByLabel('Use Regular Expression').check();
    await find.fill('(');
    await expect(dlg.getByText(/Invalid regular expression/).first()).toBeVisible();
    await expect(find).toHaveAttribute('aria-invalid', 'true');
    await find.fill('(D)og');
    await expect(matches).toHaveCount(1);
    await dlg.locator('#find-replace-replace').fill('$1ig');
    await dlg.getByRole('button', { name: 'Replace', exact: true }).click();
    expect(await text(page)).toContain('Dig cat');
    await dlg.getByLabel('Use Regular Expression').uncheck();

    // no matches
    await find.fill('zebra');
    await expect(dlg.getByText('No matches found').first()).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Replace All' })).toBeDisabled();

    // find in selection: only the second paragraph
    await page.evaluate(() => {
      const e = window.__penkoEditor;
      let start = 0;
      e.state.doc.forEach((n: any, off: number, i: number) => i === 1 && (start = off));
      e.commands.setTextSelection({ from: start + 1, to: e.state.doc.content.size - 1 });
    });
    await find.fill('cat');
    await dlg.getByLabel('Find in Selection').check();
    await expect(matches).toHaveCount(1);
    await dlg.locator('#find-replace-replace').fill('kitten');
    await dlg.getByRole('button', { name: 'Replace All' }).click();
    expect(await text(page)).toBe('Cat cat category. cat\n\nDig kitten');
    // the selection range follows the edit (it grew by 3 characters)
    await find.fill('kitten');
    await expect(matches).toHaveCount(1);
    await find.fill('cat');
    await expect(matches).toHaveCount(0);
    await dlg.getByLabel('Find in Selection').uncheck();

    // replace current: one at a time
    await expect(matches).toHaveCount(4);
    await dlg.locator('#find-replace-replace').fill('dog');
    await dlg.getByRole('button', { name: 'Replace', exact: true }).click();
    await expect(matches).toHaveCount(3);

    // Esc closes and removes highlights
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(matches).toHaveCount(0);
    // reopen: search kept, highlights come back
    await page.keyboard.press('Control+f');
    await expect(find).toHaveValue('cat');
    await expect(matches).toHaveCount(3);
    await dlg.getByLabel('Close').click();
    await expect(matches).toHaveCount(0);
  });
});

/* ------------------------------------------------------------------ */
/* Import dialog                                                       */
/* ------------------------------------------------------------------ */

test.describe('import dialog', () => {
  const dialog = (page: Page) => page.locator('[aria-labelledby="import-dialog-title"]');
  const importFile = async (page: Page, file: { name: string; mimeType: string; buffer: Buffer }) => {
    const before = await page.evaluate(() => window.__penkoEditor);
    await page.getByTitle('Import', { exact: true }).click();
    await dialog(page).locator('input[type=file]').setInputFiles(file);
    await page.waitForFunction(prev => window.__penkoEditor && window.__penkoEditor !== prev, before, { timeout: 15000 });
    await expect(dialog(page)).toHaveCount(0);
    await page.waitForFunction(() => !!window.__penkoEditor?.getText().trim());
    return text(page);
  };

  test('imports every supported format', async ({ page }) => {
    const docx = await Packer.toBuffer(
      new DocxDocument({
        sections: [{ children: [new Paragraph({ text: 'Docx Heading', heading: HeadingLevel.HEADING_1 }), new Paragraph({ children: [new TextRun({ text: 'bold run', bold: true })] })] }],
      }),
    );
    await editorReady(page);
    expect(await importFile(page, { name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# MD Title\n\nSome **bold** text\n\n- one\n- two\n') })).toContain('MD Title');
    expect(await html(page)).toMatch(/<h1[^>]*>MD Title<\/h1>[\s\S]*<strong>bold<\/strong>[\s\S]*<li>/);
    expect(await importFile(page, { name: 'page.html', mimeType: 'text/html', buffer: Buffer.from('<h2>HTML Head</h2><p>para <em>em</em></p>') })).toContain('HTML Head');
    expect(await html(page)).toContain('<em>em</em>');
    expect(await importFile(page, { name: 'plain.txt', mimeType: 'text/plain', buffer: Buffer.from('Line one\n\nLine <two> & more') })).toContain('Line <two> & more');
    expect(await importFile(page, { name: 'word.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx })).toContain('Docx Heading');
    expect(await html(page)).toContain('<strong>bold run</strong>');
    expect(await importFile(page, { name: 'legacy.doc', mimeType: 'application/msword', buffer: fs.readFileSync(fixture('legacy-word97.doc')) })).toContain('Legacy Title');
    // .doc import warns that formatting was dropped
    await expect(page.locator('div.fixed.top-4.right-4 [class*="yellow"]').first()).toBeVisible();
    expect(await importFile(page, { name: 'sample.rtf', mimeType: 'application/rtf', buffer: fs.readFileSync(fixture('sample.rtf')) })).toContain('café € naïve');
    expect((await importFile(page, { name: 'sample.odt', mimeType: 'application/vnd.oasis.opendocument.text', buffer: fs.readFileSync(fixture('sample.odt')) })).trim().length).toBeGreaterThan(0);
    // each import created its own document, titled after the file
    await page.getByTitle('Files', { exact: true }).click();
    for (const title of ['notes', 'page', 'plain', 'word', 'legacy', 'sample']) await expect(docItems(page).filter({ hasText: title }).first()).toBeVisible();
  });

  test('errors, try again, cancel before the auto-open and reopen state', async ({ page }) => {
    await editorReady(page);
    const docCount = () => page.evaluate(async () => {
      const req = indexedDB.open('penko-writer-docs');
      const db: IDBDatabase = await new Promise(res => (req.onsuccess = () => res(req.result)));
      return new Promise<number>(res => {
        const r = db.transaction('docs', 'readonly').objectStore('docs').count();
        r.onsuccess = () => res(r.result);
      });
    });
    await page.waitForTimeout(600);
    const before = await docCount();
    await page.getByTitle('Import', { exact: true }).click();
    const dlg = dialog(page);
    const input = dlg.locator('input[type=file]');

    await input.setInputFiles({ name: 'data.xyz', mimeType: 'application/octet-stream', buffer: Buffer.from('x') });
    await expect(dlg.getByText('Import Failed')).toBeVisible();
    await expect(dlg.getByText(/\.xyz/)).toBeVisible();
    await dlg.getByRole('button', { name: 'Try Again' }).click();
    await expect(dlg.getByText('Supported Formats', { exact: false })).toBeVisible();

    await input.setInputFiles({ name: 'broken.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('not a zip at all') });
    await expect(dlg.getByText('Import Failed')).toBeVisible();
    // Enter on the focused "Try again" button retries (does not open the file picker)
    await dlg.getByRole('button', { name: 'Try Again' }).focus();
    await page.keyboard.press('Enter');
    await expect(dlg.getByText('Import Failed')).toHaveCount(0);

    // success, then close before it opens → nothing imported
    await input.setInputFiles({ name: 'later.txt', mimeType: 'text/plain', buffer: Buffer.from('should not open') });
    await expect(dlg.getByText('Import Successful!')).toBeVisible();
    await dlg.getByLabel('Close').click();
    await page.waitForTimeout(1500);
    expect(await docCount()).toBe(before);
    expect(await text(page)).not.toContain('should not open');

    // reopening starts fresh
    await page.getByTitle('Import', { exact: true }).click();
    await expect(dlg.getByText('Import Successful!')).toHaveCount(0);
    await expect(dlg.getByText(/Drag (&|and) drop/i).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
  });
});

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

test.describe('toasts', () => {
  test('stack, close on click and auto-dismiss', async ({ page }) => {
    await editorReady(page);
    const toasts = page.locator('div.fixed.top-4.right-4 > div > div');
    // three different toasts stack (Save Now ×1, select-to-comment info, invalid server error)
    await page.keyboard.press('Control+s');
    await reviewTab(page);
    await page.evaluate(() => window.__penkoEditor.commands.setTextSelection(1));
    await page.getByTitle('New Comment').first().click();
    await expect(toasts).toHaveCount(2);
    await expect(toasts.nth(0)).toContainText('Document saved!');
    await expect(toasts.nth(1)).toContainText(/select/i);
    // screen readers get them through live regions
    await expect(page.getByRole('status').filter({ hasText: 'Document saved!' })).toHaveCount(1);
    // close button removes just that toast
    await toasts.nth(0).getByLabel('Close notification').click();
    await expect(toasts).toHaveCount(1);
    await expect(toasts.first()).toContainText(/select/i);
    // auto-dismiss after ~3 s
    await expect(toasts).toHaveCount(0, { timeout: 5000 });
  });

  test('repeated identical messages do not pile up; the stack is capped', async ({ page }) => {
    await editorReady(page);
    const toasts = page.locator('div.fixed.top-4.right-4 > div > div');
    await reviewTab(page);
    await page.evaluate(() => window.__penkoEditor.commands.setTextSelection(1));
    for (let i = 0; i < 4; i++) await page.getByTitle('New Comment').first().click();
    await expect(toasts).toHaveCount(1);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(30);
    }
    const n = await toasts.count();
    expect(n).toBeLessThanOrEqual(5);
  });
});

/* ------------------------------------------------------------------ */
/* Switching documents with panels open                                */
/* ------------------------------------------------------------------ */

test('panels follow the document when switching documents', async ({ page }) => {
  // the one document in the list that is not the open one
  const otherDoc = (p: Page) => docItems(p).filter({ hasNot: p.locator('[aria-current]') }).first().locator('button').first().click();
  await editorReady(page);
  await setDoc(page, '<h1>Doc A heading</h1><p>alpha</p>');
  await reviewTab(page);
  await page.evaluate(() => window.__penkoEditor.chain().focus().setTextSelection({ from: 15, to: 20 }).run());
  await page.getByTitle('New Comment').first().click();
  await page.getByPlaceholder('Write a comment...').fill('A note');
  await page.getByPlaceholder('Write a comment...').press('Control+Enter');
  await page.getByLabel('Close comments panel').click();
  await newDoc(page);
  await setDoc(page, '<h2>Doc B heading</h2><p>beta</p>');
  await page.waitForTimeout(500);

  // comments panel shows the current document's comments; a half-written comment is dropped
  await page.getByTitle('Files', { exact: true }).click();
  await otherDoc(page);
  await page.waitForFunction(() => window.__penkoEditor?.getText().includes('alpha'));
  await page.getByTitle('Show Comments').click();
  await expect(page.locator('[data-panel-comment]')).toHaveCount(1);
  await page.evaluate(() => window.__penkoEditor.chain().focus().setTextSelection({ from: 1, to: 4 }).run());
  await page.locator('[aria-labelledby="comments-panel-title"]').getByTitle('New Comment').click();
  await expect(page.getByPlaceholder('Write a comment...')).toBeVisible();
  await page.getByTitle('Files', { exact: true }).click();
  await otherDoc(page);
  await page.waitForFunction(() => window.__penkoEditor?.getText().includes('beta'));
  await expect(page.locator('[data-panel-comment]')).toHaveCount(0);
  await expect(page.getByPlaceholder('Write a comment...')).toHaveCount(0);
  await expect(page.getByText('No comments yet')).toBeVisible();
  await page.getByLabel('Close comments panel').click();

  // outline follows too
  await viewTab(page);
  await page.locator('label', { hasText: 'Document Outline' }).locator('input').check();
  const items = page.locator('[data-outline-panel] [role="button"][aria-level]');
  await expect(items).toHaveText(['Doc B heading']);
  await page.getByTitle('Files', { exact: true }).click();
  await otherDoc(page);
  await expect(items).toHaveText(['Doc A heading']);

  // find & replace searches the newly opened document
  await page.keyboard.press('Control+f');
  await page.locator('#find-replace-find').fill('heading');
  await expect(page.locator('.ProseMirror .search-match')).toHaveCount(1);
  await page.getByTitle('Files', { exact: true }).click();
  await otherDoc(page);
  await page.waitForFunction(() => window.__penkoEditor?.getText().includes('beta'));
  await expect(page.locator('.ProseMirror .search-match')).toHaveCount(1);
  await expect(page.locator('.ProseMirror .search-match')).toHaveText('heading');
});

test('a dialog whose code fails to load does not break the app', async ({ page }) => {
  page.on('console', () => {}); // the failed load is logged
  await editorReady(page);
  await page.route(/components\/StatsDialog\.tsx/, route => route.abort());
  await viewTab(page);
  await page.getByTitle('Stats', { exact: true }).click();
  await page.waitForTimeout(800);
  await expect(page.locator('[aria-labelledby="stats-dialog-title"]')).toHaveCount(0);
  // the app still works
  await setDoc(page, '<p>still alive</p>');
  expect(await text(page)).toBe('still alive');
  // the open flag was reset, so other dialogs and a second attempt still work
  await page.getByTitle('Stats', { exact: true }).click();
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+f');
  await expect(page.locator('[aria-labelledby="find-replace-title"]')).toBeVisible();
});

test('install prompt: floating button, dialog, Esc / Not now / Install', async ({ page }) => {
  await editorReady(page);
  const offer = (outcome: 'accepted' | 'dismissed') =>
    page.evaluate(o => {
      const e: any = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = async () => {};
      e.userChoice = Promise.resolve({ outcome: o });
      window.dispatchEvent(e);
    }, outcome);
  await offer('dismissed');
  const fab = page.getByRole('button', { name: 'Install App' });
  await expect(fab).toBeVisible();
  const dlg = page.getByRole('dialog', { name: 'Install Penko Writer' });
  await fab.click();
  await expect(dlg).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await fab.click();
  await dlg.getByRole('button', { name: 'Not Now' }).click();
  await expect(dlg).toHaveCount(0);
  await fab.click();
  await dlg.getByRole('button', { name: 'Install Now' }).click();
  // dismissed in the browser prompt → the dialog and the button go away
  await expect(dlg).toHaveCount(0, { timeout: 3000 });
  await expect(fab).toHaveCount(0);

  await offer('accepted');
  await fab.click();
  await dlg.getByRole('button', { name: 'Install Now' }).click();
  await expect(dlg.getByText(/home screen|installed/i).first()).toBeVisible();
  await expect(dlg).toHaveCount(0, { timeout: 4000 });
});
