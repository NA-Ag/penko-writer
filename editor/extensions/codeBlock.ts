import CodeBlock from '@tiptap/extension-code-block';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import type PrismType from 'prismjs';
import { getPrism, loadPrism } from '../lazyAssets';
import { CodeBlockView } from '../nodeviews/CodeBlockView';
import { touchesNodes } from './changes';

type Token = string | PrismType.Token;

const flatten = (tokens: Token[], offset: number, out: { from: number; to: number; cls: string }[], parentCls = '') => {
  let pos = offset;
  for (const token of tokens) {
    if (typeof token === 'string') {
      if (parentCls) out.push({ from: pos, to: pos + token.length, cls: parentCls });
      pos += token.length;
      continue;
    }
    const alias = Array.isArray(token.alias) ? token.alias.join(' ') : token.alias || '';
    const cls = `token ${token.type} ${alias}`.trim();
    const content = token.content;
    const len = token.length;
    if (Array.isArray(content)) flatten(content as Token[], pos, out, cls);
    else if (typeof content === 'string') out.push({ from: pos, to: pos + len, cls });
    else flatten([content as Token], pos, out, cls);
    pos += len;
  }
};

const highlight = (doc: PMNode) => {
  const Prism = getPrism();
  if (!Prism) return DecorationSet.empty;
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'codeBlock') return true;
    const lang = node.attrs.language as string;
    const grammar = lang ? Prism.languages[lang] : undefined;
    if (!grammar) return false;
    const ranges: { from: number; to: number; cls: string }[] = [];
    flatten(Prism.tokenize(node.textContent, grammar), 0, ranges);
    for (const r of ranges) decos.push(Decoration.inline(pos + 1 + r.from, pos + 1 + r.to, { class: r.cls }));
    return false;
  });
  return DecorationSet.create(doc, decos);
};

const prismKey = new PluginKey('prismHighlight');

export const PenkoCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: 'plaintext',
        parseHTML: (el: HTMLElement) => {
          const code = el.querySelector('code');
          const cls = `${code?.className || ''} ${el.className || ''}`;
          return el.getAttribute('data-language') || (cls.match(/language-([\w-]+)/) || [])[1] || 'plaintext';
        },
        renderHTML: (attrs: Record<string, any>) => ({ 'data-language': attrs.language }),
      },
      theme: {
        default: 'dark',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-theme') || 'dark',
        renderHTML: (attrs: Record<string, any>) => ({ 'data-theme': attrs.theme }),
      },
      lineNumbers: {
        default: true,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-line-numbers') !== 'false',
        renderHTML: (attrs: Record<string, any>) => ({ 'data-line-numbers': attrs.lineNumbers ? 'true' : 'false' }),
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['pre', HTMLAttributes, ['code', { class: `language-${node.attrs.language}` }, 0]];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      new Plugin({
        key: prismKey,
        state: {
          init: (_, { doc }) => highlight(doc),
          apply: (tr, set, _old, newState) => {
            if (tr.getMeta(prismKey) === 'loaded') return highlight(newState.doc);
            if (!tr.docChanged) return set;
            // Re-tokenize only when a code block was edited; otherwise just map positions
            return touchesNodes([tr], newState.doc, n => n.type.name === 'codeBlock') ? highlight(tr.doc) : set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations: state => prismKey.getState(state),
        },
        // Load Prism the first time the document has a code block
        view: view => {
          const check = () => {
            if (getPrism()) return;
            let has = false;
            view.state.doc.descendants(n => {
              if (has) return false;
              if (n.type.name === 'codeBlock') has = true;
              return !has && !n.isTextblock;
            });
            if (has) void loadPrism().then(() => !view.isDestroyed && view.dispatch(view.state.tr.setMeta(prismKey, 'loaded').setMeta('addToHistory', false)));
          };
          check();
          return { update: (v, prev) => v.state.doc !== prev.doc && !getPrism() && check() };
        },
      }),
    ];
  },
}).configure({ defaultLanguage: 'plaintext', enableTabIndentation: true } as any);
