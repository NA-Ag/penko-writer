import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import type { DocumentData } from '../../types';
import { buildDocxBlob } from '../../utils/docxExport';
import { buildArchive, buildPlainText, buildStandaloneHtml, buildWordHtmlDoc } from '../../utils/export';
import { importArchive, importDocument, numberNotes } from '../../utils/import';
import { paragraphText, zoneFromParagraphs, pageConfigFromSectPr } from '../../utils/docxImport';

const makeDoc = (content: string, extra: Partial<DocumentData> = {}): DocumentData => ({
  id: 'd1',
  title: 'Round trip',
  content,
  createdAt: 0,
  lastModified: 0,
  pageConfig: { size: 'A4', orientation: 'portrait', margins: 'normal' },
  ...extra,
});

const fileOf = (data: BlobPart, name: string) => new File([data], name);
const reimportDocx = async (doc: DocumentData) => importDocument(fileOf(await (await buildDocxBlob(doc)).arrayBuffer(), 'x.docx'));
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html').body;

const NOTES = `<p>One<sup data-type="footnote" data-note-type="footnote" data-content="First note" data-number="1">1</sup> two<sup data-type="footnote" data-note-type="footnote" data-content="Second &amp; note" data-number="2">2</sup></p>`;

describe('DOCX export -> import', () => {
  it('keeps page setup, header / footer, page numbers and "different first page"', async () => {
    const res = await reimportDocx(
      makeDoc('<p>A</p><div data-type="page-break"></div><p>B</p>', {
        pageConfig: { size: 'Letter', orientation: 'landscape', margins: 'narrow' },
        header: '<p>Report {PAGE} / {PAGES}</p>',
        showPageNumbers: true,
        pageNumberPosition: 'footer-right',
        pageNumberFormat: 'roman',
        differentFirstPage: true,
      }),
    );
    expect(res.success).toBe(true);
    expect(res.extra).toMatchObject({
      pageConfig: { size: 'Letter', orientation: 'landscape', margins: 'narrow' },
      header: '<p>Report {PAGE} / {PAGES}</p>',
      showPageNumbers: true,
      pageNumberPosition: 'footer-right',
      pageNumberFormat: 'roman',
      differentFirstPage: true,
    });
    expect(parse(res.content).querySelectorAll('[data-type="page-break"]')).toHaveLength(1);
  });

  it('keeps "Page X of Y" numbering', async () => {
    const res = await reimportDocx(makeDoc('<p>x</p>', { showPageNumbers: true, pageNumberPosition: 'header-left', pageNumberFormat: 'page-of' }));
    expect(res.extra).toMatchObject({ showPageNumbers: true, pageNumberPosition: 'header-left', pageNumberFormat: 'page-of' });
  });

  it('turns Word footnotes back into numbered footnote nodes', async () => {
    const res = await reimportDocx(makeDoc(NOTES));
    const notes = Array.from(parse(res.content).querySelectorAll('sup[data-type="footnote"]'));
    expect(notes.map(n => [n.getAttribute('data-content'), n.getAttribute('data-number')])).toEqual([
      ['First note', '1'],
      ['Second & note', '2'],
    ]);
    expect(res.content).not.toContain('↑');
    expect(res.content).not.toContain('<ol');
  });

  it('maps code blocks, quotes and screenplay elements to named styles and back', async () => {
    const code = await reimportDocx(makeDoc('<pre><code class="language-js">a();\n  b();</code></pre><blockquote><p>Quoted</p></blockquote>'));
    const body = parse(code.content);
    expect(body.querySelector('pre')?.textContent).toBe('a();\n  b();');
    expect(body.querySelector('blockquote')?.textContent).toBe('Quoted');

    const sp = await reimportDocx(
      makeDoc('<p data-screenplay-type="scene-heading">INT. ROOM - DAY</p><p data-screenplay-type="character">BOB</p><p data-screenplay-type="dialogue">Hi.</p>', { isScreenplay: true }),
    );
    expect(sp.extra?.isScreenplay).toBe(true);
    expect(Array.from(parse(sp.content).querySelectorAll('p')).map(p => p.getAttribute('data-screenplay-type'))).toEqual(['scene-heading', 'character', 'dialogue']);
  });

  it('marks right-to-left paragraphs as bidirectional', async () => {
    const zip = await JSZip.loadAsync(await buildDocxBlob(makeDoc('<p style="text-align: right">مرحبا بالعالم</p><p>Hello</p>')));
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml.match(/<w:bidi\/>/g)).toHaveLength(1);
    // right-aligned RTL = aligned to its start
    expect(xml).toContain('<w:jc w:val="start"/>');
  });

  it('shows the centred page number next to header text, like the editor', async () => {
    const zip = await JSZip.loadAsync(await buildDocxBlob(makeDoc('<p>x</p>', { footer: '<p>Draft</p>', showPageNumbers: true, pageNumberPosition: 'footer-center' })));
    const footer = await zip.file(Object.keys(zip.files).find(f => /word\/footer\d*\.xml/.test(f))!)!.async('string');
    expect(footer).toContain('Draft');
    expect(footer).toContain('PAGE');
  });
});

describe('DOCX layout helpers', () => {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const para = (inner: string) => new DOMParser().parseFromString(`<w:p ${W}>${inner}</w:p>`, 'application/xml').documentElement;

  it('reads simple and complex PAGE / NUMPAGES fields', () => {
    expect(paragraphText(para('<w:r><w:t xml:space="preserve">Page </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:t>3</w:t></w:r></w:fldSimple>'))).toBe('Page {PAGE}');
    const complex =
      '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> NUMPAGES \\* MERGEFORMAT </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>9</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
    expect(paragraphText(para(`<w:r><w:t>of </w:t></w:r>${complex}<w:r><w:tab/><w:t>x</w:t></w:r>`))).toBe('of {PAGES}\tx');
    // unknown fields keep their displayed result
    expect(paragraphText(para('<w:fldSimple w:instr=" DATE "><w:r><w:t>1 May</w:t></w:r></w:fldSimple>'))).toBe('1 May');
  });

  it('splits header paragraphs into text and a page-number setting', () => {
    expect(zoneFromParagraphs(['\tTitle\t{PAGE}'])).toEqual({ html: '<p>Title</p>', number: { position: 'right', pageOf: false } });
    expect(zoneFromParagraphs(['Page {PAGE} of {PAGES}\t\t'])).toEqual({ html: '', number: { position: 'left', pageOf: true } });
    expect(zoneFromParagraphs(['{PAGE}'])).toEqual({ html: '', number: { position: 'center', pageOf: false } });
    // centred text with a number is kept as text (renders the same)
    expect(zoneFromParagraphs(['\tChapter {PAGE} of {PAGES}\t'])).toEqual({ html: '<p>Chapter {PAGE} of {PAGES}</p>', number: undefined });
    expect(zoneFromParagraphs(['A <b>', 'Second'])).toEqual({ html: '<p>A &lt;b&gt;</p><p>Second</p>', number: undefined });
  });

  it('snaps page size and margins to the presets', () => {
    const sect = (inner: string) => new DOMParser().parseFromString(`<w:sectPr ${W}>${inner}</w:sectPr>`, 'application/xml').documentElement;
    expect(pageConfigFromSectPr(sect('<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:left="1418" w:right="1418"/>'))).toEqual({ size: 'A4', orientation: 'portrait', margins: 'normal', cols: 1 });
    expect(pageConfigFromSectPr(sect('<w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:left="2880" w:right="2880"/>'))).toEqual({ size: 'Letter', orientation: 'landscape', margins: 'wide', cols: 1 });
    expect(pageConfigFromSectPr(sect('<w:pgMar w:left="0"/>'))).toBeNull();
  });
});

describe('HTML / .doc export -> import', () => {
  const rich = makeDoc(`${NOTES}<div data-type="page-break"></div><p>After</p>`, { header: '<p>Head</p>', footer: '<p>Foot</p>', showPageNumbers: true, language: 'de-DE' });

  it('gives back only the document content for Penko HTML files', async () => {
    const res = await importDocument(fileOf(buildStandaloneHtml(rich), 'x.html'));
    const body = parse(res.content);
    expect(body.textContent).not.toContain('Head');
    expect(body.textContent).not.toContain('Foot');
    expect(body.textContent).not.toContain('First note'); // only inside data-content
    expect(body.querySelectorAll('sup[data-type="footnote"]')).toHaveLength(2);
    expect(body.querySelectorAll('[data-type="page-break"]')).toHaveLength(1);
    expect(res.extra).toEqual({ language: 'de-DE' });
  });

  it('does the same for the Word-compatible .doc', async () => {
    const res = await importDocument(fileOf(`﻿${buildWordHtmlDoc({ ...rich, isScreenplay: true, content: '<p data-screenplay-type="character">BOB</p><div data-type="page-break"></div><p>x</p>' })}`, 'x.doc'));
    const body = parse(res.content);
    expect(body.querySelectorAll('[data-type="page-break"]')).toHaveLength(1);
    expect(res.extra?.isScreenplay).toBe(true);
  });
});

describe('header / footer placeholders in HTML and TXT', () => {
  it('fills {PAGE} and {PAGES} and keeps text next to a centred number', () => {
    const doc = makeDoc('<p>Body</p>', { header: '<p>Head {PAGE}/{PAGES}</p>', footer: '<p>Draft</p>', showPageNumbers: true, pageNumberPosition: 'footer-center' });
    const html = buildStandaloneHtml(doc);
    expect(html).toContain('Head 1/1');
    expect(html).not.toContain('{PAGES}');
    // the centred number stays on the same line as the text (inside its paragraph)
    expect(html).toMatch(/Draft <span class="penko-page-number">1<\/span><\/p>/);
    const txt = buildPlainText(doc);
    expect(txt.startsWith('Head 1/1')).toBe(true);
  });
});

describe('import helpers', () => {
  it('numbers imported notes in document order', () => {
    const html = numberNotes('<p><sup data-type="footnote" data-note-type="footnote">*</sup><sup data-type="footnote" data-note-type="endnote">*</sup><sup data-type="footnote">*</sup></p>');
    expect(Array.from(parse(html).querySelectorAll('sup')).map(s => s.getAttribute('data-number'))).toEqual(['1', '1', '2']);
  });

  it('backup ZIP keeps page-number format and "different first page"', async () => {
    const zip = await buildArchive([makeDoc('<p>x</p>', { differentFirstPage: true, pageNumberFormat: 'roman' })]);
    const res = await importArchive(fileOf(await zip.arrayBuffer(), 'backup.zip'));
    expect(res.documents[0]).toMatchObject({ differentFirstPage: true, pageNumberFormat: 'roman' });
  });
});
