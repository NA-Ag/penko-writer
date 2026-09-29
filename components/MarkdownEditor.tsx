import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Editor as TiptapEditor } from '@tiptap/core';
import { htmlToMarkdown, markdownToHtml } from '../utils/markdownConverter';
import { createExtensions } from '../editor/extensions';
import { prepareHtmlForEditor, sanitizeHtml } from '../editor/sanitize';
import { getKatex, loadKatex } from '../editor/lazyAssets';
import { useApp } from '../AppContext';
import { t } from '../utils/translations';

interface MarkdownEditorProps {
  content: string;
  /** Exact markdown text saved the last time this document was edited in markdown mode. */
  markdownSource?: string;
  /**
   * Kept for API compatibility; edits are persisted through the app context
   * (`updateCurrentDoc({ content, markdownSource })`, debounced) instead.
   */
  onChange?: (htmlContent: string) => void;
  darkMode: boolean;
  language?: string;
}

const SAVE_DELAY = 400;

/** Structural fingerprint of HTML (schema-normalised, heading ids ignored). */
const fingerprint = (html: string): string => {
  let editor: TiptapEditor | null = null;
  try {
    editor = new TiptapEditor({ extensions: createExtensions({ paginate: false }), content: prepareHtmlForEditor(html) });
    const json = editor.getJSON();
    // the rich editor appends an empty trailing paragraph; ignore it
    const blocks = [...(json.content || [])];
    while (blocks.length && blocks[blocks.length - 1].type === 'paragraph' && !blocks[blocks.length - 1].content?.length) blocks.pop();
    return JSON.stringify({ ...json, content: blocks }, (key, value) => (key === 'id' ? undefined : value));
  } catch {
    return html;
  } finally {
    editor?.destroy();
  }
};

/**
 * Rule for entering markdown mode: the saved `markdownSource` is reused when
 * the document content is still what that markdown produces (i.e. nothing was
 * edited in rich-text mode since). Otherwise the markdown is regenerated from
 * the HTML.
 */
const initialMarkdown = (content: string, source?: string): string => {
  if (source != null) {
    const fromSource = markdownToHtml(source);
    if (fromSource === content || prepareHtmlForEditor(fromSource) === content || fingerprint(fromSource) === fingerprint(content)) return source;
  }
  return htmlToMarkdown(content || '');
};

/** Parses HTML without loading its images (unlike a detached <div>). */
const inertBody = (html: string) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;

const htmlStats = (html: string) => {
  const div = inertBody(html);
  div.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,pre,blockquote,tr,br').forEach(el => el.append('\n'));
  const text = (div.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  return { words, characters: text.replace(/\n/g, '').length, text };
};

const hasEquations = (html: string) => html.includes('data-type="equation"');

/**
 * Preview HTML: equations rendered with KaTeX (their LaTeX source until KaTeX
 * has loaded), always sanitized.
 */
const previewHtml = (markdown: string) => {
  const html = markdownToHtml(markdown);
  if (!hasEquations(html)) return html;
  const katex = getKatex();
  const div = inertBody(html);
  div.querySelectorAll('span[data-type="equation"]').forEach(el => {
    const latex = el.getAttribute('data-latex') || '';
    try {
      if (!katex) throw new Error('KaTeX not loaded');
      el.innerHTML = katex.renderToString(latex, { throwOnError: false, displayMode: el.getAttribute('data-display') === 'true' });
    } catch {
      el.textContent = latex;
    }
  });
  return sanitizeHtml(div.innerHTML);
};

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  content,
  markdownSource,
  darkMode,
  language = 'en-US'
}) => {
  const { currentDoc, updateCurrentDoc, setStats, registerEditorFlush, uiLanguage } = useApp();
  // Edits always belong to the document this editor was opened for.
  const docIdRef = useRef(currentDoc?.id);
  // The component is keyed by document id, so this runs once per document.
  const [markdownText, setMarkdownText] = useState(() => initialMarkdown(content, markdownSource));
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<string | null>(null);
  const timer = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const text = pending.current;
    if (text === null) return;
    pending.current = null;
    const html = markdownToHtml(text);
    updateCurrentDoc(d => (d.id === docIdRef.current ? { content: html, markdownSource: text } : {}));
    setStats(htmlStats(html));
  }, [updateCurrentDoc, setStats]);

  // Doc switches, mode toggles, "save now" and tab close call flushPendingEdits().
  useEffect(() => {
    registerEditorFlush(flush);
    return () => {
      // e.g. remounted by a restore: don't let a pending save fire later
      flush();
      registerEditorFlush(null);
    };
  }, [registerEditorFlush, flush]);

  useEffect(() => {
    setStats(htmlStats(markdownToHtml(markdownText)));
    // only on mount: later updates happen in flush()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedule = (text: string) => {
    pending.current = text;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY);
  };

  // Handle markdown text changes
  const handleMarkdownChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMarkdown = e.target.value;
    setMarkdownText(newMarkdown);
    schedule(newMarkdown);
  };

  // Tab key support for indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newText = markdownText.substring(0, start) + '  ' + markdownText.substring(end);
      setMarkdownText(newText);
      schedule(newText);

      // Restore cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const [katexReady, setKatexReady] = useState(() => !!getKatex());
  const preview = useMemo(() => (showPreview ? previewHtml(markdownText) : ''), [showPreview, markdownText, katexReady]);
  useEffect(() => {
    if (katexReady || !hasEquations(preview)) return;
    let alive = true;
    loadKatex().then(
      () => alive && setKatexReady(true),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [preview, katexReady]);

  return (
    <div className="h-full w-full max-w-4xl flex flex-col">
      {/* Toolbar */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${
        darkMode ? 'bg-[#252526] border-gray-700' : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {t(uiLanguage, 'markdownMode')}
          </span>
          <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {t(uiLanguage, 'markdownFlavor')}
          </span>
        </div>
        <button
          onClick={() => {
            flush();
            setShowPreview(!showPreview);
          }}
          aria-pressed={showPreview}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            showPreview
              ? 'bg-blue-600 text-white'
              : darkMode
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {showPreview ? t(uiLanguage, 'markdownEditTab') : t(uiLanguage, 'preview')}
        </button>
      </div>

      {/* Editor/Preview */}
      <div className="flex-1 overflow-hidden">
        {showPreview ? (
          // Preview Mode (document styles from editor/editor.css)
          <div
            className={`h-full overflow-auto p-8 max-w-none penko-doc ${
              darkMode ? 'penko-doc-dark bg-[#1e1e1e]' : 'bg-white'
            }`}
            lang={language}
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        ) : (
          // Edit Mode
          <textarea
            ref={textareaRef}
            value={markdownText}
            onChange={handleMarkdownChange}
            onKeyDown={handleKeyDown}
            onBlur={flush}
            spellCheck={true}
            lang={language}
            className={`w-full h-full p-8 font-mono text-sm resize-none focus:outline-none ${
              darkMode
                ? 'bg-[#1e1e1e] text-gray-300 placeholder-gray-600'
                : 'bg-white text-gray-900 placeholder-gray-400'
            }`}
            placeholder={t(uiLanguage, 'markdownPlaceholder')}
          />
        )}
      </div>
    </div>
  );
};
