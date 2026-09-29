import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { getKatex, loadKatex } from '../lazyAssets';
import { escapeHtml } from '../sanitize';
import { Citation } from '../../types';
import { BIBLIOGRAPHY_TITLES, CitationStyle, formatBibliographyEntry, formatInTextCitation, sortCitations } from '../citations';
import { buildTocInnerHtml, collectHeadings, TocStyle, tocContainerStyle } from '../toc';
import { touchesNodes } from './changes';

/**
 * Footnotes, citations, bibliography, equations and the table of contents are
 * real document nodes. Their visible text is derived (numbering, formatting,
 * heading list) so it can never go stale.
 */

export interface ReferenceStorage {
  citations: Citation[];
  tocTitle: string;
  tocEmpty: string;
  version: number;
}

const refsKey = new PluginKey('penkoReferences');

const getRefs = (editor: any): ReferenceStorage =>
  (editor?.storage?.references as ReferenceStorage) || { citations: [], tocTitle: 'Table of Contents', tocEmpty: 'No headings found', version: 0 };

const headingSignature = (doc: PMNode) => {
  let sig = '';
  doc.descendants(node => {
    if (node.type.name === 'heading') sig += `${node.attrs.level}:${node.attrs.id}:${node.textContent}|`;
    return true;
  });
  return sig;
};

/** Holds document-level reference data and re-renders dependent node views. */
export const References = Extension.create<{}, ReferenceStorage>({
  name: 'references',
  addStorage() {
    return { citations: [], tocTitle: 'Table of Contents', tocEmpty: 'No headings found', version: 0 };
  },
  addCommands() {
    return {
      setReferenceData:
        (data: Partial<ReferenceStorage>) =>
        ({ tr, dispatch }: any) => {
          const storage = getRefs(this.editor);
          Object.assign(storage, data);
          storage.version++;
          if (dispatch) tr.setMeta(refsKey, storage.version).setMeta('addToHistory', false);
          return true;
        },
    } as any;
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: refsKey,
        state: {
          init: (_, state) => {
            const sig = headingSignature(state.doc);
            return { sig, version: getRefs(editor).version, decorations: refDecorations(state.doc, sig, getRefs(editor).version) };
          },
          apply: (tr, value, _old, newState) => {
            const version = tr.getMeta(refsKey) ?? value.version;
            // Rebuild only when headings or reference nodes were touched (or data changed)
            const relevant = tr.docChanged && touchesNodes([tr], newState.doc, n => REF_NODES.has(n.type.name));
            if (!relevant && version === value.version) {
              return tr.docChanged ? { ...value, decorations: value.decorations.map(tr.mapping, tr.doc) } : value;
            }
            const sig = relevant ? headingSignature(newState.doc) : value.sig;
            return { sig, version, decorations: refDecorations(newState.doc, sig, version) };
          },
        },
        props: {
          decorations: state => refsKey.getState(state)?.decorations,
        },
      }),
      // Keep footnote / endnote numbers in document order
      new Plugin({
        key: new PluginKey('footnoteNumbering'),
        appendTransaction: (transactions, _old, newState) => {
          if (!transactions.some(t => t.docChanged)) return null;
          if (!touchesNodes(transactions, newState.doc, n => n.type.name === 'footnote')) return null;
          const counters: Record<string, number> = { footnote: 0, endnote: 0 };
          const tr = newState.tr;
          let changed = false;
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'footnote') return true;
            const kind = node.attrs.noteType === 'endnote' ? 'endnote' : 'footnote';
            const n = ++counters[kind];
            if (node.attrs.number !== n) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, number: n });
              changed = true;
            }
            return false;
          });
          if (!changed) return null;
          tr.setMeta('addToHistory', false);
          return tr;
        },
      }),
    ];
  },
});

const REF_NODES = new Set(['heading', 'tableOfContents', 'citation', 'bibliography']);

/** Node decorations that make TOC / citation / bibliography node views re-render when their inputs change. */
const refDecorations = (doc: PMNode, sig: string, version: number) => {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    const name = node.type.name;
    if (name === 'tableOfContents') decos.push(Decoration.node(pos, pos + node.nodeSize, { 'data-sig': String(sig.length) + ':' + hash(sig) }));
    else if (name === 'citation' || name === 'bibliography') decos.push(Decoration.node(pos, pos + node.nodeSize, { 'data-v': String(version) }));
    return true;
  });
  return decos.length ? DecorationSet.create(doc, decos) : DecorationSet.empty;
};

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

const toRoman = (num: number) => {
  const map: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let out = '';
  for (const [v, s] of map) while (num >= v) { out += s; num -= v; }
  return out;
};

export const noteLabel = (noteType: string, number: number) => (noteType === 'endnote' ? toRoman(number || 1) : String(number || 1));

export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      id: { default: null, parseHTML: el => el.getAttribute('data-id') || el.getAttribute('data-note-id') },
      noteType: { default: 'footnote', parseHTML: el => el.getAttribute('data-note-type') || 'footnote' },
      content: { default: '', parseHTML: el => el.getAttribute('data-content') || '' },
      number: { default: 0, parseHTML: el => parseInt(el.getAttribute('data-number') || el.getAttribute('data-legacy-number') || '0', 10) || 0 },
      legacyNumber: { default: null, parseHTML: el => el.getAttribute('data-legacy-number'), renderHTML: () => ({}) },
    };
  },
  parseHTML() {
    return [{ tag: 'sup[data-type="footnote"]', priority: 60 }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'sup',
      mergeAttributes(
        {
          'data-type': 'footnote',
          'data-id': node.attrs.id,
          'data-note-type': node.attrs.noteType,
          'data-content': node.attrs.content,
          'data-number': node.attrs.number,
          class: `${node.attrs.noteType}-ref`,
        },
        { style: HTMLAttributes.style || null },
      ),
      noteLabel(node.attrs.noteType, node.attrs.number),
    ];
  },
  renderText({ node }) {
    return `[${noteLabel(node.attrs.noteType, node.attrs.number)}]`;
  },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('sup');
      dom.className = `${node.attrs.noteType}-ref penko-note-ref`;
      dom.setAttribute('data-type', 'footnote');
      dom.contentEditable = 'false';
      const render = (n: PMNode) => {
        dom.textContent = noteLabel(n.attrs.noteType, n.attrs.number);
        dom.title = n.attrs.content || '';
        dom.className = `${n.attrs.noteType}-ref penko-note-ref`;
      };
      render(node);
      dom.addEventListener('click', () => {
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        editor.emit('penko:editFootnote' as any, { pos, node } as any);
      });
      return {
        dom,
        update: updated => {
          if (updated.type.name !== 'footnote') return false;
          render(updated);
          return true;
        },
      };
    };
  },
});

export const CitationNode = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      citationId: { default: null, parseHTML: el => el.getAttribute('data-citation-id') },
      citationStyle: { default: 'apa', parseHTML: el => el.getAttribute('data-citation-style') || 'apa' },
      fallback: { default: '', parseHTML: el => el.textContent || '', renderHTML: () => ({}) },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-type="citation"]', priority: 60 }];
  },
  renderHTML({ node }) {
    const refs = getRefs(this.editor);
    const c = refs.citations.find(x => x.id === node.attrs.citationId);
    const text = c ? formatInTextCitation(c, node.attrs.citationStyle) : node.attrs.fallback || '[?]';
    return ['span', { 'data-type': 'citation', class: 'citation', 'data-citation-id': node.attrs.citationId, 'data-citation-style': node.attrs.citationStyle }, text];
  },
  renderText({ node }) {
    const c = getRefs(this.editor).citations.find(x => x.id === node.attrs.citationId);
    return c ? formatInTextCitation(c, node.attrs.citationStyle) : node.attrs.fallback || '';
  },
  addNodeView() {
    return ({ node, editor }) => {
      const dom = document.createElement('span');
      dom.className = 'citation';
      dom.contentEditable = 'false';
      const render = (n: PMNode) => {
        const c = getRefs(editor).citations.find(x => x.id === n.attrs.citationId);
        dom.textContent = c ? formatInTextCitation(c, n.attrs.citationStyle) : n.attrs.fallback || '[?]';
        dom.classList.toggle('citation-missing', !c);
      };
      render(node);
      return {
        dom,
        update: updated => {
          if (updated.type.name !== 'citation') return false;
          render(updated);
          return true;
        },
      };
    };
  },
});

const bibliographyHtml = (citations: Citation[], style: CitationStyle) => {
  const entries = sortCitations(citations)
    .map(c => (style === 'bibtex' ? `<pre style="font-family: monospace; margin: 10px 0; white-space: pre-wrap;">${formatBibliographyEntry(c, style)}</pre>` : `<p style="margin: 8px 0;">${formatBibliographyEntry(c, style)}</p>`))
    .join('');
  return `<h2 style="font-size: 1.5em; font-weight: bold; margin-bottom: 20px;">${BIBLIOGRAPHY_TITLES[style]}</h2><div style="padding-left: 40px; text-indent: -40px;">${entries}</div>`;
};

/** Citations actually used in the document, in first-use order. */
export const citedIds = (doc: PMNode): string[] => {
  const ids: string[] = [];
  doc.descendants(node => {
    if (node.type.name === 'citation' && node.attrs.citationId && !ids.includes(node.attrs.citationId)) ids.push(node.attrs.citationId);
    return true;
  });
  return ids;
};

export const Bibliography = Node.create({
  name: 'bibliography',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      citationStyle: { default: 'apa', parseHTML: el => el.getAttribute('data-citation-style') || 'apa' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="bibliography"]', priority: 60 }];
  },
  renderHTML({ node }) {
    const refs = getRefs(this.editor);
    const dom = document.createElement('div');
    dom.setAttribute('data-type', 'bibliography');
    dom.setAttribute('data-citation-style', node.attrs.citationStyle);
    dom.className = 'bibliography';
    dom.setAttribute('style', 'margin-top: 40px; page-break-before: always;');
    dom.innerHTML = bibliographyHtml(refs.citations, node.attrs.citationStyle);
    return dom;
  },
  addNodeView() {
    return ({ node, editor }) => {
      const dom = document.createElement('div');
      dom.className = 'bibliography';
      dom.contentEditable = 'false';
      dom.style.marginTop = '40px';
      const render = (n: PMNode) => {
        dom.innerHTML = bibliographyHtml(getRefs(editor).citations, n.attrs.citationStyle);
      };
      render(node);
      return {
        dom,
        update: updated => {
          if (updated.type.name !== 'bibliography') return false;
          render(updated);
          return true;
        },
      };
    };
  },
});

const renderKatex = (latex: string, displayMode: boolean) => {
  const katex = getKatex();
  // Until KaTeX has loaded, show the source; node views re-render once it arrives
  if (!katex) return `<span class="katex-pending">${escapeHtml(latex || '')}</span>`;
  try {
    return katex.renderToString(latex || '', { throwOnError: false, displayMode, output: 'htmlAndMathml' });
  } catch {
    return '';
  }
};

export const Equation = Node.create({
  name: 'equation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      latex: { default: '', parseHTML: el => el.getAttribute('data-latex') || '' },
      display: { default: false, parseHTML: el => el.getAttribute('data-display') === 'true' },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-type="equation"]', priority: 60 }];
  },
  renderHTML({ node }) {
    const dom = document.createElement('span');
    dom.setAttribute('data-type', 'equation');
    dom.setAttribute('data-latex', node.attrs.latex);
    if (node.attrs.display) dom.setAttribute('data-display', 'true');
    dom.className = 'katex-equation';
    dom.innerHTML = renderKatex(node.attrs.latex, node.attrs.display);
    return dom;
  },
  renderText({ node }) {
    return node.attrs.latex;
  },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('span');
      dom.className = 'katex-equation';
      dom.contentEditable = 'false';
      const render = (n: PMNode) => {
        dom.style.display = n.attrs.display ? 'block' : 'inline-block';
        dom.style.textAlign = n.attrs.display ? 'center' : '';
        dom.innerHTML = renderKatex(n.attrs.latex, n.attrs.display);
      };
      render(node);
      if (!getKatex()) void loadKatex().then(() => render(node));
      dom.addEventListener('dblclick', () => {
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        editor.emit('penko:editEquation' as any, { pos, node } as any);
      });
      return {
        dom,
        update: updated => {
          if (updated.type.name !== 'equation') return false;
          render(updated);
          return true;
        },
      };
    };
  },
});

export const TableOfContents = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      tocStyle: { default: 'default', parseHTML: el => el.getAttribute('data-toc-style') || 'default' },
      levels: {
        default: [1, 2, 3],
        parseHTML: el => (el.getAttribute('data-levels') || '1,2,3').split(',').map(Number).filter(Boolean),
        renderHTML: attrs => ({ 'data-levels': (attrs.levels || []).join(',') }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="toc"]', priority: 60 }];
  },
  renderHTML({ node }) {
    const refs = getRefs(this.editor);
    const doc = this.editor?.state.doc;
    const entries = doc ? collectHeadings(doc, node.attrs.levels) : [];
    const dom = document.createElement('div');
    dom.setAttribute('data-type', 'toc');
    dom.setAttribute('data-toc-style', node.attrs.tocStyle);
    dom.setAttribute('data-levels', (node.attrs.levels || []).join(','));
    dom.className = 'table-of-contents';
    dom.setAttribute('style', tocContainerStyle(node.attrs.tocStyle as TocStyle));
    dom.innerHTML = buildTocInnerHtml(entries, node.attrs.tocStyle, refs.tocTitle, refs.tocEmpty);
    return dom;
  },
  addNodeView() {
    return ({ node, editor }) => {
      const dom = document.createElement('div');
      dom.className = 'table-of-contents';
      dom.contentEditable = 'false';
      let current = node;
      const render = () => {
        const refs = getRefs(editor);
        dom.setAttribute('style', tocContainerStyle(current.attrs.tocStyle));
        dom.innerHTML = buildTocInnerHtml(collectHeadings(editor.state.doc, current.attrs.levels), current.attrs.tocStyle, refs.tocTitle, refs.tocEmpty);
      };
      render();
      dom.addEventListener('click', e => {
        const a = (e.target as HTMLElement).closest('a');
        if (!a) return;
        e.preventDefault();
        const id = (a.getAttribute('href') || '').slice(1);
        const target = id ? editor.view.dom.querySelector(`[id="${CSS.escape(id)}"]`) : null;
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return {
        dom,
        update: updated => {
          if (updated.type.name !== 'tableOfContents') return false;
          current = updated;
          render();
          return true;
        },
      };
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    references: {
      setReferenceData: (data: Partial<ReferenceStorage>) => ReturnType;
    };
  }
}
