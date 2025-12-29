import React, { useState, useEffect } from 'react';
import { X, Check, List, RefreshCw } from 'lucide-react';
import { t, LanguageCode } from '../utils/translations';

interface TableOfContentsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
  darkMode: boolean;
  currentContent: string;
  uiLanguage: LanguageCode;
}

interface TOCEntry {
  level: number;
  text: string;
  id: string;
}

const TableOfContentsDialog: React.FC<TableOfContentsDialogProps> = ({
  isOpen,
  onClose,
  onInsert,
  darkMode,
  currentContent,
  uiLanguage,
}) => {
  const [entries, setEntries] = useState<TOCEntry[]>([]);
  const [style, setStyle] = useState<'default' | 'minimal' | 'numbered'>('default');
  const [includeH1, setIncludeH1] = useState(true);
  const [includeH2, setIncludeH2] = useState(true);
  const [includeH3, setIncludeH3] = useState(true);
  const [includeH4, setIncludeH4] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    extractHeadings();
  }, [isOpen, currentContent, includeH1, includeH2, includeH3, includeH4]);

  const extractHeadings = () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(currentContent, 'text/html');
    const headings: TOCEntry[] = [];

    const selectors = [];
    if (includeH1) selectors.push('h1');
    if (includeH2) selectors.push('h2');
    if (includeH3) selectors.push('h3');
    if (includeH4) selectors.push('h4');

    if (selectors.length === 0) {
      setEntries([]);
      return;
    }

    const elements = doc.querySelectorAll(selectors.join(', '));
    elements.forEach((heading, index) => {
      const level = parseInt(heading.tagName.substring(1));
      const text = heading.textContent?.trim() || '';

      // Generate or use existing ID
      let id = heading.id;
      if (!id) {
        id = `toc-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`;
        heading.id = id;
      }

      if (text) {
        headings.push({ level, text, id });
      }
    });

    setEntries(headings);
  };

  const generateTOC = () => {
    if (entries.length === 0) {
      return `<p><em>${t(uiLanguage, 'noHeadingsFoundInDoc')}</em></p>`;
    }

    let html = '<div class="table-of-contents" style="';

    if (style === 'default') {
      html += 'border: 2px solid #e5e7eb; padding: 20px; margin: 20px 0; border-radius: 8px; background: #f9fafb;';
    } else if (style === 'minimal') {
      html += 'border-left: 3px solid #3b82f6; padding-left: 20px; margin: 20px 0;';
    } else {
      html += 'padding: 20px; margin: 20px 0;';
    }

    html += '">';
    html += `<h2 style="margin-top: 0; font-size: 1.5em; font-weight: bold; margin-bottom: 16px;">${t(uiLanguage, 'tableOfContents')}</h2>`;

    if (style === 'numbered') {
      html += '<ol style="list-style: decimal; padding-left: 20px;">';
      entries.forEach(entry => {
        const indent = (entry.level - 1) * 20;
        html += `<li style="margin: 8px 0; padding-left: ${indent}px;">`;
        html += `<a href="#${entry.id}" style="color: #3b82f6; text-decoration: none; hover: text-decoration: underline;">${entry.text}</a>`;
        html += '</li>';
      });
      html += '</ol>';
    } else {
      html += '<ul style="list-style: none; padding: 0;">';
      entries.forEach(entry => {
        const indent = (entry.level - 1) * 20;
        html += `<li style="margin: 8px 0; padding-left: ${indent}px;">`;
        html += `<a href="#${entry.id}" style="color: #3b82f6; text-decoration: none;">${entry.text}</a>`;
        html += '</li>';
      });
      html += '</ul>';
    }

    html += '</div>';
    return html;
  };

  const handleInsert = () => {
    const tocHTML = generateTOC();
    onInsert(tocHTML);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className={`
        max-w-3xl w-full rounded-2xl shadow-2xl overflow-hidden
        ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}
      `}>
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <List className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t(uiLanguage, 'tableOfContents')}</h2>
              <p className="text-indigo-100 text-sm">{t(uiLanguage, 'autoGenerateFromHeadings')}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Include Levels */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t(uiLanguage, 'includeHeadings')}
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeH1}
                    onChange={(e) => setIncludeH1(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'heading1')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeH2}
                    onChange={(e) => setIncludeH2(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'heading2')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeH3}
                    onChange={(e) => setIncludeH3(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'heading3')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeH4}
                    onChange={(e) => setIncludeH4(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'heading4')}</span>
                </label>
              </div>
            </div>

            {/* Style */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t(uiLanguage, 'style')}
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="style"
                    checked={style === 'default'}
                    onChange={() => setStyle('default')}
                    className="w-4 h-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'styleDefaultBoxed')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="style"
                    checked={style === 'minimal'}
                    onChange={() => setStyle('minimal')}
                    className="w-4 h-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'styleMinimalSidebar')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="style"
                    checked={style === 'numbered'}
                    onChange={() => setStyle('numbered')}
                    className="w-4 h-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'styleNumbered')}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t(uiLanguage, 'preview')} ({entries.length} {t(uiLanguage, 'headingsFound')})
              </label>
              <button
                onClick={extractHeadings}
                className={`
                  flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors
                  ${darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }
                `}
              >
                <RefreshCw className="w-4 h-4" />
                {t(uiLanguage, 'refresh')}
              </button>
            </div>
            <div
              className={`
                p-4 rounded-lg border max-h-60 overflow-y-auto
                ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}
              `}
              dangerouslySetInnerHTML={{ __html: generateTOC() }}
            />
          </div>

          {/* Info */}
          <div className={`
            p-4 rounded-lg text-sm
            ${darkMode ? 'bg-indigo-900/20 border-indigo-700' : 'bg-indigo-50 border-indigo-200'}
            border
          `}>
            <p className={darkMode ? 'text-indigo-200' : 'text-indigo-900'}>
              💡 {t(uiLanguage, 'tocTip')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={`
          p-6 border-t flex justify-end gap-3
          ${darkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}
        `}>
          <button
            onClick={onClose}
            className={`
              px-6 py-2.5 rounded-lg font-medium transition-colors
              ${darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }
            `}
          >
            {t(uiLanguage, 'cancel')}
          </button>
          <button
            onClick={handleInsert}
            disabled={entries.length === 0}
            className={`
              px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2
              ${entries.length === 0
                ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'
              }
            `}
          >
            <Check className="w-5 h-5" />
            {t(uiLanguage, 'insertTOC')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TableOfContentsDialog;
