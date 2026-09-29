import { test, expect, Page } from '@playwright/test';

/**
 * Ribbon & insert-dialog regression suite: clicks through every ribbon tab
 * and checks the resulting document HTML. Runs serially on one page.
 */
test.describe.configure({ mode: 'serial' });

let page: Page;
const errors: string[] = [];
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('dialog', d => {
    errors.push('NATIVE DIALOG: ' + d.message());
    void d.dismiss();
  });
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__penkoEditor, null, { timeout: 20000 });
  page.setDefaultTimeout(8000);
  await page.waitForTimeout(800);
});
test.afterAll(async () => {
  expect(errors, errors.join('\n')).toEqual([]);
  await page.close();
});
test.afterEach(async () => {
  await page.keyboard.press('Escape').catch(() => {});
});

const assert = (c: unknown, m: string) => {
  if (!c) throw new Error(m);
};
const html = (): Promise<string> => page.evaluate(() => (window as any).__penkoEditor.getHTML());
const setDoc = async (h: string) => {
  await page.evaluate(h => {
    const e = (window as any).__penkoEditor;
    e.commands.setContent(h);
    e.commands.focus();
  }, h);
  await page.waitForTimeout(80);
};
const select = async (from: number, to: number) => {
  await page.evaluate(([f, t]) => (window as any).__penkoEditor.chain().focus().setTextSelection({ from: f, to: t }).run(), [from, to]);
  await page.waitForTimeout(80);
};
const selectAll = async () => {
  await page.evaluate(() => {
    const e = (window as any).__penkoEditor;
    e.chain().focus().setTextSelection({ from: 1, to: e.state.doc.content.size - 1 }).run();
  });
  await page.waitForTimeout(80);
};
const tab = async (label: string) => {
  const b = page.locator(`button[aria-pressed][aria-label="${label}"]`).first();
  if ((await b.getAttribute('aria-pressed')) === 'true') return;
  await b.click();
  await page.waitForTimeout(100);
};
const btn = (title: string) => page.locator(`button[title="${title}"]`).first();
const click = async (title: string) => {
  await btn(title).click();
  await page.waitForTimeout(120);
};

// ---------------- HOME ----------------
test('open Home tab (#1)', async () => {
  await tab('Home');
});
test('bold/italic/underline/strike', async () => {
  await setDoc('<p>Hello world</p>'); await selectAll();
  await click('Bold (Ctrl+B)'); await click('Italic (Ctrl+I)'); await click('Underline (Ctrl+U)'); await click('Strikethrough (Ctrl+Shift+S)');
  const h = await html(); assert(/<strong>/.test(h) && /<em>/.test(h) && /<u>/.test(h) && /<s>/.test(h), h);
  assert(await btn('Bold (Ctrl+B)').getAttribute('aria-pressed') === 'true', 'bold not pressed');
});
test('sub/superscript', async () => {
  await setDoc('<p>H2O</p>'); await select(2, 3); await click('Subscript'); let h = await html(); assert(/<sub>2<\/sub>/.test(h), h);
  await setDoc('<p>x2</p>'); await select(2, 3); await click('Superscript'); h = await html(); assert(/<sup>2<\/sup>/.test(h), h);
});
test('font family/size/grow/shrink', async () => {
  await setDoc('<p>Hello world</p>'); await selectAll();
  await page.selectOption('select[aria-label="Font"]', 'Roboto'); await page.waitForTimeout(100);
  await page.selectOption('select[aria-label="Font size"]', '14'); await page.waitForTimeout(100);
  let h = await html(); assert(/font-family: Roboto/.test(h) && /font-size: 14pt/.test(h), h);
  await click('Increase Size'); h = await html(); assert(/font-size: 15pt/.test(h), 'grow ' + h);
  await click('Decrease Size'); await click('Decrease Size'); h = await html(); assert(/font-size: 13pt/.test(h), 'shrink ' + h);
  assert(await page.inputValue('select[aria-label="Font"]') === 'Roboto', 'font select not showing Roboto');
});
test('font select shows unknown font / size 10.5', async () => {
  await setDoc('<p><span style="font-family: Calibri; font-size: 10.5pt">Calib</span></p>'); await select(2, 3);
  await page.waitForTimeout(150);
  const f = await page.inputValue('select[aria-label="Font"]'); const s = await page.inputValue('select[aria-label="Font size"]');
  assert(f === 'Calibri' && s === '10.5', `font=${f} size=${s}`); return `${f} ${s}`;
});
test('change case', async () => {
  await setDoc('<p>hello world. second one</p>'); await selectAll();
  await click('Change Case'); await page.locator('[role=menuitem]', { hasText: 'UPPERCASE' }).click(); await page.waitForTimeout(100);
  let h = await html(); assert(/HELLO WORLD/.test(h), h);
  await selectAll(); await click('Change Case'); await page.locator('[role=menuitem]', { hasText: 'Sentence case' }).click(); await page.waitForTimeout(100);
  h = await html(); assert(/Hello world\. Second one/.test(h), h);
  // outside click / Escape closes menu
  await click('Change Case'); await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  assert(await page.locator('[role=menuitem]', { hasText: 'UPPERCASE' }).count() === 0, 'case menu not closed by Esc');
});
test('text + highlight colour', async () => {
  await setDoc('<p>Hello world</p>'); await selectAll();
  await click('Text Color'); await page.locator('button[aria-label="#FF0000"]').first().click(); await page.waitForTimeout(100);
  await click('Highlight Color'); await page.locator('button[aria-label="#FFFF00"]').first().click(); await page.waitForTimeout(100);
  const h = await html(); assert(/color: (#ff0000|#FF0000|rgb\(255, 0, 0\))/i.test(h) && /background-color: (#ffff00|rgb\(255, 255, 0\))/i.test(h), h);
});
test('paragraph style gallery', async () => {
  const pick = async (id: string) => {
    await page.getByRole('button', { name: 'Paragraph style', exact: true }).click();
    await page.locator(`[data-style-option="${id}"]`).click();
    await page.waitForTimeout(150);
  };
  await setDoc('<p>Title</p>'); await select(2, 2);
  await pick('heading1');
  let h = await html(); assert(/<h1/.test(h), h);
  assert(await page.getByRole('button', { name: 'Paragraph style', exact: true }).getAttribute('data-style-current') === 'heading1', 'gallery value');
  await pick('normal');
  h = await html(); assert(/^<p/.test(h), h);
  await pick('quote'); h = await html(); assert(/<blockquote/.test(h), h);
});
test('alignment', async () => {
  await setDoc('<p>Text</p>'); await select(2, 2);
  for (const [t, v] of [['Align Center', 'center'], ['Align Right', 'right'], ['Justify', 'justify']]) { await click(t); const h = await html(); assert(h.includes(`text-align: ${v}`), t + h); }
  await click('Align Left'); assert(await btn('Align Left').getAttribute('aria-pressed') === 'true', 'left pressed');
});
test('lists + indent', async () => {
  await setDoc('<p>Item</p>'); await select(2, 2);
  await click('Bullet List'); let h = await html(); assert(/<ul/.test(h), h);
  await click('Numbered List'); h = await html(); assert(/<ol/.test(h), h);
  await click('Numbered List'); h = await html(); assert(!/<ol/.test(h), 'toggle off ' + h);
  await click('Increase Indent'); h = await html(); const indented = h; assert(/margin-left|padding-left|data-indent/.test(h), 'indent ' + h);
  await click('Decrease Indent'); h = await html(); assert(h !== indented, 'outdent');
});
test('paragraph shading + line spacing (controlled)', async () => {
  await setDoc('<p>Shade</p><p>Other</p>'); await select(2, 2);
  await page.locator('button', { hasText: 'Paragraph Shading' }).click(); await page.locator('button[aria-label="#D9EAD3"]').first().click(); await page.waitForTimeout(100);
  let h = await html(); assert(/background-color: (#d9ead3|rgb\(217, 234, 211\))/i.test(h), h);
  await page.selectOption('#ribbon-line-spacing', '2.0'); await page.waitForTimeout(150);
  h = await html(); assert(/line-height: 2/.test(h), h);
  await select(9, 9); await page.waitForTimeout(150);
  const other = await page.inputValue('#ribbon-line-spacing');
  await select(2, 2); await page.waitForTimeout(150);
  const first = await page.inputValue('#ribbon-line-spacing');
  assert(first === '2.0' && other === '1.15', `first=${first} other=${other}`);
});
test('undo/redo + disabled state', async () => {
  await setDoc('<p>abc</p>'); await select(4, 4);
  await page.keyboard.type('d'); await page.waitForTimeout(300);
  const undo = page.locator('button[title="Undo"]');
  assert(!(await undo.isDisabled()), 'undo disabled after typing');
  await undo.click(); await page.waitForTimeout(150);
  let h = await html(); assert(!h.includes('abcd'), h);
  await page.locator('button[title="Redo"]').click(); await page.waitForTimeout(150); h = await html(); assert(h.includes('abcd'), 'redo ' + h);
});
test('paint format', async () => {
  await setDoc('<p><strong><span style="color: #ff0000">Source</span></strong> target words</p>'); await select(3, 3);
  await page.locator('button', { hasText: 'Paint Format' }).click(); await page.waitForTimeout(150);
  assert(await page.locator('button', { hasText: 'Paint Format' }).getAttribute('aria-pressed') === 'true', 'not painting');
  // mouse-select "target" in the editor
  const box = await page.evaluate(() => { const e = window.__penkoEditor; const a = e.view.coordsAtPos(9); const b = e.view.coordsAtPos(15); return { x1: a.left + 1, y: (a.top + a.bottom) / 2, x2: b.left - 1 }; });
  await page.mouse.move(box.x1, box.y); await page.mouse.down(); await page.mouse.move(box.x2, box.y, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(300);
  const h = await html(); assert(/<span style="color: rgb\(255, 0, 0\);"><strong>arget/.test(h), h);
  assert(await page.locator('button', { hasText: 'Paint Format' }).getAttribute('aria-pressed') === 'false', 'still painting');
  // cancel by clicking again
  await page.locator('button', { hasText: 'Paint Format' }).click(); await page.locator('button', { hasText: 'Paint Format' }).click();
  assert(await page.locator('button', { hasText: 'Paint Format' }).getAttribute('aria-pressed') === 'false', 'cancel');
});

// ---------------- INSERT ----------------
test('open Insert tab (#2)', async () => {
  await tab('Insert');
});
test('insert table via picker + table tab ops', async () => {
  await setDoc('<p>Before</p>'); await select(7, 7);
  await click('Table'); await page.locator('button[aria-label="3 × 4"]').click(); await page.waitForTimeout(250);
  let rows = await page.evaluate(() => { const d = document.querySelector<HTMLTableElement>('.ProseMirror table'); return d ? [d.rows.length, d.rows[0].cells.length] : null; });
  assert(rows && rows[0] === 3 && rows[1] === 4, 'size ' + JSON.stringify(rows));
  assert(await page.locator('button[aria-pressed][aria-label="Table Design"]').count() === 1, 'table tab missing');
  await tab('Table Design');
  const dims = () => page.evaluate(() => { const d = document.querySelector<HTMLTableElement>('.ProseMirror table'); return d ? [d.rows.length, d.rows[0].cells.length] : null; });
  await click('Insert row below'); assert((await dims())[0] === 4, 'addRow');
  await click('Insert column to the right'); assert((await dims())[1] === 5, 'addCol');
  await click('+ Row Above'); assert((await dims())[0] === 5, 'addRowBefore');
  await click('+ Col Left'); assert((await dims())[1] === 6, 'addColBefore');
  await click('- Row'); assert((await dims())[0] === 4, 'delRow');
  await click('- Col'); assert((await dims())[1] === 5, 'delCol');
  await click('Striped'); let h = await html(); assert(/table-style-striped/.test(h), 'style ' + h.slice(0, 200));
  await click('Default'); h = await html(); assert(!/table-style-/.test(h), 'default style');
  await click('Header Row'); h = await html(); assert(/<th/.test(h), 'header row');
  await click('Cell Shading'); await page.locator('button[aria-label="#CFE2F3"]').first().click(); await page.waitForTimeout(100);
  h = await html(); assert(/background-color: (#CFE2F3|rgb\(207, 226, 243\))/i.test(h), 'cell bg ' + (h.match(/<t[dh][^>]*>/g)||[]).slice(0,3).join(''));
  // merge: select two cells via CellSelection
  await page.evaluate(() => { const e = window.__penkoEditor; const cells = []; e.state.doc.descendants((n, p) => { if (n.type.name === 'tableCell') cells.push(p); }); e.chain().focus().setCellSelection({ anchorCell: cells[0], headCell: cells[1] }).run(); });
  await page.waitForTimeout(150);
  await click('Merge'); h = await html(); assert(/colspan="2"/.test(h), 'merge');
  await click('Split'); h = await html(); assert(!/colspan="2"/.test(h), 'split');
  await click('Delete Table'); h = await html(); assert(!/<table/.test(h), 'delete table');
});
test('open Insert tab (#3)', async () => {
  await tab('Insert');
});
test('insert image + image format tab', async () => {
  await setDoc('<p>Img here</p>'); await select(9, 9);
  await page.setInputFiles('input[type=file][accept="image/*"]', 'tests/e2e/fixtures/test.png'); await page.waitForTimeout(800);
  let h = await html(); assert(/<img[^>]+src="data:image\/png/.test(h), 'no img');
  await page.locator('.ProseMirror img').first().click(); await page.waitForTimeout(250);
  await tab('Image Format');
  await page.locator('button[aria-label="Size"]').click(); await page.locator('[role=menuitem]', { hasText: '50%' }).click(); await page.waitForTimeout(150);
  h = await html(); assert(/width: 50%/.test(h), 'resize ' + h);
  await click('Rotate 90°'); h = await html(); assert(/rotate\(90deg\)/.test(h), 'rotate');
  await click('Thin'); h = await html(); assert(/border: 1px solid/.test(h), 'border');
  await page.locator('button[aria-label="Layout Style"]').click(); await page.locator('[role=menuitem]', { hasText: 'Break Text' }).click(); await page.waitForTimeout(150);
  h = await html(); assert(/display: block/.test(h), 'layout');
  await click('Align Center'); h = await html(); assert(/text-align: center/.test(h), 'img align ' + h);
});
test('open Insert tab (#4)', async () => {
  await tab('Insert');
});
test('link insert/edit/remove + mailto', async () => {
  await setDoc('<p>Visit <strong>site</strong> now</p>'); await select(7, 11);
  await click('Link'); await page.waitForTimeout(200);
  const active = await page.evaluate(() => document.activeElement?.id); assert(active === 'link-dialog-url', 'focus on ' + active);
  await page.keyboard.type('example.com'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  let h = await html(); assert(/<a[^>]+href="https:\/\/example\.com"[^>]*><strong>site<\/strong><\/a>|<strong><a[^>]+href="https:\/\/example\.com"[^>]*>site<\/a><\/strong>/.test(h), h);
  await select(9, 9); await click('Link'); await page.waitForTimeout(200);
  assert(await page.locator('#link-dialog-title').innerText() === 'Edit Link', 'edit title');
  assert(await page.inputValue('#link-dialog-url') === 'https://example.com', 'prefill');
  await page.fill('#link-dialog-url', 'mailto:me@example.com'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  h = await html(); assert(/href="mailto:me@example\.com"/.test(h) && /<strong>/.test(h), 'mailto ' + h);
  await select(9, 9); await click('Link'); await page.waitForTimeout(200);
  await page.locator('button', { hasText: 'Remove Link' }).click(); await page.waitForTimeout(200);
  h = await html(); assert(!/<a /.test(h), 'remove ' + h);
  await click('Link'); await page.keyboard.press('Escape'); await page.waitForTimeout(150); assert(await page.locator('#link-dialog-title').count() === 0, 'esc');
});
test('equation insert + edit', async () => {
  await setDoc('<p>Eq: </p>'); await select(5, 5);
  await click('Equation'); await page.waitForTimeout(200);
  await page.fill('#equation-latex', 'a^2+b^2=c^2'); await page.locator('input[name="equation-mode"]').nth(1).check();
  await page.locator('button', { hasText: 'Insert Equation' }).last().click(); await page.waitForTimeout(250);
  let h = await html(); assert(/data-latex="a\^2\+b\^2=c\^2"/.test(h) && /data-display="true"/.test(h), h.slice(0, 300));
  assert(await page.locator('.ProseMirror .katex').count() > 0, 'katex not rendered');
  await page.locator('.ProseMirror .katex-equation').first().dblclick(); await page.waitForTimeout(250);
  assert(await page.inputValue('#equation-latex') === 'a^2+b^2=c^2', 'prefill');
  await page.fill('#equation-latex', 'E=mc^2'); await page.locator('input[name="equation-mode"]').nth(0).check();
  await page.locator('button', { hasText: 'Update Equation' }).click(); await page.waitForTimeout(250);
  h = await html(); const n = (h.match(/data-type="equation"/g) || []).length;
  assert(n === 1 && /E=mc\^2/.test(h) && !/data-display="true"/.test(h), `n=${n} ${h.slice(0, 300)}`);
});
test('code block with theme + line numbers', async () => {
  await setDoc('<p>Code:</p>'); await select(6, 6);
  await click('Code Block'); await page.waitForTimeout(200);
  await page.selectOption('#codeblock-language', 'python'); await page.selectOption('#codeblock-theme', 'github');
  await page.locator('textarea[aria-label="Code Editor"]').fill('print("hi")');
  await page.locator('label', { hasText: 'Line Numbers' }).locator('input').uncheck();
  await page.locator('button', { hasText: 'Insert Code Block' }).last().click(); await page.waitForTimeout(300);
  const attrs = await page.evaluate(() => { let a = null; window.__penkoEditor.state.doc.descendants(n => { if (n.type.name === 'codeBlock') a = n.attrs; }); return a; });
  assert(attrs && attrs.language === 'python' && attrs.theme === 'light' && attrs.lineNumbers === false, JSON.stringify(attrs));
  return JSON.stringify(attrs);
});
test('diagram insert', async () => {
  await setDoc('<p>Diagram:</p>'); await select(9, 9);
  await click('Diagram Editor'); await page.waitForTimeout(250);
  await page.locator('button[aria-label="Rectangle"]').click(); await page.locator('svg[aria-label="Diagram canvas"]').click({ position: { x: 200, y: 150 } });
  await page.locator('#diagram-shape-text').fill('Box');
  await page.locator('button', { hasText: 'Insert into document' }).click(); await page.waitForTimeout(800);
  const h = await html(); assert(/<img[^>]+src="data:image\/png;base64/.test(h), 'no diagram img');
  assert(await page.locator('#diagram-editor-title').count() === 0, 'dialog still open');
});
test('HR, symbol, page break', async () => {
  await setDoc('<p>A</p>'); await select(2, 2);
  await click('Horizontal Line'); let h = await html(); assert(/<hr/.test(h), 'hr');
  await page.locator('button', { hasText: 'Special Symbol' }).click(); await page.locator('button[aria-label="©"]').click(); await page.waitForTimeout(100);
  h = await html(); assert(h.includes('©'), 'symbol');
  await click('Page Break (Ctrl+Enter)'); h = await html(); assert(/page-break|data-type="page-break"|pageBreak/i.test(h), 'page break ' + h);
});
test('header/footer both saved', async () => {
  await click('Header & Footer'); await page.waitForTimeout(300);
  await page.locator('#hf-header-editor').click(); await page.keyboard.type('My Header');
  await page.locator('button[aria-pressed]', { hasText: 'Footer' }).click(); await page.waitForTimeout(150);
  await page.locator('#hf-footer-editor').click(); await page.keyboard.type('Foot ');
  await page.locator('button[title="Insert Page Number"]').click();
  await page.locator('button[aria-pressed]', { hasText: 'Header' }).click(); await page.waitForTimeout(150);
  const again = await page.locator('#hf-header-editor').innerText(); assert(again.includes('My Header'), 'header lost on tab switch: ' + again);
  await page.locator('#hf-header-editor').click(); await page.keyboard.press('End'); await page.keyboard.type('!');
  const typed = await page.locator('#hf-header-editor').innerText(); assert(typed.includes('My Header!'), 'caret jump: ' + typed);
  await page.locator('button', { hasText: /^Save$/ }).click(); await page.waitForTimeout(300);
  // Paginated layout: header in the first page's top margin, footer in the last page's bottom margin
  const hdr = await page.locator('.penko-first-header').innerText(); const ftr = await page.locator('.penko-last-footer').innerText().catch(() => '');
  assert(hdr.includes('My Header!') && /Foot \d/.test(ftr), `hdr=${hdr} ftr=${ftr}`);
});

// ---------------- REFERENCES ----------------
test('open References tab (#5)', async () => {
  await tab('References');
});
test('footnotes insert/order/edit', async () => {
  await setDoc('<p>First sentence. Second sentence.</p>'); await select(33, 33);
  await click('Footnote'); await page.fill('#footnote-content', 'Note B'); await page.locator('button', { hasText: 'Insert Footnote' }).last().click(); await page.waitForTimeout(250);
  await select(16, 16);
  await click('Footnote'); await page.waitForTimeout(150);
  const info = await page.locator('text=/#1/').count();
  await page.fill('#footnote-content', 'Note A'); await page.locator('button', { hasText: 'Insert Footnote' }).last().click(); await page.waitForTimeout(800);
  const notes = await page.locator('.penko-page-notes-zone .penko-page-note, .penko-last-notes .penko-page-note').allInnerTexts();
  assert(notes.length === 2 && notes[0].startsWith('1') && notes[0].includes('Note A') && notes[1].startsWith('2') && notes[1].includes('Note B'), JSON.stringify(notes));
  const refs = await page.locator('.ProseMirror sup.penko-note-ref').allInnerTexts(); assert(refs.join(',') === '1,2', refs.join(','));
  await page.locator('.ProseMirror sup.penko-note-ref').nth(1).click(); await page.waitForTimeout(250);
  assert(await page.inputValue('#footnote-content') === 'Note B', 'prefill');
  await page.fill('#footnote-content', 'Note B edited'); await page.locator('button', { hasText: 'Save Note' }).click(); await page.waitForTimeout(800);
  const notes2 = await page.locator('.penko-page-notes-zone .penko-page-note, .penko-last-notes .penko-page-note').allInnerTexts(); assert(/Note B edited/.test(notes2[1]), JSON.stringify(notes2));
  await page.locator('.ProseMirror sup.penko-note-ref').nth(0).click(); await page.waitForTimeout(200);
  await page.locator('button', { hasText: 'Delete Note' }).click(); await page.waitForTimeout(250);
  const refs2 = await page.locator('.ProseMirror sup.penko-note-ref').allInnerTexts(); assert(refs2.join(',') === '1', 'after delete ' + refs2);
  return `preview#1 shown=${info > 0}`;
});
test('citations + bibliography live update', async () => {
  await setDoc('<p>Claim.</p>'); await select(7, 7);
  await click('Citation'); await page.waitForTimeout(200);
  await page.locator('button', { hasText: 'Add New Source' }).click();
  await page.fill('input[placeholder="Last, First"]', 'Smith'); await page.fill('input[placeholder="2024"]', '2020'); await page.fill('input[placeholder="Title of the work"]', 'Book <b>One</b>');
  await page.locator('button', { hasText: 'Add Source' }).last().click(); await page.waitForTimeout(200);
  await page.locator('[role=button][aria-pressed]').first().click();
  await page.locator('button', { hasText: 'Insert Citation' }).last().click(); await page.waitForTimeout(250);
  let txt = await page.locator('.ProseMirror').innerText(); assert(txt.includes('(Smith, 2020)'), txt);
  await page.locator('button[aria-label="Insert Bibliography"]').click(); await page.locator('[role=menuitem]', { hasText: 'APA Style' }).click(); await page.waitForTimeout(250);
  let bib = await page.locator('.ProseMirror .bibliography').innerHTML(); assert(/Smith/.test(bib) && /Book &lt;b&gt;One/.test(bib), 'bib ' + bib);
  await click('Citation'); await page.waitForTimeout(200);
  await page.locator('button[aria-label="Edit Source"]').first().click(); await page.fill('input[placeholder="Last, First"]', 'Jones');
  await page.locator('button', { hasText: 'Save Source' }).click(); await page.waitForTimeout(200);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  txt = await page.locator('.ProseMirror').innerText(); bib = await page.locator('.ProseMirror .bibliography').innerText();
  assert(txt.includes('(Jones, 2020)') && bib.includes('Jones'), 'after edit ' + txt);
  // delete clears selection
  await click('Citation'); await page.waitForTimeout(150); await page.locator('[role=button][aria-pressed]').first().click();
  await page.locator('button[aria-label="Delete"]').first().click(); await page.waitForTimeout(150);
  assert(await page.locator('button', { hasText: 'Insert Citation' }).last().isDisabled(), 'insert still enabled after delete');
  await page.keyboard.press('Escape');
});
test('TOC insert, update, link scroll', async () => {
  const many = Array.from({ length: 40 }, (_, i) => `<p>Filler ${i}</p>`).join('');
  await setDoc(`<p>Start</p><h1>Intro</h1>${many}<h2>Deep <b>&lt;x&gt;</b></h2>${many}<h3>Last</h3>`); await select(1, 1);
  await click('Table of Contents'); await page.waitForTimeout(250);
  const prev = await page.locator('[role=dialog] ul').first().innerText(); assert(prev.includes('Intro') && prev.includes('Deep <x>'), 'preview ' + prev);
  await page.locator('button', { hasText: 'Insert Table of Contents' }).click(); await page.waitForTimeout(300);
  assert(await page.locator('.ProseMirror .table-of-contents a').count() === 3, 'links');
  await click('Table of Contents'); await page.waitForTimeout(200);
  assert(await page.locator('button', { hasText: 'Update Table of Contents' }).count() === 1, 'no update button');
  await page.locator('label', { hasText: 'Heading 3' }).locator('input').uncheck();
  await page.locator('label', { hasText: 'Numbered' }).locator('input').check();
  await page.locator('button', { hasText: 'Update Table of Contents' }).click(); await page.waitForTimeout(300);
  const h = await html(); assert((h.match(/data-type="toc"/g) || []).length === 1, 'duplicate toc');
  assert(await page.locator('.ProseMirror .table-of-contents a').count() === 2, 'levels not updated');
  const before = await page.evaluate(() => document.getElementById('editor-scroll-container').scrollTop);
  await page.locator('.ProseMirror .table-of-contents a', { hasText: 'Deep' }).click(); await page.waitForTimeout(900);
  const after = await page.evaluate(() => document.getElementById('editor-scroll-container').scrollTop);
  assert(after > before + 200, `scroll ${before}->${after}`);
});

// ---------------- LAYOUT ----------------
test('open Layout tab (#6)', async () => {
  await tab('Layout');
});
test('layout dropdown click-toggle + ruler margins', async () => {
  const pos1 = await page.evaluate(() => document.querySelector('[data-marker="left"]')?.getBoundingClientRect().left);
  await page.locator('button[aria-label="Margins"]').hover(); await page.waitForTimeout(150);
  assert(await page.locator('[role=menu]').count() === 0, 'opens on hover');
  await page.locator('button[aria-label="Margins"]').click(); assert(await page.locator('[role=menu]').count() === 1, 'no open on click');
  await page.mouse.click(700, 500); await page.waitForTimeout(100); assert(await page.locator('[role=menu]').count() === 0, 'outside click');
  await page.locator('button[aria-label="Margins"]').click(); await page.locator('[role=menuitemradio]', { hasText: 'Wide' }).click(); await page.waitForTimeout(300);
  const pos2 = await page.evaluate(() => document.querySelector('[data-marker="left"]')?.getBoundingClientRect().left);
  const contentLeft = await page.evaluate(() => { const r = document.querySelector('#editor-content .ProseMirror').getBoundingClientRect(); return r.left; });
  assert(Math.abs(pos2 + 6 - contentLeft) < 4, `marker ${pos2 + 6} vs content ${contentLeft}`);
  await page.locator('button[aria-label="Orientation"]').click(); await page.locator('[role=menuitemradio]', { hasText: 'Landscape' }).click(); await page.waitForTimeout(300);
  const rw = await page.evaluate(() => [document.querySelector('[data-testid=ruler]').getBoundingClientRect().width, document.querySelector('.page-shadow').getBoundingClientRect().width]);
  assert(Math.abs(rw[0] - rw[1]) < 3, 'ruler width ' + rw);
  await page.locator('button[aria-label="Zoom out"]').click(); await page.waitForTimeout(400);
  const rw2 = await page.evaluate(() => [document.querySelector('[data-testid=ruler]').getBoundingClientRect().width, document.querySelector('.page-shadow').getBoundingClientRect().width]);
  assert(Math.abs(rw2[0] - rw2[1]) < 3, 'zoomed ruler width ' + rw2);
  await page.locator('button[aria-label="Zoom in"]').click();
  await page.locator('button[aria-label="Orientation"]').click(); await page.locator('[role=menuitemradio]', { hasText: 'Portrait' }).click();
  await page.locator('button[aria-label="Margins"]').click(); await page.locator('[role=menuitemradio]', { hasText: 'Normal' }).click();
  return `marker ${pos1}->${pos2}`;
});
test('page colour', async () => {
  await page.locator('button', { hasText: 'Page Color' }).click(); await page.locator('button[aria-label="#FFF2CC"]').click(); await page.waitForTimeout(200);
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.page-shadow')).backgroundColor); assert(bg === 'rgb(255, 242, 204)', bg);
  await page.locator('button', { hasText: 'Page Color' }).click(); await page.locator('button[aria-label="#FFFFFF"]').click();
});

// ---------------- REVIEW / VIEW ----------------
test('open Review tab (#7)', async () => {
  await tab('Review');
});
test('track changes panel + tracking checkbox', async () => {
  const cb = page.locator('#tracking-box'); const before = await cb.isChecked();
  await cb.click(); await page.waitForTimeout(150); assert((await cb.isChecked()) !== before, 'toggle');
  await cb.click();
  await click('Track Changes'); await page.waitForTimeout(300);
  const visible = await page.locator('text=/Track(ed)? Changes/i').count(); assert(visible > 1, 'panel not visible');
  await page.locator('[data-track-changes-panel] button[aria-label]').first().click().catch(() => {});
  await page.waitForTimeout(300);
});
test('open View tab (#8)', async () => {
  await tab('View');
});
test('read aloud toggle + shortcuts dialog', async () => {
  await setDoc('<p>Hello &amp; welcome</p>');
  await page.evaluate(() => { window.__spoken = []; let speaking = false;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { get speaking() { return speaking; }, speak(u) { window.__spoken.push([u.text, u.lang]); speaking = true; }, cancel() { speaking = false; } } }); });
  await click('Read Aloud'); await page.waitForTimeout(100);
  const spoken = await page.evaluate(() => window.__spoken); assert(spoken.length === 1 && spoken[0][0].includes('Hello & welcome') && spoken[0][1], JSON.stringify(spoken));
  assert(await btn('Stop Reading').count() === 1, 'no stop label');
  await click('Stop Reading'); assert(await btn('Read Aloud').count() === 1, 'not toggled back');
  await click('Shortcuts'); await page.waitForTimeout(200); assert(await page.locator('#shortcuts-dialog-title').count() === 1, 'shortcuts');
  const txt = await page.locator('[role=dialog]').innerText(); assert(!/\bbold\b/.test(txt) && txt.includes('Bold'), 'bold key');
  await page.keyboard.press('Escape'); await page.waitForTimeout(150); assert(await page.locator('#shortcuts-dialog-title').count() === 0, 'esc');
});

// ---------------- QUALITY PASS: fresh page per test ----------------
test.describe('ribbon controls (fresh page)', () => {
  const ready = async (p: Page) => {
    p.on('dialog', d => {
      throw new Error('native dialog shown: ' + d.message());
    });
    await p.goto('/');
    await p.waitForFunction(() => !!window.__penkoEditor, null, { timeout: 20000 });
    await p.waitForTimeout(300);
  };
  const doc = async (p: Page, h: string) => {
    await p.evaluate(h => {
      const e = window.__penkoEditor;
      e.commands.setContent(h);
      e.commands.focus();
    }, h);
    await p.waitForTimeout(80);
  };
  const sel = async (p: Page, from: number, to = from) => {
    await p.evaluate(([f, t]) => window.__penkoEditor.chain().focus().setTextSelection({ from: f, to: t }).run(), [from, to]);
    await p.waitForTimeout(80);
  };
  const getHtml = (p: Page): Promise<string> => p.evaluate(() => window.__penkoEditor.getHTML());
  const openTab = (p: Page, label: string) => p.locator(`button[aria-pressed][aria-label="${label}"]`).first().click();
  const pressedTabs = (p: Page) =>
    p.locator('button[aria-pressed][aria-label]').evaluateAll(els => els.filter(e => e.getAttribute('aria-pressed') === 'true').map(e => e.getAttribute('aria-label')));

  test('contextual table tab hands back to the previous tab', async ({ page }) => {
    await ready(page);
    await openTab(page, 'Insert');
    await doc(page, '<p>Before</p><table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table><p>After</p>');
    await sel(page, 12);
    await expect.poll(() => pressedTabs(page)).toEqual(['Table Design']);
    await sel(page, 2);
    await expect.poll(() => pressedTabs(page)).toEqual(['Insert']);
    // The panel shows the Insert groups again, not the stale table tools
    await expect(page.locator('button[title="Merge"]')).toHaveCount(0);
    await expect(page.locator('button[title="Equation"]')).toHaveCount(1);
  });

  test('collapse / expand the ribbon', async ({ page }) => {
    await ready(page);
    await page.locator('button[aria-label="Collapse Panel"]').click();
    await expect(page.locator('#ribbon-doc-title')).toHaveCount(0);
    await expect(page.locator('button[aria-label="Expand Panel"]')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('button[aria-label="Expand Panel"]').click();
    await expect(page.locator('#ribbon-doc-title')).toHaveCount(1);
    // clicking the active tab collapses, another tab expands and switches
    await openTab(page, 'Home');
    await expect(page.locator('#ribbon-doc-title')).toHaveCount(0);
    await openTab(page, 'View');
    await expect(page.locator('#ribbon-doc-title')).toHaveCount(1);
    await expect.poll(() => pressedTabs(page)).toEqual(['View']);
  });

  test('"No Color" resets text, highlight and paragraph shading', async ({ page }) => {
    await ready(page);
    await doc(page, '<p style="background-color: #d9ead3"><span style="color: #ff0000; background-color: #ffff00">Hello</span> world</p>');
    await sel(page, 1, 6);
    await page.locator('button[aria-label="Text Color"]').click();
    await expect(page.locator('[role=option][aria-label="#FF0000"]')).toHaveAttribute('aria-selected', 'true');
    await page.locator('[role=option]', { hasText: 'No Color' }).click();
    await page.locator('button[aria-label="Highlight Color"]').click();
    await page.locator('[role=option]', { hasText: 'No Color' }).click();
    await page.locator('button', { hasText: 'Paragraph Shading' }).click();
    await page.locator('[role=option]', { hasText: 'No Color' }).click();
    await expect.poll(() => getHtml(page)).toBe('<p>Hello world</p>');
  });

  test('page colour and cell shading can be reset; shading keeps cell padding', async ({ page }) => {
    await ready(page);
    await openTab(page, 'Layout');
    await page.locator('button', { hasText: 'Page Color' }).click();
    await page.locator('[role=option][aria-label="#FFF2CC"]').click();
    const bg = () => page.evaluate(() => getComputedStyle(document.querySelector('.page-shadow')!).backgroundColor);
    await expect.poll(bg).toBe('rgb(255, 242, 204)');
    await page.locator('button', { hasText: 'Page Color' }).click();
    await page.locator('[role=option]', { hasText: 'No Color' }).click();
    await expect.poll(bg).toBe('rgb(255, 255, 255)');
    expect(await page.evaluate(() => (window as any).__penkoEditor && document.querySelector('.page-shadow')!.getAttribute('data-page-background'))).toBe('#ffffff');

    await doc(page, '<table><tbody><tr><td style="padding: 12px"><p>a</p></td><td><p>b</p></td></tr></tbody></table>');
    await sel(page, 3);
    // entering the table switches to the contextual tab by itself
    await expect.poll(() => pressedTabs(page)).toEqual(['Table Design']);
    await page.locator('button[title="Cell Shading"]').click();
    await page.locator('[role=option][aria-label="#CFE2F3"]').click();
    await expect.poll(() => getHtml(page)).toMatch(/<td[^>]* style="padding: 12px; background-color: (#CFE2F3|rgb\(207, 226, 243\));?"/i);
    await page.locator('button[title="Cell Shading"]').click();
    await page.locator('[role=option]', { hasText: 'No Color' }).click();
    await expect.poll(() => getHtml(page)).toMatch(/<td[^>]* style="padding: 12px;?"/);
  });

  test('layout menus mark the current setting and change the page count', async ({ page }) => {
    await ready(page);
    const many = Array.from({ length: 60 }, (_, i) => `<p>Paragraph ${i} with enough words to wrap across part of the line on the page.</p>`).join('');
    await doc(page, many);
    const total = async () => Number((await page.locator('text=/Page \\d+ of \\d+/').first().innerText()).match(/of (\d+)/)![1]);
    await expect.poll(total).toBeGreaterThan(1);
    const before = await total();
    await openTab(page, 'Layout');
    await page.locator('button[aria-label="Margins"]').click();
    await expect(page.locator('[role=menuitemradio][aria-checked=true]')).toHaveText('Normal');
    await page.locator('[role=menuitemradio]', { hasText: 'Narrow' }).click();
    await expect.poll(total).toBeLessThan(before);
    await page.locator('button[aria-label="Margins"]').click();
    await expect(page.locator('[role=menuitemradio][aria-checked=true]')).toHaveText('Narrow');
    await page.keyboard.press('Escape');
    await page.locator('button[aria-label="Columns"]').click();
    await page.locator('[role=menuitemradio]', { hasText: 'Two' }).click();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('#editor-content')!).columnCount)).toBe('2');
  });

  test('keyboard shortcuts listed in the shortcuts dialog work', async ({ page }) => {
    await ready(page);
    const cases: [string, string, number, number, string, RegExp][] = [
      ['bold', '<p>Hello</p>', 1, 6, 'Control+b', /<strong>/],
      ['italic', '<p>Hello</p>', 1, 6, 'Control+i', /<em>/],
      ['underline', '<p>Hello</p>', 1, 6, 'Control+u', /<u>/],
      ['strike', '<p>Hello</p>', 1, 6, 'Control+Shift+s', /<s>/],
      ['subscript', '<p>Hello</p>', 1, 6, 'Control+,', /<sub>/],
      ['superscript', '<p>Hello</p>', 1, 6, 'Control+.', /<sup>/],
      ['inline code', '<p>Hello</p>', 1, 6, 'Control+e', /<code>/],
      ['highlight', '<p>Hello</p>', 1, 6, 'Control+Shift+h', /<mark|background-color/],
      ['heading', '<p>Hello</p>', 2, 2, 'Control+Alt+2', /^<h2/],
      ['normal text', '<h2>Hello</h2>', 2, 2, 'Control+Alt+0', /^<p/],
      ['bullets', '<p>Hello</p>', 2, 2, 'Control+Shift+8', /<ul/],
      ['numbers', '<p>Hello</p>', 2, 2, 'Control+Shift+7', /<ol/],
      ['center', '<p>Hello</p>', 2, 2, 'Control+Shift+e', /text-align: center/],
      ['right', '<p>Hello</p>', 2, 2, 'Control+Shift+r', /text-align: right/],
      ['justify', '<p>Hello</p>', 2, 2, 'Control+Shift+j', /text-align: justify/],
      ['left', '<p style="text-align: center">Hello</p>', 2, 2, 'Control+Shift+l', /^<p(?![^>]*center)/],
      ['page break', '<p>Hello</p>', 3, 3, 'Control+Enter', /page-break/],
      ['line break', '<p>Hello</p>', 3, 3, 'Shift+Enter', /<br>/],
    ];
    for (const [name, h, from, to, key, re] of cases) {
      await doc(page, h);
      await sel(page, from, to);
      await page.keyboard.press(key);
      await expect.poll(() => getHtml(page), { message: name }).toMatch(re);
    }
    // undo / redo (both redo chords)
    await doc(page, '<p>abc</p>');
    await sel(page, 4);
    await page.keyboard.type('X');
    await page.keyboard.press('Control+z');
    await expect.poll(() => getHtml(page)).not.toContain('abcX');
    await page.keyboard.press('Control+y');
    await expect.poll(() => getHtml(page)).toContain('abcX');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+Shift+z');
    await expect.poll(() => getHtml(page)).toContain('abcX');
    // app-level shortcuts open their dialogs
    for (const [key, id] of [['Control+k', '#link-dialog-title'], ['Control+f', '#find-replace-title'], ['Control+h', '#find-replace-title'], ['Control+/', '#shortcuts-dialog-title']]) {
      await sel(page, 2, 3);
      await page.keyboard.press(key);
      await expect(page.locator(id)).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(page.locator(id)).toHaveCount(0);
    }
  });

  test('undo is disabled in a fresh document; screenplay and markdown toggles', async ({ page }) => {
    await ready(page);
    const before = await page.evaluate(() => window.__penkoEditor);
    await page.getByTitle('New', { exact: true }).click();
    await page.waitForFunction(prev => window.__penkoEditor && window.__penkoEditor !== prev, before);
    await expect(page.locator('button[title="Undo"]')).toBeDisabled();
    await expect(page.locator('button[title="Redo"]')).toBeDisabled();

    await openTab(page, 'View');
    await doc(page, '<p>INT. HOUSE - DAY</p>');
    await page.locator('label', { hasText: 'Screenplay Mode' }).locator('input').check();
    await sel(page, 17);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.type('JOHN');
    await expect.poll(() => getHtml(page)).toContain('data-screenplay-type="character"');
    await page.locator('label', { hasText: 'Screenplay Mode' }).locator('input').uncheck();

    await doc(page, '<h1>Title</h1><p>Some <strong>bold</strong></p>');
    await page.waitForTimeout(500);
    await page.locator('label', { hasText: 'Markdown Mode' }).locator('input').check();
    await expect(page.locator('textarea').first()).toHaveValue(/# Title\s+Some \*\*bold\*\*/);
    await page.locator('label', { hasText: 'Markdown Mode' }).locator('input').uncheck();
    await expect.poll(() => getHtml(page)).toMatch(/<h1[^>]*>Title<\/h1><p>Some <strong>bold<\/strong><\/p>/);
  });

  test('present and zen focus entry points open their views', async ({ page }) => {
    await ready(page);
    await doc(page, '<h1>Slide</h1><p>Body</p>');
    await openTab(page, 'View');
    await page.locator('button[title="Present"]').click();
    await expect(page.locator('[role=dialog]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('[role=dialog]')).toHaveCount(0);
    await openTab(page, 'Home');
    await page.locator('button', { hasText: 'Zen Focus Mode' }).click();
    await expect(page.getByText('Enter Zen Space').first()).toBeVisible();
  });

  test('code block dialog edits the block at the cursor and never injects HTML', async ({ page }) => {
    await ready(page);
    await doc(page, '<p>Code:</p><pre data-language="javascript" data-theme="dark"><code>let a = 1;</code></pre><p>after</p>');
    await sel(page, 10);
    await openTab(page, 'Insert');
    await page.locator('button[title="Code Block"]').click();
    await expect(page.locator('#codeblock-dialog-title')).toHaveText('Edit Code Block');
    await expect(page.locator('textarea[aria-label="Code Editor"]')).toHaveValue('let a = 1;');
    await expect(page.locator('#codeblock-language')).toHaveValue('javascript');
    await page.selectOption('#codeblock-language', 'plaintext');
    await page.locator('textarea[aria-label="Code Editor"]').fill('<img src=x onerror="window.__xss=1">');
    // plain text preview is text, not markup
    await expect(page.locator('[role=dialog] pre img')).toHaveCount(0);
    await page.locator('button', { hasText: /^Update$/ }).click();
    const blocks = await page.evaluate(() => {
      const out: any[] = [];
      window.__penkoEditor.state.doc.descendants((n: any) => {
        if (n.type.name === 'codeBlock') out.push({ lang: n.attrs.language, text: n.textContent });
      });
      return out;
    });
    expect(blocks).toEqual([{ lang: 'plaintext', text: '<img src=x onerror="window.__xss=1">' }]);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  });

  test('citation dialog updates a selected citation in place', async ({ page }) => {
    await ready(page);
    await doc(page, '<p>Claim.</p>');
    await openTab(page, 'References');
    const addSource = async (author: string) => {
      await page.locator('button[title="Citation"]').click();
      await page.locator('button', { hasText: 'Add New Source' }).click();
      await page.fill('#citation-author', author);
      await page.fill('#citation-year', '2020');
      await page.fill('#citation-title', 'Book ' + author);
      await page.locator('button', { hasText: 'Add Source' }).last().click();
    };
    await sel(page, 7);
    await addSource('Smith');
    await page.locator('button', { hasText: 'Insert Citation' }).last().click();
    await expect(page.locator('.ProseMirror')).toContainText('(Smith, 2020)');
    await addSource('Jones');
    await page.keyboard.press('Escape');
    // select the citation node, then pick the other source
    const pos = await page.evaluate(() => {
      let p = -1;
      window.__penkoEditor.state.doc.descendants((n: any, at: number) => {
        if (n.type.name === 'citation') p = at;
      });
      window.__penkoEditor.chain().focus().setNodeSelection(p).run();
      return p;
    });
    expect(pos).toBeGreaterThan(0);
    await page.locator('button[title="Citation"]').click();
    await expect(page.locator('[role=button][aria-pressed=true]')).toContainText('Smith');
    await page.locator('[role=button][aria-pressed]', { hasText: 'Jones' }).click();
    await page.locator('button', { hasText: 'MLA' }).click();
    await page.locator('button', { hasText: /^Update$/ }).click();
    await expect(page.locator('.ProseMirror')).toContainText('(Jones)');
    expect((await getHtml(page)).match(/data-type="citation"/g)).toHaveLength(1);
  });

  test('TOC dialog does not carry options over to a document without a TOC', async ({ page }) => {
    await ready(page);
    await doc(page, '<h1>One</h1><h2>Two</h2>');
    await sel(page, 1);
    await openTab(page, 'References');
    await page.locator('button[title="Table of Contents"]').click();
    await page.locator('label', { hasText: 'Numbered' }).locator('input').check();
    await page.locator('label', { hasText: 'Heading 2' }).locator('input').uncheck();
    await page.locator('button', { hasText: 'Cancel' }).click();
    await page.locator('button[title="Table of Contents"]').click();
    await expect(page.locator('label', { hasText: 'Heading 2' }).locator('input')).toBeChecked();
    await expect(page.locator('label', { hasText: 'Default (boxed)' }).locator('input')).toBeChecked();
  });

  test('diagram arrows end at the edge of the target shape', async ({ page }) => {
    await ready(page);
    await openTab(page, 'Insert');
    await page.locator('button[title="Diagram Editor"]').click();
    const canvas = page.locator('svg[aria-label="Diagram canvas"]');
    await page.locator('button[aria-label="Rectangle"]').click();
    await canvas.click({ position: { x: 150, y: 150 } });
    await page.locator('button[aria-label="Rectangle"]').click();
    await canvas.click({ position: { x: 450, y: 150 } });
    await page.locator('button[aria-label="Arrow"]').click();
    await canvas.locator('rect').nth(0).click();
    await canvas.locator('rect').nth(1).click();
    const line = await canvas.locator('line').evaluate(l => ({ x1: Number(l.getAttribute('x1')), x2: Number(l.getAttribute('x2')) }));
    const rects = await canvas.locator('rect').evaluateAll(rs => rs.map(r => ({ x: Number(r.getAttribute('x')), w: Number(r.getAttribute('width')) })));
    // from the right edge of the first shape to the left edge of the second
    expect(line).toEqual({ x1: rects[0].x + rects[0].w, x2: rects[1].x });
    await expect(page.getByText('2 shapes, 1 connectors')).toBeVisible();
  });
});
