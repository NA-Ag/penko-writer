import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
  darkMode: boolean;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose, darkMode }) => {
  useEffect(() => {
    const duration = toast.duration || 3000;
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return darkMode
          ? 'bg-green-900/90 border-green-700 text-green-100'
          : 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return darkMode
          ? 'bg-red-900/90 border-red-700 text-red-100'
          : 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return darkMode
          ? 'bg-yellow-900/90 border-yellow-700 text-yellow-100'
          : 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
      default:
        return darkMode
          ? 'bg-blue-900/90 border-blue-700 text-blue-100'
          : 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getIcon = () => {
    const iconSize = 20;
    switch (toast.type) {
      case 'success':
        return <CheckCircle size={iconSize} className="text-green-500" />;
      case 'error':
        return <XCircle size={iconSize} className="text-red-500" />;
      case 'warning':
        return <AlertTriangle size={iconSize} className="text-yellow-500" />;
      case 'info':
      default:
        return <Info size={iconSize} className="text-blue-500" />;
    }
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg
        backdrop-blur-sm min-w-[300px] max-w-md
        animate-in slide-in-from-right-full fade-in duration-300
        ${getToastStyles()}
      `}
    >
      <div className="flex-shrink-0">{getIcon()}</div>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => onClose(toast.id)}
        className={`flex-shrink-0 p-1 rounded-lg transition-colors ${
          darkMode ? 'hover:bg-white/10' : 'hover:bg-black/10'
        }`}
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
  darkMode: boolean;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose, darkMode }) => {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <div className="flex flex-col gap-2 pointer-events-auto">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={onClose} darkMode={darkMode} />
        ))}
      </div>
    </div>
  );
};

export default Toast;
