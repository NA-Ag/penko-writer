import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import { LanguageCode, t } from '../utils/translations';
import { useFocusTrap } from '../utils/hooks';

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
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || '');
  const mod = isMac ? '⌘' : 'Ctrl';
  const alt = isMac ? '⌥' : 'Alt';
  const shift = isMac ? '⇧' : 'Shift';

  const cat = {
    formatting: t(uiLanguage, 'formatting'),
    paragraph: t(uiLanguage, 'grpParagraph'),
    editing: t(uiLanguage, 'editing'),
    insert: t(uiLanguage, 'tabInsert'),
    document: t(uiLanguage, 'document'),
    screenplay: t(uiLanguage, 'screenplayMode'),
  };

  const shortcuts: Shortcut[] = [
    // Formatting
    { keys: `${mod}+B`, description: t(uiLanguage, 'bold'), category: cat.formatting },
    { keys: `${mod}+I`, description: t(uiLanguage, 'italic'), category: cat.formatting },
    { keys: `${mod}+U`, description: t(uiLanguage, 'underline'), category: cat.formatting },
    { keys: `${mod}+${shift}+S`, description: t(uiLanguage, 'strikethrough'), category: cat.formatting },
    { keys: `${mod}+,`, description: t(uiLanguage, 'subscript'), category: cat.formatting },
    { keys: `${mod}+.`, description: t(uiLanguage, 'superscript'), category: cat.formatting },
    { keys: `${mod}+E`, description: t(uiLanguage, 'inlineCode'), category: cat.formatting },
    { keys: `${mod}+${shift}+H`, description: t(uiLanguage, 'highlightColor'), category: cat.formatting },

    // Paragraph
    { keys: `${mod}+${alt}+1…6`, description: t(uiLanguage, 'headingsShortcut'), category: cat.paragraph },
    { keys: `${mod}+${alt}+0`, description: t(uiLanguage, 'normalText'), category: cat.paragraph },
    { keys: `${mod}+${shift}+8`, description: t(uiLanguage, 'bulletList'), category: cat.paragraph },
    { keys: `${mod}+${shift}+7`, description: t(uiLanguage, 'numberedList'), category: cat.paragraph },
    { keys: `${mod}+${shift}+L`, description: t(uiLanguage, 'alignLeft'), category: cat.paragraph },
    { keys: `${mod}+${shift}+E`, description: t(uiLanguage, 'alignCenter'), category: cat.paragraph },
    { keys: `${mod}+${shift}+R`, description: t(uiLanguage, 'alignRight'), category: cat.paragraph },
    { keys: `${mod}+${shift}+J`, description: t(uiLanguage, 'justify'), category: cat.paragraph },

    // Editing
    { keys: `${mod}+Z`, description: t(uiLanguage, 'undo'), category: cat.editing },
    { keys: `${mod}+Y / ${mod}+${shift}+Z`, description: t(uiLanguage, 'redo'), category: cat.editing },
    { keys: `${mod}+C`, description: t(uiLanguage, 'copy'), category: cat.editing },
    { keys: `${mod}+X`, description: t(uiLanguage, 'cut'), category: cat.editing },
    { keys: `${mod}+V`, description: t(uiLanguage, 'paste'), category: cat.editing },
    { keys: `${mod}+A`, description: t(uiLanguage, 'selectAll'), category: cat.editing },

    // Insert
    { keys: `${mod}+K`, description: t(uiLanguage, 'insertLink'), category: cat.insert },
    { keys: `${mod}+Enter`, description: t(uiLanguage, 'pageBreak'), category: cat.insert },
    { keys: `${shift}+Enter`, description: t(uiLanguage, 'lineBreak'), category: cat.insert },

    // Document
    { keys: `${mod}+S`, description: t(uiLanguage, 'save'), category: cat.document },
    { keys: `${mod}+${alt}+S`, description: t(uiLanguage, 'saveToFile'), category: cat.document },
    { keys: `${mod}+${alt}+${shift}+S`, description: t(uiLanguage, 'saveAsFile'), category: cat.document },
    { keys: `${mod}+P`, description: t(uiLanguage, 'print'), category: cat.document },
    { keys: `${mod}+O`, description: t(uiLanguage, 'openFileEllipsis'), category: cat.document },
    { keys: `${mod}+F`, description: t(uiLanguage, 'find'), category: cat.document },
    { keys: `${mod}+H`, description: t(uiLanguage, 'findReplace'), category: cat.document },
    { keys: `${mod}+/`, description: t(uiLanguage, 'keyboardShortcuts'), category: cat.document },

    // Screenplay
    { keys: 'Tab', description: t(uiLanguage, 'screenplayNextElement'), category: cat.screenplay },
    { keys: `${shift}+Tab`, description: t(uiLanguage, 'screenplayPrevElement'), category: cat.screenplay },
  ];

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="shortcuts-dialog-title">
      <div
        ref={dialogRef}
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
            aria-label={t(uiLanguage, 'close')}
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Keyboard className="w-6 h-6" />
            </div>
            <div>
              <h2 id="shortcuts-dialog-title" className="text-xl font-bold">{t(uiLanguage, 'keyboardShortcuts')}</h2>
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
