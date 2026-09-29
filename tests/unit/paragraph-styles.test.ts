import { describe, it, expect, afterEach } from 'vitest';
import JSZip from 'jszip';
import { Editor } from '@tiptap/core';
import type { DocumentData, ParagraphStyle } from '../../types';
import { createExtensions } from '../../editor/extensions';
import { prepareHtmlForEditor } from '../../editor/sanitize';
import { runEditorCommand } from '../../editor/commands';
import {
  BUILTIN_STYLES, builtInStyle, effectiveProps, generateStyleCss, isDefaultStyle, newStyleId, normalizeStyle, removeStyle, resolveStyles, upsertStyle, wordStyleIds,
} from '../../utils/paragraphStyles';
import { absorbDirectFormatting, applyParagraphStyle, captureStyleFromSelection, clearDirectFormatting, currentStyleId } from '../../editor/extensions/paragraphStyles';
import { buildExportModel, type ParaBlock } from '../../utils/exportModel';
import { buildDocxBlob } from '../../utils/docxExport';
import { buildPdf } from '../../utils/pdfExport';
import { buildStandaloneHtml } from '../../utils/export';
import { importDocument } from '../../utils/import';
import { htmlToMarkdown } from '../../utils/markdownConverter';
import { parseOdtContent } from '../../utils/odtParser';

const style = (id: string, patch: Partial<ParagraphStyle> = {}): ParagraphStyle => ({ ...(builtInStyle(id) || { ...builtInStyle('normal')!, id, name: id }), ...patch });
const FANCY: ParagraphStyle = { ...builtInStyle('normal')!, id: 'u-fancy', name: 'Fancy', kind: 'paragraph', fontFamily: 'Georgia', fontSize: 14, color: '#ff0000', spaceAfter: 6 };

const makeDoc = (content: string, extra: Partial<DocumentData> = {}): DocumentData => ({ id: 'd1', title: 'Styles', content, createdAt: 0, lastModified: 0, ...extra });

let editor: Editor | null = null;
/** Real keydown through the editor's handlers (the keyboardShortcut command only keeps one transaction). */
const press = (ed: Editor, key: string, mods: KeyboardEventInit = {}) =>
  ed.view.someProp('handleKeyDown', f => f(ed.view, new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods })));
const make = (html: string) => {
  editor = new Editor({ extensions: createExtensions({ paginate: false }), content: prepareHtmlForEditor(html) });
  return editor;
};
afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('style list', () => {
  it('defaults reproduce editor.css (heading sizes / spacing in pt at 11pt)', () => {
    expect(style('heading1')).toMatchObject({ fontSize: 22, lineHeight: 1.2, spaceBefore: 14.74, spaceAfter: 8.8, bold: true });
    expect(style('heading3')).toMatchObject({ fontSize: 13.75, spaceBefore: 6.875 });
    expect(style('normal')).toMatchObject({ fontFamily: 'Calibri', fontSize: 11, lineHeight: 1.15, spaceBefore: 0, spaceAfter: 0 });
    expect(BUILTIN_STYLES.map(s => s.id)).toEqual(['normal', 'title', 'subtitle', 'heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6', 'quote', 'code']);
  });

  it('resolves stored changes over built-ins, appends custom styles and drops invalid entries', () => {
    const stored = [style('heading2', { fontSize: 20 }), FANCY, { id: 'Bad Id!' } as any, null as any];
    const all = resolveStyles(stored);
    expect(all.find(s => s.id === 'heading2')!.fontSize).toBe(20);
    expect(all.find(s => s.id === 'heading2')!.kind).toBe('heading');
    expect(all[all.length - 1].id).toBe('u-fancy');
    expect(all).toHaveLength(BUILTIN_STYLES.length + 1);
  });

  it('upsert stores only changed built-ins; remove resets / deletes', () => {
    let stored = upsertStyle(undefined, style('title', { fontSize: 30 }));
    expect(stored.map(s => s.id)).toEqual(['title']);
    stored = upsertStyle(stored, style('title'));
    expect(stored).toEqual([]);
    stored = upsertStyle(stored, FANCY);
    expect(removeStyle(stored, 'u-fancy')).toEqual([]);
    expect(isDefaultStyle(style('quote'))).toBe(true);
  });

  it('normalizes untrusted values (ids, colours, fonts, numbers)', () => {
    expect(normalizeStyle({ id: 'u-x', name: 'X', fontSize: 9999, color: 'red;}body{', fontFamily: 'A"};x' } as any)).toMatchObject({ fontSize: 400, color: null, fontFamily: 'Ax' });
    expect(normalizeStyle({ id: '<script>' } as any)).toBeNull();
    expect(newStyleId('My Style', [FANCY, { ...FANCY, id: 'u-my-style' }])).toBe('u-my-style-2');
  });

  it('effective props: built-ins with a CSS baseline only emit changes', () => {
    expect(effectiveProps(style('heading1'))).toEqual({});
    expect(effectiveProps(style('heading1', { fontSize: 30, color: '#123456' }))).toEqual({ fontSize: 30, color: '#123456' });
    expect(effectiveProps(style('title'))).toMatchObject({ fontSize: 26, spaceAfter: 3, fontFamily: 'Calibri' });
    expect(effectiveProps(style('code', { fontSize: 30 }))).toEqual({});
  });
});

describe('style sheet', () => {
  it('an untouched document only styles Title / Subtitle', () => {
    const css = generateStyleCss(undefined);
    expect(css).toContain('[data-style="title"]');
    expect(css).toContain('[data-style="subtitle"]');
    expect(css).not.toMatch(/ h[1-6]|blockquote| p:not/);
  });

  it('changed built-ins and custom styles become scoped rules; direct formatting (inline style) is left to win', () => {
    const css = generateStyleCss([style('heading1', { fontSize: 28, color: '#ff0000' }), style('normal', { fontFamily: 'Georgia', spaceAfter: 8 }), style('quote', { italic: false }), FANCY]);
    expect(css).toMatch(/\.penko-doc:not\(\.screenplay-mode\) \.ProseMirror h1:not\(:is\(\[data-style="title"\], \[data-style="subtitle"\], \[data-style="u-fancy"\]\)\)[^{]*\{ font-size: 28pt; color: #ff0000; \}/);
    expect(css).toMatch(/ProseMirror p:not\(:is\([^)]*\)\)[^{]*\{ font-family: "Georgia", serif; \}/);
    // Normal's spacing skips list items / table cells
    expect(css).toMatch(/:not\(li > p\):not\(td > p\):not\(th > p\) \{ margin-bottom: 8pt; \}/);
    expect(css).toMatch(/blockquote[^{]*\{ font-style: normal; \}/);
    expect(css).toMatch(/\[data-style="u-fancy"\][^{]*\{ font-family: "Georgia", serif; font-size: 14pt; font-weight: 400; font-style: normal; text-decoration: none; color: #ff0000; text-align: left; line-height: 1.15; margin-top: 0pt; margin-bottom: 6pt; margin-left: 0pt; \}/);
    expect(css).not.toContain('!important');
    // page header/footer zones and node views are excluded
    expect(css).toContain(':not(.penko-page-boundary *)');
  });
});

describe('editor', () => {
  it('applies styles: Title keeps a data-style, headings keep their level, quote / code convert the block', () => {
    const ed = make('<p>One</p><p>Two</p>');
    ed.commands.setTextSelection(2);
    applyParagraphStyle(ed, style('title'));
    expect(ed.getHTML()).toMatch(/^<p data-style="title">One<\/p><p>Two<\/p>/);
    expect(currentStyleId(ed.state)).toBe('title');
    applyParagraphStyle(ed, style('heading2'));
    expect(ed.getHTML()).toMatch(/^<h2 id="[^"]+">One<\/h2>/);
    applyParagraphStyle(ed, { ...FANCY, kind: 'heading', level: 3 });
    expect(ed.getHTML()).toMatch(/^<h3 data-style="u-fancy" id="[^"]+">One<\/h3>/);
    applyParagraphStyle(ed, style('quote'));
    expect(ed.getHTML()).toMatch(/^<blockquote><p>One<\/p><\/blockquote>/);
    expect(currentStyleId(ed.state)).toBe('quote');
    applyParagraphStyle(ed, style('normal'));
    expect(ed.getHTML()).toBe('<p>One</p><p>Two</p>');
  });

  it('applies to every selected paragraph and keeps direct formatting', () => {
    const ed = make('<p style="text-align: center">A</p><p><strong>B</strong></p>');
    ed.commands.setTextSelection({ from: 1, to: 6 });
    applyParagraphStyle(ed, style('subtitle'));
    expect(ed.getHTML()).toMatch(/^<p data-style="subtitle" style="text-align: center;?">A<\/p><p data-style="subtitle"><strong>B<\/strong><\/p>$/);
  });

  it('Enter at the end of a styled paragraph starts a Normal one; formatBlock clears the named style', () => {
    const ed = make('<p data-style="title">Doc</p>');
    ed.commands.focus('end');
    press(ed, 'Enter');
    ed.commands.insertContent('body');
    expect(ed.getHTML()).toBe('<p data-style="title">Doc</p><p>body</p>');
    ed.commands.setTextSelection(2);
    runEditorCommand(ed, 'formatBlock', 'p');
    expect(ed.getHTML()).toBe('<p>Doc</p><p>body</p>');
  });

  it('Ctrl+Alt+0 / Ctrl+Alt+N apply Normal / Heading N', () => {
    const ed = make('<p data-style="title">Doc</p><p>x</p>');
    ed.commands.setTextSelection(2);
    ed.commands.keyboardShortcut('Mod-Alt-2');
    expect(ed.getHTML()).toMatch(/^<h2 id=[^>]*>Doc<\/h2><p>x<\/p>$/);
    ed.commands.keyboardShortcut('Mod-Alt-2');
    expect(ed.getHTML()).toMatch(/^<h2 id=/); // applies, doesn't toggle
    ed.commands.keyboardShortcut('Mod-Alt-0');
    expect(ed.getHTML()).toBe('<p>Doc</p><p>x</p>');
  });

  it('captures block-wide direct formatting for "update to match" and then removes it', () => {
    const ed = make('<h1 style="margin-top: 20pt; color: #111111">Big <strong>bold</strong></h1><p><span style="font-family: Georgia; font-size: 14pt">All <em>mine</em></span></p>');
    ed.commands.setTextSelection(3);
    const h = captureStyleFromSelection(ed.state, style('heading1'));
    expect(h).toMatchObject({ id: 'heading1', spaceBefore: 20, fontSize: 22, bold: true, color: '#111111' });
    ed.commands.setTextSelection(ed.state.doc.content.size - 2);
    const n = captureStyleFromSelection(ed.state, style('normal'));
    expect(n).toMatchObject({ fontFamily: 'Georgia', fontSize: 14, italic: false });
    absorbDirectFormatting(ed);
    // only the paragraph at the cursor gives up its formatting
    expect(ed.getHTML()).toMatch(/^<h1 style="margin-top: 20pt[^>]*>Big <strong>bold<\/strong><\/h1><p>All <em>mine<\/em><\/p>$/);
  });

  it('clear formatting removes direct formatting but keeps the style, links and comments', () => {
    const ed = make('<p data-style="title" style="line-height: 2; text-align: center"><strong>A</strong> <a href="https://x.org">link</a> <span style="color: #ff0000">red</span></p>');
    ed.commands.setTextSelection(2);
    clearDirectFormatting(ed);
    expect(ed.getHTML()).toBe('<p data-style="title">A <a target="_blank" rel="noopener noreferrer nofollow" href="https://x.org">link</a> red</p>');
  });

  it('keeps data-style through a getHTML/setContent round trip and ignores bad ids', () => {
    const ed = make('<p data-style="u-fancy">x</p><h2 data-style="bad id">y</h2>');
    expect(ed.getHTML()).toBe('<p data-style="u-fancy">x</p><h2>y</h2>');
  });
});

describe('export', () => {
  const content = '<p data-style="title">Report</p><h1>Intro</h1><p>Body</p><ul><li><p>Item</p></li></ul><p data-style="u-fancy">Fancy</p>';
  const styles = [style('heading1', { fontSize: 30, color: '#1f4e79' }), style('normal', { spaceAfter: 8, fontFamily: 'Georgia' }), FANCY];

  it('model resolves named styles (PDF uses these values); direct formatting still wins', () => {
    const model = buildExportModel(makeDoc(content + '<p style="margin-bottom: 2pt">Direct</p>', { styles }));
    const paras = model.blocks.filter(b => b.type === 'para') as ParaBlock[];
    const [title, h1, body, item, fancy, direct] = paras;
    expect(title).toMatchObject({ styleId: 'title', spaceAfterPt: 3 });
    expect(title.baseStyle.sizePt).toBe(26);
    expect(h1).toMatchObject({ styleId: 'heading1', heading: 1 });
    expect(h1.baseStyle).toMatchObject({ sizePt: 30, color: '1f4e79', bold: true });
    expect(body).toMatchObject({ styleId: 'normal', spaceAfterPt: 8 });
    expect(body.baseStyle.font).toBe('Georgia');
    expect(item.spaceAfterPt).toBeUndefined();
    expect(fancy.baseStyle).toMatchObject({ font: 'Georgia', sizePt: 14, color: 'ff0000' });
    expect(direct.spaceAfterPt).toBe(2);
  });

  it('an unstyled document exports exactly as before', () => {
    const plain = buildExportModel(makeDoc('<h1>A</h1><p>B</p><blockquote><p>C</p></blockquote>'));
    const withDefaults = buildExportModel(makeDoc('<h1>A</h1><p>B</p><blockquote><p>C</p></blockquote>', { styles: [] }));
    const strip = (m: typeof plain) => m.blocks.map(b => (b.type === 'para' ? { ...b, styleId: undefined } : b));
    expect(strip(withDefaults)).toEqual(strip(plain));
    const h = plain.blocks[0] as ParaBlock;
    expect(h.baseStyle.sizePt).toBe(22);
    expect(h.spaceBeforePt).toBeCloseTo(14.74);
  });

  it('DOCX has real paragraph styles and paragraphs reference them', async () => {
    const zip = await JSZip.loadAsync(await (await buildDocxBlob(makeDoc(content, { styles }))).arrayBuffer());
    const stylesXml = await zip.file('word/styles.xml')!.async('string');
    const docXml = await zip.file('word/document.xml')!.async('string');
    const styleEl = (id: string) => (stylesXml.match(new RegExp(`<w:style [^>]*w:styleId="${id}"[\\s\\S]*?</w:style>`)) || [''])[0];
    expect(styleEl('Title')).toContain('<w:sz w:val="52"/>');
    expect(styleEl('Heading1')).toContain('<w:sz w:val="60"/>');
    expect(styleEl('Heading1')).toContain('<w:color w:val="1F4E79"/>');
    expect(styleEl('Subtitle')).toContain('<w:color w:val="666666"/>');
    expect(styleEl('Fancy')).toMatch(/<w:name w:val="Fancy"\/>[\s\S]*w:ascii="Georgia"[\s\S]*<w:sz w:val="28"\/>/);
    expect(stylesXml).toMatch(/<w:docDefaults>[\s\S]*w:ascii="Georgia"[\s\S]*w:after="160"/);
    expect(docXml).toContain('<w:pStyle w:val="Title"/>');
    expect(docXml).toContain('<w:pStyle w:val="Heading1"/>');
    expect(docXml).toContain('<w:pStyle w:val="Fancy"/>');
    expect(wordStyleIds([FANCY, { ...FANCY, id: 'u-2', name: 'Title' }]).get('u-2')).toBe('Title2');
  });

  it('PDF renders with the resolved styles (Georgia falls back to a standard font)', async () => {
    const result = await buildPdf(makeDoc(content, { styles }));
    expect(result.kind).toBe('pdf');
    if (result.kind === 'pdf') expect(result.pdf.output()).toMatch(/^%PDF/);
  });

  it('HTML export embeds the style sheet (and the styles for re-import)', async () => {
    const html = buildStandaloneHtml(makeDoc(content, { styles }));
    expect(html).toContain('[data-style="u-fancy"]');
    expect(html).toContain('font-size: 30pt');
    const back = await importDocument(new File([html], 'x.html', { type: 'text/html' }));
    expect(back.extra?.styles?.map(s => s.id).sort()).toEqual(['heading1', 'normal', 'u-fancy']);
    expect(back.content).toContain('data-style="u-fancy"');
  });

  it('Markdown maps Title to #', () => {
    expect(htmlToMarkdown('<p data-style="title">My Title</p><h1>Intro</h1><p>x</p>')).toMatch(/^# My Title\n\n# Intro\n\nx\n?$/);
  });
});

describe('import', () => {
  it('DOCX: styles.xml becomes document styles (changed built-ins + custom styles in use)', async () => {
    const blob = await buildDocxBlob(makeDoc(styledContent(), { styles: [style('heading1', { fontSize: 30, color: '#1f4e79' }), FANCY, { ...FANCY, id: 'u-unused', name: 'Unused' }] }));
    const res = await importDocument(new File([await blob.arrayBuffer()], 'styled.docx'));
    const got = resolveStyles(res.extra?.styles);
    expect(got.find(s => s.id === 'heading1')).toMatchObject({ fontSize: 30, color: '#1f4e79' });
    const fancy = got.find(s => s.name === 'Fancy')!;
    expect(fancy).toMatchObject({ kind: 'paragraph', fontFamily: 'Georgia', fontSize: 14, color: '#ff0000', spaceAfter: 6 });
    expect(got.some(s => s.name === 'Unused')).toBe(false);
    expect(res.content).toContain(`<p data-style="${fancy.id}">Fancy</p>`);
    expect(res.content).toContain('<p data-style="title">Report</p>');
    expect(res.content).toMatch(/<h1[^>]*>(<strong>)?Intro(<\/strong>)?<\/h1>/);
  });

  it('DOCX: re-importing an unstyled export stores no style changes', async () => {
    const blob = await buildDocxBlob(makeDoc('<h1>A</h1><h3>B</h3><h6>C</h6><p>D</p><blockquote><p>E</p></blockquote>'));
    const res = await importDocument(new File([await blob.arrayBuffer()], 'plain.docx'));
    expect(res.extra?.styles).toBeUndefined();
  });

  it('ODT: Title / Subtitle paragraphs become named styles', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text><text:p text:style-name="Title">Big</text:p><text:p text:style-name="Subtitle">Small</text:p></office:text></office:body></office:document-content>`;
    expect(parseOdtContent(xml)).toBe('<p data-style="title">Big</p><p data-style="subtitle">Small</p>');
  });
});

function styledContent() {
  return '<p data-style="title">Report</p><h1>Intro</h1><p>Body</p><p data-style="u-fancy">Fancy</p>';
}
