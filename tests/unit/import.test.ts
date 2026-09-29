import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { parseRtf } from '../../utils/rtfParser';
import { parseOdtContent } from '../../utils/odtParser';
import { extractWordText, wordTextToHtml } from '../../utils/wordBinary';
import { escapeHtml } from '../../editor/sanitize';
import { importDocument, importArchive } from '../../utils/import';
import { buildArchive } from '../../utils/export';

const fileFrom = (name: string, data: BlobPart) => new File([data], name);

describe('RTF parser', () => {
  const rtf =
    '{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}{\\f1\\froman Times New Roman;}}' +
    '{\\colortbl ;\\red255\\green0\\blue0;}' +
    '{\\*\\generator Msftedit 5.41;}{\\info{\\title Secret title}}' +
    '\\viewkind4\\uc1\\pard\\qc\\f0\\fs32 Caf\\\'e9 \\b bold\\b0  \\i italic\\i0  \\ul under\\ulnone  \\strike gone\\strike0\\par' +
    '\\pard Euro \\u8364? sign and \\cf1 red\\cf0  text\\line next line\\par' +
    '\\pard\\qr right\\tab tabbed\\par}';

  it('does not leak the font table, generator or info', () => {
    const { html } = parseRtf(rtf);
    expect(html).not.toContain('Arial;');
    expect(html).not.toContain('fswiss');
    expect(html).not.toContain('Times New Roman');
    // \deff0 (Arial) is the default font: not repeated on every run
    expect(html).not.toContain('font-family: Arial');
    expect(html).not.toContain('Msftedit');
    expect(html).not.toContain('Secret title');
  });

  it("decodes \\'hh and \\uN (with fallback skipping)", () => {
    const { html } = parseRtf(rtf);
    expect(html).toContain('Café');
    expect(html).toContain('Euro € sign');
    expect(html).not.toContain('€?');
  });

  it('keeps bold / italic / underline / strike, alignment, colour and size', () => {
    const { html } = parseRtf(rtf);
    expect(html).toMatch(/<strong>[^<]*(<[^>]+>)*bold/);
    expect(html).toContain('<em>');
    expect(html).toContain('<u>');
    expect(html).toContain('<s>');
    expect(html).toContain('text-align: center');
    expect(html).toContain('text-align: right');
    expect(html).toContain('color: #ff0000');
    expect(html).toContain('font-size: 16pt');
    expect(html).toContain('<br>');
  });

  it('decodes other code pages via the font charset', () => {
    const { html } = parseRtf("{\\rtf1\\ansi{\\fonttbl{\\f0\\fcharset204 Arial Cyr;}}\\f0 \\'cf\\'f0\\'e8\\'e2\\'e5\\'f2\\par}");
    expect(html).toContain('Привет');
  });

  it('parses a LibreOffice RTF file', async () => {
    const res = await importDocument(fileFrom('sample.rtf', fs.readFileSync(path.join(__dirname, 'fixtures/sample.rtf'))));
    expect(res.success).toBe(true);
    expect(res.content).toMatch(/<h1[^>]*>Legacy Title<\/h1>/);
    expect(res.content).toContain('café € naïve');
    expect(res.content).toContain('Ελληνικά');
    expect(res.content).toContain('日本語');
    expect(res.content).toContain('<table>');
    expect(res.content).not.toMatch(/Liberation|Times New Roman;|Arial;/);
  });
});

describe('ODT parser', () => {
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0">
<office:automatic-styles>
  <style:style style:name="P1" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/></style:style>
  <style:style style:name="T1" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
  <style:style style:name="T2" style:family="text"><style:text-properties fo:font-style="italic" style:text-underline-style="solid"/></style:style>
  <text:list-style style:name="L1"><text:list-level-style-number text:level="1"/><text:list-level-style-bullet text:level="2"/></text:list-style>
</office:automatic-styles>
<office:body><office:text>
  <text:h text:outline-level="2">Chapter Two</text:h>
  <text:p text:style-name="P1">Hello <text:span text:style-name="T1">bold</text:span> and <text:span text:style-name="T2">it-under</text:span><text:line-break/>next<text:tab/>tab<text:s text:c="3"/>spaces</text:p>
  <text:list text:style-name="L1"><text:list-item><text:p>One</text:p><text:list><text:list-item><text:p>Nested</text:p></text:list-item></text:list></text:list-item><text:list-item><text:p>Two</text:p></text:list-item></text:list>
  <table:table><table:table-row><table:table-cell><text:p>A</text:p></table:table-cell><table:table-cell><text:p>B</text:p></table:table-cell></table:table-row></table:table>
  <text:p><draw:frame svg:width="2.54cm" svg:height="1.27cm"><draw:image xlink:href="Pictures/img.png"/></draw:frame></text:p>
  <text:p>Linked <text:a xlink:href="https://example.com">site</text:a><text:note text:note-class="footnote"><text:note-citation>1</text:note-citation><text:note-body><text:p>Note text</text:p></text:note-body></text:note></text:p>
</office:text></office:body></office:document-content>`;

  it('walks headings, spans, lists, tables, images, breaks', () => {
    const html = parseOdtContent(content, { images: { 'Pictures/img.png': 'data:image/png;base64,AAAA' } });
    expect(html).toContain('<h2>Chapter Two</h2>');
    expect(html).toContain('style="text-align: center"');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em><u>it-under</u></em>');
    expect(html).toContain('<br>next\ttab   spaces');
    expect(html).toMatch(/<ol><li><p>One<\/p><ul><li><p>Nested<\/p><\/li><\/ul><\/li><li><p>Two<\/p><\/li><\/ol>/);
    expect(html).toContain('<table><tbody><tr><td><p>A</p></td><td><p>B</p></td></tr></tbody></table>');
    expect(html).toContain('<img src="data:image/png;base64,AAAA" width="96" height="48">');
    expect(html).toContain('<a href="https://example.com">site</a>');
    expect(html).toContain('data-type="footnote"');
    expect(html).toContain('data-content="Note text"');
  });

  it('imports a LibreOffice ODT file', async () => {
    const res = await importDocument(fileFrom('sample.odt', fs.readFileSync(path.join(__dirname, 'fixtures/sample.odt'))));
    expect(res.success).toBe(true);
    expect(res.content).toMatch(/<h1[^>]*>Legacy Title<\/h1>/);
    expect(res.content).toContain('<strong>world</strong>');
    expect(res.content).toContain('<table>');
  });
});

describe('legacy .doc', () => {
  it('extracts the text of a Word 97 file', () => {
    const bytes = new Uint8Array(fs.readFileSync(path.join(__dirname, 'fixtures/legacy-word97.doc')));
    const text = extractWordText(bytes);
    expect(text).toContain('Legacy Title');
    expect(text).toContain('café € naïve');
    expect(text).toContain('Ελληνικά and 日本語');
    const html = wordTextToHtml(text, escapeHtml);
    expect(html).toContain('<p>Legacy Title</p>');
    expect(html).toContain('A1\tB1');
  });

  it('imports with a formatting-lost warning; refuses garbage', async () => {
    const res = await importDocument(fileFrom('legacy.doc', fs.readFileSync(path.join(__dirname, 'fixtures/legacy-word97.doc'))));
    expect(res.success).toBe(true);
    expect(res.warning).toBeTruthy();
    const bad = await importDocument(fileFrom('bad.doc', new Uint8Array(2048).fill(7)));
    expect(bad.success).toBe(false);
  });

  it('imports RTF saved with a .doc extension', async () => {
    const res = await importDocument(fileFrom('x.doc', '{\\rtf1\\ansi \\b Bold\\b0  text\\par}'));
    expect(res.success).toBe(true);
    expect(res.content).toContain('<strong>Bold</strong>');
  });
});

describe('HTML / Markdown import', () => {
  it('sanitizes HTML', async () => {
    const res = await importDocument(fileFrom('a.html', '<html><head><title>T</title></head><body><p onclick="x()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">x</a></body></html>'));
    expect(res.content).toContain('<p>Hi</p>');
    expect(res.content).not.toContain('script');
    expect(res.content).not.toContain('onclick');
    expect(res.content).not.toContain('javascript:');
  });

  it('converts markdown', async () => {
    const res = await importDocument(fileFrom('a.md', '# Title\n\n- a\n- b\n\n```\ncode_here\n```\n'));
    expect(res.content).toContain('<h1>Title</h1>');
    expect(res.content).toContain('<li>a</li>');
    expect(res.content).toContain('code_here');
  });
});

describe('archive round trip', () => {
  it('restores documents with all fields, ignoring metadata.json', async () => {
    const blob = await buildArchive([
      { id: 'a', title: 'Doc A', content: '<p>A</p>', createdAt: 1, lastModified: 2, isScreenplay: true, header: '<p>H</p>', comments: [], citations: [] },
      { id: 'b', title: 'Doc B', content: '<p>B</p>', createdAt: 1, lastModified: 2, isMarkdownMode: true, markdownSource: '# B' },
    ]);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files)).toContain('penko-writer-documents/metadata.json');
    const res = await importArchive(new File([await blob.arrayBuffer()], 'backup.zip'));
    expect(res.success).toBe(true);
    expect(res.documents).toHaveLength(2);
    expect(res.documents[0]).toMatchObject({ title: 'Doc A', isScreenplay: true, header: '<p>H</p>' });
    expect(res.documents[1]).toMatchObject({ title: 'Doc B', isMarkdownMode: true, markdownSource: '# B' });
    expect((res.documents[0] as any).id).toBeUndefined();
  });
});
