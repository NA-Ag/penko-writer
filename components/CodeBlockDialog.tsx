import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Code2, Copy, Download } from 'lucide-react';
import type { Editor } from '@tiptap/core';
import Prism from '../editor/prism';
import { t, LanguageCode } from '../utils/translations';
import { useApp } from '../AppContext';
import { useFocusTrap } from '../utils/hooks';

interface CodeBlockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (code: string, language: string, theme: string, lineNumbers?: boolean) => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
}

/** `ext` is the file extension used by "Download". */
const CODE_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', ext: 'js' },
  { value: 'typescript', label: 'TypeScript', ext: 'ts' },
  { value: 'python', label: 'Python', ext: 'py' },
  { value: 'java', label: 'Java', ext: 'java' },
  { value: 'cpp', label: 'C++', ext: 'cpp' },
  { value: 'c', label: 'C', ext: 'c' },
  { value: 'csharp', label: 'C#', ext: 'cs' },
  { value: 'php', label: 'PHP', ext: 'php' },
  { value: 'ruby', label: 'Ruby', ext: 'rb' },
  { value: 'go', label: 'Go', ext: 'go' },
  { value: 'rust', label: 'Rust', ext: 'rs' },
  { value: 'sql', label: 'SQL', ext: 'sql' },
  { value: 'bash', label: 'Bash/Shell', ext: 'sh' },
  { value: 'json', label: 'JSON', ext: 'json' },
  { value: 'yaml', label: 'YAML', ext: 'yaml' },
  { value: 'markdown', label: 'Markdown', ext: 'md' },
  { value: 'css', label: 'CSS', ext: 'css' },
  { value: 'html', label: 'HTML', ext: 'html' },
  { value: 'plaintext', label: '', ext: 'txt' },
];

const THEMES = [
  { value: 'tomorrow-night', labelKey: 'themeDark' },
  { value: 'github', labelKey: 'themeLight' },
];

/** The code block containing the cursor, if any (so the dialog edits it instead of nesting a new one). */
const codeBlockAtSelection = (editor: Editor | null) => {
  if (!editor || editor.isDestroyed) return null;
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'codeBlock') return { pos: $from.before(d), node };
  }
  return null;
};

const SAMPLE_CODE: { [key: string]: string } = {
  javascript: `function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nconsole.log(fibonacci(10));`,
  python: `def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n - 1) + fibonacci(n - 2)\n\nprint(fibonacci(10))`,
  java: `public class Fibonacci {\n    public static int fib(int n) {\n        if (n <= 1) return n;\n        return fib(n - 1) + fib(n - 2);\n    }\n    \n    public static void main(String[] args) {\n        System.out.println(fib(10));\n    }\n}`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint fibonacci(int n) {\n    if (n <= 1) return n;\n    return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nint main() {\n    cout << fibonacci(10) << endl;\n    return 0;\n}`,
  plaintext: `Write your code or pseudocode here...\n\nThis supports any text without syntax highlighting.`,
};

const CodeBlockDialog: React.FC<CodeBlockDialogProps> = ({
  isOpen,
  onClose,
  onInsert,
  darkMode,
  uiLanguage,
}) => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [theme, setTheme] = useState('tomorrow-night');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  // Position of the code block being edited (cursor was inside one when the dialog opened)
  const [editingPos, setEditingPos] = useState<number | null>(null);
  const { toast, editor } = useApp();
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const previewRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setCode('');
      setLanguage('javascript');
      setTheme('tomorrow-night');
      setShowLineNumbers(true);
      setEditingPos(null);
      return;
    }
    const found = codeBlockAtSelection(editor);
    if (found) {
      setEditingPos(found.pos);
      setCode(found.node.textContent);
      setLanguage(found.node.attrs.language || 'plaintext');
      setTheme(found.node.attrs.theme === 'light' ? 'github' : 'tomorrow-night');
      setShowLineNumbers(found.node.attrs.lineNumbers !== false);
    }
    // Only when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const grammar = language !== 'plaintext' ? Prism.languages[language] : undefined;
    if (code && grammar) {
      try {
        // Prism escapes the source; its output is only markup for tokens
        el.innerHTML = Prism.highlight(code, grammar, language);
        return;
      } catch {
        /* fall through to plain text */
      }
    }
    el.textContent = code || t(uiLanguage, 'previewPlaceholder');
  }, [code, language, isOpen, uiLanguage]);

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

  const handleInsert = () => {
    if (!code.trim()) return;
    const text = code.replace(/\s+$/, '');
    const existing = editingPos !== null && editor && !editor.isDestroyed ? editor.state.doc.nodeAt(editingPos) : null;
    if (existing?.type.name === 'codeBlock' && editor) {
      const { schema } = editor.state;
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          const attrs = { ...existing.attrs, language, theme: theme === 'github' ? 'light' : 'dark', lineNumbers: showLineNumbers };
          tr.replaceWith(editingPos!, editingPos! + existing.nodeSize, schema.nodes.codeBlock.create(attrs, schema.text(text)));
          return true;
        })
        .run();
    } else {
      onInsert(text, language, theme, showLineNumbers);
    }
    onClose();
  };

  const handleLoadSample = () => {
    const sample = SAMPLE_CODE[language] || t(uiLanguage, 'codeSamplePlain');
    setCode(sample);
    textareaRef.current?.focus();
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t(uiLanguage, 'codeCopied'));
    } catch {
      toast.error(t(uiLanguage, 'copyFailed'));
    }
  };

  const handleDownloadCode = () => {
    const ext = CODE_LANGUAGES.find(l => l.value === language)?.ext || 'txt';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `code.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(t(uiLanguage, 'codeDownloaded'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="codeblock-dialog-title">
      <div ref={dialogRef} className={`
        max-w-5xl w-full rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col
        ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}
      `}>
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 text-white relative flex-shrink-0">
          <button
            onClick={onClose}
            aria-label={t(uiLanguage, 'close')}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <h2 id="codeblock-dialog-title" className="text-xl font-bold">{editingPos !== null ? t(uiLanguage, 'editCodeBlock') : t(uiLanguage, 'insertCodeBlock')}</h2>
              <p className="text-cyan-100 text-sm">{t(uiLanguage, 'syntaxHighlightedCode')}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Language and Theme Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="codeblock-language" className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t(uiLanguage, 'programmingLanguage')}
              </label>
              <select
                id="codeblock-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={`
                  w-full px-4 py-2 rounded-lg font-medium
                  ${darkMode
                    ? 'bg-gray-800 text-white border-gray-700'
                    : 'bg-gray-50 text-gray-900 border-gray-300'
                  }
                  border-2 focus:border-cyan-500 outline-none
                `}
              >
                {!CODE_LANGUAGES.some(l => l.value === language) && <option value={language}>{language}</option>}
                {CODE_LANGUAGES.map(lang => (
                  <option key={lang.value} value={lang.value}>{lang.value === 'plaintext' ? t(uiLanguage, 'plainText') : lang.label}</option>
                ))}
              </select>
              <label htmlFor="codeblock-theme" className={`block text-sm font-medium mb-2 mt-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t(uiLanguage, 'codeTheme')}
              </label>
              <select
                id="codeblock-theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className={`
                  w-full px-4 py-2 rounded-lg font-medium
                  ${darkMode
                    ? 'bg-gray-800 text-white border-gray-700'
                    : 'bg-gray-50 text-gray-900 border-gray-300'
                  }
                  border-2 focus:border-cyan-500 outline-none
                `}
              >
                {THEMES.map(th => (
                  <option key={th.value} value={th.value}>{t(uiLanguage, th.labelKey)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t(uiLanguage, 'options')}
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLineNumbers}
                    onChange={(e) => setShowLineNumbers(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'lineNumbers')}</span>
                </label>

                <button
                  onClick={handleLoadSample}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${darkMode
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }
                  `}
                >
                  {t(uiLanguage, 'loadSample')}
                </button>
              </div>
            </div>
          </div>

          {/* Code Editor */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t(uiLanguage, 'codeEditor')}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyCode}
                  disabled={!code}
                  className={`
                    flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors
                    ${!code
                      ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                      : darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }
                  `}
                >
                  <Copy className="w-4 h-4" />
                  {t(uiLanguage, 'copy')}
                </button>
                <button
                  onClick={handleDownloadCode}
                  disabled={!code}
                  className={`
                    flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors
                    ${!code
                      ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                      : darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }
                  `}
                >
                  <Download className="w-4 h-4" />
                  {t(uiLanguage, 'download')}
                </button>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              data-autofocus
              aria-label={t(uiLanguage, 'codeEditor')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t(uiLanguage, 'enterCodePlaceholder').replace('{language}', (language !== 'plaintext' && (CODE_LANGUAGES.find(l => l.value === language)?.label || language)) || t(uiLanguage, 'plainText'))}
              rows={12}
              className={`
                w-full px-4 py-3 rounded-lg font-mono text-sm
                ${darkMode
                  ? 'bg-gray-900 text-gray-100 border-gray-700'
                  : 'bg-gray-50 text-gray-900 border-gray-300'
                }
                border-2 focus:border-cyan-500 outline-none transition-colors resize-none
              `}
              spellCheck={false}
            />
          </div>

          {/* Preview */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t(uiLanguage, 'previewWithSyntax')}
            </label>
            <div className={`
              p-4 rounded-lg overflow-x-auto
              ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}
              border-2 ${darkMode ? 'border-gray-700' : 'border-gray-200'}
            `}>
              <pre className={`${showLineNumbers ? 'line-numbers' : ''} language-${language}`}>
                <code ref={previewRef} className={`language-${language}`} />
              </pre>
            </div>
          </div>

          {/* Info Box */}
          <div className={`
            p-4 rounded-lg text-sm
            ${darkMode ? 'bg-cyan-900/20 border-cyan-700' : 'bg-cyan-50 border-cyan-200'}
            border
          `}>
            <p className={darkMode ? 'text-cyan-200' : 'text-cyan-900'}>
              💡 {t(uiLanguage, 'codeBlockTip')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={`
          p-6 border-t flex justify-end gap-3 flex-shrink-0
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
            disabled={!code.trim()}
            className={`
              px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2
              ${!code.trim()
                ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white'
              }
            `}
          >
            <Check className="w-5 h-5" />
            {editingPos !== null ? t(uiLanguage, 'update') : t(uiLanguage, 'insertCodeBlock')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodeBlockDialog;
