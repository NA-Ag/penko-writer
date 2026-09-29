import { test, expect, type Page } from '@playwright/test';
import { editorReady, html, newDoc, setDoc, typeInEditor, failOnNativeDialogs } from './helpers';

/**
 * Full-screen modes and floating tools: focus mode (word goal, pomodoro,
 * ambiance), presentation, markdown mode, the Penko assistant and the
 * collaboration dialog.
 */

failOnNativeDialogs();

const ribbonTab = async (page: Page, name: string) => {
  const tab = page.locator(`button[aria-label="${name}"][aria-pressed]`).first();
  if ((await tab.getAttribute('aria-pressed')) !== 'true') await tab.click();
};
const focusRoot = (page: Page) => page.locator('.fixed.inset-0.z-50').filter({ has: page.getByTitle('Exit Focus Mode') });
const focusHtml = (page: Page): Promise<string> =>
  page.evaluate(() => (document.querySelector('.fixed.inset-0.z-50 .ProseMirror') as any).editor.getHTML());
const openFocus = async (page: Page) => {
  await ribbonTab(page, 'Home');
  await page.getByRole('button', { name: 'Zen Focus Mode' }).click();
  await page.getByRole('button', { name: 'Enter Zen Space' }).waitFor();
};

/** A tiny valid WAV file (silence). */
const wav = () => {
  const samples = 800;
  const b = Buffer.alloc(44 + samples * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + samples * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(samples * 2, 40);
  return b;
};

test.describe('focus mode', () => {
  test('edits, word goal and exit restore the main editor exactly', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await setDoc(page, '<h1>Title</h1><p>Alpha <strong>beta</strong> gamma</p><ul><li><p>item</p></li></ul>');
    const before = await html(page);

    // Cancel leaves everything untouched
    await openFocus(page);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(focusRoot(page)).toHaveCount(0);
    expect(await html(page)).toBe(before);

    await openFocus(page);
    await page.locator('input[type=number]').first().fill('7');
    await page.getByRole('button', { name: 'Enter Zen Space' }).click();
    expect(await focusHtml(page)).toBe(before);
    await expect(page.getByText(/^5 \/ 7 Words/)).toBeVisible();

    await page.waitForFunction(() => document.activeElement?.closest('.fixed.inset-0.z-50') && document.activeElement.classList.contains('ProseMirror'));
    await page.keyboard.press('Control+End');
    await page.keyboard.type('delta epsilon');
    await expect(page.getByText(/^7 \/ 7 Words/)).toContainText('Goal Complete');
    // edit / clear the goal; invalid goals are rejected
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.locator('input[type=number]').first().fill('-3');
    await page.keyboard.press('Enter');
    await expect(page.locator('input[type=number]')).toHaveCount(1);
    await page.locator('input[type=number]').first().fill('20');
    await page.keyboard.press('Enter');
    await expect(page.getByText(/^7 \/ 20 Words/)).toBeVisible();
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await page.getByRole('button', { name: 'Set Word Goal' }).click();
    await page.locator('input[type=number]').first().fill('20');
    await page.keyboard.press('Enter');

    // Dialog shortcuts would open hidden dialogs underneath: swallowed
    await page.keyboard.press('Control+o');
    await expect(page.locator('[aria-labelledby="import-dialog-title"]')).toHaveCount(0);

    const final = await focusHtml(page);
    await page.getByTitle('Exit Focus Mode').click();
    await expect(focusRoot(page)).toHaveCount(0);
    expect(await html(page)).toBe(final);
    expect(final).toContain('delta epsilon');

    // Re-entering without edits changes nothing; the last goal is prefilled
    await openFocus(page);
    await expect(page.locator('input[type=number]').first()).toHaveValue('20');
    await page.getByRole('button', { name: 'Enter Zen Space' }).click();
    await page.getByTitle('Exit Focus Mode').click();
    expect(await html(page)).toBe(final);
  });

  test('typewriter mode keeps the caret centred', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await openFocus(page);
    await page.getByRole('button', { name: 'Enter Zen Space' }).click();
    await page.getByRole('button', { name: 'Typewriter Mode' }).click();
    await page.evaluate(() => (document.querySelector('.fixed.inset-0.z-50 .ProseMirror') as any).editor.commands.focus('end'));
    await page.waitForFunction(() => document.activeElement?.classList.contains('ProseMirror'));
    for (let i = 0; i < 30; i++) await page.keyboard.press('Enter');
    await page.keyboard.type('bottom');
    await page.waitForTimeout(700);
    const offset = await page.evaluate(() => {
      const ed = (document.querySelector('.fixed.inset-0.z-50 .ProseMirror') as any).editor;
      const c = ed.view.coordsAtPos(ed.state.selection.head);
      const box = document.querySelector('.fixed.inset-0.z-50 .flex-1.overflow-y-auto')!.getBoundingClientRect();
      return Math.abs((c.top + c.bottom) / 2 - (box.top + box.height / 2));
    });
    expect(offset).toBeLessThan(40);
  });

  test('strict pomodoro break locks and unlocks writing', async ({ page }) => {
    await page.clock.install();
    await editorReady(page);
    await newDoc(page);
    await openFocus(page);
    await page.getByLabel('Enable Pomodoro Timer').check();
    await page.getByRole('button', { name: 'Enter Zen Space' }).click();
    await page.getByTitle('Settings', { exact: true }).last().click();
    await page.getByText('Work Duration (minutes)').locator('xpath=..').locator('input').fill('1');
    await page.getByText('Break Duration (minutes)').locator('xpath=..').locator('input').fill('1');
    await page.getByLabel(/Strict Break Mode/).check();
    const timer = page.locator('.text-5xl');
    const editable = () => page.locator('.fixed.inset-0.z-50 .ProseMirror').getAttribute('contenteditable');
    await expect(timer).toHaveText('01:00');
    await page.getByTitle('Start', { exact: true }).click();
    await page.clock.fastForward(20_000);
    await expect(timer).toHaveText('00:40');
    await page.getByTitle('Pause', { exact: true }).click();
    await page.clock.fastForward(10_000);
    await expect(timer).toHaveText('00:40');
    await page.getByTitle('Start', { exact: true }).click();
    await page.clock.fastForward(41_000);
    await expect(page.getByText('Break Time!')).toBeVisible();
    expect(await editable()).toBe('false');
    await expect(page.getByText(/Completed Pomodoros: 1/)).toBeVisible();
    await page.clock.fastForward(61_000);
    await expect(page.getByText('Break Time!')).toHaveCount(0);
    expect(await editable()).toBe('true');
    await expect(timer).toHaveText('01:00');
    // closing the timer during a strict break releases the lock
    await page.getByTitle('Start', { exact: true }).click();
    await page.clock.fastForward(61_000);
    await expect(page.getByText('Break Time!')).toBeVisible();
    await page.getByTitle('Close', { exact: true }).last().click();
    await expect(page.getByText('Break Time!')).toHaveCount(0);
    expect(await editable()).toBe('true');
    // minimised timer is a button that restores it
    await page.getByTitle('Pomodoro Timer', { exact: true }).first().click();
    await page.getByTitle('Minimize').click();
    await page.getByRole('button', { name: /Pomodoro Timer \d\d:\d\d/ }).click();
    await expect(page.getByTitle('Minimize')).toBeVisible();
  });

  test('ambiance tracks upload, play, stop and persist', async ({ page }) => {
    await page.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        (window as any).__audio = this;
        return play.call(this).catch(() => {});
      };
    });
    await editorReady(page);
    await openFocus(page);
    await page.getByRole('button', { name: 'Enter Zen Space' }).click();
    await page.getByTitle('Ambiance', { exact: true }).click();
    const input = page.locator('input[type=file][accept*="audio"]');
    await input.setInputFiles({ name: 'rain.wav', mimeType: 'audio/wav', buffer: wav() });
    const track = page.getByRole('button', { name: /rain/ });
    await expect(track).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => !!(window as any).__audio && !(window as any).__audio.paused)).toBe(true);
    await page.locator('input[type=range]').fill('50');
    expect(await page.evaluate(() => (window as any).__audio.volume)).toBe(0.5);
    await track.click();
    expect(await page.evaluate(() => (window as any).__audio.paused)).toBe(true);
    await input.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
    await expect(page.getByText(/valid audio file/).first()).toBeVisible();
    await page.getByTitle('Exit Focus Mode').click();

    // The playlist survives a reload (blobs live in IndexedDB)
    await page.reload();
    await page.waitForFunction(() => !!window.__penkoEditor);
    await openFocus(page);
    await page.getByRole('button', { name: 'Enter Zen Space' }).click();
    await page.getByTitle('Ambiance', { exact: true }).click();
    await expect(page.getByRole('button', { name: /rain/ })).toHaveCount(1);
    await page.getByRole('button', { name: 'Delete track' }).click();
    await expect(page.getByRole('button', { name: /rain/ })).toHaveCount(0);
    await page.getByTitle('Exit Focus Mode').click();
    await openFocus(page);
    await page.getByRole('button', { name: 'Enter Zen Space' }).click();
    await page.getByTitle('Ambiance', { exact: true }).click();
    await expect(page.getByRole('button', { name: /rain/ })).toHaveCount(0);
  });
});

test.describe('presentation', () => {
  test('keys, buttons, counter, fullscreen and exit', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await setDoc(page, '<h1>One</h1><p>first</p><h2>Two</h2><p>second</p><h2>Three</h2><p>third</p>');
    // the latest keystrokes make it onto the slides
    await typeInEditor(page, ' fresh');
    await ribbonTab(page, 'View');
    await page.getByRole('button', { name: 'Present', exact: true }).click();
    const dlg = page.locator('[aria-roledescription=presentation]');
    const counter = dlg.locator('[aria-live=polite]');
    await expect(counter).toHaveText('1 / 3');
    for (const [k, want] of [
      ['ArrowRight', '2 / 3'], ['Space', '3 / 3'], ['ArrowRight', '3 / 3'], ['Shift+Space', '2 / 3'], ['Backspace', '1 / 3'],
      ['End', '3 / 3'], ['Home', '1 / 3'], ['PageDown', '2 / 3'], ['PageUp', '1 / 3'], ['Enter', '2 / 3'], ['ArrowDown', '3 / 3'], ['ArrowUp', '2 / 3'],
    ]) {
      await page.keyboard.press(k);
      await expect(counter, k).toHaveText(want);
    }
    await page.keyboard.press('End');
    await expect(dlg.locator('.penko-doc')).toContainText('third fresh');
    await expect(dlg.getByRole('button', { name: 'Next slide' })).toBeDisabled();
    await dlg.getByRole('button', { name: 'Previous slide' }).click();
    await expect(counter).toHaveText('2 / 3');
    await dlg.getByRole('button', { name: 'Next slide' }).click();
    await expect(counter).toHaveText('3 / 3');

    await page.keyboard.press('f');
    await expect(dlg.getByRole('button', { name: 'Exit full screen' })).toBeVisible();
    await dlg.getByRole('button', { name: 'Exit full screen' }).click();
    await expect(dlg.getByRole('button', { name: 'Full screen' })).toBeVisible();
    expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false);

    await page.keyboard.press('Control+f'); // no hidden find dialog underneath
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(page.locator('[role=dialog]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Present', exact: true }).click();
    await dlg.getByRole('button', { name: 'Close' }).click();
    await expect(dlg).toHaveCount(0);
  });

  test('empty document shows a placeholder slide', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await ribbonTab(page, 'View');
    await page.getByRole('button', { name: 'Present', exact: true }).click();
    const dlg = page.locator('[aria-roledescription=presentation]');
    await expect(dlg.locator('[aria-live=polite]')).toHaveText('1 / 1');
    await expect(dlg).toContainText('Start Typing to Create Slides');
  });

  test.describe('touch', () => {
    test.use({ hasTouch: true, viewport: { width: 1000, height: 700 } });
    test('swipes change slides', async ({ page, context, browserName }) => {
      await editorReady(page);
      await setDoc(page, '<h1>One</h1><p>a</p><h2>Two</h2><p>b</p><h2>Three</h2><p>c</p>');
      await ribbonTab(page, 'View');
      await page.getByRole('button', { name: 'Present', exact: true }).click();
      const counter = page.locator('[aria-roledescription=presentation] [aria-live=polite]');
      // the presentation is lazy-loaded: don't swipe before it is on screen
      await expect(counter).toHaveText('1 / 3');
      const steps = (x0: number, x1: number) => Array.from({ length: 8 }, (_, i) => x0 + ((x1 - x0) * (i + 1)) / 8);
      let swipe: (x0: number, x1: number) => Promise<void>;
      if (browserName === 'chromium') {
        // Real touch input through CDP: also proves touch-action keeps the browser from claiming the gesture
        const cdp = await context.newCDPSession(page);
        swipe = async (x0, x1) => {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: 350 }] });
          for (const x of steps(x0, x1)) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 350 }] });
            await page.waitForTimeout(16);
          }
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        };
      } else {
        // Playwright has no touch-move API outside Chromium: send the pointer events a touch produces,
        // and check the touch-action that stops the browser from claiming horizontal swipes
        const pan = await page.evaluate(() => getComputedStyle(document.elementFromPoint(700, 350)!.closest('[style*="touch-action"]')!).touchAction);
        expect(pan).toBe('pan-y pinch-zoom');
        swipe = async (x0, x1) => {
          await page.evaluate(
            ({ x0, xs }) => {
              const target = document.elementFromPoint(x0, 350)!;
              const fire = (type: string, x: number) =>
                target.dispatchEvent(
                  new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: 350, bubbles: true, cancelable: true }),
                );
              fire('pointerdown', x0);
              for (const x of xs) fire('pointermove', x);
              fire('pointerup', xs[xs.length - 1]);
            },
            { x0, xs: steps(x0, x1) },
          );
        };
      }
      await swipe(700, 300);
      await expect(counter).toHaveText('2 / 3');
      await swipe(700, 300);
      await expect(counter).toHaveText('3 / 3');
      await swipe(300, 700);
      await expect(counter).toHaveText('2 / 3');
    });
  });
});

test.describe('markdown mode', () => {
  test('toggles both ways, previews, counts words and survives a document switch', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await page.fill('#ribbon-doc-title', 'MD Spec');
    await setDoc(page, '<h1>Heading</h1><p>Some <strong>bold</strong> text.</p><ul><li><p>one</p></li></ul>');
    const toggle = async () => {
      await ribbonTab(page, 'View');
      await page.getByLabel('Markdown Mode').click();
    };
    const ta = page.locator('textarea[spellcheck=true]');
    await toggle();
    await expect(ta).toHaveValue(/# Heading[\s\S]*\*\*bold\*\*/);
    await ta.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\n\nNew *para* and $x^2$\n\n* star');
    // equations have no words: Heading Some bold text one New para and star
    await expect(page.getByText(/^\d+ words$/).first()).toHaveText('9 words');

    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const preview = page.locator('.penko-doc.h-full');
    await expect(preview.locator('em', { hasText: 'para' })).toHaveCount(1);
    await expect(preview.locator('.katex')).not.toHaveCount(0); // KaTeX loads on demand
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const typed = await ta.inputValue();

    await toggle();
    await expect(ta).toHaveCount(0);
    await page.waitForFunction(() => !!window.__penkoEditor && !window.__penkoEditor.isDestroyed);
    const rich = await html(page);
    expect(rich).toContain('<em>para</em>');
    expect(rich).toContain('<strong>bold</strong>');
    expect(rich).toContain('data-type="equation"');

    // Back to markdown: the exact source is kept (not regenerated)
    await toggle();
    await expect(ta).toHaveValue(typed);

    // Type and switch documents immediately (before the save debounce)
    await ta.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\n\nlast minute');
    await page.getByTitle('New', { exact: true }).click();
    await expect(ta).toHaveCount(0);
    expect(await html(page)).not.toContain('last minute');
    await page.getByTitle('Files', { exact: true }).click();
    await page.locator('button', { has: page.locator('span.font-medium.truncate', { hasText: 'MD Spec' }) }).first().click();
    await expect(ta).toHaveValue(/last minute$/);
  });
});

test.describe('Penko assistant', () => {
  test('replies, drag, dismiss and summon', async ({ page }) => {
    await editorReady(page);
    await newDoc(page);
    await setDoc(page, '<p>alpha beta alpha Alpha</p>');
    await page.waitForTimeout(500); // stats are debounced
    const penko = page.getByRole('button', { name: 'Penko Assistant', exact: true });
    const input = page.getByPlaceholder('Ask me how to save, export...');
    const message = page.locator('[aria-live=polite]').filter({ hasText: '"' }).first();
    await penko.click();
    for (const [q, re] of [
      ['how do I save?', /Ctrl \+ S, or click the Save/],
      ['export please', /DOCX, PDF, HTML, or TXT/],
      ['word count', /Stats button/],
      ['ruler', /margin ruler/],
      ['markdown', /raw Markdown/],
      ['bibliography', /References tab/],
      ['who are you', /I am Penko/],
      ['find alpha', /Found "alpha" 3 times/],
      ['blah', /still learning/],
    ] as const) {
      await input.fill(q);
      await input.press('Enter');
      await expect(message, q).toHaveText(re);
    }
    await input.fill('save');
    await page.locator('form button[type=submit]').click();
    await expect(message).toHaveText(/Ctrl \+ S/);
    await expect(input).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(input).toHaveCount(0);

    // drag moves Penko without toggling the bubble; the keyboard still works afterwards
    const b0 = (await penko.boundingBox())!;
    await page.mouse.move(b0.x + 30, b0.y + 30);
    await page.mouse.down();
    await page.mouse.move(b0.x - 100, b0.y - 150, { steps: 8 });
    await page.mouse.up();
    const b1 = (await penko.boundingBox())!;
    expect(Math.abs(b1.x - b0.x + 130)).toBeLessThan(4);
    expect(Math.abs(b1.y - b0.y + 180)).toBeLessThan(4);
    await expect(input).toHaveCount(0);
    await penko.focus();
    await page.keyboard.press('Enter');
    await expect(input).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(input).toHaveCount(0);

    // dismiss persists; summon greets, then shows a tip
    await page.getByTitle('Dismiss Penko').click();
    await page.reload();
    await page.waitForFunction(() => !!window.__penkoEditor);
    await page.getByRole('button', { name: 'Summon Penko' }).click();
    await expect(message).toHaveText(/You rang/);
    await expect(message).toHaveText(/^"Tip:/, { timeout: 5000 });
    // focus moved from the summon pill to Penko, so Escape closes the bubble
    await expect(penko).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(input).toHaveCount(0);
  });
});

test.describe('collaboration dialog', () => {
  test('Escape, focus and connection settings', async ({ page }) => {
    await editorReady(page);
    const open = async () => {
      await ribbonTab(page, 'Insert');
      await page.getByRole('button', { name: 'Collaborate' }).first().click();
    };
    const dlg = page.getByRole('dialog', { name: 'P2P Share & Sync' });
    await open();
    await expect(dlg).toBeVisible();
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);

    await open();
    await page.getByRole('button', { name: 'Connection settings' }).click();
    await page.fill('#collab-signaling', 'http://not-a-websocket');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dlg.locator('.text-red-500')).toHaveCount(1);
    await page.fill('#collab-signaling', 'wss://signal.example.com');
    await page.fill('#collab-turn-url', 'http://bad');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dlg.locator('.text-red-500')).toHaveCount(1);
    await page.fill('#collab-turn-url', 'turn:turn.example.com:3478');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const saved = JSON.parse((await page.evaluate(() => localStorage.getItem('penko_writer_collab_config')))!);
    expect(saved.signaling).toEqual(['wss://signal.example.com']);
    expect(saved.turnUrl).toBe('turn:turn.example.com:3478');
    await page.getByRole('button', { name: 'Reset to defaults' }).click();
    expect(await page.inputValue('#collab-turn-url')).toBe('');

    // Join form validation and back
    await page.getByRole('button', { name: /Join Peer Session/ }).click();
    await expect(page.getByRole('button', { name: 'Join Room' })).toBeDisabled();
    await page.getByRole('button', { name: 'Back' }).click();
    // QR: invalid transfer code
    await page.getByRole('button', { name: /Direct QR Clone/ }).click();
    await page.getByRole('button', { name: /Scan & Import/ }).click();
    await page.fill('#qr-manual-code', 'nonsense');
    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(dlg.getByRole('alert').filter({ hasText: 'not a valid transfer code' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel Scanner' }).click();
    await expect(page.getByRole('button', { name: /Send Document/ })).toBeVisible();
  });

  // Needs a local signaling server: PENKO_SIGNALING=ws://localhost:4444 (npx y-webrtc-signaling)
  test('host, join, sync, rename and leave (two browsers)', async ({ browser }) => {
    const signaling = process.env.PENKO_SIGNALING;
    test.skip(!signaling, 'set PENKO_SIGNALING to a y-webrtc signaling server');
    const mk = async () => {
      const ctx = await browser.newContext();
      await ctx.addInitScript(s => localStorage.setItem('penko_writer_collab_config', JSON.stringify({ signaling: [s] })), signaling);
      const page = await ctx.newPage();
      await editorReady(page);
      return page;
    };
    const A = await mk();
    const B = await mk();
    const openCollab = async (p: Page) => {
      await ribbonTab(p, 'Insert');
      await p.getByRole('button', { name: 'Collaborate' }).first().click();
    };
    await setDoc(A, '<p>Hello from Alice</p>');
    await openCollab(A);
    await A.fill('#collab-display-name', 'Alice');
    await A.getByRole('button', { name: /Start E2EE Sync Session/ }).click();
    const room = (await A.textContent('[data-testid=collab-room-code]'))!.trim();
    const pass = (await A.textContent('[data-testid=collab-room-password]'))!.trim();
    await expect(A.getByTestId('collab-connection-status')).toContainText('Connected live', { timeout: 15000 });
    await A.keyboard.press('Escape');
    await expect(A.getByTestId('collab-status-pill')).toBeVisible();

    await openCollab(B);
    await B.fill('#collab-display-name', 'Bob');
    await B.getByRole('button', { name: /Join Peer Session/ }).click();
    await B.fill('#collab-room-code', room.toLowerCase());
    await B.fill('#collab-room-password', pass);
    await B.getByRole('button', { name: 'Join Room' }).click();
    await B.waitForFunction(() => window.__penkoEditor?.getText().includes('Hello from Alice'), null, { timeout: 30000 });
    await B.fill('#collab-display-name', 'Bobby');
    await B.locator('#collab-display-name').press('Enter');
    await B.keyboard.press('Escape');
    await expect(A.getByTestId('collab-pill-count')).toHaveText('2', { timeout: 15000 });
    await A.getByTestId('collab-status-pill').getByRole('button').first().click();
    await expect(A.getByTestId('collab-participants')).toContainText('Bobby');
    await A.keyboard.press('Escape');

    await typeInEditor(B, ' and Bob');
    await A.waitForFunction(() => window.__penkoEditor.getText().includes('and Bob'), null, { timeout: 10000 });
    await B.getByTestId('collab-status-pill').getByRole('button', { name: 'Leave' }).click();
    await expect(B.getByTestId('collab-status-pill')).toHaveCount(0);
    await expect(A.getByTestId('collab-pill-count')).toHaveText('1', { timeout: 15000 });
    expect(await B.evaluate(() => window.__penkoEditor.getText())).toContain('and Bob');
    await A.getByTestId('collab-status-pill').getByRole('button', { name: 'Leave' }).click();
    await expect(A.getByTestId('collab-status-pill')).toHaveCount(0);
  });
});
