import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { createExtensions } from '../../editor/extensions';
import { collectTrackedChanges } from '../../editor/extensions/review';

let editor: Editor | null = null;
const make = (html: string, tracking = true) => {
  editor = new Editor({ extensions: createExtensions({ paginate: false }), content: html });
  if (tracking) editor.commands.setTrackChanges(true, 'Ann');
  return editor;
};
afterEach(() => {
  editor?.destroy();
  editor = null;
});

/** Position just after the n-th character of the first paragraph. */
const at = (n: number) => 1 + n;
const setCaret = (ed: Editor, pos: number) => ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, pos)));
const type = (ed: Editor, text: string) => {
  for (const ch of text) {
    const { from, to } = ed.state.selection;
    ed.view.dispatch(ed.state.tr.insertText(ch, from, to));
  }
};
const backspace = (ed: Editor) => {
  const { from } = ed.state.selection;
  ed.view.dispatch(ed.state.tr.delete(from - 1, from));
};
const forwardDelete = (ed: Editor) => {
  const { from } = ed.state.selection;
  ed.view.dispatch(ed.state.tr.delete(from, from + 1));
};

describe('track changes plugin', () => {
  it('does nothing while tracking is off', () => {
    const ed = make('<p>hello</p>', false);
    setCaret(ed, at(5));
    type(ed, '!');
    expect(collectTrackedChanges(ed.state.doc)).toHaveLength(0);
    expect(ed.getText()).toBe('hello!');
  });

  it('marks typed text as one insertion by the author', () => {
    const ed = make('<p>hello</p>');
    setCaret(ed, at(5));
    type(ed, ' world');
    const changes = collectTrackedChanges(ed.state.doc);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ type: 'insert', author: 'Ann', content: ' world' });
    expect(ed.getHTML()).toContain('<ins');
  });

  it('backspace keeps the text struck out and moves the caret before it', () => {
    const ed = make('<p>hello</p>');
    setCaret(ed, at(5));
    backspace(ed);
    backspace(ed);
    expect(ed.getText()).toBe('hello');
    const changes = collectTrackedChanges(ed.state.doc);
    expect(changes.every(c => c.type === 'delete')).toBe(true);
    expect(changes.map(c => c.content)).toEqual(['lo']); // one change, not one per keypress
    expect(ed.state.selection.from).toBe(at(3));
  });

  it('forward delete keeps the text struck out and moves the caret after it', () => {
    const ed = make('<p>hello</p>');
    setCaret(ed, at(0));
    forwardDelete(ed);
    forwardDelete(ed);
    expect(ed.getText()).toBe('hello');
    expect(collectTrackedChanges(ed.state.doc).map(c => c.content)).toEqual(['he']);
    expect(ed.state.selection.from).toBe(at(2));
  });

  it('deleting a selection marks it deleted; typing over it inserts', () => {
    const ed = make('<p>the quick fox</p>');
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, at(4), at(9))));
    type(ed, 'slow');
    const changes = collectTrackedChanges(ed.state.doc);
    expect(changes.find(c => c.type === 'delete')?.content).toBe('quick');
    expect(changes.find(c => c.type === 'insert')?.content).toBe('slow');
  });

  it('deleting your own tracked insertion really removes it', () => {
    const ed = make('<p>ab</p>');
    setCaret(ed, at(2));
    type(ed, 'xyz');
    backspace(ed);
    expect(ed.getText()).toBe('abxy');
    expect(collectTrackedChanges(ed.state.doc)).toHaveLength(1);
  });

  it('accept all / reject all produce the right text', () => {
    const build = () => {
      const ed = make('<p>one two three</p>');
      setCaret(ed, at(13));
      type(ed, ' four');
      // delete "two "
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, at(4), at(8))));
      ed.view.dispatch(ed.state.tr.deleteSelection());
      return ed;
    };
    let ed = build();
    expect(ed.getText()).toBe('one two three four');
    ed.commands.acceptAllChanges();
    expect(ed.getText()).toBe('one three four');
    expect(collectTrackedChanges(ed.state.doc)).toHaveLength(0);
    ed.destroy();

    ed = build();
    ed.commands.rejectAllChanges();
    expect(ed.getText()).toBe('one two three');
    expect(collectTrackedChanges(ed.state.doc)).toHaveLength(0);
  });

  it('accept / reject a single change', () => {
    const ed = make('<p>abc</p>');
    setCaret(ed, at(3));
    type(ed, 'X');
    setCaret(ed, at(1));
    backspace(ed);
    const changes = collectTrackedChanges(ed.state.doc);
    const ins = changes.find(c => c.type === 'insert')!;
    const del = changes.find(c => c.type === 'delete')!;
    ed.commands.rejectChange(ins.id);
    expect(ed.getText()).toBe('abc');
    ed.commands.acceptChange(del.id);
    expect(ed.getText()).toBe('bc');
    expect(collectTrackedChanges(ed.state.doc)).toHaveLength(0);
  });

  it('undo removes a tracked insertion in one step', () => {
    const ed = make('<p>abc</p>');
    setCaret(ed, at(3));
    ed.view.dispatch(ed.state.tr.insertText('XYZ', at(3)));
    expect(ed.getText()).toBe('abcXYZ');
    ed.commands.undo();
    expect(ed.getText()).toBe('abc');
    expect(collectTrackedChanges(ed.state.doc)).toHaveLength(0);
  });

  it('undo of a tracked deletion restores unmarked text', () => {
    const ed = make('<p>abc</p>');
    setCaret(ed, at(3));
    backspace(ed);
    expect(collectTrackedChanges(ed.state.doc)).toHaveLength(1);
    ed.commands.undo();
    expect(ed.getText()).toBe('abc');
    expect(collectTrackedChanges(ed.state.doc)).toHaveLength(0);
  });

  it('deletion across paragraphs keeps both paragraphs', () => {
    const ed = make('<p>first</p><p>second</p>');
    // select "st" + paragraph boundary + "sec"
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, at(3), 8 + 3)));
    ed.view.dispatch(ed.state.tr.deleteSelection());
    expect(ed.getText({ blockSeparator: '\n' })).toBe('first\nsecond');
    ed.commands.acceptAllChanges();
    expect(ed.getText({ blockSeparator: '\n' })).toBe('firond');
  });
});
