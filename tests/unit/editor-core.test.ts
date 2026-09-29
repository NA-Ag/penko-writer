import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { createExtensions } from '../../editor/extensions';
import { prepareHtmlForEditor } from '../../editor/sanitize';
import { runEditorCommand } from '../../editor/commands';
import { getSearchState } from '../../editor/extensions/search';

let editor: Editor | null = null;
const make = (html: string) => {
  editor = new Editor({ extensions: createExtensions({ paginate: false }), content: prepareHtmlForEditor(html) });
  return editor;
};
afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('search / replace', () => {
  it('finds matches across formatting boundaries and replaces the current one', () => {
    const ed = make('<p>cat <strong>ca</strong>t cat</p>');
    ed.commands.setSearch({ term: 'cat' });
    expect(getSearchState(ed.state).matches).toHaveLength(3);
    ed.commands.goToMatch(1);
    ed.commands.replaceMatch('dog');
    expect(ed.getText()).toBe('cat dog cat');
  });

  it('replace all is a single undo step and supports regex groups', () => {
    const ed = make('<p>2024-01-05 and 2025-12-31</p>');
    ed.commands.setSearch({ term: '(\\d{4})-(\\d{2})-(\\d{2})', regex: true });
    expect(getSearchState(ed.state).matches).toHaveLength(2);
    ed.commands.replaceAllMatches('$3/$2/$1');
    expect(ed.getText()).toBe('05/01/2024 and 31/12/2025');
    ed.commands.undo();
    expect(ed.getText()).toBe('2024-01-05 and 2025-12-31');
  });

  it('whole word and case sensitivity', () => {
    const ed = make('<p>Art art party ART</p>');
    ed.commands.setSearch({ term: 'art', wholeWord: true });
    expect(getSearchState(ed.state).matches).toHaveLength(3);
    ed.commands.setSearch({ term: 'art', wholeWord: true, caseSensitive: true });
    expect(getSearchState(ed.state).matches).toHaveLength(1);
  });

  it('reports invalid regex instead of throwing', () => {
    const ed = make('<p>x</p>');
    ed.commands.setSearch({ term: '(', regex: true });
    expect(getSearchState(ed.state).error).toBeTruthy();
  });
});

describe('ribbon commands', () => {
  it('text case keeps formatting', () => {
    const ed = make('<p>hello <em>big</em> world</p>');
    ed.commands.selectAll();
    runEditorCommand(ed, 'textCase', 'uppercase');
    expect(ed.getHTML()).toBe('<p>HELLO <em>BIG</em> WORLD</p>');
    runEditorCommand(ed, 'textCase', 'capitalize');
    expect(ed.getText()).toBe('HELLO BIG WORLD');
    runEditorCommand(ed, 'textCase', 'lowercase');
    runEditorCommand(ed, 'textCase', 'capitalize');
    expect(ed.getText()).toBe('Hello Big World');
  });

  it('font size grow/shrink works from the current size', () => {
    const ed = make('<p><span style="font-size: 12pt">abc</span></p>');
    ed.commands.selectAll();
    runEditorCommand(ed, 'fontSize', 'grow');
    expect(ed.getHTML()).toContain('font-size: 13pt');
    runEditorCommand(ed, 'fontSize', 'shrink');
    runEditorCommand(ed, 'fontSize', 'shrink');
    expect(ed.getHTML()).toContain('font-size: 11pt');
  });

  it('paragraph shading, line height and indent are block styles', () => {
    const ed = make('<p>a</p>');
    ed.commands.selectAll();
    runEditorCommand(ed, 'paragraphBackground', '#ffff00');
    runEditorCommand(ed, 'lineHeight', '2');
    runEditorCommand(ed, 'indent');
    runEditorCommand(ed, 'indent');
    const html = ed.getHTML();
    expect(html).toMatch(/background-color: (#ffff00|rgb\(255, 255, 0\))/);
    expect(html).toContain('line-height: 2');
    expect(html).toContain('margin-left: 80px');
    runEditorCommand(ed, 'outdent');
    expect(ed.getHTML()).toContain('margin-left: 40px');
  });

  it('createLink rejects javascript: urls', () => {
    const ed = make('<p>click</p>');
    ed.commands.selectAll();
    expect(runEditorCommand(ed, 'createLink', 'javascript:alert(1)')).toBe(false);
    runEditorCommand(ed, 'createLink', 'example.com');
    expect(ed.getHTML()).toContain('href="https://example.com"');
  });

  it('formatBlock maps to headings/paragraphs', () => {
    const ed = make('<p>Title</p>');
    ed.commands.setTextSelection(2);
    runEditorCommand(ed, 'formatBlock', 'h2');
    expect(ed.getHTML()).toMatch(/^<h2 id="h-[a-z0-9]+">Title<\/h2>/);
    runEditorCommand(ed, 'formatBlock', 'div');
    expect(ed.getHTML()).toMatch(/^<p>Title<\/p>/);
  });
});

describe('references', () => {
  it('numbers footnotes in document order and renumbers on insert', () => {
    const ed = make('<p>one two</p>');
    ed.commands.setTextSelection(8);
    ed.commands.insertContent({ type: 'footnote', attrs: { noteType: 'footnote', content: 'second' } });
    ed.commands.setTextSelection(4);
    ed.commands.insertContent({ type: 'footnote', attrs: { noteType: 'footnote', content: 'first' } });
    const notes: { n: number; c: string }[] = [];
    ed.state.doc.descendants(node => {
      if (node.type.name === 'footnote') notes.push({ n: node.attrs.number, c: node.attrs.content });
    });
    expect(notes).toEqual([
      { n: 1, c: 'first' },
      { n: 2, c: 'second' },
    ]);
  });

  it('citations render from citation data and stay escaped', () => {
    const ed = make('<p>x</p>');
    ed.commands.setReferenceData({ citations: [{ id: 'c1', type: 'book', author: '<b>Doe</b>', title: 'T', year: '2020' }] });
    ed.commands.insertContent({ type: 'citation', attrs: { citationId: 'c1', citationStyle: 'apa' } });
    const html = ed.getHTML();
    expect(html).toContain('(&lt;b&gt;Doe&lt;/b&gt;, 2020)');
    expect(html).not.toContain('<b>Doe</b>');
  });

  it('legacy footnote markup is recognised', () => {
    const ed = make('<p>a<sup class="footnote-ref" data-note-id="footnote-1">1</sup></p>');
    let found = false;
    ed.state.doc.descendants(node => {
      if (node.type.name === 'footnote') found = true;
    });
    expect(found).toBe(true);
  });

  it('equations serialise with their latex', () => {
    const ed = make('<p>x</p>');
    ed.commands.insertContent({ type: 'equation', attrs: { latex: 'E=mc^2' } });
    const html = ed.getHTML();
    expect(html).toContain('data-latex="E=mc^2"');
    expect(html).toContain('katex');
  });
});

describe('screenplay', () => {
  it('Tab cycles element types and Enter after character creates dialogue', () => {
    const ed = make('<p>SARAH</p>');
    (ed.storage as any).screenplay.enabled = true;
    ed.commands.setTextSelection(6);
    ed.commands.setScreenplayType('character');
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    ed.view.someProp('handleKeyDown', f => f(ed.view, event));
    const types: (string | null)[] = [];
    ed.state.doc.forEach(n => types.push(n.attrs.screenplayType));
    expect(types).toEqual(['character', 'dialogue']);
  });

  it('auto-detects scene headings without locking in early guesses', () => {
    const ed = make('<p></p>');
    (ed.storage as any).screenplay.enabled = true;
    ed.commands.setTextSelection(1);
    for (const ch of 'INT. HOUSE - DAY') ed.commands.insertContent(ch);
    expect(ed.state.doc.firstChild!.attrs.screenplayType).toBe('scene-heading');
  });
});

describe('legacy documents', () => {
  it('old execCommand html loads cleanly', () => {
    const ed = make('<div><font face="Georgia">Hello</font></div><div class="img-resize-wrapper"><img src="data:image/png;base64,AAAA" class="selected-img" style="width: 50%;"><div class="img-resize-handle img-resize-nw"></div></div>');
    const html = ed.getHTML();
    expect(html).toContain('font-family: Georgia');
    expect(html).toContain('width: 50%');
    expect(html).not.toContain('img-resize');
  });
});

describe('incremental plugin work', () => {
  it('heading ids and footnote numbers still update when relevant nodes change', () => {
    const ed = make('<p>intro</p>');
    ed.commands.setTextSelection(1);
    ed.commands.insertContent('<h2>New heading</h2>');
    let id: string | null = null;
    ed.state.doc.descendants(n => {
      if (n.type.name === 'heading') id = n.attrs.id;
    });
    expect(id).toMatch(/^h-/);
    ed.commands.setTextSelection(ed.state.doc.content.size - 1);
    ed.commands.insertContent({ type: 'footnote', attrs: { content: 'b' } });
    ed.commands.setTextSelection(2);
    ed.commands.insertContent({ type: 'footnote', attrs: { content: 'a' } });
    const nums: number[] = [];
    ed.state.doc.descendants(n => {
      if (n.type.name === 'footnote') nums.push(n.attrs.number);
    });
    expect(nums).toEqual([1, 2]);
    // deleting the first footnote renumbers the second
    let first = -1;
    ed.state.doc.descendants((n, pos) => {
      if (n.type.name === 'footnote' && first === -1) first = pos;
    });
    ed.commands.deleteRange({ from: first, to: first + 1 });
    const after: number[] = [];
    ed.state.doc.descendants(n => {
      if (n.type.name === 'footnote') after.push(n.attrs.number);
    });
    expect(after).toEqual([1]);
  });
});

describe('track changes: paragraph breaks', () => {
  const paragraphs = (ed: Editor) => {
    const out: string[] = [];
    ed.state.doc.forEach(n => out.push(n.textContent));
    return out;
  };

  it('records Enter as an inserted break; reject joins the paragraphs again', () => {
    const ed = make('<p>Hello world</p>');
    ed.commands.setTrackChanges(true, 'Ann');
    ed.commands.setTextSelection(7);
    ed.commands.splitBlock();
    expect(paragraphs(ed)).toEqual(['Hello ', 'world']);
    expect(ed.getHTML()).toContain('track-break-insert');
    ed.commands.rejectAllChanges();
    expect(paragraphs(ed)).toEqual(['Hello world']);
  });

  it('records joining paragraphs as a deleted break; accept joins, reject keeps both', () => {
    const ed = make('<p>One</p><p>Two</p>');
    ed.commands.setTrackChanges(true, 'Ann');
    ed.commands.setTextSelection(6); // start of "Two"
    ed.commands.joinBackward();
    expect(paragraphs(ed)).toEqual(['One', 'Two']);
    expect(ed.getHTML()).toContain('track-break-delete');
    ed.commands.rejectAllChanges();
    expect(paragraphs(ed)).toEqual(['One', 'Two']);
    expect(ed.getHTML()).not.toContain('track-break');

    ed.commands.setTextSelection(6);
    ed.commands.joinBackward();
    ed.commands.acceptAllChanges();
    expect(paragraphs(ed)).toEqual(['OneTwo']);
  });

  it('undoing your own tracked Enter with Backspace simply joins', () => {
    const ed = make('<p>Hello world</p>');
    ed.commands.setTrackChanges(true, 'Ann');
    ed.commands.setTextSelection(7);
    ed.commands.splitBlock();
    ed.commands.joinBackward();
    expect(paragraphs(ed)).toEqual(['Hello world']);
    expect(ed.getHTML()).not.toContain('track-break');
  });

  it('lists paragraph breaks as tracked changes', async () => {
    const { collectTrackedChanges } = await import('../../editor/extensions/review');
    const ed = make('<p>Hello world</p>');
    ed.commands.setTrackChanges(true, 'Ann');
    ed.commands.setTextSelection(7);
    ed.commands.splitBlock();
    expect(collectTrackedChanges(ed.state.doc).map(c => [c.type, c.content])).toContainEqual(['insert', '¶']);
  });
});

describe('whitespace', () => {
  it('keeps leading and double spaces across a save/reload of editor HTML', async () => {
    const { parseOptionsFor } = await import('../../editor/sanitize');
    const ed = make('<p>x</p>');
    ed.commands.setContent('<p></p>');
    ed.commands.insertContent({ type: 'text', text: '  indented  twice' });
    const saved = ed.getHTML();
    const reloaded = new Editor({ extensions: createExtensions({ paginate: false }), content: saved, parseOptions: parseOptionsFor(saved) });
    expect(reloaded.getText()).toBe('  indented  twice');
    reloaded.destroy();
  });
  it('still collapses formatting whitespace in hand-written HTML', async () => {
    const { parseOptionsFor } = await import('../../editor/sanitize');
    const html = '<p>\n  Hello\n  world\n</p>';
    const ed2 = new Editor({ extensions: createExtensions({ paginate: false }), content: html, parseOptions: parseOptionsFor(html) });
    expect(ed2.getText()).toBe('Hello world');
    ed2.destroy();
  });
});
