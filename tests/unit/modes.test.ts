import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { dialogShortcutAction, useIsMobile } from '../../utils/hooks';
import { getAssistantReply } from '../../components/PenkoAssistant';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
  ({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods }) as KeyboardEvent;

describe('dialogShortcutAction (full-screen modes)', () => {
  it('blocks dialog shortcuts and keeps the browser find bar', () => {
    expect(dialogShortcutAction(key('o', { ctrlKey: true }))).toBe('block');
    expect(dialogShortcutAction(key('K', { metaKey: true }))).toBe('block');
    expect(dialogShortcutAction(key('/', { ctrlKey: true }))).toBe('block');
    expect(dialogShortcutAction(key('h', { ctrlKey: true }))).toBe('block');
    expect(dialogShortcutAction(key('f', { ctrlKey: true }))).toBe('stop');
  });
  it('leaves editing shortcuts and plain keys alone', () => {
    expect(dialogShortcutAction(key('h', { ctrlKey: true, shiftKey: true }))).toBeNull(); // highlight
    expect(dialogShortcutAction(key('b', { ctrlKey: true }))).toBeNull();
    expect(dialogShortcutAction(key('s', { ctrlKey: true }))).toBeNull();
    expect(dialogShortcutAction(key('o', { ctrlKey: true, altKey: true }))).toBeNull();
    expect(dialogShortcutAction(key('o'))).toBeNull();
  });
});

describe('useIsMobile', () => {
  const setWidth = (w: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
    window.dispatchEvent(new Event('resize'));
  };
  afterEach(() => setWidth(1024));

  it('runs onBeforeChange once, before the layout flips', () => {
    setWidth(400);
    const seen: boolean[] = [];
    let current: boolean | null = null;
    const before = vi.fn(() => seen.push(current as boolean));
    const Probe = () => {
      current = useIsMobile(768, before);
      return null;
    };
    const el = document.createElement('div');
    const root = createRoot(el);
    act(() => root.render(React.createElement(Probe)));
    expect(current).toBe(true);
    act(() => setWidth(500)); // same side of the breakpoint
    expect(before).not.toHaveBeenCalled();
    act(() => setWidth(900)); // rotated to landscape past the breakpoint
    expect(before).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([true]); // called while still mobile
    expect(current).toBe(false);
    act(() => setWidth(1000));
    expect(before).toHaveBeenCalledTimes(1);
    act(() => setWidth(390));
    expect(before).toHaveBeenCalledTimes(2);
    expect(current).toBe(true);
    act(() => root.unmount());
  });
});

describe('getAssistantReply (Penko)', () => {
  const text = () => 'Alpha beta alpha (a.b) ALPHA';
  it.each([
    ['how do I save', 'Ctrl + S'],
    ['download it', 'DOCX'],
    ['word count?', 'Stats'],
    ['the ruler', 'ruler'],
    ['Markdown', 'Markdown Mode'],
    ['add a citation', 'References'],
    ['who are you', 'Penko'],
  ])('answers %s', (q, expected) => {
    expect(getAssistantReply(q, 'en-US', text)).toContain(expected);
  });
  it('counts search terms case-insensitively and literally', () => {
    expect(getAssistantReply('find alpha', 'en-US', text)).toBe('Found "alpha" 3 times in the document.');
    expect(getAssistantReply('search a.b', 'en-US', text)).toContain('1 times');
    expect(getAssistantReply('search (', 'en-US', text)).toContain('1 times');
  });
  it('localizes and falls back to English', () => {
    expect(getAssistantReply('guardar', 'es', text)).toContain('Guardar');
    expect(getAssistantReply('buscar beta', 'es', text)).toContain('1 veces');
    expect(getAssistantReply('save', 'xx', text)).toContain('Ctrl + S');
    expect(getAssistantReply('qwerty', 'en-US', text)).toContain('still learning');
  });
});
