import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { editorReady, setDoc } from './helpers';
import { startWebDavServer } from './fixtures/webdav-server.mjs';

/**
 * Device sync: two browser contexts (= two devices with separate storage)
 * syncing through a local WebDAV server, and through a paired WebRTC link.
 */

type DavServer = Awaited<ReturnType<typeof startWebDavServer>>;
const HERE = path.dirname(fileURLToPath(import.meta.url));

let server: DavServer;
const contexts: BrowserContext[] = [];

test.beforeEach(async () => {
  server = await startWebDavServer();
});
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map(c => c.close()));
  await server.close();
});

const device = async (browser: Browser, init?: (ctx: BrowserContext) => Promise<void>) => {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  contexts.push(ctx);
  await init?.(ctx);
  const page = await ctx.newPage();
  page.on('dialog', d => {
    throw new Error('native dialog shown: ' + d.message());
  });
  await editorReady(page);
  return page;
};

const dialog = (p: Page) => p.getByRole('dialog', { name: 'Sync' });

const openSync = async (p: Page) => {
  if (await dialog(p).isVisible()) return;
  await p.locator('button[title="Sync"]').first().click();
  await expect(dialog(p)).toBeVisible({ timeout: 20000 });
  await expect(p.locator('#sync-device-name')).toBeVisible({ timeout: 20000 });
};

const closeSync = async (p: Page) => {
  if (await dialog(p).isVisible()) await dialog(p).getByRole('button', { name: 'Close' }).click();
  await expect(dialog(p)).toHaveCount(0);
};

const fillServer = async (p: Page, url: string, passphrase: string) => {
  await openSync(p);
  await p.fill('#sync-url', url);
  await p.fill('#sync-user', 'penko');
  await p.fill('#sync-password', 'secret');
  await p.fill('#sync-passphrase', passphrase);
};

const connect = async (p: Page, passphrase = 'correct horse battery') => {
  await fillServer(p, server.url, passphrase);
  await dialog(p).getByRole('button', { name: 'Connect and sync' }).click();
  await expect(p.getByTestId('sync-status')).toContainText(/Last synced/, { timeout: 30000 });
};

const syncNow = async (p: Page) => {
  await openSync(p);
  const button = dialog(p).getByRole('button', { name: 'Sync now' });
  await expect(button).toBeEnabled({ timeout: 15000 });
  await button.click();
  await expect(button).toBeEnabled({ timeout: 15000 });
};

const editorText = (p: Page) => p.evaluate(() => window.__penkoEditor.getText());

/** Content of every document stored in the device's IndexedDB. */
const storedDocs = (p: Page) =>
  p.evaluate(async () => {
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
    return all.map(d => ({ id: d.id as string, title: d.title as string, content: d.content as string }));
  });

const openDocByTitle = async (p: Page, title: string) => {
  await closeSync(p);
  await p.getByTitle('Files', { exact: true }).click();
  await p.getByRole('listitem').filter({ hasText: title }).getByRole('button').first().click();
  await expect(p.locator('#ribbon-doc-title')).toHaveValue(title);
};

const setTitle = async (p: Page, title: string) => {
  await p.fill('#ribbon-doc-title', title);
};

test('WebDAV: set up, sync to a second device, live update and offline merge', async ({ browser }) => {
  const A = await device(browser);
  const B = await device(browser);

  await setTitle(A, 'Shared notes');
  await setDoc(A, '<p>First paragraph</p><p>Second paragraph</p>');
  await connect(A);
  // only ciphertext on the server
  const blob = Buffer.concat([...server.files.values()].map(f => f.data)).toString('latin1');
  expect(blob).not.toContain('First paragraph');
  expect(blob).not.toContain('Shared notes');
  expect([...server.files.keys()]).toContain('/Penko/penko-sync.json');

  await connect(B);
  await expect.poll(async () => (await storedDocs(B)).find(d => d.title === 'Shared notes')?.content || '', { timeout: 20000 }).toContain('First paragraph');
  await expect(B.getByTestId('sync-indicator')).toBeVisible();
  await openDocByTitle(B, 'Shared notes');
  expect(await editorText(B)).toContain('Second paragraph');

  // an edit on A shows up in B's open editor (caret kept, no reload)
  await A.evaluate(() => window.__penkoEditor.commands.insertContentAt(1, 'Edited on A: '));
  await B.evaluate(() => window.__penkoEditor.commands.setTextSelection(3));
  const editorBefore = await B.evaluate(() => ((window as any).__editorBefore = window.__penkoEditor, true));
  expect(editorBefore).toBe(true);
  await expect
    .poll(async () => {
      await syncNow(A);
      await syncNow(B);
      return editorText(B);
    }, { timeout: 30000 })
    .toContain('Edited on A: First paragraph');
  expect(await B.evaluate(() => (window as any).__editorBefore === window.__penkoEditor)).toBe(true);

  // both devices go offline and edit different paragraphs
  server.setOffline(true);
  await closeSync(A);
  await closeSync(B);
  await A.evaluate(() => {
    const ed = window.__penkoEditor;
    let end = 0;
    ed.state.doc.forEach((node, offset, index) => index === 0 && (end = offset + node.nodeSize - 1));
    ed.commands.insertContentAt(end, ' +A offline');
  });
  await B.evaluate(() => {
    const ed = window.__penkoEditor;
    ed.commands.insertContentAt(ed.state.doc.content.size - 1, ' +B offline');
  });
  await syncNow(A);
  await expect(A.getByTestId('sync-status')).toContainText(/Offline|reach/i, { timeout: 15000 });
  server.setOffline(false);
  await expect
    .poll(async () => {
      await syncNow(A);
      await syncNow(B);
      await syncNow(A);
      return [await editorText(A), await editorText(B)].join(' | ');
    }, { timeout: 40000 })
    .toMatch(/First paragraph \+A offline[\s\S]*Second paragraph \+B offline \| [\s\S]*First paragraph \+A offline[\s\S]*Second paragraph \+B offline/);
  expect(await A.evaluate(() => window.__penkoEditor.getHTML())).toBe(await B.evaluate(() => window.__penkoEditor.getHTML()));

  // title changes sync as fields
  await closeSync(A);
  await setTitle(A, 'Shared notes v2');
  await expect
    .poll(async () => {
      await syncNow(A);
      await syncNow(B);
      return B.locator('#ribbon-doc-title').inputValue();
    }, { timeout: 30000 })
    .toBe('Shared notes v2');
});

test('WebDAV: deleting a document removes it on the other device', async ({ browser }) => {
  const A = await device(browser);
  const B = await device(browser);
  await setTitle(A, 'Doomed');
  await setDoc(A, '<p>short-lived</p>');
  await connect(A);
  await connect(B);
  await expect.poll(async () => (await storedDocs(B)).some(d => d.title === 'Doomed'), { timeout: 20000 }).toBe(true);

  await closeSync(A);
  await A.getByTitle('Files', { exact: true }).click();
  const item = A.getByRole('listitem').filter({ hasText: 'Doomed' });
  await item.hover();
  await item.getByRole('button', { name: 'Remove from History' }).click();
  await item.getByTitle('Delete', { exact: true }).click();
  await expect(A.getByRole('listitem').filter({ hasText: 'Doomed' })).toHaveCount(0);
  await expect
    .poll(async () => {
      await syncNow(A);
      await syncNow(B);
      return (await storedDocs(B)).some(d => d.title === 'Doomed');
    }, { timeout: 30000 })
    .toBe(false);
  // the encrypted files of the deleted document are gone from the server too
  const docId = (await storedDocs(A)).find(d => d.title === 'Doomed')?.id;
  expect(docId).toBeUndefined();
});

test('WebDAV: wrong passphrase, bad credentials and CORS problems are explained', async ({ browser }) => {
  const A = await device(browser);
  await connect(A, 'the right passphrase');
  const B = await device(browser);
  await fillServer(B, server.url, 'not the right one');
  await dialog(B).getByRole('button', { name: 'Connect and sync' }).click();
  await expect(dialog(B).getByRole('alert')).toContainText('Wrong sync passphrase', { timeout: 20000 });

  await B.fill('#sync-password', 'wrong');
  await dialog(B).getByRole('button', { name: 'Test' }).click();
  await expect(dialog(B).getByRole('alert')).toContainText('rejected the username or app password');

  await B.fill('#sync-password', 'secret');
  await dialog(B).getByRole('button', { name: 'Test' }).click();
  await expect(dialog(B).getByText('Connection works.')).toBeVisible();

  const noCors = await startWebDavServer({ cors: false });
  try {
    await B.fill('#sync-url', noCors.url);
    await dialog(B).getByRole('button', { name: 'Test' }).click();
    await expect(dialog(B).getByRole('alert')).toContainText('CORS', { timeout: 15000 });
    await expect(dialog(B).getByRole('alert')).toContainText('http://localhost');
  } finally {
    await noCors.close();
  }

  // short passphrases are refused before anything is sent
  await B.fill('#sync-url', server.url);
  await B.fill('#sync-passphrase', 'short');
  await dialog(B).getByRole('button', { name: 'Connect and sync' }).click();
  await expect(dialog(B).getByRole('alert')).toContainText('at least 8 characters');
});

/* ------------------------------------------------------------------ */
/* Device-to-device (WebRTC)                                           */
/* ------------------------------------------------------------------ */

test.describe('paired devices', () => {
  let signaling: ChildProcess | null = null;
  const PORT = 4499;

  test.beforeAll(async () => {
    test.skip(process.env.PENKO_SKIP_P2P === '1', 'P2P sync tests disabled');
    signaling = spawn(process.execPath, [path.join(HERE, '../../node_modules/y-webrtc/bin/server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`http://127.0.0.1:${PORT}`)).ok) return;
      } catch {
        /* not up yet */
      }
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('signaling server did not start');
  });
  test.afterAll(() => {
    signaling?.kill();
  });

  const withSignaling = async (ctx: BrowserContext) => {
    await ctx.addInitScript(url => localStorage.setItem('penko_writer_collab_config', JSON.stringify({ signaling: [url] })), `ws://localhost:${PORT}`);
  };

  test('pair two devices, sync all documents, rename and unpair', async ({ browser }) => {
    const A = await device(browser, withSignaling);
    let B = await device(browser, withSignaling);
    await setTitle(A, 'Paired doc');
    await setDoc(A, '<p>Hello over WebRTC</p>');

    await openSync(A);
    await A.fill('#sync-device-name', 'Alice laptop');
    await A.locator('#sync-device-name').press('Enter');
    await dialog(A).getByRole('tab', { name: 'Devices' }).click();
    await dialog(A).getByRole('button', { name: /Pair a new device/ }).click();
    const code = (await A.getByTestId('sync-pairing-code').textContent({ timeout: 15000 }))!.trim();
    expect(code).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){5}$/);

    await openSync(B);
    await dialog(B).getByRole('tab', { name: 'Devices' }).click();
    await dialog(B).getByRole('button', { name: /Enter a pairing code/ }).click();
    await B.fill('#sync-pair-code', code.toLowerCase());
    await dialog(B).getByRole('button', { name: 'Pair', exact: true }).click();

    await expect(B.getByTestId('sync-devices')).toContainText('Alice laptop', { timeout: 40000 });
    await expect(A.getByTestId('sync-devices')).toHaveCount(1, { timeout: 20000 });
    await expect(B.getByTestId('sync-devices')).toContainText('Connected', { timeout: 40000 });

    // A's document arrives on B
    await expect.poll(async () => (await storedDocs(B)).find(d => d.title === 'Paired doc')?.content || '', { timeout: 40000 }).toContain('Hello over WebRTC');
    await openDocByTitle(B, 'Paired doc');

    // live edits both ways
    await A.evaluate(() => window.__penkoEditor.commands.insertContentAt(1, 'A says: '));
    await expect.poll(() => editorText(B), { timeout: 20000 }).toContain('A says: Hello over WebRTC');
    await B.evaluate(() => window.__penkoEditor.commands.insertContentAt(window.__penkoEditor.state.doc.content.size - 1, ' (B was here)'));
    await expect.poll(() => editorText(A), { timeout: 20000 }).toContain('Hello over WebRTC (B was here)');

    // B goes away while A keeps editing; when B is back, both devices reconnect and it catches up
    const ctxB = B.context();
    await B.close();
    await A.evaluate(() => window.__penkoEditor.commands.insertContentAt(window.__penkoEditor.state.doc.content.size - 1, ' (while B was away)'));
    B = await ctxB.newPage();
    await editorReady(B);
    await expect(B.locator('#ribbon-doc-title')).toHaveValue('Paired doc');
    await expect.poll(() => editorText(B), { timeout: 40000 }).toContain('(B was here) (while B was away)');

    // rename on B is local
    await openSync(B);
    await dialog(B).getByRole('tab', { name: 'Devices' }).click();
    await dialog(B).getByRole('button', { name: 'Rename: Alice laptop' }).click();
    await B.keyboard.press('ControlOrMeta+a');
    await B.keyboard.type('Work laptop');
    await B.keyboard.press('Enter');
    await expect(B.getByTestId('sync-devices')).toContainText('Work laptop');

    // unpair: both sides forget each other
    await dialog(B).getByRole('button', { name: 'Unpair: Work laptop' }).click();
    await dialog(B).getByRole('button', { name: 'Unpair', exact: true }).click();
    await expect(B.getByTestId('sync-devices')).toHaveCount(0);
    await expect(dialog(B).getByText('No paired devices yet.')).toBeVisible();
    await openSync(A);
    await dialog(A).getByRole('tab', { name: 'Devices' }).click();
    await expect(dialog(A).getByText('No paired devices yet.')).toBeVisible({ timeout: 20000 });
  });
});
