import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Copy, BookOpen } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { t, LanguageCode } from '../utils/translations';

interface EquationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (latex: string) => void;
  darkMode: boolean;
  existingEquation?: string;
  uiLanguage: LanguageCode;
}

const getCommonEquations = (lang: LanguageCode) => [
  { nameKey: 'eqQuadraticFormula', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { nameKey: 'eqPythagorean', latex: 'a^2 + b^2 = c^2' },
  { nameKey: 'eqSum', latex: '\\sum_{i=1}^{n} x_i' },
  { nameKey: 'eqIntegral', latex: '\\int_{a}^{b} f(x) \\, dx' },
  { nameKey: 'eqDerivative', latex: '\\frac{d}{dx} f(x)' },
  { nameKey: 'eqLimit', latex: '\\lim_{x \\to \\infty} f(x)' },
  { nameKey: 'eqMatrix', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { nameKey: 'eqFraction', latex: '\\frac{a}{b}' },
  { nameKey: 'eqSquareRoot', latex: '\\sqrt{x}' },
  { nameKey: 'eqGreekLetters', latex: '\\alpha \\beta \\gamma \\delta' },
];

const EquationDialog: React.FC<EquationDialogProps> = ({
  isOpen,
  onClose,
  onInsert,
  darkMode,
  existingEquation,
  uiLanguage,
}) => {
  const [latex, setLatex] = useState(existingEquation || '');
  const [error, setError] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (existingEquation) {
      setLatex(existingEquation);
    }
  }, [existingEquation]);

  useEffect(() => {
    if (!isOpen) {
      setLatex(existingEquation || '');
      setError('');
    }
  }, [isOpen, existingEquation]);

  useEffect(() => {
    if (previewRef.current && latex) {
      try {
        katex.render(latex, previewRef.current, {
          throwOnError: true,
          displayMode: true,
        });
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid LaTeX syntax');
      }
    } else if (previewRef.current) {
      previewRef.current.innerHTML = '<span class="text-gray-400">Preview will appear here...</span>';
    }
  }, [latex]);

  const handleInsert = () => {
    if (latex && !error) {
      onInsert(latex);
      onClose();
    }
  };

  const handleCopyTemplate = (template: string) => {
    setLatex(template);
    textareaRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className={`
        max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden
        ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}
      `}>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t(uiLanguage, 'insertEquation')}</h2>
              <p className="text-blue-100 text-sm">{t(uiLanguage, 'latexMathEditor')}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* LaTeX Input */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t(uiLanguage, 'latexExpression')}
            </label>
            <textarea
              ref={textareaRef}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              placeholder={t(uiLanguage, 'latexPlaceholder')}
              rows={4}
              className={`
                w-full px-4 py-3 rounded-lg font-mono text-sm
                ${darkMode
                  ? 'bg-gray-800 text-white border-gray-700'
                  : 'bg-gray-50 text-gray-900 border-gray-300'
                }
                border-2 focus:border-blue-500 outline-none transition-colors resize-none
              `}
            />
            {error && (
              <p className="mt-2 text-sm text-red-500 flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </p>
            )}
          </div>

          {/* Preview */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t(uiLanguage, 'preview')}
            </label>
            <div className={`
              p-6 rounded-lg min-h-[100px] flex items-center justify-center
              ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
            `}>
              <div ref={previewRef} className={darkMode ? 'text-white' : 'text-gray-900'} />
            </div>
          </div>

          {/* Common Templates */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t(uiLanguage, 'commonEquations')}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {getCommonEquations(uiLanguage).map((eq) => (
                <button
                  key={eq.nameKey}
                  onClick={() => handleCopyTemplate(eq.latex)}
                  className={`
                    p-3 rounded-lg text-left transition-all text-sm
                    ${darkMode
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }
                    flex items-center gap-2
                  `}
                >
                  <Copy className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{t(uiLanguage, eq.nameKey)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Reference */}
          <div className={`
            p-4 rounded-lg text-sm
            ${darkMode ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'}
            border
          `}>
            <p className={`font-medium mb-2 ${darkMode ? 'text-blue-300' : 'text-blue-900'}`}>
              {t(uiLanguage, 'quickReference')}
            </p>
            <div className={`grid grid-cols-2 gap-2 ${darkMode ? 'text-blue-200' : 'text-blue-800'}`}>
              <div><code>\frac{'{a}'}{'{b}'}</code> → Fraction</div>
              <div><code>\sqrt{'{x}'}</code> → Square root</div>
              <div><code>x^{'{2}'}</code> → Superscript</div>
              <div><code>x_{'{i}'}</code> → Subscript</div>
              <div><code>\sum</code> → Summation</div>
              <div><code>\int</code> → Integral</div>
              <div><code>\alpha \beta</code> → Greek letters</div>
              <div><code>\pm</code> → Plus/minus</div>
            </div>
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
            disabled={!latex || !!error}
            className={`
              px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2
              ${!latex || error
                ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
              }
            `}
          >
            <Check className="w-5 h-5" />
            {t(uiLanguage, 'insertEquation')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EquationDialog;
