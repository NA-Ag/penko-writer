import { describe, it, expect } from 'vitest';
import { splitBlocks, diffBlocks, mergeBlocks } from '../../utils/blockDiff';
import {
  positionPatch, getPositionMode, rotatePatch, getRotation, effectPatch, getEffect, borderPatch, shadowPatch,
  shouldCompressImage, fitWithin, hasTransparency, estimateDataUrlBytes, getDataUrlMime, getImageInfo,
} from '../../utils/imageUtils';
import { parseStyle, stringifyStyle } from '../../editor/extensions/styleUtils';
import { computeTextStats, countWords, countSentences } from '../../utils/textStats';

const applyPatch = (style: string | null, patch: Record<string, string | null>) => {
  const map = parseStyle(style);
  Object.entries(patch).forEach(([k, v]) => (v === null ? delete map[k] : (map[k] = v)));
  return stringifyStyle(map) || null;
};

describe('block diff / merge (version history)', () => {
  const OLD = '<h1>Title</h1><p>Alpha <strong>bold</strong></p><p>Beta</p><ul><li><p>one</p></li></ul><p>Gamma</p>';
  const NEW = '<h1>Title</h1><p>Alpha <strong>bold</strong> more</p><p>Inserted</p><ul><li><p>one</p></li></ul><p>Gamma</p>';

  it('splits top-level blocks and keeps their HTML', () => {
    const blocks = splitBlocks(OLD);
    expect(blocks.map(b => b.text)).toEqual(['Title', 'Alpha bold', 'Beta', 'one', 'Gamma']);
    expect(blocks[1].html).toBe('<p>Alpha <strong>bold</strong></p>');
    expect(splitBlocks('loose <em>text</em><p>x</p>').map(b => b.html)).toEqual(['<p>loose <em>text</em></p>', '<p>x</p>']);
  });

  it('diffs changed / added / removed blocks with LCS', () => {
    const ops = diffBlocks(splitBlocks(OLD), splitBlocks(NEW));
    expect(ops.map(o => o.type)).toEqual(['equal', 'changed', 'changed', 'equal', 'equal']);
    const ops2 = diffBlocks(splitBlocks('<p>a</p><p>b</p><p>c</p>'), splitBlocks('<p>a</p><p>c</p><p>d</p>'));
    expect(ops2.map(o => o.type)).toEqual(['equal', 'removed', 'equal', 'added']);
  });

  it('merge defaults to the current version and preserves formatting', () => {
    const ops = diffBlocks(splitBlocks(OLD), splitBlocks(NEW));
    expect(mergeBlocks(ops, {})).toBe(NEW);
    // Reject the first change: take the snapshot's paragraph back (formatting intact)
    expect(mergeBlocks(ops, { 1: 'reject' })).toBe(
      '<h1>Title</h1><p>Alpha <strong>bold</strong></p><p>Inserted</p><ul><li><p>one</p></li></ul><p>Gamma</p>',
    );
    // Reject everything: back to the snapshot
    expect(mergeBlocks(ops, { 1: 'reject', 2: 'reject' })).toBe(OLD);
  });

  it('moved blocks are never lost', () => {
    const a = '<p>one</p><p>two</p><p>three</p>';
    const b = '<p>three</p><p>one</p><p>two</p>';
    const ops = diffBlocks(splitBlocks(a), splitBlocks(b));
    expect(mergeBlocks(ops, {})).toBe(b);
    const rejectAll = Object.fromEntries(ops.map((_, i) => [i, 'reject' as const]));
    expect(mergeBlocks(ops, rejectAll)).toBe(a);
  });
});

describe('image style patches', () => {
  it('position modes round-trip', () => {
    for (const mode of ['inline', 'float-left', 'float-right', 'centered'] as const) {
      const style = applyPatch('width: 50%; float: right', positionPatch(mode));
      expect(getPositionMode(style)).toBe(mode);
      expect(parseStyle(style).width).toBe('50%');
    }
  });

  it('rotation accumulates and wraps', () => {
    let style: string | null = 'filter: sepia(100%)';
    style = applyPatch(style, rotatePatch(style, 90));
    expect(getRotation(style)).toBe(90);
    style = applyPatch(style, rotatePatch(style, 270));
    expect(getRotation(style)).toBe(0);
    expect(parseStyle(style).transform).toBeUndefined();
    expect(parseStyle(style).filter).toBe('sepia(100%)');
  });

  it('effects, borders and shadows', () => {
    expect(getEffect(applyPatch(null, effectPatch('brightness', 150)))).toEqual({ effect: 'brightness', value: 150 });
    expect(getEffect(applyPatch('filter: grayscale(100%)', effectPatch('none')))).toEqual({ effect: 'none', value: 100 });
    expect(borderPatch('thin')).toEqual({ border: '1px solid #cccccc', 'border-radius': '0', padding: '2px' });
    expect(borderPatch('rounded')['border-radius']).toBe('12px');
    expect(applyPatch('border: 1px solid #ccc; width: 10%', borderPatch('none'))).toBe('width: 10%');
    expect(shadowPatch('none')).toEqual({ 'box-shadow': null });
  });

  it('image info from node attrs', () => {
    const info = getImageInfo({ src: 'data:image/png;base64,AAAA', alt: 'Cat', width: 200, style: 'float: left; transform: rotate(90deg)' });
    expect(info).toMatchObject({ alt: 'Cat', width: 200, positionMode: 'float-left', rotation: 90, effect: 'none' });
  });
});

describe('upload optimisation', () => {
  const big = (mime: string) => `data:${mime};base64,${'A'.repeat(2 * 1024 * 1024)}`;
  it('never recompresses GIF / SVG, only large rasters', () => {
    expect(shouldCompressImage(big('image/gif'))).toBe(false);
    expect(shouldCompressImage(big('image/svg+xml'))).toBe(false);
    expect(shouldCompressImage(big('image/jpeg'))).toBe(true);
    expect(shouldCompressImage(big('image/png'))).toBe(true);
    expect(shouldCompressImage('data:image/jpeg;base64,AAAA')).toBe(false);
    expect(shouldCompressImage('https://example.com/a.jpg')).toBe(false);
  });
  it('helpers', () => {
    expect(getDataUrlMime('data:image/PNG;base64,xx')).toBe('image/png');
    expect(estimateDataUrlBytes('data:image/png;base64,AAAA')).toBe(3);
    expect(fitWithin(4000, 2000, 1920, 1920)).toEqual({ width: 1920, height: 960 });
    expect(fitWithin(100, 50, 1920, 1920)).toEqual({ width: 100, height: 50 });
    expect(hasTransparency([0, 0, 0, 255, 1, 1, 1, 255])).toBe(false);
    expect(hasTransparency([0, 0, 0, 255, 1, 1, 1, 0])).toBe(true);
  });
});

describe('document statistics', () => {
  it('counts words, characters, paragraphs and sentences', () => {
    const text = 'Hello world. How are you?\n\nFine thanks\nOK!';
    const s = computeTextStats(text);
    expect(s.words).toBe(8);
    expect(s.characters).toBe(text.replace(/\n/g, '').length);
    expect(s.charactersNoSpaces).toBe(text.replace(/\s/g, '').length);
    expect(s.paragraphs).toBe(3);
    expect(s.sentences).toBe(4);
    expect(s.readingMinutes).toBe(1);
  });
  it('empty document', () => {
    expect(computeTextStats('')).toMatchObject({ words: 0, characters: 0, paragraphs: 0, sentences: 0, readingMinutes: 0 });
  });
  it('uses the editor word count when given, CJK counts characters', () => {
    expect(computeTextStats('a b', 7).words).toBe(7);
    expect(countWords('你好世界 hello')).toBe(5);
    expect(countSentences('Dr Smith arrived. "Really?" she said.')).toBe(3);
    expect(computeTextStats('word '.repeat(401)).readingMinutes).toBe(3);
  });
});

describe('document outline sections', async () => {
  const { Editor } = await import('@tiptap/core');
  const { createExtensions } = await import('../../editor/extensions');
  const { collectHeadings, moveSection } = await import('../../utils/outline');
  const make = (html: string) => new Editor({ extensions: createExtensions({ paginate: false }), content: html });
  const html = (ed: InstanceType<typeof Editor>) => ed.getHTML().replace(/ id="[^"]*"/g, '');

  it('collects headings with levels', () => {
    const ed = make('<h1>A</h1><p>a</p><h2>A1</h2><p>x</p><h1>B</h1>');
    expect(collectHeadings(ed.state.doc).map(h => `${h.level}${h.text}`)).toEqual(['1A', '2A1', '1B']);
    ed.destroy();
  });

  it('moves a section (heading + content up to the next same-level heading) in one undoable step', () => {
    const ed = make('<h1>A</h1><p>a</p><h2>A1</h2><p>x</p><h1>B</h1><p>b</p>');
    const [a, , b] = collectHeadings(ed.state.doc);
    const tr = ed.state.tr;
    expect(moveSection(tr, b.pos, a.pos, 'before')).toBe(true);
    ed.view.dispatch(tr);
    expect(html(ed)).toBe('<h1>B</h1><p>b</p><h1>A</h1><p>a</p><h2>A1</h2><p>x</p>');
    ed.commands.undo();
    expect(html(ed)).toBe('<h1>A</h1><p>a</p><h2>A1</h2><p>x</p><h1>B</h1><p>b</p>');
    // after: A's section goes behind B's section
    const hs = collectHeadings(ed.state.doc);
    const tr2 = ed.state.tr;
    expect(moveSection(tr2, hs[0].pos, hs[2].pos, 'after')).toBe(true);
    ed.view.dispatch(tr2);
    expect(html(ed)).toBe('<h1>B</h1><p>b</p><h1>A</h1><p>a</p><h2>A1</h2><p>x</p>');
    ed.destroy();
  });

  it('refuses to move a section into itself', () => {
    const ed = make('<h1>A</h1><p>a</p><h2>A1</h2><p>x</p>');
    const [a, a1] = collectHeadings(ed.state.doc);
    expect(moveSection(ed.state.tr, a.pos, a1.pos, 'before')).toBe(false);
    ed.destroy();
  });
});
