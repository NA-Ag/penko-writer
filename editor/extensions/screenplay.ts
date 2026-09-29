import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { ScreenplayElementType } from '../../types';
import { detectScreenplayElement, formatScreenplayText, getNextScreenplayElement, getPreviousScreenplayElement } from '../../utils/screenplayFormatter';

/**
 * Screenplay mode: each paragraph carries a `screenplayType` attribute that
 * drives Final Draft-style layout via CSS classes. Tab / Shift+Tab cycles the
 * element type, Enter picks the natural next element, and untyped paragraphs
 * are auto-detected as you write (until you set a type explicitly with Tab).
 */

export interface ScreenplayStorage {
  enabled: boolean;
}

const NEXT_ON_ENTER: Record<ScreenplayElementType, ScreenplayElementType> = {
  'scene-heading': 'action',
  action: 'action',
  character: 'dialogue',
  parenthetical: 'dialogue',
  dialogue: 'character',
  transition: 'scene-heading',
};

const key = new PluginKey('screenplay');

export const Screenplay = Extension.create<{}, ScreenplayStorage>({
  name: 'screenplay',
  // Must win over the default Enter/Tab handlers while screenplay mode is on
  priority: 1000,
  addStorage() {
    return { enabled: false };
  },
  addCommands() {
    return {
      setScreenplayType:
        (type: ScreenplayElementType) =>
        ({ state, tr, dispatch }: any) => {
          const { $from } = state.selection;
          const node = $from.parent;
          if (node.type.name !== 'paragraph') return false;
          if (dispatch) {
            const pos = $from.before();
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, screenplayType: type, screenplayAuto: false });
            const text = node.textContent;
            const formatted = text.trim() ? formatScreenplayText(text, type) : text;
            if (formatted !== text) {
              tr.insertText(formatted, pos + 1, pos + 1 + node.content.size);
            }
          }
          return true;
        },
    } as any;
  },
  addKeyboardShortcuts() {
    const cycle = (backwards: boolean) => {
      if (!(this.editor.storage as any).screenplay?.enabled) return false;
      const { $from } = this.editor.state.selection;
      if ($from.parent.type.name !== 'paragraph') return false;
      const current = ($from.parent.attrs.screenplayType as ScreenplayElementType) || detectScreenplayElement($from.parent.textContent);
      const next = backwards ? getPreviousScreenplayElement(current) : getNextScreenplayElement(current);
      return (this.editor.commands as any).setScreenplayType(next);
    };
    return {
      Tab: () => cycle(false),
      'Shift-Tab': () => cycle(true),
      Enter: () => {
        if (!(this.editor.storage as any).screenplay?.enabled) return false;
        const { state } = this.editor;
        const { $from, empty } = state.selection;
        if (!empty || $from.parent.type.name !== 'paragraph') return false;
        const current = ($from.parent.attrs.screenplayType as ScreenplayElementType) || 'action';
        // Empty dialogue line: turn it back into action instead of adding a line
        if (current === 'dialogue' && !$from.parent.textContent.trim()) {
          return (this.editor.commands as any).setScreenplayType('action');
        }
        const next = NEXT_ON_ENTER[current] || 'action';
        return this.editor.chain().splitBlock().updateAttributes('paragraph', { screenplayType: next, screenplayAuto: false }).run();
      },
    };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key,
        appendTransaction: (transactions, _old, newState) => {
          if (!(editor.storage as any).screenplay?.enabled || !transactions.some(t => t.docChanged)) return null;
          // Auto-detect the element type of the paragraph being typed in,
          // only when it has no explicit type (or its type was auto-detected).
          const { $from } = newState.selection;
          const para = $from.parent;
          if (para.type.name !== 'paragraph') return null;
          const text = para.textContent;
          if (para.attrs.screenplayType && !para.attrs.screenplayAuto) return null;
          if (text.trim().length < 2) return null;
          const detected = detectScreenplayElement(text);
          if (detected === para.attrs.screenplayType) return null;
          const tr = newState.tr.setNodeMarkup($from.before(), undefined, { ...para.attrs, screenplayType: detected, screenplayAuto: true });
          tr.setSelection(TextSelection.create(tr.doc, newState.selection.from, newState.selection.to));
          tr.setMeta('addToHistory', true);
          return tr;
        },
      }),
    ];
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    screenplay: {
      setScreenplayType: (type: ScreenplayElementType) => ReturnType;
    };
  }
}
