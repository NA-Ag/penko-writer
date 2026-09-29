import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { computeBoundaries, LayoutUnit } from '../../editor/extensions/pagination';
import { zoneHtml, formatPageNumber } from '../../editor/pageChrome';
import { buildDocxBlob } from '../../utils/docxExport';
import { createNewDocument } from '../../utils/storage';

const unit = (pos: number, top: number, bottom: number, extra: Partial<LayoutUnit> = {}): LayoutUnit => ({ pos, top, bottom, left: 0, parentLeft: 0, ...extra });

describe('computeBoundaries', () => {
  const H = 100; // content height per page
  const stride = 150; // page + gap

  it('keeps everything on one page when it fits', () => {
    expect(computeBoundaries([unit(0, 0, 40), unit(10, 40, 90)], H, stride)).toEqual([]);
  });

  it('moves a block that crosses the page edge to the next page', () => {
    const b = computeBoundaries([unit(0, 0, 60), unit(10, 60, 120)], H, stride);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ pos: 10, page: 1, inline: false });
    // the boundary fills the rest of page 1 plus the gap
    expect(b[0].height).toBeCloseTo(stride - 60);
  });

  it('splits a paragraph between lines', () => {
    const lines = [0, 1, 2, 3, 4, 5].map(i => ({ top: 50 + i * 20, bottom: 70 + i * 20, pos: 100 + i * 10 }));
    const b = computeBoundaries([unit(0, 0, 50), unit(99, 50, 170, { lines })], H, stride);
    expect(b).toHaveLength(1);
    // lines 0 and 1 end at 70 and 90 (fit), line 2 ends at 110 (doesn't)
    expect(b[0]).toMatchObject({ pos: 120, inline: true, page: 1 });
  });

  it('honours forced page breaks', () => {
    const b = computeBoundaries([unit(0, 0, 20), unit(5, 30, 50, { forceBreakBefore: true })], H, stride);
    expect(b.map(x => x.pos)).toEqual([5]);
  });

  it('lets an atom taller than a page overflow instead of looping', () => {
    const b = computeBoundaries([unit(0, 0, 250), unit(10, 250, 270)], H, stride);
    expect(b.length).toBe(1);
    expect(b[0].pos).toBe(10);
  });

  it('breaks a long paragraph over several pages', () => {
    const lines = Array.from({ length: 20 }, (_, i) => ({ top: i * 20, bottom: i * 20 + 20, pos: 1 + i * 5 }));
    const b = computeBoundaries([unit(0, 0, 400, { lines })], H, stride);
    expect(b.map(x => x.page)).toEqual([1, 2, 3]);
    expect(b.every(x => x.inline)).toBe(true);
  });
});

describe('page chrome', () => {
  const doc = { header: '<p>Report {PAGE}/{PAGES}</p>', footer: '', showPageNumbers: true, pageNumberPosition: 'footer-right' as const };

  it('fills page placeholders per page', () => {
    expect(zoneHtml(doc, 'header', 3, 7)).toContain('Report 3/7');
    expect(zoneHtml(doc, 'footer', 3, 7)).toMatch(/text-align:right">3</);
  });

  it('hides chrome on the first page when requested', () => {
    expect(zoneHtml({ ...doc, differentFirstPage: true }, 'header', 1, 5)).toBe('');
    expect(zoneHtml({ ...doc, differentFirstPage: true }, 'header', 2, 5)).toContain('Report 2/5');
  });

  it('formats page numbers', () => {
    expect(formatPageNumber(4, 9, 'roman')).toBe('iv');
    expect(formatPageNumber(4, 9, 'page-of')).toBe('Page 4 of 9');
    expect(formatPageNumber(4, 9, 'decimal')).toBe('4');
  });

  it('sanitizes header html', () => {
    expect(zoneHtml({ ...doc, header: '<img src=x onerror="alert(1)">Hi' }, 'header', 1, 1)).not.toContain('onerror');
  });
});

describe('DOCX page setup', () => {
  it('writes title page, page-of fields and roman numbering', async () => {
    const base = {
      ...createNewDocument(),
      content: '<p>Hello</p>',
      header: '<p>Title {PAGE} of {PAGES}</p>',
      showPageNumbers: true,
      pageNumberPosition: 'footer-center' as const,
      differentFirstPage: true,
      pageNumberFormat: 'page-of' as const,
    };
    const zip = await JSZip.loadAsync(await (await buildDocxBlob(base, { pageOf: 'Page {PAGE} of {PAGES}' })).arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('string');
    expect(documentXml).toContain('<w:titlePg');
    const parts = await Promise.all(Object.keys(zip.files).filter(f => /word\/(header|footer)\d*\.xml/.test(f)).map(f => zip.file(f)!.async('string')));
    const all = parts.join('');
    expect(all).toContain('NUMPAGES');
    expect(all).toMatch(/PAGE/);

    const roman = await JSZip.loadAsync(await (await buildDocxBlob({ ...base, pageNumberFormat: 'roman' })).arrayBuffer());
    expect(await roman.file('word/document.xml')!.async('string')).toMatch(/w:pgNumType[^>]*lowerRoman/);
  });
});
