import React, { useState, useEffect } from 'react';
import { X, Search, Replace, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { t, LanguageCode } from '../utils/translations';

interface AdvancedFindReplaceProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
  editorRef: React.RefObject<HTMLDivElement>;
}

interface Match {
  node: Text;
  offset: number;
  length: number;
  text: string;
}

export const AdvancedFindReplace: React.FC<AdvancedFindReplaceProps> = ({
  isOpen,
  onClose,
  darkMode,
  uiLanguage,
  editorRef
}) => {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [findInSelection, setFindInSelection] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [regexError, setRegexError] = useState('');

  // Clear highlights
  const clearHighlights = () => {
    if (!editorRef.current) return;
    const editorElement = editorRef.current.getContentElement();
    if (!editorElement) return;

    // Remove all highlight marks
    const highlights = editorElement.querySelectorAll('mark.find-highlight');
    highlights.forEach(mark => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });
  };

  // Get text nodes from editor
  const getTextNodes = (node: Node, selectionOnly: boolean = false): Text[] => {
    const textNodes: Text[] = [];

    let range: Range | null = null;
    if (selectionOnly) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return [];
      range = selection.getRangeAt(0);
    }

    const walk = (n: Node) => {
      if (n.nodeType === Node.TEXT_NODE) {
        const textNode = n as Text;
        if (textNode.textContent && textNode.textContent.trim()) {
          // If selection only, check if node is in range
          if (range) {
            if (range.intersectsNode(n)) {
              textNodes.push(textNode);
            }
          } else {
            textNodes.push(textNode);
          }
        }
      } else {
        n.childNodes.forEach(walk);
      }
    };

    walk(node);
    return textNodes;
  };

  // Find matches
  const findMatches = () => {
    if (!editorRef.current || !findText) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      clearHighlights();
      return;
    }

    const editorElement = editorRef.current.getContentElement();
    if (!editorElement) return;

    clearHighlights();
    setRegexError('');
    const foundMatches: Match[] = [];

    try {
      let pattern: RegExp;

      if (useRegex) {
        // User-provided regex
        const flags = caseSensitive ? 'g' : 'gi';
        pattern = new RegExp(findText, flags);
      } else {
        // Escape special regex characters
        let escapedText = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Whole word matching
        if (wholeWord) {
          escapedText = `\\b${escapedText}\\b`;
        }

        const flags = caseSensitive ? 'g' : 'gi';
        pattern = new RegExp(escapedText, flags);
      }

      const textNodes = getTextNodes(editorElement, findInSelection);

      textNodes.forEach(node => {
        const text = node.textContent || '';
        let match;

        // Reset regex lastIndex
        pattern.lastIndex = 0;

        while ((match = pattern.exec(text)) !== null) {
          foundMatches.push({
            node,
            offset: match.index,
            length: match[0].length,
            text: match[0]
          });

          // Prevent infinite loop with zero-length matches
          if (match[0].length === 0) {
            pattern.lastIndex++;
          }
        }
      });

      setMatches(foundMatches);
      setCurrentMatchIndex(foundMatches.length > 0 ? 0 : -1);

      // Highlight all matches
      highlightMatches(foundMatches);

      // Jump to first match
      if (foundMatches.length > 0) {
        jumpToMatch(0, foundMatches);
      }
    } catch (error) {
      setRegexError(error instanceof Error ? error.message : 'Invalid regex pattern');
      setMatches([]);
      setCurrentMatchIndex(-1);
    }
  };

  // Highlight matches
  const highlightMatches = (matchList: Match[]) => {
    matchList.forEach((match, index) => {
      const mark = document.createElement('mark');
      mark.className = 'find-highlight';
      mark.style.backgroundColor = darkMode ? 'rgba(251, 191, 36, 0.4)' : 'rgba(251, 191, 36, 0.6)';
      mark.style.borderRadius = '2px';
      mark.style.padding = '0 2px';

      const range = document.createRange();
      range.setStart(match.node, match.offset);
      range.setEnd(match.node, match.offset + match.length);
      range.surroundContents(mark);
    });
  };

  // Jump to match
  const jumpToMatch = (index: number, matchList: Match[] = matches) => {
    if (index < 0 || index >= matchList.length) return;

    const match = matchList[index];

    // Find the mark element
    let currentNode: Node | null = match.node;
    while (currentNode && currentNode.nodeType !== Node.ELEMENT_NODE) {
      currentNode = currentNode.parentNode;
    }

    if (currentNode && currentNode instanceof HTMLElement) {
      // Scroll to element
      currentNode.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Update highlight to show current match
      if (editorRef.current) {
        const editorElement = editorRef.current.getContentElement();
        if (editorElement) {
          const highlights = editorElement.querySelectorAll('mark.find-highlight');
          highlights.forEach((mark, i) => {
            if (i === index) {
              (mark as HTMLElement).style.backgroundColor = darkMode ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.4)';
              (mark as HTMLElement).style.outline = '2px solid rgb(59, 130, 246)';
            } else {
              (mark as HTMLElement).style.backgroundColor = darkMode ? 'rgba(251, 191, 36, 0.4)' : 'rgba(251, 191, 36, 0.6)';
              (mark as HTMLElement).style.outline = 'none';
            }
          });
        }
      }
    }
  };

  // Navigate matches
  const nextMatch = () => {
    if (matches.length === 0) return;
    const newIndex = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(newIndex);
    jumpToMatch(newIndex);
  };

  const previousMatch = () => {
    if (matches.length === 0) return;
    const newIndex = currentMatchIndex <= 0 ? matches.length - 1 : currentMatchIndex - 1;
    setCurrentMatchIndex(newIndex);
    jumpToMatch(newIndex);
  };

  // Replace current match
  const replaceCurrent = () => {
    if (currentMatchIndex < 0 || currentMatchIndex >= matches.length) return;

    const match = matches[currentMatchIndex];
    const mark = findMarkElement(match);

    if (mark && mark.parentNode) {
      const textNode = document.createTextNode(replaceText);
      mark.parentNode.replaceChild(textNode, mark);

      // Rerun search to update matches
      setTimeout(() => {
        findMatches();
      }, 0);
    }
  };

  // Replace all matches
  const replaceAll = () => {
    if (matches.length === 0) return;

    // Replace from end to start to preserve indices
    const sortedMatches = [...matches].reverse();

    sortedMatches.forEach(match => {
      const mark = findMarkElement(match);
      if (mark && mark.parentNode) {
        const textNode = document.createTextNode(replaceText);
        mark.parentNode.replaceChild(textNode, mark);
      }
    });

    // Normalize editor to merge text nodes
    if (editorRef.current) {
      const editorElement = editorRef.current.getContentElement();
      if (editorElement) {
        editorElement.normalize();
      }
    }

    // Clear matches
    setMatches([]);
    setCurrentMatchIndex(-1);
  };

  // Find mark element for a match
  const findMarkElement = (match: Match): HTMLElement | null => {
    if (!editorRef.current) return null;
    const editorElement = editorRef.current.getContentElement();
    if (!editorElement) return null;

    const highlights = editorElement.querySelectorAll('mark.find-highlight');
    for (let i = 0; i < highlights.length; i++) {
      const mark = highlights[i] as HTMLElement;
      if (mark.textContent === match.text) {
        return mark;
      }
    }
    return null;
  };

  // Clear on close
  useEffect(() => {
    if (!isOpen) {
      clearHighlights();
      setMatches([]);
      setCurrentMatchIndex(-1);
    }
  }, [isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        previousMatch();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        nextMatch();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, matches, currentMatchIndex]);

  if (!isOpen) return null;

  const bg = darkMode ? 'bg-[#1e1e1e] border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-900';
  const inputBg = darkMode ? 'bg-[#2a2a2a] border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900';
  const buttonBg = darkMode ? 'bg-[#2a2a2a] hover:bg-[#3a3a3a]' : 'bg-gray-100 hover:bg-gray-200';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={`w-[500px] rounded-lg shadow-2xl border ${bg}`}>
        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Search size={20} />
            {t(uiLanguage, 'findReplace')}
          </h2>
          <button onClick={onClose} className="opacity-60 hover:opacity-100">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Find Input */}
          <div>
            <label className="text-xs opacity-60 block mb-1">{t(uiLanguage, 'findText')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    findMatches();
                  }
                }}
                className={`flex-1 px-3 py-2 rounded border ${inputBg}`}
                placeholder={t(uiLanguage, 'enterSearchTerm')}
                autoFocus
              />
              <button
                onClick={findMatches}
                className={`px-4 py-2 rounded flex items-center gap-2 ${buttonBg}`}
              >
                <Search size={16} />
                {t(uiLanguage, 'find')}
              </button>
            </div>
          </div>

          {/* Replace Input */}
          <div>
            <label className="text-xs opacity-60 block mb-1">{t(uiLanguage, 'replaceWith')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className={`flex-1 px-3 py-2 rounded border ${inputBg}`}
                placeholder={t(uiLanguage, 'enterReplacementText')}
              />
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">{t(uiLanguage, 'useRegex')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">{t(uiLanguage, 'caseSensitive')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={wholeWord}
                onChange={(e) => setWholeWord(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">{t(uiLanguage, 'wholeWord')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={findInSelection}
                onChange={(e) => setFindInSelection(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">{t(uiLanguage, 'findInSelection')}</span>
            </label>
          </div>

          {/* Error Message */}
          {regexError && (
            <div className={`p-3 rounded flex items-start gap-2 ${darkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-100 text-red-700'}`}>
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <div className="text-sm">{regexError}</div>
            </div>
          )}

          {/* Match Counter */}
          {matches.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-70">
                {currentMatchIndex + 1} {t(uiLanguage, 'of')} {matches.length} {t(uiLanguage, 'matches')}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={previousMatch}
                  className={`p-2 rounded ${buttonBg}`}
                  title={t(uiLanguage, 'previousMatch')}
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  onClick={nextMatch}
                  className={`p-2 rounded ${buttonBg}`}
                  title={t(uiLanguage, 'nextMatch')}
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={replaceCurrent}
              disabled={currentMatchIndex < 0}
              className={`flex-1 px-4 py-2 rounded flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              <Replace size={16} />
              {t(uiLanguage, 'replaceCurrent')}
            </button>
            <button
              onClick={replaceAll}
              disabled={matches.length === 0}
              className={`flex-1 px-4 py-2 rounded flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              <Replace size={16} />
              {t(uiLanguage, 'replaceAll')}
            </button>
          </div>

          {/* Hint */}
          <p className="text-xs opacity-50 text-center">
            {t(uiLanguage, 'findReplaceHint')}
          </p>
        </div>
      </div>
    </div>
  );
};
