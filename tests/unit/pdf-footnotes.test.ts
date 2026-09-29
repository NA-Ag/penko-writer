import { describe, expect, it } from 'vitest';
import type { jsPDF } from 'jspdf';
import { buildPdf } from '../../utils/pdfExport';
import type { DocumentData } from '../../types';

const LONG = 'The quick brown fox jumps over the lazy dog while the committee reviews the quarterly figures carefully. ';
const note = (n: number, text: string, type = 'footnote') =>
  `<sup data-type="footnote" data-note-type="${type}" data-content="${text}" data-number="${n}">${n}</sup>`;

const makeDoc = (content: string): DocumentData => ({
  id: 'fn',
  title: 'Footnotes',
  content,
  createdAt: 0,
  lastModified: 0,
  pageConfig: { size: 'A4', orientation: 'portrait', margins: 'normal' },
});

const pdfOf = async (content: string): Promise<jsPDF> => {
  const result = await buildPdf(makeDoc(content));
  if (result.kind !== 'pdf') throw new Error('expected a PDF');
  return result.pdf;
};

/** The pages (1-based) whose content stream draws `word` (the writer draws word by word). */
const pagesWith = (pdf: jsPDF, word: string): number[] => {
  const pages = (pdf.internal as unknown as { pages: string[][] }).pages;
  const out: number[] = [];
  for (let i = 1; i < pages.length; i++) if (pages[i].join('\n').includes(`(${word}) Tj`)) out.push(i);
  return out;
};

/** y (from the top, pt) where `word` is drawn on `page`. */
const yOf = (pdf: jsPDF, page: number, word: string): number => {
  const stream = (pdf.internal as unknown as { pages: string[][] }).pages[page].join('\n');
  const m = new RegExp(`([\\d.]+) ([\\d.]+) Td\\s*\\n?\\(${word}\\) Tj`).exec(stream);
  if (!m) throw new Error(`${word} not found on page ${page}`);
  return pdf.internal.pageSize.getHeight() - parseFloat(m[2]);
};

describe('PDF footnotes', () => {
  it('puts each footnote at the bottom of the page of its reference', async () => {
    const paras = Array.from({ length: 24 }, (_, i) => `<p>Anchor${i} ${LONG.repeat(5)}${i % 5 === 2 ? note(Math.floor(i / 5) + 1, `Notetext${Math.floor(i / 5) + 1} explained`) : ''}</p>`).join('');
    const pdf = await pdfOf(paras);
    expect(pdf.getNumberOfPages()).toBeGreaterThan(2);
    for (const [i, n] of [[2, 1], [7, 2], [12, 3], [17, 4], [22, 5]]) {
      // the reference sits in the paragraph's last line, so compare with the page where the paragraph ends
      const refPage = pagesWith(pdf, `Anchor${i + 1}`)[0] ?? pdf.getNumberOfPages();
      const notePages = pagesWith(pdf, `Notetext${n}`);
      expect(notePages).toHaveLength(1);
      expect([refPage, refPage - 1]).toContain(notePages[0]);
      // the note is below all body text of its page, near the bottom margin
      const y = yOf(pdf, notePages[0], `Notetext${n}`);
      expect(y).toBeGreaterThan(pdf.internal.pageSize.getHeight() - 72 - 80);
    }
    // no leftover list of notes at the end of the document
    const last = pdf.getNumberOfPages();
    expect(pagesWith(pdf, 'Notetext5')).not.toContain(last + 1);
  });

  it('keeps the note on the same page as the line holding the reference', async () => {
    // fill the page so the referencing line would land on the last body line
    const filler = Array.from({ length: 40 }, (_, i) => `<p>Line${i}</p>`).join('');
    const pdf = await pdfOf(`${filler}<p>Refline ${note(1, `Bottomnote ${LONG.repeat(3)}`)}</p><p>Afterwards</p>`);
    const refPage = pagesWith(pdf, 'Refline')[0];
    expect(pagesWith(pdf, 'Bottomnote')).toEqual([refPage]);
    // the body stops above the note area
    expect(yOf(pdf, refPage, 'Refline')).toBeLessThan(yOf(pdf, refPage, 'Bottomnote'));
  });

  it('continues a note taller than the page on the next page', async () => {
    const huge = Array.from({ length: 120 }, (_, i) => `Huge${i}`).join(' ') + ' ' + LONG.repeat(70);
    const pdf = await pdfOf(`<p>Start ${note(1, huge)}</p><p>Next</p>`);
    expect(pagesWith(pdf, 'Huge0')).toEqual([1]);
    expect(pagesWith(pdf, 'Start')).toEqual([1]);
    // the rest of the note fills the bottom of page 2, and the body continues above it
    expect(pagesWith(pdf, 'carefully.')).toContain(2);
    expect(pagesWith(pdf, 'Next')).toEqual([2]);
    expect(yOf(pdf, 2, 'Next')).toBeLessThan(yOf(pdf, 2, 'carefully.'));
  });

  it('keeps endnotes at the end under their heading and places table notes', async () => {
    const pdf = await pdfOf(
      `<p>Body${note(1, 'Endtext', 'endnote')}</p><table><tbody><tr><td><p>cell${note(1, 'Celltext')}</p></td></tr></tbody></table><p>Tail</p>`,
    );
    expect(pagesWith(pdf, 'Endnotes')).toEqual([pdf.getNumberOfPages()]);
    expect(pagesWith(pdf, 'Endtext')).toEqual([pdf.getNumberOfPages()]);
    expect(pagesWith(pdf, 'Celltext')).toEqual([1]);
    expect(yOf(pdf, 1, 'Celltext')).toBeGreaterThan(yOf(pdf, 1, 'Tail'));
  });

  it('draws equations with the Symbol font instead of LaTeX source', async () => {
    const pdf = await pdfOf('<p>Mass <span data-type="equation" data-latex="E=mc^2 + \\alpha"></span></p>');
    const stream = (pdf.internal as unknown as { pages: string[][] }).pages[1].join('\n');
    expect(stream).not.toContain('mc^2');
    expect(stream).toContain('(E) Tj');
    // Symbol-font code for alpha is "a"
    expect(Object.keys(pdf.getFontList())).toContain('symbol');
  });
});

describe('PDF sections in the other orientation', () => {
  it('writes landscape pages for a landscape section, including pages a long table adds', async () => {
    const rows = Array.from({ length: 60 }, (_, i) => `<tr><td><p>r${i}</p></td><td><p>x</p></td></tr>`).join('');
    const pdf = await pdfOf(
      `<p>Intro</p><div data-type="section-break" data-section='{"orientation":"landscape"}'></div><p>Wide</p><table><tbody>${rows}</tbody></table>` +
        `<div data-type="section-break" data-section='{"orientation":"portrait"}'></div><p>Outro</p>`,
    );
    const sizes = Array.from({ length: pdf.getNumberOfPages() }, (_, i) => {
      pdf.setPage(i + 1);
      return pdf.internal.pageSize.getWidth() > pdf.internal.pageSize.getHeight() ? 'L' : 'P';
    });
    expect(sizes[0]).toBe('P');
    expect(sizes[sizes.length - 1]).toBe('P');
    const middle = sizes.slice(1, -1);
    expect(middle.length).toBeGreaterThan(1); // the table continues on a second landscape page
    expect(middle.every(s => s === 'L')).toBe(true);
    expect(pagesWith(pdf, 'Wide')).toEqual([2]);
    expect(pagesWith(pdf, 'Outro')).toEqual([sizes.length]);
  });
});
