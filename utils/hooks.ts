import { useState, useEffect, useRef } from 'react';

/**
 * Hook to detect if the user is on a mobile device. `onBeforeChange` runs
 * right before the value flips (e.g. a phone rotated past the breakpoint), in
 * the same event, so state it updates lands in the same render.
 */
export function useIsMobile(breakpoint: number = 768, onBeforeChange?: () => void): boolean {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint);
  const currentRef = useRef(isMobile);
  const beforeChangeRef = useRef(onBeforeChange);
  beforeChangeRef.current = onBeforeChange;

  useEffect(() => {
    const checkMobile = () => {
      const next = window.innerWidth < breakpoint;
      if (next === currentRef.current) return;
      currentRef.current = next;
      beforeChangeRef.current?.();
      setIsMobile(next);
    };

    // Check initially
    checkMobile();

    // Listen for resize
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}

/**
 * Hook to trap focus within a dialog or modal
 * Returns a ref to attach to the dialog container
 */
export function useFocusTrap<T extends HTMLElement>(isActive: boolean) {
  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Store the currently focused element to restore later
    previousActiveElement.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    // Get all focusable elements within the container
    const getFocusableElements = (): HTMLElement[] => {
      const selector =
        'a[href], button:not([disabled]), textarea:not([disabled]), ' +
        'input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(container.querySelectorAll(selector));
    };

    // Focus the first focusable element — unless something inside the dialog
    // already took focus (React `autoFocus` runs before effects), or an element
    // is explicitly marked with `data-autofocus`.
    if (!container.contains(document.activeElement)) {
      const preferred = container.querySelector<HTMLElement>('[data-autofocus], [autofocus]');
      const focusableElements = getFocusableElements();
      (preferred || focusableElements[0])?.focus();
    }

    // Handle Tab key to trap focus
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab: if on first element, go to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Cleanup: restore focus when dialog closes
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive]);

  return containerRef;
}

/*
 * Escape handling for dialogs. One window listener serves a stack of open
 * dialogs: only the most recently opened one reacts, and only when nothing
 * inside it (a composer, a menu…) already handled the key. Unlike an
 * onKeyDown on the dialog element, this keeps working after the focused
 * element was removed (e.g. a "Retry" button that disappears while loading).
 */
const escapeStack: { current: () => void }[] = [];
const onEscapeKey = (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || e.defaultPrevented || !escapeStack.length) return;
  e.preventDefault();
  escapeStack[escapeStack.length - 1].current();
};

export function useEscapeKey(active: boolean, handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    if (!escapeStack.length) window.addEventListener('keydown', onEscapeKey);
    escapeStack.push(ref);
    return () => {
      const i = escapeStack.indexOf(ref);
      if (i !== -1) escapeStack.splice(i, 1);
      if (!escapeStack.length) window.removeEventListener('keydown', onEscapeKey);
    };
  }, [active]);
}

/**
 * App-wide shortcuts that open dialogs (see the keyboard handler in
 * AppContext). While a full-screen mode covers the app those dialogs would
 * open hidden underneath it. Returns 'block' (swallow and prevent the browser
 * default), 'stop' (swallow, keep the browser default: Ctrl+F still opens the
 * browser's own find bar) or null.
 */
export const dialogShortcutAction = (e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): 'block' | 'stop' | null => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return null;
  const key = e.key.toLowerCase();
  if (key === 'f') return 'stop';
  if (key === 'o' || key === 'h' || key === 'k' || key === '/') return 'block';
  return null;
};

/** Swallows dialog-opening app shortcuts while `active` (full-screen modes). */
export function useSuppressDialogShortcuts(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const action = dialogShortcutAction(e);
      if (!action) return;
      e.stopImmediatePropagation();
      if (action === 'block') e.preventDefault();
    };
    // capture on window: runs before the app's own (bubbling) window listener
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active]);
}
