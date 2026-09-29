import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import type { DocumentData } from '../../types';
import { buildDocxBlob } from '../../utils/docxExport';
import { buildPdf } from '../../utils/pdfExport';
import { buildExportModel, blocksToText } from '../../utils/exportModel';
import { buildStandaloneHtml, buildWordHtmlDoc } from '../../utils/export';
import { ensureRenderAssets } from '../../editor/lazyAssets';

const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const makeDoc = (content: string, extra: Partial<DocumentData> = {}): DocumentData => ({
  id: 'd1',
  title: 'Test <Doc>',
  content,
  createdAt: 0,
  lastModified: 0,
  pageConfig: { size: 'A4', orientation: 'portrait', margins: 'normal' },
  ...extra,
});

const RICH = `
<h1>Heading One</h1>
<p style="text-align: center">Centered <strong>bold</strong> <em>italic</em> <span style="color: #ff0000">red</span> <a href="https://example.com">link</a></p>
<ul><li><p>Bullet A</p><ul><li><p>Nested B</p></li></ul></li></ul>
<ol><li><p>First</p></li><li><p>Second</p></li></ol>
<table><tbody><tr><th><p>Name</p></th><th><p>Value</p></th></tr><tr><td><p>Alpha</p></td><td><p>42</p></td></tr></tbody></table>
<p>Image: <img src="${PNG_1x1}" width="40" height="40" alt="dot"></p>
<blockquote><p>Quoted text</p></blockquote>
<pre><code class="language-js">const x = 1;</code></pre>
<p>Note here<sup data-type="footnote" data-note-type="footnote" data-content="Footnote body" data-number="1">1</sup></p>
<hr>
<div data-type="page-break"></div>
<p>After break with <span data-type="equation" data-latex="E=mc^2"></span></p>
`;

const zipOf = async (blob: Blob) => JSZip.loadAsync(await blob.arrayBuffer());

describe('export model', () => {
  it('extracts lists, tables, notes and equations', () => {
    const model = buildExportModel(makeDoc(RICH));
    const text = blocksToText(model.blocks);
    expect(text).toContain('Heading One');
    expect(text).toContain('• Bullet A');
    expect(text).toContain('    ◦ Nested B');
    expect(text).toContain('1. First');
    expect(text).toContain('2. Second');
    expect(text).toContain('Name\tValue');
    expect(text).toContain('E = mc²');
    expect(model.notes).toHaveLength(1);
    const centered = model.blocks.find(b => b.type === 'para' && b.align === 'center');
    expect(centered).toBeTruthy();
  });
});

describe('DOCX export', () => {
  it('produces a valid docx with lists, tables, images and footnotes', async () => {
    const blob = await buildDocxBlob(makeDoc(RICH, { header: '<p>My header</p>', showPageNumbers: true, pageNumberPosition: 'footer-center' }));
    const zip = await zipOf(blob);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Heading One');
    expect(xml).toContain('Bullet A');
    expect(xml).toContain('Nested B');
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('Alpha');
    expect(xml).toContain('<w:numPr>');
    expect(xml).toContain('w:footnoteReference');
    expect(xml).toContain('<w:drawing>');
    expect(xml).toContain('w:type="page"');
    expect(Object.keys(zip.files).some(f => f.startsWith('word/media/'))).toBe(true);
    const footnotes = await zip.file('word/footnotes.xml')!.async('string');
    expect(footnotes).toContain('Footnote body');
    const headers = Object.keys(zip.files).filter(f => /word\/header\d*\.xml/.test(f));
    expect(headers.length).toBeGreaterThan(0);
    const footerXml = await zip.file(Object.keys(zip.files).find(f => /word\/footer\d*\.xml/.test(f))!)!.async('string');
    expect(footerXml).toContain('PAGE');
  });

  it('writes landscape letter page size', async () => {
    const blob = await buildDocxBlob(makeDoc('<p>x</p>', { pageConfig: { size: 'Letter', orientation: 'landscape', margins: 'narrow' } }));
    const xml = await (await zipOf(blob)).file('word/document.xml')!.async('string');
    expect(xml).toMatch(/<w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/);
    expect(xml).toContain('w:left="720"');
  });
});

describe('PDF export', () => {
  it('does not throw on tables and paginates long documents', async () => {
    const long = RICH + Array.from({ length: 120 }, (_, i) => `<p>Paragraph ${i} with some text that wraps across the line because it is long enough to need wrapping in the PDF output.</p>`).join('');
    const result = await buildPdf(makeDoc(long, { footer: '<p>Footer {PAGE}</p>', showPageNumbers: true, pageNumberPosition: 'header-right' }));
    expect(result.kind).toBe('pdf');
    if (result.kind !== 'pdf') return;
    expect(result.pdf.getNumberOfPages()).toBeGreaterThan(1);
    const out = result.pdf.output();
    expect(out.startsWith('%PDF')).toBe(true);
  });

  it('uses the page size and orientation', async () => {
    const result = await buildPdf(makeDoc('<p>hi</p>', { pageConfig: { size: 'Letter', orientation: 'landscape', margins: 'normal' } }));
    if (result.kind !== 'pdf') throw new Error('expected pdf');
    const size = result.pdf.internal.pageSize;
    expect(Math.round(size.getWidth())).toBe(792);
    expect(Math.round(size.getHeight())).toBe(612);
  });

  it('asks for the print fallback for scripts the standard fonts cannot render', async () => {
    const result = await buildPdf(makeDoc('<p>日本語のテキスト</p>'));
    expect(result.kind).toBe('unsupported-script');
  });

  it('renders screenplays', async () => {
    const result = await buildPdf(
      makeDoc('<p data-screenplay-type="scene-heading">INT. ROOM - DAY</p><p data-screenplay-type="character">BOB</p><p data-screenplay-type="dialogue">Hello there.</p>', { isScreenplay: true }),
    );
    expect(result.kind).toBe('pdf');
  });
});

describe('HTML exports', () => {
  it('escapes the title and inlines the editor CSS', () => {
    const html = buildStandaloneHtml(makeDoc('<p>Body<script>alert(1)</script></p>'));
    expect(html).toContain('<title>Test &lt;Doc&gt;</title>');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('.penko-doc');
    expect(html).toContain('Body');
  });

  it('renders equations as MathML without external resources', async () => {
    await ensureRenderAssets(); // KaTeX is lazy; the export entry points load it first
    const html = buildStandaloneHtml(makeDoc('<p>x <span data-type="equation" data-latex="a^2+b^2"></span></p>'));
    expect(html).toContain('<math');
    expect(html).not.toMatch(/https?:\/\/(cdn|fonts)\./);
  });

  it('builds a Word-compatible HTML .doc', () => {
    const out = buildWordHtmlDoc(makeDoc(`<p>Hi <img src="${PNG_1x1}"> <span data-type="equation" data-latex="x^2"></span></p>`, { pageConfig: { size: 'Letter', orientation: 'landscape', margins: 'normal' } }));
    expect(out).toContain('xmlns:w="urn:schemas-microsoft-com:office:word"');
    expect(out).toContain('<w:View>Print</w:View>');
    expect(out).toContain('mso-page-orientation: landscape');
    expect(out).toContain('<title>Test &lt;Doc&gt;</title>');
    expect(out).toContain('<i>x²</i>');
    expect(out).toContain('data:image/png;base64');
  });
});
