import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { LanguageCode, t } from '../utils/translations';

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
}

interface Shortcut {
  keys: string;
  description: string;
  category: string;
}

const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({
  isOpen,
  onClose,
  darkMode,
  uiLanguage,
}) => {
  if (!isOpen) return null;

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifier = isMac ? '⌘' : 'Ctrl';

  const shortcuts: Shortcut[] = [
    // Formatting
    { keys: `${modifier}+B`, description: t(uiLanguage, 'bold'), category: t(uiLanguage, 'formatting') },
    { keys: `${modifier}+I`, description: t(uiLanguage, 'italic'), category: t(uiLanguage, 'formatting') },
    { keys: `${modifier}+U`, description: t(uiLanguage, 'underline'), category: t(uiLanguage, 'formatting') },

    // Editing
    { keys: `${modifier}+Z`, description: t(uiLanguage, 'undo'), category: t(uiLanguage, 'editing') },
    { keys: `${modifier}+Y`, description: t(uiLanguage, 'redo'), category: t(uiLanguage, 'editing') },
    { keys: `${modifier}+C`, description: t(uiLanguage, 'copy'), category: t(uiLanguage, 'editing') },
    { keys: `${modifier}+X`, description: t(uiLanguage, 'cut'), category: t(uiLanguage, 'editing') },
    { keys: `${modifier}+V`, description: t(uiLanguage, 'paste'), category: t(uiLanguage, 'editing') },

    // Document
    { keys: `${modifier}+S`, description: t(uiLanguage, 'save'), category: t(uiLanguage, 'document') },
    { keys: `${modifier}+P`, description: t(uiLanguage, 'print'), category: t(uiLanguage, 'document') },
    { keys: `${modifier}+O`, description: t(uiLanguage, 'open'), category: t(uiLanguage, 'document') },

    // Navigation
    { keys: `${modifier}+F`, description: t(uiLanguage, 'find'), category: t(uiLanguage, 'navigation') },
    { keys: `${modifier}+K`, description: t(uiLanguage, 'insertLink'), category: t(uiLanguage, 'navigation') },
  ];

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div
        className={`
          max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden
          ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}
        `}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Keyboard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t(uiLanguage, 'keyboardShortcuts')}</h2>
              <p className="text-blue-100 text-sm">{t(uiLanguage, 'shortcutsDesc')}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category} className="mb-6 last:mb-0">
              <h3
                className={`text-sm font-semibold uppercase tracking-wide mb-3 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {category}
              </h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className={`
                      flex items-center justify-between p-3 rounded-lg
                      ${darkMode ? 'bg-gray-800/50 hover:bg-gray-800' : 'bg-gray-50 hover:bg-gray-100'}
                      transition-colors
                    `}
                  >
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                      {shortcut.description}
                    </span>
                    <kbd
                      className={`
                        px-3 py-1.5 rounded-md font-mono text-sm font-semibold
                        ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-800 border border-gray-300'}
                        shadow-sm
                      `}
                    >
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Tips Section */}
          <div
            className={`
              mt-6 p-4 rounded-xl border
              ${darkMode ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'}
            `}
          >
            <h3 className={`text-sm font-semibold mb-2 ${darkMode ? 'text-blue-300' : 'text-blue-900'}`}>
              💡 {t(uiLanguage, 'tip')}
            </h3>
            <p className={`text-sm ${darkMode ? 'text-blue-200' : 'text-blue-800'}`}>
              {t(uiLanguage, 'shortcutsTip')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`
            p-4 border-t flex justify-end
            ${darkMode ? 'border-gray-800' : 'border-gray-200'}
          `}
        >
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            {t(uiLanguage, 'close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsDialog;
