import React, { useState, useEffect } from 'react';
import { Check, X, AlertCircle, Loader } from 'lucide-react';
import { t, LanguageCode } from '../utils/translations';

interface SpellCheckerProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
  content: string;
  documentLanguage?: string;
  onApplyCorrection: (original: string, correction: string) => void;
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
  type: {
    typeName: string;
  };
}

interface LanguageToolResponse {
  matches: GrammarMatch[];
}

export const SpellChecker: React.FC<SpellCheckerProps> = ({
  isOpen,
  onClose,
  darkMode,
  uiLanguage,
  content,
  documentLanguage = 'en-US',
  onApplyCorrection,
}) => {
  const [matches, setMatches] = useState<GrammarMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ignoredMatches, setIgnoredMatches] = useState<Set<string>>(new Set());

  // Extract plain text from HTML
  const extractPlainText = (html: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  };

  // Check grammar using LanguageTool API
  const checkGrammar = async () => {
    setLoading(true);
    setError('');
    setMatches([]);
    setCurrentIndex(0);

    try {
      const plainText = extractPlainText(content);

      if (!plainText.trim()) {
        setError('No text to check');
        setLoading(false);
        return;
      }

      // Use public LanguageTool API
      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          text: plainText,
          language: documentLanguage,
          enabledOnly: 'false',
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: LanguageToolResponse = await response.json();
      setMatches(data.matches || []);

      if (data.matches.length === 0) {
        setError('No issues found! Your text looks good.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check grammar');
      console.error('Grammar check error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Run check when dialog opens
  useEffect(() => {
    if (isOpen && content) {
      checkGrammar();
    }
  }, [isOpen]);

  // Apply suggestion
  const applySuggestion = (match: GrammarMatch, replacement: string) => {
    const plainText = extractPlainText(content);
    const original = plainText.substring(match.offset, match.offset + match.length);
    onApplyCorrection(original, replacement);

    // Mark as ignored and move to next
    const matchId = `${match.offset}-${match.length}-${match.message}`;
    setIgnoredMatches(prev => new Set(prev).add(matchId));
    nextMatch();
  };

  // Ignore suggestion
  const ignoreMatch = () => {
    const match = getCurrentMatch();
    if (match) {
      const matchId = `${match.offset}-${match.length}-${match.message}`;
      setIgnoredMatches(prev => new Set(prev).add(matchId));
    }
    nextMatch();
  };

  // Navigate matches
  const nextMatch = () => {
    if (currentIndex < matches.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const previousMatch = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const getCurrentMatch = (): GrammarMatch | null => {
    return matches[currentIndex] || null;
  };

  const currentMatch = getCurrentMatch();
  const activeMatches = matches.filter((m, i) => {
    const matchId = `${m.offset}-${m.length}-${m.message}`;
    return !ignoredMatches.has(matchId);
  });

  if (!isOpen) return null;

  const bg = darkMode ? 'bg-[#1e1e1e] border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-900';
  const inputBg = darkMode ? 'bg-[#2a2a2a] border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900';
  const buttonBg = darkMode ? 'bg-[#2a2a2a] hover:bg-[#3a3a3a]' : 'bg-gray-100 hover:bg-gray-200';

  // Get category color
  const getCategoryColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'misspelling': return 'text-red-500';
      case 'grammar': return 'text-yellow-500';
      case 'style': return 'text-blue-500';
      case 'typographical': return 'text-purple-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={`w-[600px] max-h-[80vh] rounded-lg shadow-2xl border ${bg} flex flex-col`}>
        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Check size={20} />
            {t(uiLanguage, 'spellCheck')}
          </h2>
          <button onClick={onClose} className="opacity-60 hover:opacity-100">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader className="animate-spin" size={20} />
              <span>{t(uiLanguage, 'checkingGrammar')}</span>
            </div>
          )}

          {error && !loading && (
            <div className={`p-3 rounded flex items-start gap-2 ${
              matches.length === 0
                ? darkMode ? 'bg-green-900/20 text-green-400' : 'bg-green-100 text-green-700'
                : darkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-100 text-red-700'
            }`}>
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <div className="text-sm">{error}</div>
            </div>
          )}

          {!loading && activeMatches.length > 0 && currentMatch && (
            <>
              {/* Progress */}
              <div className="flex items-center justify-between text-sm opacity-70">
                <span>
                  {currentIndex + 1} {t(uiLanguage, 'of')} {matches.length} {t(uiLanguage, 'issues')}
                </span>
                <span className={getCategoryColor(currentMatch.rule.issueType)}>
                  {currentMatch.rule.category.name}
                </span>
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
                    {currentMatch.context.text.substring(
                      currentMatch.context.offset,
                      currentMatch.context.offset + currentMatch.context.length
                    )}
                  </span>
                  {currentMatch.context.text.substring(
                    currentMatch.context.offset + currentMatch.context.length
                  )}
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
                <button
                  onClick={ignoreMatch}
                  className={`flex-1 px-4 py-2 rounded ${buttonBg}`}
                >
                  {t(uiLanguage, 'ignore')}
                </button>
                <button
                  onClick={previousMatch}
                  disabled={currentIndex === 0}
                  className={`px-4 py-2 rounded ${buttonBg} disabled:opacity-30`}
                >
                  ←
                </button>
                <button
                  onClick={nextMatch}
                  disabled={currentIndex >= matches.length - 1}
                  className={`px-4 py-2 rounded ${buttonBg} disabled:opacity-30`}
                >
                  →
                </button>
              </div>
            </>
          )}

          {!loading && matches.length > 0 && activeMatches.length === 0 && (
            <div className={`p-4 rounded text-center ${darkMode ? 'bg-green-900/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
              <Check size={48} className="mx-auto mb-2" />
              <p className="font-semibold">{t(uiLanguage, 'allIssuesReviewed')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className="text-xs opacity-50 text-center">
            {t(uiLanguage, 'poweredByLanguageTool')}
          </p>
        </div>
      </div>
    </div>
  );
};
