import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Copy, BookOpen } from 'lucide-react';
import { getKatex, loadKatex } from '../editor/lazyAssets';
import { t, LanguageCode } from '../utils/translations';
import { useApp } from '../AppContext';
import { useFocusTrap } from '../utils/hooks';

interface EquationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (latex: string, display?: boolean) => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
}

const COMMON_EQUATIONS = [
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
  uiLanguage,
}) => {
  const { editingEquation, setEditingEquation } = useApp();
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const [latex, setLatex] = useState('');
  const [display, setDisplay] = useState(false);
  const [error, setError] = useState('');
  // KaTeX (and its stylesheet) is loaded on first use
  const [katexReady, setKatexReady] = useState(() => !!getKatex());
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEditing = !!editingEquation;

  useEffect(() => {
    if (isOpen) {
      if (editingEquation) {
        setLatex(editingEquation.latex || '');
        setDisplay(!!editingEquation.display);
      }
    } else {
      setLatex('');
      setDisplay(false);
      setError('');
    }
  }, [isOpen, editingEquation]);

  useEffect(() => {
    if (!isOpen || katexReady) return;
    let cancelled = false;
    loadKatex()
      .then(() => !cancelled && setKatexReady(true))
      .catch(() => !cancelled && setError(t(uiLanguage, 'invalidLatex')));
    return () => {
      cancelled = true;
    };
  }, [isOpen, katexReady, uiLanguage]);

  useEffect(() => {
    if (!isOpen) return;
    const katex = getKatex();
    if (previewRef.current && latex && katex) {
      try {
        katex.render(latex, previewRef.current, {
          throwOnError: true,
          displayMode: display,
        });
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : t(uiLanguage, 'invalidLatex'));
      }
    } else if (previewRef.current && !latex) {
      previewRef.current.textContent = '';
      const span = document.createElement('span');
      span.className = 'text-gray-400';
      span.textContent = t(uiLanguage, 'previewPlaceholder');
      previewRef.current.appendChild(span);
      setError('');
    }
  }, [latex, display, isOpen, uiLanguage, katexReady]);

  const handleClose = () => {
    setEditingEquation(null);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const handleInsert = () => {
    if (latex.trim() && !error) {
      // handleInsertEquation edits in place when editingEquation is set (and clears it)
      onInsert(latex.trim(), display);
      handleClose();
    }
  };

  const handleCopyTemplate = (template: string) => {
    setLatex(template);
    textareaRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="equation-dialog-title">
      <div ref={dialogRef} className={`
        max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden
        ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}
      `}>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white relative">
          <button
            onClick={handleClose}
            aria-label={t(uiLanguage, 'close')}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 id="equation-dialog-title" className="text-xl font-bold">{isEditing ? t(uiLanguage, 'editEquation') : t(uiLanguage, 'insertEquation')}</h2>
              <p className="text-blue-100 text-sm">{t(uiLanguage, 'latexMathEditor')}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* LaTeX Input */}
          <div className="mb-6">
            <label htmlFor="equation-latex" className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t(uiLanguage, 'latexExpression')}
            </label>
            <textarea
              id="equation-latex"
              data-autofocus
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
            <div className="mt-3 flex items-center gap-4" role="radiogroup" aria-label={t(uiLanguage, 'equationMode')}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="equation-mode"
                  checked={!display}
                  onChange={() => setDisplay(false)}
                  className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{t(uiLanguage, 'equationInline')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="equation-mode"
                  checked={display}
                  onChange={() => setDisplay(true)}
                  className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{t(uiLanguage, 'equationDisplay')}</span>
              </label>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-sm text-red-500 flex items-center gap-2">
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
              {COMMON_EQUATIONS.map((eq) => (
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
              <div><code>\frac{'{a}'}{'{b}'}</code> → {t(uiLanguage, 'qrFraction')}</div>
              <div><code>\sqrt{'{x}'}</code> → {t(uiLanguage, 'qrSquareRoot')}</div>
              <div><code>x^{'{2}'}</code> → {t(uiLanguage, 'superscript')}</div>
              <div><code>x_{'{i}'}</code> → {t(uiLanguage, 'subscript')}</div>
              <div><code>\sum</code> → {t(uiLanguage, 'qrSummation')}</div>
              <div><code>\int</code> → {t(uiLanguage, 'qrIntegral')}</div>
              <div><code>\alpha \beta</code> → {t(uiLanguage, 'qrGreek')}</div>
              <div><code>\pm</code> → {t(uiLanguage, 'qrPlusMinus')}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`
          p-6 border-t flex justify-end gap-3
          ${darkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}
        `}>
          <button
            onClick={handleClose}
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
            disabled={!latex.trim() || !!error}
            className={`
              px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2
              ${!latex.trim() || error
                ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
              }
            `}
          >
            <Check className="w-5 h-5" />
            {isEditing ? t(uiLanguage, 'updateEquation') : t(uiLanguage, 'insertEquation')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EquationDialog;
