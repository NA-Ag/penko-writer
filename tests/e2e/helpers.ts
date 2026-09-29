import { test, type Download, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/** Shared helpers for the end-to-end specs (dev server, `window.__penkoEditor`). */

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Opens the app and waits for the editor instance. */
export const editorReady = async (page: Page) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__penkoEditor, null, { timeout: 20000 });
};

export const html = (page: Page): Promise<string> => page.evaluate(() => window.__penkoEditor.getHTML());
export const text = (page: Page): Promise<string> => page.evaluate(() => window.__penkoEditor.getText());

/** Replaces the document content (as a user edit, so it is saved). */
export const setDoc = async (page: Page, h: string) => {
  await page.evaluate(h => window.__penkoEditor.commands.setContent(h, { emitUpdate: true }), h);
  await page.waitForTimeout(50);
};

/** Creates a new document and waits for its editor. */
export const newDoc = async (page: Page) => {
  const before = await page.evaluate(() => window.__penkoEditor);
  await page.getByTitle('New', { exact: true }).click();
  await page.waitForFunction(prev => window.__penkoEditor && window.__penkoEditor !== prev, before);
};

export const typeInEditor = async (page: Page, s: string) => {
  await page.evaluate(() => window.__penkoEditor.commands.focus('end'));
  // Tiptap moves DOM focus on the next frame
  await page.waitForFunction(() => document.activeElement?.classList.contains('ProseMirror'));
  await page.keyboard.type(s);
};

export const readDownload = async (d: Download) => fs.readFileSync((await d.path())!);

/** A file from tests/unit/fixtures or tests/e2e/fixtures. */
export const fixture = (name: string, dir: 'unit' | 'e2e' = 'unit') => path.join(HERE, '..', dir, 'fixtures', name);

/** Visible toast with this text (the sr-only live region duplicates it). */
export const toastText = (page: Page, re: RegExp) => page.locator('div.fixed.top-4.right-4 p', { hasText: re });

/** Every test fails if the app shows alert() / confirm() / prompt(). */
export const failOnNativeDialogs = () =>
  test.beforeEach(async ({ page }) => {
    page.on('dialog', d => {
      throw new Error('native dialog shown: ' + d.message());
    });
  });
