import type { Editor } from '@tiptap/core';
import type { Mark as PMMark } from '@tiptap/pm/model';
import { SelectionContext } from '../types';
import { prepareHtmlForEditor, safeUrl } from './sanitize';
import { parseStyle } from './extensions/styleUtils';

/**
 * Maps the app's command vocabulary (inherited from the execCommand days, and
 * still used by the Ribbon / mobile toolbar) onto Tiptap commands.
 */

const toPt = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const n = parseFloat(value);
  if (Number.isNaN(n)) return null;
  if (/px$/.test(value)) return Math.round(n * 0.75 * 10) / 10;
  if (/em$|rem$/.test(value)) return Math.round(n * 11);
  return n;
};

const currentFontSizePt = (editor: Editor): number => {
  const fromMark = toPt(editor.getAttributes('textStyle').fontSize);
  if (fromMark) return fromMark;
  const ctx = computeSelectionContext(editor);
  return parseFloat(ctx.fontSize || '11') || 11;
};

const transformCase = (editor: Editor, mode: string) => {
  const { state, view } = editor;
  const { from, to, empty } = state.selection;
  if (empty) return false;
  const tr = state.tr;
  const segments: { from: number; to: number; text: string; marks: readonly PMMark[] }[] = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return true;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.nodeSize);
    segments.push({ from: start, to: end, text: node.text!.slice(start - pos, end - pos), marks: node.marks });
    return false;
  });
  const convert = (s: string, prevChar: string) => {
    if (mode === 'uppercase') return s.toUpperCase();
    if (mode === 'lowercase') return s.toLowerCase();
    if (mode === 'sentence') return s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_m, a, b) => a + b.toUpperCase());
    // capitalize: Title Case (letter after a non-letter)
    let out = '';
    let prev = prevChar;
    for (const ch of s) {
      out += /\p{L}/u.test(ch) && !/\p{L}/u.test(prev) ? ch.toUpperCase() : ch;
      prev = ch;
    }
    return out;
  };
  // Reversed so earlier positions stay valid while replacing.
  for (const seg of segments.reverse()) {
    const before = seg.from > 1 ? state.doc.textBetween(seg.from - 1, seg.from, ' ', ' ') : ' ';
    const replaced = convert(seg.text, before || ' ');
    if (replaced !== seg.text) tr.replaceWith(seg.from, seg.to, state.schema.text(replaced, seg.marks));
  }
  view.dispatch(tr);
  return true;
};

export const runEditorCommand = (editor: Editor | null, command: string, value?: string | null): boolean => {
  if (!editor || editor.isDestroyed) return false;
  const chain = () => editor.chain().focus();
  const v = value ?? '';

  switch (command) {
    case 'bold':
      return chain().toggleBold().run();
    case 'italic':
      return chain().toggleItalic().run();
    case 'underline':
      return chain().toggleUnderline().run();
    case 'strikeThrough':
    case 'strikethrough':
      return chain().toggleStrike().run();
    case 'subscript':
      return chain().toggleSubscript().run();
    case 'superscript':
      return chain().toggleSuperscript().run();
    case 'code':
      return chain().toggleCode().run();
    case 'justifyLeft':
      return chain().setTextAlign('left').run();
    case 'justifyCenter':
      return chain().setTextAlign('center').run();
    case 'justifyRight':
      return chain().setTextAlign('right').run();
    case 'justifyFull':
      return chain().setTextAlign('justify').run();
    case 'insertOrderedList':
      return chain().toggleOrderedList().run();
    case 'insertUnorderedList':
      return chain().toggleBulletList().run();
    case 'indent':
      return chain().indentBlock().run();
    case 'outdent':
      return chain().outdentBlock().run();
    case 'undo':
      return chain().undo().run();
    case 'redo':
      return chain().redo().run();
    case 'formatBlock': {
      const tag = v.toLowerCase().replace(/[<>]/g, '');
      // a named style (Title, custom…) doesn't survive a switch to Normal / Heading N
      if (tag === 'div' || tag === 'p' || tag === '') return chain().setNode('paragraph', { styleId: null }).run();
      const m = tag.match(/^h([1-6])$/);
      if (m) return chain().setNode('heading', { level: Number(m[1]), styleId: null }).run();
      if (tag === 'blockquote') return chain().toggleBlockquote().run();
      if (tag === 'pre') return chain().toggleCodeBlock().run();
      return false;
    }
    case 'removeFormat':
      return chain().unsetAllMarks().unsetTextAlign().setBlockStyle('line-height', null).setBlockStyle('background-color', null).run();
    case 'foreColor':
      return v ? chain().setColor(v).run() : chain().unsetColor().run();
    case 'hiliteColor':
    case 'backColor':
      return !v || v === 'transparent' ? chain().unsetBackgroundColor().unsetHighlight().run() : chain().setBackgroundColor(v).run();
    case 'insertHorizontalRule':
      return chain().setHorizontalRule().run();
    case 'insertPageBreak':
      return chain().setPageBreak().run();
    case 'insertSectionBreak':
      return chain().insertSectionBreak().run();
    case 'createLink': {
      const href = safeUrl(v);
      if (!href) return false;
      return chain().extendMarkRange('link').setLink({ href }).run();
    }
    case 'unlink':
      return chain().extendMarkRange('link').unsetLink().run();
    case 'insertHTML':
      return chain().insertContent(prepareHtmlForEditor(v)).run();
    case 'insertText':
    case 'insertSymbol':
      return chain().insertContent({ type: 'text', text: v }).run();
    case 'insertImage':
      return v ? chain().setImage({ src: v }).run() : false;
    case 'fontName':
      return v ? chain().setFontFamily(v).run() : chain().unsetFontFamily().run();
    case 'fontSize': {
      let size: number;
      if (v === 'grow' || v === 'shrink') {
        const cur = currentFontSizePt(editor);
        size = v === 'grow' ? cur + 1 : Math.max(6, cur - 1);
      } else {
        size = parseFloat(v) || 11;
      }
      return chain().setFontSize(`${size}pt`).run();
    }
    case 'textCase':
      return transformCase(editor, v);
    case 'paragraphBackground':
      return chain().setBlockStyle('background-color', !v || v === 'transparent' ? null : v).run();
    case 'lineHeight':
      return chain().setBlockStyle('line-height', v || null).run();
    case 'selectAll':
      return chain().selectAll().run();
    default:
      console.warn('[Penko] Unknown editor command', command);
      return false;
  }
};

const rgbToHex = (rgb: string): string => {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return rgb;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return '';
  return '#' + [m[1], m[2], m[3]].map(x => Number(x).toString(16).padStart(2, '0')).join('');
};

/** Toolbar state derived from the editor selection (replaces queryCommandState). */
export const computeSelectionContext = (editor: Editor | null): SelectionContext => {
  if (!editor || editor.isDestroyed) return { type: 'none' };
  const { state, view } = editor;
  const { selection } = state;

  if ((selection as any).node?.type?.name === 'image') {
    const node = (selection as any).node;
    return { type: 'image', data: { src: node.attrs.src, pos: selection.from } };
  }
  const inTable = editor.isActive('table');

  let fontName = 'Arial';
  let fontSize = '11';
  let paragraphBackground = '';
  try {
    const { node } = view.domAtPos(selection.from);
    const el = (node.nodeType === 3 ? node.parentElement : node) as HTMLElement | null;
    if (el && view.dom.contains(el)) {
      const cs = window.getComputedStyle(el);
      if (cs.fontFamily) fontName = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      const pt = toPt(cs.fontSize);
      if (pt) fontSize = String(Math.round(pt));
    }
  } catch {
    /* view not ready */
  }
  const ts = editor.getAttributes('textStyle');
  if (ts.fontFamily) fontName = String(ts.fontFamily).split(',')[0].replace(/['"]/g, '').trim();
  const markPt = toPt(ts.fontSize);
  if (markPt) fontSize = String(Math.round(markPt * 10) / 10);

  const $from = selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    const bg = parseStyle($from.node(d).attrs.style)['background-color'];
    if (bg) {
      paragraphBackground = bg;
      break;
    }
  }

  let formatBlock = 'div';
  const parent = $from.parent;
  if (parent.type.name === 'heading') formatBlock = `h${parent.attrs.level}`;
  else if (parent.type.name === 'codeBlock') formatBlock = 'pre';
  else if (editor.isActive('blockquote')) formatBlock = 'blockquote';

  const align = (parent.attrs.textAlign as any) || 'left';

  return {
    type: inTable ? 'table' : 'text',
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    underline: editor.isActive('underline'),
    strikeThrough: editor.isActive('strike'),
    subscript: editor.isActive('subscript'),
    superscript: editor.isActive('superscript'),
    fontName,
    fontSize,
    foreColor: ts.color ? rgbToHex(String(ts.color)) : '',
    hiliteColor: ts.backgroundColor ? rgbToHex(String(ts.backgroundColor)) : editor.getAttributes('highlight').color || '',
    paragraphBackground,
    align,
    formatBlock,
  };
};

/** Paint-format support: capture marks + block formatting at the cursor. */
export interface CopiedFormat {
  marks: { type: string; attrs: Record<string, any> }[];
  textAlign: string | null;
  blockStyle: string | null;
}

export const captureFormatting = (editor: Editor): CopiedFormat => {
  const { $from } = editor.state.selection;
  const marks = (editor.state.storedMarks || $from.marks()).filter(m => !['link', 'comment', 'insertion', 'deletion'].includes(m.type.name));
  return {
    marks: marks.map(m => ({ type: m.type.name, attrs: { ...m.attrs } })),
    textAlign: $from.parent.attrs.textAlign || null,
    blockStyle: $from.parent.attrs.style || null,
  };
};

export const applyFormatting = (editor: Editor, fmt: CopiedFormat) => {
  const { from, to } = editor.state.selection;
  const { schema } = editor.state;
  const tr = editor.state.tr;
  ['bold', 'italic', 'underline', 'strike', 'subscript', 'superscript', 'textStyle', 'highlight', 'code'].forEach(name => {
    const t = schema.marks[name];
    if (t) tr.removeMark(from, to, t);
  });
  fmt.marks.forEach(m => {
    const t = schema.marks[m.type];
    if (t) tr.addMark(from, to, t.create(m.attrs));
  });
  editor.state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === 'paragraph' || node.type.name === 'heading') {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, textAlign: fmt.textAlign, style: fmt.blockStyle });
      return false;
    }
    return true;
  });
  editor.view.dispatch(tr);
};
