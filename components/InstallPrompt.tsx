import React, { useState, useEffect, useSyncExternalStore, useRef } from 'react';
import { Download, X, Smartphone, Monitor, CheckCircle, RefreshCw } from 'lucide-react';
import {
  showInstallPrompt,
  isStandalone,
  subscribePwa,
  getPwaState,
  applyUpdate,
  dismissUpdate,
  dismissOfflineReady,
  snoozeInstallPrompt,
  installPromptSnoozed,
} from '../utils/pwa';
import { useApp } from '../AppContext';
import { useEscapeKey, useFocusTrap } from '../utils/hooks';
import { t } from '../utils/translations';

interface InstallPromptProps {
  darkMode: boolean;
}

const usePwaState = () => useSyncExternalStore(subscribePwa, getPwaState, getPwaState);

/**
 * PWA UI: the "new version available" banner, the one-time "ready offline"
 * toast, and the install button/dialog. Mounted once from DialogsContainer.
 */
const InstallPrompt: React.FC<InstallPromptProps> = ({ darkMode }) => {
  useLaunchShortcut();
  return (
    <>
      <UpdateBanner darkMode={darkMode} />
      <InstallButton darkMode={darkMode} />
    </>
  );
};

/** Handles the manifest's "New Document" shortcut (start URL `?action=new`). */
function useLaunchShortcut() {
  const { docsLoaded, handleNewDoc } = useApp();
  const handled = useRef(false);
  useEffect(() => {
    if (!docsLoaded || handled.current) return;
    handled.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') !== 'new') return;
    params.delete('action');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    handleNewDoc();
  }, [docsLoaded, handleNewDoc]);
}

const UpdateBanner: React.FC<{ darkMode: boolean }> = ({ darkMode }) => {
  const { needRefresh, offlineReady } = usePwaState();
  const { toast, uiLanguage } = useApp();
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!offlineReady) return;
    toast.success(t(uiLanguage, 'pwaOfflineReady'));
    dismissOfflineReady();
  }, [offlineReady, toast, uiLanguage]);

  if (!needRefresh) return null;

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      await applyUpdate(); // reloads once the new service worker has taken control
    } catch {
      setUpdating(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        fixed bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[9998]
        flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm sm:min-w-[360px] max-w-md
        ${darkMode ? 'bg-blue-900/90 border-blue-700 text-blue-100' : 'bg-blue-50 border-blue-200 text-blue-800'}
      `}
    >
      <div className="flex-shrink-0">
        <RefreshCw size={20} className={`text-blue-500 ${updating ? 'animate-spin' : ''}`} />
      </div>
      <p className="flex-1 text-sm font-medium">{t(uiLanguage, 'pwaUpdateAvailable')}</p>
      <button
        onClick={handleUpdate}
        disabled={updating}
        className="flex-shrink-0 px-3 py-1.5 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
      >
        {t(uiLanguage, 'pwaUpdateNow')}
      </button>
      <button
        onClick={dismissUpdate}
        disabled={updating}
        className={`flex-shrink-0 p-1 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
        aria-label={t(uiLanguage, 'pwaUpdateLater')}
        title={t(uiLanguage, 'pwaUpdateLater')}
      >
        <X size={16} />
      </button>
    </div>
  );
};

const InstallButton: React.FC<InstallPromptProps> = ({ darkMode }) => {
  const { canInstall } = usePwaState();
  const { uiLanguage } = useApp();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<'accepted' | 'dismissed' | 'unavailable' | null>(null);
  const autoShown = useRef(false);
  const dialogRef = useFocusTrap<HTMLDivElement>(showPrompt);
  const hideTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  useEffect(() => {
    // Auto-show the dialog once, a little after the prompt becomes available
    // (the user has had time to explore), unless it was dismissed recently.
    if (!canInstall || autoShown.current || isStandalone()) return;
    autoShown.current = true;
    const timer = setTimeout(() => {
      if (!installPromptSnoozed()) setShowPrompt(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [canInstall]);

  const handleInstall = async () => {
    setIsInstalling(true);
    const result = await showInstallPrompt();
    setInstallResult(result);
    setIsInstalling(false);

    // Accepted: show the confirmation briefly. Dismissed (or the prompt went
    // away): don't auto-show again for 14 days.
    if (result !== 'accepted') snoozeInstallPrompt();
    hideTimer.current = window.setTimeout(() => setShowPrompt(false), result === 'accepted' ? 2000 : 1000);
  };

  const handleDismiss = () => {
    snoozeInstallPrompt();
    setShowPrompt(false);
  };
  useEscapeKey(showPrompt && !isInstalling, handleDismiss);

  // Don't render if already installed or can't install (keep the dialog if it is showing the result)
  if (isStandalone() || (!canInstall && !showPrompt)) {
    return null;
  }

  // Floating install button (always visible when installable)
  if (!showPrompt) {
    return (
      <button
        onClick={() => setShowPrompt(true)}
        className={`
          fixed bottom-6 right-6 z-50
          flex items-center gap-2 px-4 py-3 rounded-full
          shadow-lg hover:shadow-xl transition-all
          ${darkMode
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
        `}
        title={t(uiLanguage, 'installPenkoWriter')}
      >
        <Download className="w-5 h-5" />
        <span className="font-medium">{t(uiLanguage, 'installApp')}</span>
      </button>
    );
  }

  // Full install prompt dialog
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="install-dialog-title">
      <div ref={dialogRef} className={`
        max-w-md w-full rounded-2xl shadow-2xl overflow-hidden
        ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}
      `}>
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white relative">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
            aria-label={t(uiLanguage, 'close')}
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
              <img
                src={`${import.meta.env.BASE_URL}penguin-logo.svg`}
                alt=""
                className="w-12 h-12"
              />
            </div>
            <div>
              <h2 id="install-dialog-title" className="text-2xl font-bold">{t(uiLanguage, 'installPenkoWriter')}</h2>
              <p className="text-blue-100 text-sm mt-1">
                {t(uiLanguage, 'workOffline')}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {installResult === 'accepted' ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {t(uiLanguage, 'installing')}
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {t(uiLanguage, 'addedToHomeScreen')}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                <Feature
                  icon={<Smartphone className="w-5 h-5" />}
                  title={t(uiLanguage, 'workAnywhere')}
                  description={t(uiLanguage, 'accessOffline')}
                  darkMode={darkMode}
                />
                <Feature
                  icon={<Monitor className="w-5 h-5" />}
                  title={t(uiLanguage, 'nativeExperience')}
                  description={t(uiLanguage, 'runsLikeDesktop')}
                  darkMode={darkMode}
                />
                <Feature
                  icon={<Download className="w-5 h-5" />}
                  title={t(uiLanguage, 'instantLoading')}
                  description={t(uiLanguage, 'fasterStartup')}
                  darkMode={darkMode}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className={`
                    flex-1 px-6 py-3 rounded-xl font-semibold
                    bg-blue-600 hover:bg-blue-700 text-white
                    transition-colors disabled:opacity-50
                    ${isInstalling ? 'cursor-wait' : ''}
                  `}
                >
                  {isInstalling ? t(uiLanguage, 'installing') : t(uiLanguage, 'installNow')}
                </button>
                <button
                  onClick={handleDismiss}
                  className={`
                    px-6 py-3 rounded-xl font-semibold
                    ${darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    }
                    transition-colors
                  `}
                >
                  {t(uiLanguage, 'notNow')}
                </button>
              </div>

              <p className={`text-xs text-center mt-4 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                {t(uiLanguage, 'canInstallAnytime')}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Feature component for install benefits
const Feature: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  darkMode: boolean;
}> = ({ icon, title, description, darkMode }) => (
  <div className="flex gap-3">
    <div className={`
      w-10 h-10 rounded-lg flex items-center justify-center shrink-0
      ${darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}
    `}>
      {icon}
    </div>
    <div>
      <h4 className={`font-semibold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        {title}
      </h4>
      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        {description}
      </p>
    </div>
  </div>
);

export default InstallPrompt;
