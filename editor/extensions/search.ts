import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

/**
 * Find & replace implemented as decorations: matches are highlighted without
 * touching the document, and replacements are ordinary (undoable) transactions.
 */

export interface SearchOptions {
  term: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  /** Restrict matches to this document range. */
  range?: { from: number; to: number } | null;
}

export interface SearchMatch {
  from: number;
  to: number;
  text: string;
}

interface SearchState {
  options: SearchOptions;
  matches: SearchMatch[];
  current: number;
  error: string | null;
}

export const searchKey = new PluginKey<SearchState>('penkoSearch');

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildSearchRegex = (opts: SearchOptions): RegExp | null => {
  if (!opts.term) return null;
  let source = opts.regex ? opts.term : escapeRegExp(opts.term);
  if (opts.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
  return new RegExp(source, `gu${opts.caseSensitive ? '' : 'i'}`);
};

/** Text of each textblock with a map back to document positions. */
export const textblockSegments = (doc: PMNode) => {
  const segments: { text: string; positions: number[] }[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    const positions: number[] = [];
    node.forEach((child, offset) => {
      const start = pos + 1 + offset;
      if (child.isText) {
        const t = child.text || '';
        for (let i = 0; i < t.length; i++) positions.push(start + i);
        text += t;
      } else {
        // atoms (images, footnotes) count as a single object character
        positions.push(start);
        text += '￼';
      }
    });
    positions.push(pos + 1 + node.content.size);
    segments.push({ text, positions });
    return false;
  });
  return segments;
};

export const findMatches = (doc: PMNode, opts: SearchOptions): { matches: SearchMatch[]; error: string | null } => {
  let re: RegExp | null;
  try {
    re = buildSearchRegex(opts);
  } catch (e: any) {
    return { matches: [], error: e?.message || 'Invalid regular expression' };
  }
  if (!re) return { matches: [], error: null };
  const matches: SearchMatch[] = [];
  for (const seg of textblockSegments(doc)) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg.text))) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const from = seg.positions[m.index];
      const to = seg.positions[m.index + m[0].length - 1] + 1;
      if (opts.range && (from < opts.range.from || to > opts.range.to)) continue;
      matches.push({ from, to, text: m[0] });
      if (matches.length > 5000) return { matches, error: null };
    }
  }
  return { matches, error: null };
};

/** Expand $1 / $& in replacement strings for regex mode. */
const expandReplacement = (match: string, opts: SearchOptions, replacement: string) => {
  if (!opts.regex) return replacement;
  const re = buildSearchRegex({ ...opts, wholeWord: false });
  if (!re) return replacement;
  re.lastIndex = 0;
  return match.replace(new RegExp(re.source, re.flags.replace('g', '')), replacement);
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    search: {
      setSearch: (options: SearchOptions) => ReturnType;
      clearSearch: () => ReturnType;
      goToMatch: (index: number) => ReturnType;
      replaceMatch: (replacement: string) => ReturnType;
      replaceAllMatches: (replacement: string) => ReturnType;
    };
  }
}

const emptyState: SearchState = { options: { term: '' }, matches: [], current: 0, error: null };

export const getSearchState = (state: any): SearchState => searchKey.getState(state) || emptyState;

export const Search = Extension.create({
  name: 'search',
  addCommands() {
    const scrollToCurrent = (editor: any) => {
      if (typeof requestAnimationFrame === 'undefined') return;
      requestAnimationFrame(() => {
        if (editor.isDestroyed) return;
        const el = editor.view.dom.querySelector('.search-match-current');
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    };
    return {
      setSearch:
        (options: SearchOptions) =>
        ({ tr, dispatch, editor }: any) => {
          if (dispatch) {
            tr.setMeta(searchKey, { options }).setMeta('addToHistory', false);
            scrollToCurrent(editor);
          }
          return true;
        },
      clearSearch:
        () =>
        ({ tr, dispatch }: any) => {
          if (dispatch) tr.setMeta(searchKey, { options: { term: '' } }).setMeta('addToHistory', false);
          return true;
        },
      goToMatch:
        (index: number) =>
        ({ tr, dispatch, state, editor }: any) => {
          const s = getSearchState(state);
          if (!s.matches.length) return false;
          const i = ((index % s.matches.length) + s.matches.length) % s.matches.length;
          if (dispatch) {
            const m = s.matches[i];
            tr.setMeta(searchKey, { current: i }).setSelection(TextSelection.create(tr.doc, m.from, m.to));
            scrollToCurrent(editor);
          }
          return true;
        },
      replaceMatch:
        (replacement: string) =>
        ({ tr, dispatch, state }: any) => {
          const s = getSearchState(state);
          const m = s.matches[s.current];
          if (!m) return false;
          if (dispatch) {
            const text = expandReplacement(m.text, s.options, replacement);
            if (text) tr.insertText(text, m.from, m.to);
            else tr.delete(m.from, m.to);
            tr.setMeta(searchKey, { keepCurrent: true });
          }
          return true;
        },
      replaceAllMatches:
        (replacement: string) =>
        ({ tr, dispatch, state }: any) => {
          const s = getSearchState(state);
          if (!s.matches.length) return false;
          if (dispatch) {
            [...s.matches].reverse().forEach(m => {
              const text = expandReplacement(m.text, s.options, replacement);
              if (text) tr.insertText(text, m.from, m.to);
              else tr.delete(m.from, m.to);
            });
          }
          return true;
        },
    } as any;
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => emptyState,
          apply: (tr, prev, _old, newState) => {
            const meta = tr.getMeta(searchKey);
            let options = prev.options;
            let current = prev.current;
            if (meta?.options) {
              options = meta.options;
              current = 0;
            }
            if (meta && typeof meta.current === 'number') current = meta.current;
            if (!meta?.options && !tr.docChanged) return { ...prev, current };
            if (!options.term) return emptyState;
            const range = options.range ? { from: tr.mapping.map(options.range.from), to: tr.mapping.map(options.range.to) } : null;
            const opts = range ? { ...options, range } : options;
            const { matches, error } = findMatches(newState.doc, opts);
            if (meta?.options && matches.length) {
              // start at the first match after the cursor
              const head = newState.selection.from;
              const idx = matches.findIndex(m => m.from >= head);
              current = idx === -1 ? 0 : idx;
            }
            return { options: opts, matches, current: Math.min(current, Math.max(0, matches.length - 1)), error };
          },
        },
        props: {
          decorations: state => {
            const s = searchKey.getState(state);
            if (!s || !s.matches.length) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              s.matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === s.current ? 'search-match search-match-current' : 'search-match' })),
            );
          },
        },
      }),
    ];
  },
});
