import { useState, useCallback, useMemo } from 'react';
import { ToastMessage, ToastType } from '../components/Toast';

let toastIdCounter = 0;
/** At most this many toasts are visible; older ones are dropped first. */
export const MAX_TOASTS = 5;

/**
 * Add a toast to the stack. An identical message that is still showing is
 * replaced (its timer restarts) instead of stacking up.
 */
export const pushToast = (list: ToastMessage[], toast: ToastMessage, max = MAX_TOASTS): ToastMessage[] =>
  [...list.filter(t => t.message !== toast.message || t.type !== toast.type), toast].slice(-max);

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
    const id = `toast-${++toastIdCounter}`;
    const newToast: ToastMessage = {
      id,
      message,
      type,
      duration,
    };

    setToasts((prev) => pushToast(prev, newToast));
    return id;
  }, []);

  const success = useCallback((message: string, duration?: number) => {
    return showToast(message, 'success', duration);
  }, [showToast]);

  const error = useCallback((message: string, duration?: number) => {
    return showToast(message, 'error', duration);
  }, [showToast]);

  const info = useCallback((message: string, duration?: number) => {
    return showToast(message, 'info', duration);
  }, [showToast]);

  const warning = useCallback((message: string, duration?: number) => {
    return showToast(message, 'warning', duration);
  }, [showToast]);

  const closeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return useMemo(
    () => ({ toasts, showToast, success, error, info, warning, closeToast }),
    [toasts, showToast, success, error, info, warning, closeToast],
  );
};
