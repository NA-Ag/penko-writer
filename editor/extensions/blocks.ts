import { Extension, Mark, Node, mergeAttributes } from '@tiptap/core';
import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { omitStyle, parseStyle, setStyleProperty } from './styleUtils';
import { touchesNodes } from './changes';

/**
 * Keep inline `style` / `class` attributes on every structural node so that
 * templates and imported documents render exactly as authored. Properties that
 * other extensions own (text-align, colour, font…) are stripped here so they
 * aren't duplicated.
 */

const INLINE_TAGS = new Set(['A', 'ABBR', 'B', 'BR', 'CITE', 'CODE', 'EM', 'FONT', 'I', 'IMG', 'KBD', 'MARK', 'Q', 'S', 'SMALL', 'SPAN', 'STRIKE', 'STRONG', 'SUB', 'SUP', 'U', 'DEL', 'INS', 'WBR', 'LABEL', 'TIME']);

export const hasOnlyInlineContent = (el: HTMLElement): boolean =>
  Array.from(el.childNodes).every(child => child.nodeType !== 1 || INLINE_TAGS.has((child as HTMLElement).tagName));

const isPageBreakElement = (el: HTMLElement): boolean => {
  if (el.getAttribute('data-type') === 'page-break') return true;
  const style = parseStyle(el.getAttribute('style'));
  const hasBreak = style['page-break-before'] === 'always' || style['page-break-after'] === 'always' || style['break-before'] === 'page' || style['break-after'] === 'page';
  return hasBreak && !(el.textContent || '').trim() && el.children.length === 0;
};

const styleAttr = (exclude: string[] = []) => ({
  default: null,
  parseHTML: (element: HTMLElement) => omitStyle(element.getAttribute('style'), exclude),
  renderHTML: (attributes: Record<string, any>) => (attributes.style ? { style: attributes.style } : {}),
});

const classAttr = (strip?: RegExp) => ({
  default: null,
  parseHTML: (element: HTMLElement) => {
    const cls = (element.getAttribute('class') || '')
      .split(/\s+/)
      .filter(c => c && !(strip && strip.test(c)))
      .join(' ');
    return cls || null;
  },
  renderHTML: (attributes: Record<string, any>) => (attributes.class ? { class: attributes.class } : {}),
});

export const GlobalStyles = Extension.create({
  name: 'globalStyles',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          style: styleAttr(['text-align']),
          class: classAttr(/^(screenplay-|track-break-)/),
          // Tracked paragraph break *before* this block (see review.ts)
          trackBreak: {
            default: null,
            parseHTML: (el: HTMLElement) => {
              try {
                const v = JSON.parse(el.getAttribute('data-track-break') || 'null');
                return v && (v.type === 'insert' || v.type === 'delete') && v.changeId ? v : null;
              } catch {
                return null;
              }
            },
            renderHTML: (attrs: Record<string, any>) =>
              attrs.trackBreak
                ? { 'data-track-break': JSON.stringify(attrs.trackBreak), class: `track-break-${attrs.trackBreak.type}`, title: attrs.trackBreak.author }
                : {},
          },
        },
      },
      {
        types: ['blockquote', 'bulletList', 'orderedList', 'listItem', 'horizontalRule', 'tableRow', 'tableCell', 'tableHeader', 'table', 'bold', 'italic', 'underline', 'strike', 'code', 'link', 'kbd', 'subscript', 'superscript'],
        attributes: { style: styleAttr(), class: classAttr() },
      },
      {
        types: ['textStyle'],
        attributes: { style: styleAttr(['color', 'font-family', 'font-size', 'background-color', 'font-weight', 'font-style']), class: classAttr() },
      },
      {
        types: ['heading'],
        attributes: {
          id: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('id'),
            renderHTML: (attributes: Record<string, any>) => (attributes.id ? { id: attributes.id } : {}),
          },
        },
      },
    ];
  },
});

/** Paragraph that also absorbs inline-only `<div>`s (the old editor's line format). */
export const PenkoParagraph = Paragraph.extend({
  parseHTML() {
    return [
      { tag: 'p' },
      {
        tag: 'div',
        getAttrs: (el: HTMLElement) => (!isPageBreakElement(el) && hasOnlyInlineContent(el) && !el.getAttribute('data-type') ? null : false),
      },
    ];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      screenplayType: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-screenplay-type'),
        renderHTML: (attrs: Record<string, any>) =>
          attrs.screenplayType ? { 'data-screenplay-type': attrs.screenplayType, class: `screenplay-${attrs.screenplayType}` } : {},
      },
      screenplayAuto: {
        default: false,
        parseHTML: () => false,
        renderHTML: () => ({}),
      },
    };
  },
});

/** Headings get stable ids so the TOC and outline can link to them. */
export const PenkoHeading = Heading.extend({
  addProseMirrorPlugins() {
    const plugins = this.parent?.() || [];
    return [
      ...plugins,
      new Plugin({
        key: new PluginKey('headingIds'),
        appendTransaction: (transactions, _old, newState) => {
          if (!transactions.some(t => t.docChanged)) return null;
          // Most edits don't touch a heading: skip the full scan
          if (!touchesNodes(transactions, newState.doc, n => n.type.name === 'heading')) return null;
          const seen = new Set<string>();
          let tr = newState.tr;
          let changed = false;
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'heading') return;
            let id = node.attrs.id as string | null;
            if (!id || seen.has(id)) {
              id = `h-${Math.random().toString(36).slice(2, 10)}`;
              tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, id });
              changed = true;
            }
            seen.add(id);
          });
          if (!changed) return null;
          tr.setMeta('addToHistory', false);
          return tr;
        },
      }),
    ];
  },
});

/** Generic container for templates that group blocks inside styled <div>s. */
export const Div = Node.create({
  name: 'div',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { style: styleAttr(), class: classAttr() };
  },
  parseHTML() {
    return [
      {
        tag: 'div',
        getAttrs: (el: HTMLElement) => (!isPageBreakElement(el) && !hasOnlyInlineContent(el) && !el.getAttribute('data-type') ? null : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0];
  },
});

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div', priority: 60, getAttrs: (el: HTMLElement) => (isPageBreakElement(el) ? null : false) }, { tag: 'hr[data-type="page-break"]' }];
  },
  renderHTML() {
    return ['div', { 'data-type': 'page-break', class: 'page-break', style: 'page-break-after: always' }];
  },
  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) =>
          chain().insertContent({ type: this.name }).run(),
    } as any;
  },
  addKeyboardShortcuts() {
    return { 'Mod-Enter': () => (this.editor.commands as any).setPageBreak() };
  },
});

export const Kbd = Mark.create({
  name: 'kbd',
  parseHTML() {
    return [{ tag: 'kbd' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['kbd', mergeAttributes(HTMLAttributes), 0];
  },
});

const BLOCK_TYPES = ['paragraph', 'heading'];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockStyle: {
      /** Set a CSS property on every paragraph/heading touched by the selection. */
      setBlockStyle: (property: string, value: string | null) => ReturnType;
      indentBlock: () => ReturnType;
      outdentBlock: () => ReturnType;
    };
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
  }
}

const INDENT_STEP = 40;

export const BlockStyleCommands = Extension.create({
  name: 'blockStyleCommands',
  addCommands() {
    const updateBlocks =
      (fn: (style: string | null) => string | null) =>
      ({ tr, state, dispatch }: any) => {
        const { from, to } = state.selection;
        let touched = false;
        state.doc.nodesBetween(from, to, (node: any, pos: number) => {
          if (BLOCK_TYPES.includes(node.type.name)) {
            const style = fn(node.attrs.style);
            if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, style });
            touched = true;
            return false;
          }
          return true;
        });
        return touched;
      };

    return {
      setBlockStyle:
        (property: string, value: string | null) =>
          updateBlocks(style => setStyleProperty(style, property, value)),
      indentBlock:
        () =>
        (props: any) => {
          if (props.editor.isActive('listItem')) return props.commands.sinkListItem('listItem');
          return updateBlocks(style => {
            const current = parseFloat(parseStyle(style)['margin-left'] || '0') || 0;
            return setStyleProperty(style, 'margin-left', `${current + INDENT_STEP}px`);
          })(props);
        },
      outdentBlock:
        () =>
        (props: any) => {
          if (props.editor.isActive('listItem')) return props.commands.liftListItem('listItem');
          return updateBlocks(style => {
            const current = parseFloat(parseStyle(style)['margin-left'] || '0') || 0;
            const next = Math.max(0, current - INDENT_STEP);
            return setStyleProperty(style, 'margin-left', next ? `${next}px` : null);
          })(props);
        },
    } as any;
  },
});

/*
 * Bold / italic only become marks for inline elements. Templates put
 * `font-weight` / `font-style` on blocks; those stay as block styles so the
 * rendered weight is unchanged (a <strong> inside a 600-weight block would
 * render heavier).
 */
const BOLD_RE = /^(bold(er)?|[5-9]\d{2,})$/;
export const PenkoBold = Bold.extend({
  parseHTML() {
    return [
      { tag: 'strong' },
      { tag: 'b', getAttrs: (node: HTMLElement) => node.style.fontWeight !== 'normal' && null },
      { tag: 'span', consuming: false, getAttrs: (node: HTMLElement) => (BOLD_RE.test(node.style.fontWeight) ? null : false) },
    ];
  },
});
export const PenkoItalic = Italic.extend({
  parseHTML() {
    return [
      { tag: 'em' },
      { tag: 'i', getAttrs: (node: HTMLElement) => node.style.fontStyle !== 'normal' && null },
      { tag: 'span', consuming: false, getAttrs: (node: HTMLElement) => (node.style.fontStyle === 'italic' ? null : false) },
    ];
  },
});
