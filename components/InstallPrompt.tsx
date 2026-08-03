import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Monitor, CheckCircle } from 'lucide-react';
import { showInstallPrompt, isInstallPromptAvailable, isStandalone, setupInstallPrompt } from '../utils/pwa';

interface InstallPromptProps {
  darkMode: boolean;
}

const InstallPrompt: React.FC<InstallPromptProps> = ({ darkMode }) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<'accepted' | 'dismissed' | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Don't show if already installed
    if (isStandalone()) {
      return;
    }

    // Setup install prompt listener
    setupInstallPrompt(() => {
      setCanInstall(true);
      // Auto-show prompt after a delay (user has had time to explore)
      setTimeout(() => {
        if (!localStorage.getItem('penko_writer_install_dismissed')) {
          setShowPrompt(true);
        }
      }, 10000); // Show after 10 seconds
    });

    // Check if install is already available
    if (isInstallPromptAvailable()) {
      setCanInstall(true);
    }
  }, []);

  const handleInstall = async () => {
    setIsInstalling(true);
    const result = await showInstallPrompt();
    setInstallResult(result);
    setIsInstalling(false);

    if (result === 'accepted') {
      // User accepted - hide prompt
      setTimeout(() => {
        setShowPrompt(false);
      }, 2000);
    } else if (result === 'dismissed') {
      // User dismissed - don't show again for a while
      localStorage.setItem('penko_writer_install_dismissed', Date.now().toString());
      setTimeout(() => {
        setShowPrompt(false);
      }, 1000);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('penko_writer_install_dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  // Don't render if already installed or can't install
  if (isStandalone() || !canInstall) {
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
        title="Install Penko Writer"
      >
        <Download className="w-5 h-5" />
        <span className="font-medium">Install App</span>
      </button>
    );
  }

  // Full install prompt dialog
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className={`
        max-w-md w-full rounded-2xl shadow-2xl overflow-hidden
        ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}
      `}>
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white relative">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
              <img
                src="/penguin-logo.svg"
                alt="Penko Writer"
                className="w-12 h-12"
              />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Install Penko Writer</h2>
              <p className="text-blue-100 text-sm mt-1">
                Work offline, faster loading, native experience
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
                Installing...
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Penko Writer will be added to your home screen
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                <Feature
                  icon={<Smartphone className="w-5 h-5" />}
                  title="Work Anywhere"
                  description="Access your documents offline, anytime, anywhere"
                  darkMode={darkMode}
                />
                <Feature
                  icon={<Monitor className="w-5 h-5" />}
                  title="Native Experience"
                  description="Runs like a desktop app with its own window"
                  darkMode={darkMode}
                />
                <Feature
                  icon={<Download className="w-5 h-5" />}
                  title="Instant Loading"
                  description="Faster startup and better performance"
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
                  {isInstalling ? 'Installing...' : 'Install Now'}
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
                  Not Now
                </button>
              </div>

              <p className={`text-xs text-center mt-4 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                You can install Penko Writer at any time from your browser menu
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
