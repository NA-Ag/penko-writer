import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Code2, Copy, Download } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import { t, LanguageCode } from '../utils/translations';

// Import common language support (order matters - dependencies must be loaded first)
import 'prismjs/components/prism-clike'; // Required for C, C++, Java, C#, etc.
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup'; // HTML/XML

interface CodeBlockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (code: string, language: string, theme: string) => void;
  darkMode: boolean;
  existingCode?: { code: string; language: string };
  uiLanguage: LanguageCode;
}

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'csharp', label: 'C#' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash/Shell' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'css', label: 'CSS' },
  { value: 'html', label: 'HTML' },
  { value: 'plaintext', label: 'Plain Text' },
];

const THEMES = [
  { value: 'tomorrow-night', label: 'Dark (Tomorrow Night)' },
  { value: 'solarized-light', label: 'Light (Solarized)' },
  { value: 'github', label: 'GitHub' },
  { value: 'dracula', label: 'Dracula' },
];

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
  existingCode,
  uiLanguage,
}) => {
  const [code, setCode] = useState(existingCode?.code || '');
  const [language, setLanguage] = useState(existingCode?.language || 'javascript');
  const [theme, setTheme] = useState('tomorrow-night');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const previewRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (existingCode) {
      setCode(existingCode.code);
      setLanguage(existingCode.language);
    }
  }, [existingCode]);

  useEffect(() => {
    if (!isOpen) {
      if (!existingCode) {
        setCode('');
        setLanguage('javascript');
      }
      setTheme('tomorrow-night');
      setShowLineNumbers(true);
    }
  }, [isOpen, existingCode]);

  useEffect(() => {
    if (previewRef.current && code) {
      try {
        const highlighted = language === 'plaintext'
          ? code
          : Prism.highlight(code, Prism.languages[language] || Prism.languages.plaintext, language);

        previewRef.current.innerHTML = highlighted;
      } catch (err) {
        previewRef.current.textContent = code;
      }
    } else if (previewRef.current) {
      previewRef.current.textContent = 'Preview will appear here...';
    }
  }, [code, language]);

  const handleInsert = () => {
    if (code.trim()) {
      onInsert(code.trim(), language, theme);
      onClose();
    }
  };

  const handleLoadSample = () => {
    const sample = SAMPLE_CODE[language] || SAMPLE_CODE.plaintext;
    setCode(sample);
    textareaRef.current?.focus();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    alert('Code copied to clipboard!');
  };

  const handleDownloadCode = () => {
    const ext = language === 'plaintext' ? 'txt' : language;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `code.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className={`
        max-w-5xl w-full rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col
        ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}
      `}>
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 text-white relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t(uiLanguage, 'insertCodeBlock')}</h2>
              <p className="text-cyan-100 text-sm">{t(uiLanguage, 'syntaxHighlightedCode')}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Language and Theme Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t(uiLanguage, 'programmingLanguage')}
              </label>
              <select
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
                {LANGUAGES.map(lang => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
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
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t(uiLanguage, 'enterCodePlaceholder').replace('{language}', LANGUAGES.find(l => l.value === language)?.label || t(uiLanguage, 'plainText'))}
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
            {t(uiLanguage, 'insertCodeBlock')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodeBlockDialog;
