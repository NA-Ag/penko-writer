import { describe, it, expect, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { pushToast, MAX_TOASTS } from '../../utils/useToast';
import type { ToastMessage } from '../../components/Toast';
import {
  setLanguageToolServer, getLanguageToolServer, languageToolCheckUrl, hasLanguageToolConsent, setLanguageToolConsent, DEFAULT_LANGUAGETOOL_SERVER,
} from '../../utils/spellcheckSettings';
import { formatRelativeTime } from '../../utils/relativeTime';
import { useEscapeKey } from '../../utils/hooks';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('toast stack', () => {
  const toast = (id: string, message: string, type: ToastMessage['type'] = 'info'): ToastMessage => ({ id, message, type });

  it('replaces an identical visible message instead of stacking it', () => {
    let list = pushToast([], toast('1', 'Saved', 'success'));
    list = pushToast(list, toast('2', 'Other'));
    list = pushToast(list, toast('3', 'Saved', 'success'));
    expect(list.map(t => t.id)).toEqual(['2', '3']);
    // same text but a different type is a different toast
    expect(pushToast(list, toast('4', 'Saved', 'error')).map(t => t.id)).toEqual(['2', '3', '4']);
  });

  it('keeps only the newest MAX_TOASTS', () => {
    let list: ToastMessage[] = [];
    for (let i = 0; i < MAX_TOASTS + 3; i++) list = pushToast(list, toast(String(i), `m${i}`));
    expect(list).toHaveLength(MAX_TOASTS);
    expect(list[list.length - 1].id).toBe(String(MAX_TOASTS + 2));
  });
});

describe('LanguageTool settings', () => {
  beforeEach(() => localStorage.clear());

  it('normalises custom server URLs and rejects invalid ones', () => {
    expect(setLanguageToolServer('http://localhost:8081/v2/check/')).toBe(true);
    expect(getLanguageToolServer()).toBe('http://localhost:8081');
    expect(languageToolCheckUrl()).toBe('http://localhost:8081/v2/check');
    expect(setLanguageToolServer('ftp://example.com')).toBe(false);
    expect(setLanguageToolServer('not a url')).toBe(false);
    expect(getLanguageToolServer()).toBe('http://localhost:8081');
    expect(setLanguageToolServer('')).toBe(true);
    expect(getLanguageToolServer()).toBe(DEFAULT_LANGUAGETOOL_SERVER);
  });

  it('remembers consent per server', () => {
    setLanguageToolConsent(true);
    expect(hasLanguageToolConsent()).toBe(true);
    setLanguageToolServer('https://lt.example.org');
    expect(hasLanguageToolConsent()).toBe(false);
    setLanguageToolServer('');
    expect(hasLanguageToolConsent()).toBe(true);
    setLanguageToolConsent(false);
    expect(hasLanguageToolConsent()).toBe(false);
  });
});

describe('relative time', () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);
  it('formats recent times relatively and older ones as dates', () => {
    expect(formatRelativeTime(now - 10_000, 'en-US', 'Just now', now)).toBe('Just now');
    expect(formatRelativeTime(now - 5 * 60_000, 'en-US', 'Just now', now)).toBe('5 min. ago');
    expect(formatRelativeTime(now - 3 * 3_600_000, 'en-US', 'Just now', now)).toBe('3 hr. ago');
    expect(formatRelativeTime(now - 86_400_000, 'en-US', 'Just now', now)).toBe('yesterday');
    expect(formatRelativeTime(now - 30 * 86_400_000, 'en-US', 'Just now', now)).toMatch(/Dec 16, 2025/);
  });
});

describe('useEscapeKey', () => {
  const Dialog: React.FC<{ active: boolean; onEscape: () => void }> = ({ active, onEscape }) => {
    useEscapeKey(active, onEscape);
    return null;
  };
  const press = () => {
    const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(e);
    return e;
  };

  it('only the most recently opened dialog handles Escape', () => {
    const calls: string[] = [];
    const root = createRoot(document.createElement('div'));
    const render = (a: boolean, b: boolean) =>
      act(() =>
        root.render(
          React.createElement(React.Fragment, null,
            React.createElement(Dialog, { active: a, onEscape: () => calls.push('a') }),
            React.createElement(Dialog, { active: b, onEscape: () => calls.push('b') }),
          ),
        ),
      );
    render(true, false);
    render(true, true);
    expect(press().defaultPrevented).toBe(true);
    expect(calls).toEqual(['b']);
    render(true, false);
    press();
    expect(calls).toEqual(['b', 'a']);
    render(false, false);
    expect(press().defaultPrevented).toBe(false);
    expect(calls).toEqual(['b', 'a']);
    act(() => root.unmount());
  });

  it('ignores an Escape that something inside already handled', () => {
    let called = 0;
    const root = createRoot(document.createElement('div'));
    act(() => root.render(React.createElement(Dialog, { active: true, onEscape: () => called++ })));
    // e.g. a comment composer inside the panel cancels itself on Escape
    const composer = document.body.appendChild(document.createElement('textarea'));
    composer.addEventListener('keydown', e => e.preventDefault());
    composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(called).toBe(0);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(called).toBe(1);
    composer.remove();
    act(() => root.unmount());
  });
});
