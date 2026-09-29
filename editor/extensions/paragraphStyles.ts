import { Extension, type Editor } from '@tiptap/core';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { Node as PMNode, NodeType } from '@tiptap/pm/model';
import type { ParagraphStyle } from '../../types';
import { STYLE_ID_RE, styleIdOf, type StyleProps } from '../../utils/paragraphStyles';
import { parseStyle, stringifyStyle } from './styleUtils';

/**
 * Named paragraph styles in the editor (see utils/paragraphStyles.ts):
 * a `styleId` attribute on paragraphs / headings (`data-style`), applying a
 * style, capturing a paragraph's direct formatting ("update style to match
 * selection") and "clear formatting" that keeps the style.
 */

const TEXTBLOCKS = ['paragraph', 'heading'];
/** Marks that are content, not formatting. */
const KEEP_MARKS = new Set(['link', 'comment', 'insertion', 'deletion']);

export const ParagraphStyles = Extension.create({
  name: 'paragraphStyles',
  // Before Paragraph's / Heading's own Mod-Alt-N (which keep the named style) and the list / core Enter handlers
  priority: 1001,
  addGlobalAttributes() {
    return [
      {
        types: TEXTBLOCKS,
        attributes: {
          styleId: {
            default: null,
            parseHTML: (el: HTMLElement) => {
              const v = el.getAttribute('data-style');
              return v && STYLE_ID_RE.test(v) ? v : null;
            },
            renderHTML: (attrs: Record<string, any>) => (attrs.styleId ? { 'data-style': attrs.styleId } : {}),
          },
        },
      },
    ];
  },
  addKeyboardShortcuts() {
    const apply = (style: Pick<ParagraphStyle, 'id' | 'kind' | 'level'>) => () => {
      if ((this.editor.storage as any).screenplay?.enabled) return false;
      return applyParagraphStyle(this.editor, style);
    };
    const shortcuts: Record<string, () => boolean> = {
      'Mod-Alt-0': apply({ id: 'normal', kind: 'paragraph' }),
      // A styled paragraph ends with Enter: the next one is Normal (Word's "style for following paragraph").
      Enter: () => {
        const { state } = this.editor;
        const { selection } = state;
        const { $from } = selection;
        const node = $from.parent;
        if ((this.editor.storage as any).screenplay?.enabled) return false;
        if (!selection.empty || !node.attrs.styleId || !TEXTBLOCKS.includes(node.type.name)) return false;
        if ($from.parentOffset !== node.content.size || $from.node($from.depth - 1)?.type.name === 'listItem') return false;
        return this.editor
          .chain()
          .splitBlock()
          .command(({ tr }) => {
            const $pos = tr.selection.$from;
            const created = $pos.parent;
            const paragraph = tr.doc.type.schema.nodes.paragraph;
            tr.setNodeMarkup($pos.before(), paragraph, attrsFor(paragraph, { ...created.attrs, styleId: null }));
            return true;
          })
          .run();
      },
    };
    [1, 2, 3, 4, 5, 6].forEach(level => {
      shortcuts[`Mod-Alt-${level}`] = apply({ id: `heading${level}`, kind: 'heading', level });
    });
    return shortcuts;
  },
});

/** Only the attributes `type` knows (headings have `level` / `id`, paragraphs don't). */
const attrsFor = (type: NodeType, attrs: Record<string, any>) => {
  const out: Record<string, any> = {};
  Object.keys(type.spec.attrs || {}).forEach(k => {
    if (k in attrs) out[k] = attrs[k];
  });
  return out;
};

/** Textblocks (paragraphs / headings) touched by the selection, or the one holding the cursor. */
const eachTextblock = (state: EditorState, fn: (node: PMNode, pos: number) => void) => {
  const { from, to } = state.selection;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (TEXTBLOCKS.includes(node.type.name)) {
      fn(node, pos);
      return false;
    }
    return true;
  });
};

/** The style of the block at the cursor ('normal', 'heading2', 'quote', a custom id…). */
export const currentStyleId = (state: EditorState): string => {
  const { $from } = state.selection;
  let inQuote = false;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'blockquote') inQuote = true;
  const parent = $from.parent;
  return styleIdOf({ type: parent.type.name, level: parent.attrs.level, styleId: parent.attrs.styleId, inQuote });
};

/** Applies a named style to the selected paragraphs (converting headings, quotes and code blocks as needed). */
export const applyParagraphStyle = (editor: Editor, style: Pick<ParagraphStyle, 'id' | 'kind' | 'level'>): boolean => {
  if (!editor || editor.isDestroyed) return false;
  let chain = editor.chain().focus();
  if (style.kind === 'code') return editor.isActive('codeBlock') ? true : chain.setCodeBlock().run();
  if (editor.isActive('codeBlock')) chain = chain.setParagraph();
  if (style.kind !== 'quote' && editor.isActive('blockquote')) chain = chain.lift('blockquote');
  const isHeading = style.kind === 'heading';
  const styleId = style.kind === 'quote' || style.id === 'normal' || /^heading[1-6]$/.test(style.id) ? null : style.id;
  chain = chain.command(({ tr, state }) => {
    const type = state.schema.nodes[isHeading ? 'heading' : 'paragraph'];
    eachTextblock(state, (node, pos) => {
      const attrs = { ...node.attrs, styleId, ...(isHeading ? { level: style.level || 1 } : {}) };
      if (node.type === type && Object.keys(attrs).every(k => node.attrs[k] === attrs[k])) return;
      tr.setNodeMarkup(pos, type, attrsFor(type, attrs));
    });
    return true;
  });
  if (style.kind === 'quote' && !editor.isActive('blockquote')) chain = chain.wrapIn('blockquote');
  return chain.run();
};

/* ------------------------------------------------------------------ */
/* Direct formatting                                                   */
/* ------------------------------------------------------------------ */

const toPt = (value: string | undefined | null): number | null => {
  if (!value) return null;
  const m = /^(-?\d*\.?\d+)\s*(px|pt|em|rem)?$/i.exec(value.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = (m[2] || 'px').toLowerCase();
  const pt = unit === 'pt' ? n : unit === 'px' ? n * 0.75 : n * 11;
  return Math.round(pt * 100) / 100;
};

/** rgb() -> #rrggbb so the colour picker can show it. */
const hexColor = (value: string) => {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(value.trim());
  if (!m || (m[4] !== undefined && parseFloat(m[4]) < 1)) return value;
  return '#' + [m[1], m[2], m[3]].map(n => Math.min(255, +n).toString(16).padStart(2, '0')).join('');
};

const firstFont = (family: string | undefined | null) => (family ? family.split(',')[0].trim().replace(/^['"]|['"]$/g, '') || null : null);

interface BlockFormat {
  props: Partial<StyleProps>;
  /** block CSS properties to remove once absorbed */
  css: string[];
  marks: string[];
  textStyle: ('fontFamily' | 'fontSize' | 'color')[];
}

/** Direct formatting of one block that applies to all of it (block CSS, alignment, marks on every character). */
const blockFormat = (node: PMNode): BlockFormat => {
  const props: Partial<StyleProps> = {};
  const css = parseStyle(node.attrs.style);
  const cssUsed: string[] = [];
  const take = (key: string, apply: (v: string) => boolean) => {
    if (css[key] && apply(css[key])) cssUsed.push(key);
  };
  take('font-family', v => !!(props.fontFamily = firstFont(v)));
  take('font-size', v => (props.fontSize = toPt(v)) !== null);
  take('font-weight', v => ((props.bold = /bold|[6-9]00/.test(v)), true));
  take('font-style', v => ((props.italic = /italic|oblique/.test(v)), true));
  take('text-decoration', v => ((props.underline = /underline/.test(v)), true));
  take('color', v => !!(props.color = hexColor(v)));
  take('line-height', v => /^\d*\.?\d+$/.test(v) && ((props.lineHeight = parseFloat(v)), true));
  take('margin-top', v => (props.spaceBefore = toPt(v)) !== null);
  take('margin-bottom', v => (props.spaceAfter = toPt(v)) !== null);
  take('margin-left', v => (props.indent = toPt(v)) !== null);
  if (node.attrs.textAlign) props.align = node.attrs.textAlign;

  const texts: PMNode[] = [];
  node.descendants(child => {
    if (child.isText && child.text) texts.push(child);
  });
  const marks: string[] = [];
  const textStyle: BlockFormat['textStyle'] = [];
  if (texts.length) {
    const everywhere = (name: string) => texts.every(t => t.marks.some(m => m.type.name === name));
    if (everywhere('bold')) (props.bold = true), marks.push('bold');
    if (everywhere('italic')) (props.italic = true), marks.push('italic');
    if (everywhere('underline')) (props.underline = true), marks.push('underline');
    const shared = (attr: 'fontFamily' | 'fontSize' | 'color') => {
      const values = texts.map(t => t.marks.find(m => m.type.name === 'textStyle')?.attrs[attr] ?? null);
      return values[0] && values.every(v => v === values[0]) ? String(values[0]) : null;
    };
    const family = shared('fontFamily');
    if (family) (props.fontFamily = firstFont(family)), textStyle.push('fontFamily');
    const size = toPt(shared('fontSize'));
    if (size) (props.fontSize = size), textStyle.push('fontSize');
    const color = shared('color');
    if (color) (props.color = hexColor(color)), textStyle.push('color');
  }
  return { props, css: cssUsed, marks, textStyle };
};

/** Formatting of the block at the cursor laid over `base` — for "update to match" / "new style". */
export const captureStyleFromSelection = (state: EditorState, base: ParagraphStyle): ParagraphStyle => {
  const { $from } = state.selection;
  const node = TEXTBLOCKS.includes($from.parent.type.name) ? $from.parent : null;
  return node ? { ...base, ...blockFormat(node).props } : { ...base };
};

const clearTextStyleAttrs = (tr: Transaction, from: number, to: number, attrs: string[]) => {
  const type = tr.doc.type.schema.marks.textStyle;
  if (!type || !attrs.length) return;
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find(m => m.type === type);
    if (!mark) return;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.nodeSize);
    const next = { ...mark.attrs };
    attrs.forEach(a => (next[a] = null));
    tr.removeMark(start, end, type);
    if (Object.values(next).some(v => v !== null && v !== undefined && v !== '')) tr.addMark(start, end, type.create(next));
  });
};

/**
 * Removes each selected paragraph's block-wide direct formatting (after it
 * was absorbed into its style), so the style alone decides the look.
 */
export const absorbDirectFormatting = (editor: Editor): boolean => {
  const { state } = editor;
  const tr = state.tr;
  eachTextblock(state, (node, pos) => {
    const f = blockFormat(node);
    const from = pos + 1;
    const to = pos + node.nodeSize - 1;
    f.marks.forEach(name => tr.removeMark(from, to, state.schema.marks[name]));
    clearTextStyleAttrs(tr, from, to, f.textStyle);
    const css = parseStyle(node.attrs.style);
    f.css.forEach(k => delete css[k]);
    const current = tr.doc.nodeAt(pos)!;
    tr.setNodeMarkup(pos, undefined, { ...current.attrs, style: stringifyStyle(css) || null, textAlign: null });
  });
  if (!tr.docChanged) return false;
  editor.view.dispatch(tr);
  return true;
};

/**
 * "Clear formatting": removes character formatting in the selection (the
 * whole paragraph when nothing is selected) and the paragraphs' own
 * formatting, keeping their named style, links, comments and tracked changes.
 */
export const clearDirectFormatting = (editor: Editor): boolean => {
  if (!editor || editor.isDestroyed) return false;
  const { state } = editor;
  const tr = state.tr;
  const { empty, from, to } = state.selection;
  eachTextblock(state, (node, pos) => {
    const start = empty ? pos + 1 : Math.max(from, pos + 1);
    const end = empty ? pos + node.nodeSize - 1 : Math.min(to, pos + node.nodeSize - 1);
    Object.values(state.schema.marks).forEach(type => {
      if (!KEEP_MARKS.has(type.name)) tr.removeMark(start, end, type);
    });
    const current = tr.doc.nodeAt(pos)!;
    tr.setNodeMarkup(pos, undefined, { ...current.attrs, style: null, textAlign: null });
  });
  if (empty) tr.setStoredMarks([]);
  editor.view.dispatch(tr.scrollIntoView());
  editor.commands.focus();
  return true;
};
