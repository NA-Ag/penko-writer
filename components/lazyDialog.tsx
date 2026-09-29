import React, { Suspense, useState } from 'react';

/** Renders nothing (instead of taking the whole app down) when a chunk fails to load. */
class LoadBoundary extends React.Component<{ onError: (error: unknown) => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Code-split a dialog/panel: its module (and heavy dependencies such as
 * yjs, mammoth, qrcode…) is only downloaded the first time it is opened.
 *
 * The returned component takes exactly the same props as the original. It
 * renders nothing until `isOpen(props)` is first true, then stays mounted
 * (like the eager version did), so dialog state survives close/reopen.
 * The Suspense fallback is `null`, so nothing shifts while the chunk loads.
 * If the chunk can't be loaded (offline, stale deployment) the error is
 * contained: the dialog is closed again via its `onClose` prop and the rest
 * of the app keeps working. Opening it again retries the import (browsers
 * may keep the failed module cached until the page is reloaded).
 */
export function lazyDialog<P extends object>(
  load: () => Promise<React.ComponentType<P>>,
  isOpen: (props: P) => boolean = (props) => Boolean((props as { isOpen?: boolean }).isOpen),
): React.FC<P> {
  const makeLazy = () => React.lazy(() => load().then((Component) => ({ default: Component })));
  let Lazy = makeLazy();
  const Deferred: React.FC<P> = (props) => {
    const open = isOpen(props);
    const [opened, setOpened] = useState(open);
    const [failures, setFailures] = useState(0);
    const [failed, setFailed] = useState(false);
    if (open && !opened) setOpened(true);
    if (!open && failed) {
      // closed after a failed load: start over on the next open
      setFailed(false);
      setOpened(false);
    }
    if (!opened || failed) return null;
    return (
      <LoadBoundary
        key={failures}
        onError={(error) => {
          console.error('[lazyDialog] failed to load:', error);
          Lazy = makeLazy();
          setFailures((n) => n + 1);
          setFailed(true);
          // let the app's "open" flag go back to false so the user can open it again
          (props as { onClose?: () => void }).onClose?.();
        }}
      >
        <Suspense fallback={null}>
          <Lazy {...props} />
        </Suspense>
      </LoadBoundary>
    );
  };
  return Deferred;
}

/** For components that are already conditionally rendered by their parent. */
export const always = () => true;
