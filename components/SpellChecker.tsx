import React, { useState, useEffect, useRef } from 'react';
import { Check, X, AlertCircle, Loader, ShieldCheck } from 'lucide-react';
import { t, LanguageCode } from '../utils/translations';
import { useApp } from '../AppContext';
import { useFocusTrap, useEscapeKey } from '../utils/hooks';
import { textblockSegments } from '../editor/extensions/search';
import { hasLanguageToolConsent, setLanguageToolConsent, getLanguageToolServer, languageToolCheckUrl } from '../utils/spellcheckSettings';

interface SpellCheckerProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
  documentLanguage?: string;
  /** Replace `original` near text offset `offset` (see AppContext.handleApplyCorrection). */
  onApplyCorrection: (original: string, correction: string, offset?: number) => boolean;
}

interface GrammarMatch {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: Array<{ value: string }>;
  rule: {
    id: string;
    description: string;
    issueType: string;
    category: { id: string; name: string };
  };
  context: {
    text: string;
    offset: number;
    length: number;
  };
}

type TrackedMatch = GrammarMatch & { key: number; status?: 'fixed' | 'ignored' };

/**
 * Plain text of the document with blocks joined by "\n" — built from the same
 * segments `handleApplyCorrection` uses, so offsets line up exactly. Embedded
 * objects (images, footnotes) become a space.
 */
const documentText = (doc: Parameters<typeof textblockSegments>[0]) =>
  textblockSegments(doc)
    .map(s => s.text.replace(/￼/g, ' '))
    .join('\n');

export const SpellChecker: React.FC<SpellCheckerProps> = ({
  isOpen,
  onClose,
  darkMode,
  uiLanguage,
  documentLanguage = 'en-US',
  onApplyCorrection,
}) => {
  const { editor, toast } = useApp();
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  useEscapeKey(isOpen, onClose);
  const [consented, setConsented] = useState(false);
  const [matches, setMatches] = useState<TrackedMatch[]>([]);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const textRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);

  const checkGrammar = async () => {
    if (!editor || editor.isDestroyed) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    setMatches([]);
    setChecked(false);
    setCurrentIndex(0);

    const plainText = documentText(editor.state.doc);
    textRef.current = plainText;
    if (!plainText.trim()) {
      setError(t(uiLanguage, 'rvNoTextToCheck'));
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(languageToolCheckUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ text: plainText, language: documentLanguage || 'auto', enabledOnly: 'false' }),
        signal: controller.signal,
      });
      if (response.status === 429) throw new Error(t(uiLanguage, 'rvRateLimited'));
      if (response.status === 413) throw new Error(t(uiLanguage, 'rvTextTooLong'));
      if (!response.ok) throw new Error(`${t(uiLanguage, 'rvCheckFailed')} (HTTP ${response.status})`);
      const data = await response.json();
      const list: GrammarMatch[] = Array.isArray(data?.matches) ? data.matches : [];
      setMatches(list.slice().sort((a, b) => a.offset - b.offset).map((m, key) => ({ ...m, key })));
      setChecked(true);
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'AbortError') return;
      // fetch() rejects with a TypeError when the server can't be reached
      const message = err instanceof TypeError ? t(uiLanguage, 'rvNetworkError') : (err instanceof Error && err.message) || t(uiLanguage, 'rvCheckFailed');
      setError(message);
      toast.error(message);
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  // Run the check when the dialog opens (only after consent).
  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort();
      return;
    }
    const ok = hasLanguageToolConsent();
    setConsented(ok);
    setMatches([]);
    setChecked(false);
    setError('');
    if (ok) void checkGrammar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const active = matches.filter(m => !m.status);
  const index = Math.min(currentIndex, Math.max(0, active.length - 1));
  const currentMatch: TrackedMatch | null = active[index] || null;
  const fixedCount = matches.filter(m => m.status === 'fixed').length;
  const ignoredCount = matches.filter(m => m.status === 'ignored').length;

  const setStatus = (key: number, status: 'fixed' | 'ignored', shift?: { after: number; delta: number }) =>
    setMatches(prev =>
      prev.map(m => {
        if (m.key === key) return { ...m, status };
        if (shift && m.offset >= shift.after) return { ...m, offset: m.offset + shift.delta };
        return m;
      }),
    );

  // Apply suggestion
  const applySuggestion = (match: TrackedMatch, replacement: string) => {
    const text = textRef.current;
    const original = text.substring(match.offset, match.offset + match.length);
    const ok = onApplyCorrection(original, replacement, match.offset);
    if (!ok) {
      toast.warning(t(uiLanguage, 'rvCorrectionNotFound'));
      setStatus(match.key, 'ignored');
      return;
    }
    // Keep the remaining offsets valid for the edited text.
    textRef.current = text.slice(0, match.offset) + replacement + text.slice(match.offset + match.length);
    setStatus(match.key, 'fixed', { after: match.offset + match.length, delta: replacement.length - match.length });
    // Applying focuses the editor; bring keyboard focus back to the dialog.
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button')?.focus());
  };

  const ignoreMatch = () => {
    if (currentMatch) setStatus(currentMatch.key, 'ignored');
  };

  const nextMatch = () => setCurrentIndex(Math.min(index + 1, active.length - 1));
  const previousMatch = () => setCurrentIndex(Math.max(index - 1, 0));

  const grantConsent = () => {
    setLanguageToolConsent(true);
    setConsented(true);
    void checkGrammar();
  };

  if (!isOpen) return null;

  const buttonBg = darkMode ? 'bg-[#2a2a2a] hover:bg-[#3a3a3a]' : 'bg-gray-100 hover:bg-gray-200';
  const bg = darkMode ? 'bg-[#1e1e1e] border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-900';

  const getCategoryColor = (type: string) => {
    switch ((type || '').toLowerCase()) {
      case 'misspelling':
        return 'text-red-500';
      case 'grammar':
        return 'text-yellow-500';
      case 'style':
        return 'text-blue-500';
      case 'typographical':
        return 'text-purple-500';
      default:
        return 'text-gray-500';
    }
  };

  const server = getLanguageToolServer();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="spellcheck-title"
    >
      <div ref={dialogRef} className={`w-[600px] max-w-[calc(100vw-2rem)] max-h-[80vh] rounded-lg shadow-2xl border ${bg} flex flex-col`}>
        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 id="spellcheck-title" className="text-lg font-bold flex items-center gap-2">
            <Check size={20} />
            {t(uiLanguage, 'spellCheck')}
          </h2>
          <button onClick={onClose} className="opacity-60 hover:opacity-100" aria-label={t(uiLanguage, 'close')}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto" aria-live="polite">
          {!consented && (
            <div className={`p-4 rounded border ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
              <div className="flex items-start gap-3">
                <ShieldCheck size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-semibold">{t(uiLanguage, 'rvLtConsentTitle')}</p>
                  <p className="opacity-80">{t(uiLanguage, 'rvLtConsentBody').replace('{server}', server)}</p>
                  <p className="opacity-60 text-xs">{t(uiLanguage, 'rvLtConsentLocal')}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={grantConsent} className="flex-1 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm" data-autofocus>
                  {t(uiLanguage, 'rvCheckWithLt')}
                </button>
                <button onClick={onClose} className={`px-4 py-2 rounded text-sm ${buttonBg}`}>
                  {t(uiLanguage, 'cancel')}
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8 gap-2" role="status">
              <Loader className="animate-spin" size={20} />
              <span>{t(uiLanguage, 'checkingGrammar')}</span>
            </div>
          )}

          {error && !loading && (
            <div className={`p-3 rounded flex items-start gap-2 ${darkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-100 text-red-700'}`} role="alert">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <div className="text-sm flex-1">{error}</div>
              <button onClick={() => void checkGrammar()} className={`px-2 py-0.5 text-xs rounded ${buttonBg}`}>
                {t(uiLanguage, 'rvRetry')}
              </button>
            </div>
          )}

          {checked && !loading && !error && matches.length === 0 && (
            <div className={`p-3 rounded flex items-start gap-2 ${darkMode ? 'bg-green-900/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <div className="text-sm">{t(uiLanguage, 'rvNoIssues')}</div>
            </div>
          )}

          {!loading && currentMatch && (
            <>
              {/* Progress */}
              <div className="flex items-center justify-between text-sm opacity-70">
                <span>
                  {index + 1} {t(uiLanguage, 'of')} {active.length} {t(uiLanguage, 'issues')}
                </span>
                <span className={getCategoryColor(currentMatch.rule?.issueType)}>{currentMatch.rule?.category?.name}</span>
              </div>

              {/* Current Issue */}
              <div className={`p-4 rounded border ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                <div className="mb-2">
                  <strong className="text-sm opacity-70">{t(uiLanguage, 'issue')}:</strong>
                  <p className="mt-1">{currentMatch.message}</p>
                </div>

                {/* Context */}
                <div className={`p-3 rounded mt-3 font-mono text-sm ${darkMode ? 'bg-[#2a2a2a]' : 'bg-gray-100'}`}>
                  {currentMatch.context.text.substring(0, currentMatch.context.offset)}
                  <span className="bg-red-500/30 px-1 rounded">
                    {currentMatch.context.text.substring(currentMatch.context.offset, currentMatch.context.offset + currentMatch.context.length)}
                  </span>
                  {currentMatch.context.text.substring(currentMatch.context.offset + currentMatch.context.length)}
                </div>

                {/* Suggestions */}
                {currentMatch.replacements.length > 0 && (
                  <div className="mt-3">
                    <strong className="text-sm opacity-70">{t(uiLanguage, 'suggestions')}:</strong>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {currentMatch.replacements.slice(0, 5).map((rep, idx) => (
                        <button
                          key={idx}
                          onClick={() => applySuggestion(currentMatch, rep.value)}
                          className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 text-sm"
                        >
                          {rep.value}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-2">
                <button onClick={ignoreMatch} className={`flex-1 px-4 py-2 rounded ${buttonBg}`}>
                  {t(uiLanguage, 'ignore')}
                </button>
                <button
                  onClick={previousMatch}
                  disabled={index === 0}
                  className={`px-4 py-2 rounded ${buttonBg} disabled:opacity-30`}
                  aria-label={t(uiLanguage, 'rvPreviousIssue')}
                >
                  ←
                </button>
                <button
                  onClick={nextMatch}
                  disabled={index >= active.length - 1}
                  className={`px-4 py-2 rounded ${buttonBg} disabled:opacity-30`}
                  aria-label={t(uiLanguage, 'rvNextIssue')}
                >
                  →
                </button>
              </div>
            </>
          )}

          {!loading && matches.length > 0 && active.length === 0 && (
            <div className={`p-4 rounded text-center ${darkMode ? 'bg-green-900/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
              <Check size={48} className="mx-auto mb-2" />
              <p className="font-semibold">{t(uiLanguage, 'allIssuesReviewed')}</p>
              <p className="text-sm mt-1 opacity-80">
                {t(uiLanguage, 'rvFixedIgnored').replace('{fixed}', String(fixedCount)).replace('{ignored}', String(ignoredCount))}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className="text-xs opacity-50 text-center">
            {t(uiLanguage, 'poweredByLanguageTool')}
            {consented && ` · ${server.replace(/^https?:\/\//, '')}`}
          </p>
        </div>
      </div>
    </div>
  );
};
