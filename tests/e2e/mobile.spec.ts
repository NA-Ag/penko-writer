import { test, expect, type Page } from '@playwright/test';
import { editorReady, failOnNativeDialogs, html, setDoc, typeInEditor } from './helpers';

/** Mobile layout (<768px): the real editor with the bottom formatting toolbar. */

failOnNativeDialogs();

test('mobile editing keeps rich documents intact', async ({ page }) => {
  await editorReady(page);

  // Template-like content with a wrapper div, a table and a heading
  const tpl =
    '<div style="border-top: 4px solid #2563eb"><h1>Plan</h1><table><tbody><tr><td><p>A</p></td><td><p>B</p></td></tr></tbody></table><p>Body text</p></div>';
  await page.evaluate(h => window.__penkoEditor.commands.setContent(h), tpl);

  // Page fits the viewport (no horizontal clipping)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  // Select "Body" and bold it from the mobile toolbar
  await page.evaluate(() => {
    const e = window.__penkoEditor;
    let pos = -1;
    e.state.doc.descendants((n: any, p: number) => {
      if (n.isText && n.text.startsWith('Body')) pos = p;
    });
    e.chain().focus().setTextSelection({ from: pos, to: pos + 4 }).run();
  });
  await page.getByRole('button', { name: 'Bold', exact: true }).first().click();
  const html: string = await page.evaluate(() => window.__penkoEditor.getHTML());
  expect(html).toContain('<strong>Body</strong>');
  expect(html).toContain('<table');
  expect(html).toMatch(/<h1[^>]*>Plan<\/h1>/);
  expect(html).toContain('border-top: 4px solid');

  // Typing markup characters stays text
  await page.evaluate(() => window.__penkoEditor.commands.focus('end'));
  await page.waitForFunction(() => document.activeElement?.classList.contains('ProseMirror'));
  await page.keyboard.type(' x<y & z');
  expect(await page.evaluate(() => window.__penkoEditor.getText())).toContain('x<y & z');

  // Documents drawer opens
  await page.getByRole('button', { name: 'Documents' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Documents' })).toBeVisible();
});

/** Horizontal overflow of the page (0 when nothing sticks out). */
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const selectWord = (page: Page, word: string) =>
  page.evaluate(w => {
    const e = window.__penkoEditor;
    let pos = -1;
    e.state.doc.descendants((n: any, p: number) => {
      if (pos < 0 && n.isText && n.text.includes(w)) pos = p + n.text.indexOf(w);
    });
    e.chain().focus().setTextSelection({ from: pos, to: pos + w.length }).run();
  }, word);

test('top bar: rename, subtitle and every menu item', async ({ page }) => {
  await editorReady(page);
  await setDoc(page, '<h1>Head</h1><p>one two</p><p>three</p>');
  await expect(page.getByText(/3 Paragraphs • 4 Words/i)).toBeVisible();

  const title = page.getByTitle('Rename document');
  await title.click();
  await page.getByLabel('Title', { exact: true }).fill('Phone doc');
  await page.keyboard.press('Enter');
  await expect(title).toHaveText('Phone doc');
  await title.click();
  await page.getByLabel('Title', { exact: true }).fill('Discarded');
  await page.keyboard.press('Escape');
  await expect(title).toHaveText('Phone doc');

  const menu = page.locator('button[aria-haspopup=menu]');
  const item = async (name: RegExp) => {
    await menu.click();
    await page.getByRole('menuitem', { name }).click();
  };
  // Dialog items: open, fit the phone screen, close with Escape
  for (const name of [/Documents/, /Find & Replace/, /Show Stats/, /Spell & Grammar/, /Version History/, /Settings/, /Templates/, /Import Document/, /Collaborate/]) {
    await item(name);
    await expect(page.locator('[role=dialog]').first(), String(name)).toBeVisible();
    expect(await overflow(page), String(name)).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('[role=dialog]'), String(name)).toHaveCount(0);
  }
  await item(/Focus Mode/);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await item(/Present/);
  await page.locator('[aria-roledescription=presentation]').getByRole('button', { name: 'Close' }).click();
  await item(/Dark Mode/);
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
  await item(/Light Mode/);
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false);
  const before = await page.evaluate(() => window.__penkoEditor);
  await item(/New document/);
  await page.waitForFunction(prev => window.__penkoEditor !== prev, before);
  await expect(title).not.toHaveText('Phone doc');
});

test('documents drawer: new, open, export, delete', async ({ page }) => {
  await editorReady(page);
  await setDoc(page, '<p>first doc</p>');
  const drawer = page.getByRole('dialog', { name: 'Documents' });
  const open = () => page.getByRole('button', { name: 'Documents' }).first().click();
  const rows = drawer.locator('button.flex-1.min-w-0');

  await open();
  const n = await rows.count();
  await drawer.getByRole('button', { name: 'New', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await open();
  await expect(rows).toHaveCount(n + 1);
  await rows.and(page.locator(':not([aria-current])')).first().click(); // the first document
  await expect.poll(() => html(page)).toContain('first doc');

  for (const [label, ext] of [[/DOCX/, 'docx'], [/HTML/, 'html'], [/TXT/, 'txt'], [/Markdown/, 'md']] as const) {
    await open();
    const download = page.waitForEvent('download');
    await drawer.getByRole('button', { name: label }).click();
    expect((await download).suggestedFilename()).toMatch(new RegExp(`\\.${ext}$`));
  }

  await open();
  await drawer.getByRole('button', { name: /^Delete: / }).first().click();
  await drawer.getByRole('button', { name: 'Cancel' }).click();
  await expect(rows).toHaveCount(n + 1);
  await drawer.getByRole('button', { name: /^Delete: / }).first().click();
  await drawer.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(rows).toHaveCount(n);
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
});

test('bottom toolbar and the "more" sheet', async ({ page }) => {
  await editorReady(page);
  await setDoc(page, '<p>hello world</p>');
  const tb = (name: string) => page.getByRole('button', { name, exact: true }).first().click();
  await selectWord(page, 'hello');
  await tb('Bold');
  await tb('Italic');
  await tb('Underline');
  expect(await html(page)).toMatch(/<u><strong><em>hello<\/em><\/strong><\/u>|<strong><em><u>hello/);
  await tb('Undo');
  expect(await html(page)).not.toContain('<u>');
  await tb('Redo');
  expect(await html(page)).toContain('<u>');
  // the editor keeps focus (keyboard stays open)
  expect(await page.evaluate(() => document.activeElement?.classList.contains('ProseMirror'))).toBe(true);
  await tb('Bullet List');
  expect(await html(page)).toContain('<ul');
  await expect(page.getByRole('button', { name: 'Bullet List', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
  await tb('Numbered List');
  expect(await html(page)).toContain('<ol');
  await expect(page.getByRole('button', { name: 'Numbered List', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
  await tb('Numbered List');
  expect(await html(page)).not.toContain('<ol');

  const sheet = page.getByRole('dialog', { name: 'More Tools' });
  const more = async () => {
    await page.getByRole('button', { name: 'More' }).last().click();
    await expect(sheet).toBeVisible();
  };
  await more();
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape'); // the editor has focus, the sheet still closes
  await expect(sheet).toHaveCount(0);
  for (const [label, re] of [['Heading 2', /<h2/], ['Normal', /^<p/], ['Center', /text-align: center/], ['Justify', /text-align: justify/]] as const) {
    await selectWord(page, 'hello');
    await more();
    await sheet.getByRole('button', { name: label, exact: true }).click();
    expect(await html(page), label).toMatch(re);
  }
  await selectWord(page, 'world');
  await more();
  await sheet.locator('.grid-cols-8').nth(0).locator('button').nth(3).click();
  expect(await html(page)).toMatch(/color:/);
  await selectWord(page, 'world');
  await more();
  await sheet.locator('.grid-cols-8').nth(1).locator('button').nth(3).click();
  expect(await html(page)).toMatch(/background-color|<mark/);
  await page.evaluate(() => window.__penkoEditor.commands.focus('end'));
  await more();
  await sheet.getByRole('button', { name: 'Table', exact: true }).click();
  expect(await html(page)).toContain('<table');
  await more();
  const chooser = page.waitForEvent('filechooser');
  await sheet.getByRole('button', { name: 'Image', exact: true }).click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await (await chooser).setFiles({ name: 'dot.png', mimeType: 'image/png', buffer: png });
  await expect.poll(() => html(page)).toContain('<img');
  await selectWord(page, 'world');
  await more();
  await sheet.getByRole('button', { name: 'Link', exact: true }).click();
  await expect(page.locator('[role=dialog]').first()).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

test('toolbar stays above the virtual keyboard', async ({ page }) => {
  await editorReady(page);
  const bar = page.getByRole('button', { name: 'Bold', exact: true }).first();
  const full = page.viewportSize()!.height;
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, 'height', { configurable: true, get: () => 400 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect.poll(async () => (await bar.boundingBox())!.y + 44).toBeLessThanOrEqual(401);
  await page.evaluate(() => {
    delete (window.visualViewport as any).height;
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect.poll(async () => (await bar.boundingBox())!.y).toBeGreaterThan(full - 100);
});

test('rotating across the layout breakpoint keeps the latest keystrokes', async ({ page }) => {
  await editorReady(page);
  await setDoc(page, '<p>hello</p>');
  await page.waitForTimeout(1200);
  await typeInEditor(page, ' typed just now');
  const { width, height } = page.viewportSize()!;
  await page.setViewportSize({ width: height, height: width }); // landscape: desktop layout
  await page.waitForFunction(() => !!window.__penkoEditor && !window.__penkoEditor.isDestroyed);
  await expect.poll(() => html(page)).toContain('typed just now');
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  await typeInEditor(page, ' and more');
  await page.setViewportSize({ width, height });
  await page.waitForFunction(() => !!window.__penkoEditor && !window.__penkoEditor.isDestroyed);
  await expect.poll(() => html(page)).toContain('typed just now and more');
});
