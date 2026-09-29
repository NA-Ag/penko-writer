import { test, expect, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { Document as DocxDocument, Packer, Paragraph, HeadingLevel } from 'docx';
import { editorReady, failOnNativeDialogs, html, newDoc, readDownload, text, toastText, typeInEditor } from './helpers';

/**
 * Files on disk: the .penko format through the UI (save as download, reopen,
 * "already in the app" choices), drag & drop onto the window, friendly errors,
 * and the Chromium File System Access path (save in place, auto-save, recent
 * files) with stubbed pickers writing to memory.
 */

failOnNativeDialogs();

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** A document with every setting the format carries. */
const FIELDS = {
  id: 'e2e-penko-doc',
  title: 'Penko round trip',
  createdAt: 1_700_000_000_000,
  lastModified: 1_700_000_100_000,
  pageConfig: { size: 'Letter', orientation: 'landscape', margins: 'narrow', cols: 1, backgroundColor: '#fef3c7' },
  language: 'fr-FR',
  header: '<p>Header text</p>',
  footer: '<p>Footer text</p>',
  showPageNumbers: true,
  differentFirstPage: true,
  pageNumberFormat: 'roman',
  pageNumberPosition: 'footer-right',
  comments: [{ id: 'c1', rangeId: 'c1', author: 'Ann', text: 'Check this', timestamp: 5, resolved: false, replies: [{ id: 'r1', author: 'Bob', text: 'Done', timestamp: 6 }] }],
  citations: [{ id: 'cit1', type: 'book', author: 'Doe, J.', title: 'On Things', year: '2020', publisher: 'Pub' }],
  trackingEnabled: true,
};
const CONTENT =
  '<h1>Round trip heading</h1><p>Some <strong>bold</strong> and <span class="comment-highlight" data-comment-id="c1">commented</span> text.</p>' +
  '<p><img src="media/image1.png" alt="pixel"></p><ul><li><p>item</p></li></ul>';

/** Builds a .penko package the way the format documents it. */
const buildPenko = async (fields: Record<string, unknown> = FIELDS, content = CONTENT) => {
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.penko.document', { compression: 'STORE' });
  zip.file('manifest.json', JSON.stringify({ format: 'penko', version: 1, minReaderVersion: 1, generator: 'e2e', savedAt: 1 }));
  zip.file('document.json', JSON.stringify(fields));
  zip.file('content.html', content);
  zip.file('media/image1.png', Buffer.from(PNG, 'base64'));
  return zip.generateAsync({ type: 'nodebuffer' });
};

const readPenko = async (buf: Buffer | Uint8Array) => {
  const zip = await JSZip.loadAsync(buf);
  return {
    manifest: JSON.parse(await zip.file('manifest.json')!.async('string')),
    doc: JSON.parse(await zip.file('document.json')!.async('string')),
    content: await zip.file('content.html')!.async('string'),
  };
};

const allDocs = (page: Page): Promise<any[]> =>
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
    return all;
  });

const openDialog = (page: Page) => page.locator('[aria-labelledby="import-dialog-title"]');

/** Opens a file through the Open dialog's file input (the Firefox / Safari path). */
const openViaInput = async (page: Page, name: string, buffer: Buffer) => {
  await page.getByTitle('Import', { exact: true }).click();
  await openDialog(page).locator('input[type=file]').setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
};

const pill = (page: Page) => page.getByTestId('linked-file-pill');

/** Waits until the live editor (which is replaced when documents switch) contains `s`. */
const waitForText = (page: Page, s: string) =>
  page.waitForFunction(s => {
    const ed = window.__penkoEditor;
    return !!ed && !ed.isDestroyed && ed.getText().includes(s);
  }, s, { timeout: 15000 });

/** Pick the "same fields" part of a document for comparisons. */
const settingsOf = (d: any) => {
  const keys = ['title', 'pageConfig', 'language', 'header', 'footer', 'showPageNumbers', 'differentFirstPage', 'pageNumberFormat', 'pageNumberPosition', 'comments', 'citations', 'trackingEnabled', 'createdAt'];
  return Object.fromEntries(keys.map(k => [k, d[k]]));
};

test.describe('download path (no File System Access)', () => {
  test.beforeEach(async ({ page }) => {
    // Chromium has the API: hide it so this test covers what Firefox / Safari do
    await page.addInitScript(() => {
      for (const k of ['showOpenFilePicker', 'showSaveFilePicker']) Object.defineProperty(window, k, { value: undefined, configurable: true });
    });
  });

  test('.penko: open, save as download, reopen — content and settings identical', async ({ page }) => {
    await editorReady(page);
    await openViaInput(page, 'Round trip.penko', await buildPenko());
    await waitForText(page, 'Round trip heading');
    await expect(openDialog(page)).toHaveCount(0);
    await expect(toastText(page, /Opened Round trip\.penko/).first()).toBeVisible();

    // same id, every field applied, picture resolved from media/
    let docs = await allDocs(page);
    await expect.poll(async () => (docs = await allDocs(page)).find(d => d.id === FIELDS.id)?.title).toBe(FIELDS.title);
    const opened = docs.find(d => d.id === FIELDS.id);
    expect(settingsOf(opened)).toEqual(settingsOf(FIELDS));
    const editorHtml = await html(page);
    expect(editorHtml).toContain(`src="data:image/png;base64,${PNG}"`);
    expect(editorHtml).toContain('data-comment-id="c1"');
    // the document is linked to its file name
    await expect(pill(page)).toContainText('Round trip.penko');

    // Save to file (Ctrl+Alt+S): first time shows the dialog with the one-time explanation
    await page.keyboard.press('Control+Alt+s');
    const dialog = page.locator('[aria-labelledby="save-file-dialog-title"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('note')).toContainText(/can't save directly/);
    await expect(dialog.getByLabel('File name')).toHaveValue('Round trip');
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Download' }).click()]);
    expect(download.suggestedFilename()).toBe('Round trip.penko');
    await expect(dialog).toHaveCount(0);
    const saved = await readDownload(download);
    const pkg = await readPenko(saved);
    expect(pkg.manifest).toMatchObject({ format: 'penko', version: 1 });
    expect(pkg.doc.id).toBe(FIELDS.id);
    expect(settingsOf(pkg.doc)).toEqual(settingsOf(FIELDS));
    expect(pkg.content).toContain('src="media/image1.png"');
    await expect(pill(page)).toContainText('Saved to disk');

    // "Save" again downloads straight away under the remembered name (no dialog, no explanation)
    await typeInEditor(page, ' more');
    await expect(pill(page)).toContainText('Unsaved changes');
    const [again] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+Alt+s')]);
    expect(again.suggestedFilename()).toBe('Round trip.penko');
    await expect(dialog).toHaveCount(0);
    const savedAgain = await readDownload(again);
    expect((await readPenko(savedAgain)).content).toContain('more');

    // Reopening it: the document is already in the app → inline choice
    await openViaInput(page, 'Round trip.penko', savedAgain);
    const dlg = openDialog(page);
    await expect(dlg.getByText('This document is already in Penko Writer')).toBeVisible();
    // Cancel leaves everything as it was
    await dlg.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dlg).toHaveCount(0);
    expect((await allDocs(page)).filter(d => d.title === FIELDS.title)).toHaveLength(1);

    // Keep both → a second document with a new id and identical content / settings
    await openViaInput(page, 'Round trip.penko', savedAgain);
    const before = await page.evaluate(() => window.__penkoEditor);
    await dlg.getByRole('button', { name: 'Keep both' }).click();
    await page.waitForFunction(prev => window.__penkoEditor && window.__penkoEditor !== prev, before);
    await expect.poll(async () => (await allDocs(page)).filter(d => d.title === FIELDS.title).length).toBe(2);
    const copies = (await allDocs(page)).filter(d => d.title === FIELDS.title);
    const copy = copies.find(d => d.id !== FIELDS.id)!;
    const original = copies.find(d => d.id === FIELDS.id)!;
    expect({ ...settingsOf(copy), createdAt: 0 }).toEqual({ ...settingsOf(original), createdAt: 0 });
    expect(copy.content).toBe(original.content);
    expect(await text(page)).toContain('more');

    // Replace → the original is overwritten with the file's version and shown
    await page.evaluate(() => window.__penkoEditor.commands.setContent('<p>changed in the app</p>', { emitUpdate: true }));
    await openViaInput(page, 'Round trip.penko', await buildPenko({ ...FIELDS, title: 'Replaced title' }, '<p>from the file</p>'));
    await dlg.getByRole('button', { name: /Replace the app/ }).click();
    await expect(dlg).toHaveCount(0);
    await waitForText(page, 'from the file');
    await expect.poll(async () => (await allDocs(page)).find(d => d.id === FIELDS.id)?.title).toBe('Replaced title');
    expect((await allDocs(page)).find(d => d.id === FIELDS.id).content).toContain('from the file');
  });

  test('Save As offers .docx; a new document downloads under its title', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await page.evaluate(() => window.__penkoEditor.commands.setContent('<h1>Docx out</h1><p>body</p>', { emitUpdate: true }));
    await page.getByTitle('Files', { exact: true }).click();
    await page.getByRole('button', { name: 'Save As…' }).click();
    const dialog = page.locator('[aria-labelledby="save-file-dialog-title"]');
    await dialog.getByLabel('File name').fill('My report');
    await dialog.getByText('Word document (.docx)').click();
    await expect(dialog.getByText('My report.docx')).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Download' }).click()]);
    expect(download.suggestedFilename()).toBe('My report.docx');
    const zip = await JSZip.loadAsync(await readDownload(download));
    expect(await zip.file('word/document.xml')!.async('string')).toContain('Docx out');
    // Escape closes the dialog; the file menu entry is also there
    await page.keyboard.press('Control+Alt+Shift+s');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('File name')).toHaveValue('My report');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
});

test('dropping a .docx onto the window opens it; unsupported files get a friendly error', async ({ page }) => {
  const docx = await Packer.toBuffer(new DocxDocument({ sections: [{ children: [new Paragraph({ text: 'Dropped heading', heading: HeadingLevel.HEADING_1 }), new Paragraph('dropped body')] }] }));
  await editorReady(page);
  /** Drags a file over the editor (checking the overlay) and drops it. */
  const drop = async (name: string, b64: string, type: string) => {
    await page.evaluate(
      ({ name, b64, type }) => {
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], name, { type }));
        (window as any).__dt = dt;
        const target = document.querySelector('.ProseMirror')!;
        target.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      },
      { name, b64, type },
    );
    await expect(page.getByTestId('file-drop-overlay')).toBeVisible();
    await page.evaluate(() => {
      const dt = (window as any).__dt;
      document.querySelector('.ProseMirror')!.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
  };
  const before = await page.evaluate(() => window.__penkoEditor);
  await drop('dropped.docx', docx.toString('base64'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  await expect(page.getByTestId('file-drop-overlay')).toHaveCount(0);
  await page.waitForFunction(prev => window.__penkoEditor !== prev, before, { timeout: 15000 });
  await waitForText(page, 'Dropped heading');
  expect(await html(page)).toMatch(/<h1[^>]*>Dropped heading<\/h1>/);
  expect(await text(page)).not.toContain('PK'); // not pasted as content
  await expect.poll(async () => (await allDocs(page)).some(d => d.title === 'dropped')).toBe(true);

  await drop('program.exe', Buffer.from('MZ').toString('base64'), 'application/octet-stream');
  await expect(toastText(page, /\.exe/).first()).toBeVisible();
  await expect(openDialog(page)).toHaveCount(0);
});

test('damaged, foreign and mislabelled .penko files show friendly errors', async ({ page }) => {
  await editorReady(page);
  const dlg = openDialog(page);
  await openViaInput(page, 'broken.penko', Buffer.from('this is not a zip'));
  await expect(dlg.getByText('Import Failed')).toBeVisible();
  await expect(dlg.getByText("This isn't a Penko file, or it is damaged.")).toBeVisible();
  await dlg.getByRole('button', { name: 'Try Again' }).click();

  const docx = await Packer.toBuffer(new DocxDocument({ sections: [{ children: [new Paragraph('x')] }] }));
  await dlg.locator('input[type=file]').setInputFiles({ name: 'renamed.penko', mimeType: 'application/octet-stream', buffer: docx });
  await expect(dlg.getByText(/Word document with a \.penko extension/)).toBeVisible();
  await dlg.getByRole('button', { name: 'Try Again' }).click();

  const future = new JSZip();
  future.file('manifest.json', JSON.stringify({ format: 'penko', version: 9, minReaderVersion: 9 }));
  await dlg.locator('input[type=file]').setInputFiles({ name: 'future.penko', mimeType: 'application/octet-stream', buffer: await future.generateAsync({ type: 'nodebuffer' }) });
  await expect(dlg.getByText(/newer version of Penko Writer/)).toBeVisible();
  // .penko is listed among the supported formats
  await dlg.getByRole('button', { name: 'Try Again' }).click();
  await expect(dlg.getByText('.penko', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
});

test.describe('File System Access (Chromium)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium-only API');

  test.beforeEach(async ({ page }) => {
    // Pickers return fake handles that keep the written bytes in memory
    await page.addInitScript(() => {
      const w = window as any;
      w.__fsa = { files: {} as Record<string, number[]>, writes: 0, permission: 'granted' };
      class FakeWritable {
        chunks: BlobPart[] = [];
        constructor(private h: any) {}
        async write(d: BlobPart) {
          this.chunks.push(d);
        }
        async close() {
          const bytes = new Uint8Array(await new Blob(this.chunks).arrayBuffer());
          this.h.data = bytes;
          w.__fsa.files[this.h.name] = Array.from(bytes);
          w.__fsa.writes++;
        }
        async abort() {}
      }
      class FakeHandle {
        kind = 'file';
        constructor(public name: string, public data: Uint8Array = new Uint8Array()) {}
        async getFile() {
          return new File([this.data], this.name);
        }
        async createWritable() {
          return new FakeWritable(this);
        }
        async queryPermission() {
          return w.__fsa.permission;
        }
        async requestPermission() {
          w.__fsa.permission = 'granted';
          return 'granted';
        }
        async isSameEntry(o: unknown) {
          return o === this;
        }
      }
      w.__FakeHandle = FakeHandle;
      w.__fsaNextSave = 'Saved.penko';
      w.showSaveFilePicker = async () => new FakeHandle(w.__fsaNextSave);
      w.showOpenFilePicker = async () => [w.__fsaNextOpen];
    });
  });

  const fileBytes = async (page: Page, name: string) => Buffer.from(await page.evaluate(n => (window as any).__fsa.files[n] || [], name));
  const writes = (page: Page) => page.evaluate(() => (window as any).__fsa.writes as number);

  test('save in place, auto-save, open through the picker and recent files', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await typeInEditor(page, 'Linked text');

    // No file yet: Ctrl+Alt+S asks where (native picker), then writes there
    await page.keyboard.press('Control+Alt+s');
    await expect(pill(page)).toContainText('Saved.penko');
    await expect(pill(page)).toContainText('Saved to disk');
    expect((await readPenko(await fileBytes(page, 'Saved.penko'))).content).toContain('Linked text');
    await expect(toastText(page, /Saved to Saved\.penko/).first()).toBeVisible();

    // Edit → unsaved → save writes the same file again
    await typeInEditor(page, ' plus');
    await expect(pill(page)).toContainText('Unsaved changes');
    const n = await writes(page);
    await page.keyboard.press('Control+Alt+s');
    await expect.poll(() => writes(page)).toBe(n + 1);
    expect((await readPenko(await fileBytes(page, 'Saved.penko'))).content).toContain('Linked text plus');
    await expect(pill(page)).toContainText('Saved to disk');

    // Auto-save from the pill menu
    await pill(page).click();
    await page.getByRole('menuitemcheckbox', { name: 'Auto-save to this file' }).click();
    await typeInEditor(page, ' auto');
    await expect.poll(async () => (await readPenko(await fileBytes(page, 'Saved.penko'))).content, { timeout: 10000 }).toContain('Linked text plus auto');
    await expect(pill(page)).toContainText('Saved to disk');
    await pill(page).click();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Auto-save to this file' })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');

    // Permission revoked: background auto-save stops and the pill asks; clicking it asks the browser again
    await page.evaluate(() => ((window as any).__fsa.permission = 'prompt'));
    const w0 = await writes(page);
    await typeInEditor(page, ' gated');
    await expect(pill(page)).toContainText('Click to allow saving', { timeout: 10000 });
    expect(await writes(page)).toBe(w0);
    await pill(page).click();
    await expect.poll(() => writes(page)).toBe(w0 + 1);
    expect((await readPenko(await fileBytes(page, 'Saved.penko'))).content).toContain('gated');

    // Open through the native picker: the document is linked to that file
    await page.evaluate(async b64 => {
      const w = window as any;
      w.__fsaNextOpen = new w.__FakeHandle('Other.penko', Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
    }, (await buildPenko({ ...FIELDS, id: 'picker-doc', title: 'From picker' }, '<p>picked content</p>')).toString('base64'));
    await page.getByTitle('Import', { exact: true }).click();
    await openDialog(page).getByRole('button', { name: 'Drag and drop your file here' }).click();
    await waitForText(page, 'picked content');
    await expect(pill(page)).toContainText('Other.penko');
    await page.keyboard.press('Control+Alt+s');
    await expect.poll(async () => (await fileBytes(page, 'Other.penko')).length).toBeGreaterThan(0);
    expect((await readPenko(await fileBytes(page, 'Other.penko'))).doc.id).toBe('picker-doc');

    // Recent files in the Files drawer
    await page.getByTitle('Files', { exact: true }).click();
    const recent = page.getByRole('list', { name: 'Recent files' });
    await expect(recent.getByRole('button', { name: /^Other\.penko/ })).toBeVisible();
    await expect(recent.getByRole('button', { name: /^Saved\.penko/ })).toBeVisible();
    // reopening Saved.penko goes through the handle → it's already in the app
    await recent.getByRole('button', { name: /^Saved\.penko/ }).click();
    await expect(openDialog(page).getByText('This document is already in Penko Writer')).toBeVisible();
    await openDialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    // remove an entry
    await recent.getByRole('button', { name: 'Remove from recent files: Other.penko' }).click();
    await expect(recent.getByRole('button', { name: /^Other\.penko/ })).toHaveCount(0);

    // Unlink
    await pill(page).click();
    await page.getByRole('menuitem', { name: 'Stop saving to this file' }).click();
    await expect(pill(page)).toHaveCount(0);

    // The shortcuts are listed
    await page.keyboard.press('Control+/');
    const shortcuts = page.locator('[aria-labelledby="shortcuts-dialog-title"]');
    await expect(shortcuts.getByText('Save to File')).toBeVisible();
    await expect(shortcuts.getByText('Save As…')).toBeVisible();
  });
});
