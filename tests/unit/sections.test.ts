import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { Editor } from '@tiptap/core';
import { createExtensions } from '../../editor/extensions';
import { DEFAULT_SECTION, resolveSection, displayPageNumber, sectionOfPage, sectionBreaks, sectionOrientations, type SectionInfo } from '../../editor/extensions/sections';
import { importDocument } from '../../utils/import';
import { computeBoundaries, pageAltOf, pageFrame, pageTops, type LayoutUnit, type PageNote, NOTES_SEPARATOR } from '../../editor/extensions/pagination';
import { buildDocxBlob } from '../../utils/docxExport';
import { createNewDocument } from '../../utils/storage';

const sec = (index: number, firstPage: number, settings = DEFAULT_SECTION): SectionInfo => ({ index, pos: index ? index * 10 : null, firstPage, settings });

describe('sections', () => {
  it('inherit header/footer unless overridden ("same as previous")', () => {
    const doc = { header: '<p>Doc header</p>', footer: '<p>Doc footer</p>', showPageNumbers: true, pageNumberPosition: 'footer-center' as const };
    const s2 = { ...DEFAULT_SECTION, header: '<p>Chapter</p>' };
    const s3 = { ...DEFAULT_SECTION };
    expect(resolveSection(doc, [s2, s3], 0).header).toBe('<p>Doc header</p>');
    expect(resolveSection(doc, [s2, s3], 1).header).toBe('<p>Chapter</p>');
    expect(resolveSection(doc, [s2, s3], 1).footer).toBe('<p>Doc footer</p>');
    expect(resolveSection(doc, [s2, s3], 2).header).toBe('<p>Chapter</p>'); // linked to section 2
  });

  it('restarts numbering where a section says so', () => {
    const sections = [sec(0, 1), sec(1, 3, { ...DEFAULT_SECTION, restartNumbering: true, startAt: 1 }), sec(2, 6)];
    expect([1, 2, 3, 4, 5, 6, 7].map(p => displayPageNumber(p, sections))).toEqual([1, 2, 1, 2, 3, 4, 5]);
    expect(sectionOfPage(4, sections)?.index).toBe(1);
    expect(sectionOfPage(7, sections)?.index).toBe(2);
  });

  it('section breaks round-trip through the editor with their settings', () => {
    const ed = new Editor({ extensions: createExtensions({ paginate: false }), content: '<p>a</p><div data-type="section-break"></div><p>b</p>' });
    const [sb] = sectionBreaks(ed.state.doc);
    ed.commands.command(({ tr }) => {
      tr.setNodeMarkup(sb.pos, undefined, { settings: { ...DEFAULT_SECTION, header: '<p>H</p>', restartNumbering: true, startAt: 5 } });
      return true;
    });
    const html = ed.getHTML();
    const ed2 = new Editor({ extensions: createExtensions({ paginate: false }), content: html });
    expect(sectionBreaks(ed2.state.doc)[0].settings).toMatchObject({ header: '<p>H</p>', restartNumbering: true, startAt: 5 });
    ed.destroy();
    ed2.destroy();
  });

  it('exports sections as Word sections with their own headers and restarted numbering', async () => {
    const settings = JSON.stringify({ ...DEFAULT_SECTION, header: '<p>Chapter header</p>', restartNumbering: true, startAt: 1, pageNumberFormat: 'roman' }).replace(/"/g, '&quot;');
    const doc = {
      ...createNewDocument(),
      header: '<p>Front matter</p>',
      showPageNumbers: true,
      pageNumberPosition: 'footer-center' as const,
      content: `<p>Title</p><div data-type="section-break" data-section="${settings}"></div><p>Body</p>`,
    };
    const zip = await JSZip.loadAsync(await (await buildDocxBlob(doc)).arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect((xml.match(/<w:sectPr/g) || []).length).toBe(2);
    expect(xml).toMatch(/w:pgNumType[^>]*w:start="1"/);
    expect(xml).toMatch(/lowerRoman/);
    const headers = await Promise.all(Object.keys(zip.files).filter(f => /word\/header\d*\.xml/.test(f)).map(f => zip.file(f)!.async('string')));
    expect(headers.join('')).toContain('Chapter header');
    expect(headers.join('')).toContain('Front matter');
  });
});

describe('footnotes on the page that references them', () => {
  const unit = (pos: number, top: number, bottom: number, extra: Partial<LayoutUnit> = {}): LayoutUnit => ({ pos, top, bottom, left: 0, parentLeft: 0, ...extra });
  const note = (pos: number, y: number, height: number): PageNote => ({ pos, label: String(pos), content: 'n', y, height });

  it('reserves space for a page’s notes and moves a line whose note does not fit', () => {
    // page content height 100; a line at 60–80 references a 30px note: 80 + 30 + separator > 100 → moves
    const b = computeBoundaries([unit(0, 0, 60), unit(10, 60, 80)], 100, 150, undefined, [], [note(11, 60, 30)]);
    expect(b).toHaveLength(1);
    expect(b[0].pos).toBe(10);
    expect(b[0].notes).toBeUndefined();
  });

  it('keeps notes with their references and reports them per page', () => {
    const b = computeBoundaries(
      [unit(0, 0, 20), unit(10, 20, 40), unit(20, 40, 95)],
      100,
      150,
      undefined,
      [],
      [note(5, 5, 10)],
    );
    // 95 + 10 + separator > 100 → third block moves; page 1 carries the note
    expect(b[0].pos).toBe(20);
    expect(b[0].notes?.map(n => n.pos)).toEqual([5]);
    expect(NOTES_SEPARATOR).toBeGreaterThan(0);
  });
});

describe('sections in the other orientation', () => {
  const unit = (pos: number, top: number, bottom: number, extra: Partial<LayoutUnit> = {}): LayoutUnit => ({ pos, top, bottom, left: 0, parentLeft: 0, ...extra });
  // portrait: content 100, stride 150; landscape: content 60, stride 110
  const alt = { contentHeight: 60, stride: 110 };

  it('resolves each section orientation, following "same as previous"', () => {
    const land = { ...DEFAULT_SECTION, orientation: 'landscape' as const };
    expect(sectionOrientations('portrait', [land, DEFAULT_SECTION, { ...DEFAULT_SECTION, orientation: 'portrait' as const }])).toEqual(['portrait', 'landscape', 'landscape', 'portrait']);
  });

  it('uses each page’s own height and places pages one after another', () => {
    const units = [unit(0, 0, 90), unit(10, 100, 150, { forceBreakBefore: true, alt: true }), unit(20, 150, 200, { alt: true }), unit(30, 210, 230, { forceBreakBefore: true })];
    const b = computeBoundaries(units, 100, 150, undefined, [], [], alt);
    expect(b.map(x => x.page)).toEqual([1, 2, 3]);
    expect(b.map(x => [!!x.alt, !!x.nextAlt])).toEqual([[false, true], [true, true], [true, false]]);
    // page 2 is landscape (60 high): the unit ending at 200 does not fit and starts page 3
    expect(b[1].pos).toBe(20);
    expect(b.map(x => x.end)).toEqual([150, 260, 370]);
    expect(pageAltOf(b, false)).toEqual([false, true, true, false]);
    expect(pageTops({ pageWidth: 90, pageHeight: 140, gap: 10 }, [false, true, true, false])).toEqual({ tops: [0, 150, 250, 350], total: 490 });
  });

  it('centres pages of the other orientation on the page element', () => {
    expect(pageFrame({ pageWidth: 800, pageHeight: 1100 }, true)).toEqual({ left: -150, width: 1100, height: 800 });
    expect(pageFrame({ pageWidth: 800, pageHeight: 1100 }, false)).toEqual({ left: 0, width: 800, height: 1100 });
  });
});

describe('DOCX sections -> import', () => {
  it('turns Word sections back into section breaks with their settings', async () => {
    const doc = {
      ...createNewDocument(),
      title: 'Sections',
      content:
        '<p>Intro</p><div data-type="section-break" data-section=\'{"header":"<p>Wide header</p>","restartNumbering":true,"startAt":5,"orientation":"landscape"}\'></div><p>Wide</p><div data-type="section-break" data-section=\'{"orientation":"portrait"}\'></div><p>Linked</p>',
      header: '<p>Doc header</p>',
      showPageNumbers: true,
      pageNumberPosition: 'footer-right' as const,
    };
    const res = await importDocument(new File([await (await buildDocxBlob(doc)).arrayBuffer()], 'x.docx'));
    expect(res.success).toBe(true);
    const body = new DOMParser().parseFromString(res.content, 'text/html').body;
    const breaks = Array.from(body.querySelectorAll('div[data-type="section-break"]')).map(el => JSON.parse(el.getAttribute('data-section')!));
    expect(Array.from(body.children).map(el => el.textContent || el.getAttribute('data-type'))).toEqual(['Intro', 'section-break', 'Wide', 'section-break', 'Linked']);
    expect(res.extra?.header).toBe('<p>Doc header</p>');
    expect(breaks[0]).toMatchObject({ header: '<p>Wide header</p>', restartNumbering: true, startAt: 5, orientation: 'landscape' });
    expect(breaks[1]).toMatchObject({ restartNumbering: false, orientation: 'portrait' });
    expect(body.textContent).not.toMatch(/penko-section/);
  });
});
