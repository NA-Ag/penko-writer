/**
 * Text PDF export with jsPDF, laid out from the export model:
 * inline runs with wrapping (bold / italic / underline / strike / sub / sup /
 * colour / highlight / size / font family / links), alignment + justify,
 * indents, lists, blockquotes, code blocks, images, tables (jspdf-autotable),
 * page breaks, notes, page size / orientation / margins, header / footer and
 * page numbers.
 *
 * jsPDF's built-in fonts (Helvetica / Times / Courier) only cover Windows-1252.
 * When a document contains characters outside that set (CJK, Cyrillic,
 * Arabic, emoji…) `buildPdf` returns `{ kind: 'unsupported-script' }` and the
 * caller falls back to the browser's own print-to-PDF of a print-styled HTML
 * rendering, which uses real system fonts and is therefore always correct.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DocumentData } from '../types';
import { fillPlaceholders, formatPageNumber } from '../editor/pageChrome';
import {
  blocksToText,
  buildExportModel,
  htmlToPlainText,
  imageDisplaySize,
  listMarker,
  resolveImages,
  type Block,
  type ExportModel,
  type NoteItem,
  type ParaBlock,
  type ResolvedImage,
  type Run,
  type RunStyle,
  type TableBlock,
} from './exportModel';
import { resolveSection, type SectionSettings } from '../editor/extensions/sections';
import { latexToUnicode } from './latexLite';
import { layoutMath, type MathBox } from './pdfMath';

/* ------------------------------------------------------------------ */
/* Character support                                                   */
/* ------------------------------------------------------------------ */

const CP1252_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';

const TRANSLITERATE: Record<string, string> = {
  '−': '-', '‐': '-', '‑': '-', '‒': '-', '―': '—',
  '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~',
  ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
  '​': '', '‌': '', '‍': '', '﻿': '', '⁠': '',
  '◦': '·', '▪': '·', '●': '•', '′': "'", '″': '"', '⁄': '/', '™': '™',
  '✓': 'v', '✔': 'v', ' ': ' ',
};

// subscript / superscript digits
'\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089'.split('').forEach((c, i) => (TRANSLITERATE[c] = String(i)));
'\u2070\u2074\u2075\u2076\u2077\u2078\u2079'.split('').forEach((c, i) => (TRANSLITERATE[c] = String([0, 4, 5, 6, 7, 8, 9][i])));

/** Letters / digits / combining marks: text that must not silently disappear. */
const isScriptChar = (ch: string) => /[\p{L}\p{N}\p{M}]/u.test(ch) && !/[\uFE00-\uFE0F]/.test(ch);

const isWinAnsi = (ch: string) => {
  const c = ch.codePointAt(0)!;
  return c === 9 || c === 10 || c === 13 || (c >= 0x20 && c < 0x7f) || (c >= 0xa0 && c <= 0xff) || CP1252_EXTRA.includes(ch);
};

/** Maps a string to what the standard PDF fonts can draw. */
export const toPdfText = (text: string): string => {
  let out = '';
  // symbols / emoji the fonts can't draw are dropped (see unsupportedPdfChars)
  for (const ch of text) out += isWinAnsi(ch) ? ch : TRANSLITERATE[ch] ?? (isScriptChar(ch) ? ch : '');
  return out;
};

/**
 * Characters that neither WinAnsi nor the transliteration table cover, split
 * into script characters (letters: need the print fallback) and symbols /
 * emoji (dropped from the PDF, reported to the user).
 */
export const unsupportedPdfChars = (text: string): { script: string[]; symbols: string[] } => {
  const script = new Set<string>();
  const symbols = new Set<string>();
  for (const ch of text) {
    if (isWinAnsi(ch) || TRANSLITERATE[ch] !== undefined) continue;
    if (isScriptChar(ch)) script.add(ch);
    else if (!/[\uFE00-\uFE0F\u200d]/.test(ch)) symbols.add(ch);
  }
  return { script: [...script], symbols: [...symbols] };
};

/* ------------------------------------------------------------------ */
/* Fonts                                                               */
/* ------------------------------------------------------------------ */

type PdfFont = 'helvetica' | 'times' | 'courier';

const pdfFontFor = (font?: string): PdfFont => {
  const f = (font || '').toLowerCase();
  if (/courier|mono|consol|source code|menlo|code/.test(f)) return 'courier';
  if (/(^|[^-])serif|times|georgia|garamond|merriweather|playfair|cambria|book|palatino|baskerville/.test(f) && !/sans/.test(f)) return 'times';
  return 'helvetica';
};

const fontStyle = (s: RunStyle) => (s.bold && s.italic ? 'bolditalic' : s.bold ? 'bold' : s.italic ? 'italic' : 'normal');

const hexToRgb = (hex: string): [number, number, number] => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];

/* ------------------------------------------------------------------ */
/* Layout engine                                                       */
/* ------------------------------------------------------------------ */

interface TextPiece {
  kind: 'text';
  text: string;
  style: RunStyle;
  font: PdfFont;
  size: number;
  baseSize: number;
  width: number;
  space: boolean;
  /** footnote reference: its note goes to the bottom of the page this piece lands on */
  note?: NoteItem;
}
interface MathPiece {
  kind: 'math';
  box: MathBox;
  w: number;
  display: boolean;
  size: number;
}
interface ImagePiece {
  kind: 'image';
  img: ResolvedImage;
  w: number;
  h: number;
  link?: string;
}
type InlinePiece = TextPiece | ImagePiece | MathPiece;
type Piece = InlinePiece | { kind: 'break' };

const pieceWidth = (p: InlinePiece) => (p.kind === 'text' ? p.width : p.w);

interface Line {
  pieces: InlinePiece[];
  width: number;
  asc: number;
  desc: number;
  hardBreak: boolean;
}

export interface PdfLayoutOptions {
  margins: { top: number; right: number; bottom: number; left: number };
  forceLineHeight?: number;
  labels: { endnotes: string; pageOf?: string };
  /** page number format, e.g. screenplays use "n." */
  pageNumberFormat?: (n: number) => string;
  pageNumberPosition?: ExportModel['pageNumberPosition'];
  showPageNumbers?: boolean;
  skipFirstPageNumber?: boolean;
}

/** Footnote area (editor.css .penko-page-notes: 9pt, line-height 1.3, 14px separator). */
const NOTE_SIZE = 9;
const NOTE_LINE_HEIGHT = 1.3;
const NOTES_SEPARATOR = 10.5;

/** Footnotes referenced inside a table's cells, in order. */
const tableFootnotes = (table: TableBlock): NoteItem[] =>
  table.rows.flatMap(row =>
    row.flatMap(cell =>
      cell.blocks.flatMap(b => (b.type === 'para' ? b.runs.flatMap(r => (r.type === 'note' && r.noteType === 'footnote' ? [r] : [])) : b.type === 'table' ? tableFootnotes(b) : [])),
    ),
  );

const IMAGE_FORMAT: Record<ResolvedImage['type'], string> = { png: 'PNG', jpg: 'JPEG', gif: 'GIF', bmp: 'BMP' };

class PdfWriter {
  y: number;
  private pendingSpace = 0;
  /** Sections after the first: the PDF page each starts on and its settings. */
  private sectionStarts: { page: number; settings: SectionSettings }[] = [];
  readonly left: number;
  readonly top: number;
  /** Orientation of the pages being written (sections can switch it). */
  private landscape: boolean;

  constructor(
    readonly pdf: jsPDF,
    readonly model: ExportModel,
    readonly images: Map<string, ResolvedImage>,
    readonly opts: PdfLayoutOptions,
  ) {
    this.left = opts.margins.left;
    this.top = opts.margins.top;
    this.landscape = pdf.internal.pageSize.getWidth() > pdf.internal.pageSize.getHeight();
    this.y = this.top;
  }

  /* Geometry of the current page (jsPDF's pageSize follows setPage / addPage) */
  get pageW() {
    return this.pdf.internal.pageSize.getWidth();
  }
  get pageH() {
    return this.pdf.internal.pageSize.getHeight();
  }
  get right() {
    return this.pageW - this.opts.margins.right;
  }
  get bottom() {
    return this.pageH - this.opts.margins.bottom;
  }

  get contentWidth() {
    return this.right - this.left;
  }

  newPage() {
    const w = this.pdf.internal.pageSize.getWidth();
    const h = this.pdf.internal.pageSize.getHeight();
    const [short, long] = w < h ? [w, h] : [h, w];
    this.pdf.addPage(this.landscape ? [long, short] : [short, long], this.landscape ? 'landscape' : 'portrait');
    this.y = this.top;
    this.pendingSpace = 0;
  }

  /* ----- footnotes at the bottom of the page (like the editor and Word) ----- */

  /** Footnote lines per PDF page, drawn at the bottom of that page by `drawFootnotes`. */
  readonly footnoteLines = new Map<number, Line[]>();
  private noteCache = new Map<NoteItem, Line[]>();

  get pageNumber() {
    return this.pdf.getNumberOfPages();
  }

  /** Height the footnote area of a page takes (separator included). */
  notesHeight(page = this.pageNumber) {
    const lines = this.footnoteLines.get(page);
    return lines?.length ? NOTES_SEPARATOR + lines.reduce((s, l) => s + l.asc + l.desc, 0) : 0;
  }

  /** Lowest y the body may use on the current page. */
  get bodyBottom() {
    return this.bottom - this.notesHeight();
  }

  /** A footnote as it appears at the page bottom: 9pt, blue bold label (editor.css .penko-page-notes). */
  private noteLines(note: NoteItem): Line[] {
    let lines = this.noteCache.get(note);
    if (!lines) {
      const runs: Run[] = [
        { type: 'text', text: note.label, style: { sup: true, bold: true, color: '3b82f6', sizePt: NOTE_SIZE } },
        { type: 'text', text: ` ${note.content}`, style: { sizePt: NOTE_SIZE } },
      ];
      lines = this.breakLines(this.pieces(runs, NOTE_SIZE, this.contentWidth, false), this.contentWidth, this.contentWidth, NOTE_LINE_HEIGHT, NOTE_SIZE);
      this.noteCache.set(note, lines);
    }
    return lines;
  }

  /** Footnote lines of the notes referenced in a body line. */
  private lineFootnotes(line: Line): Line[] {
    return line.pieces.flatMap(p => (p.kind === 'text' && p.note ? this.noteLines(p.note) : []));
  }

  /** Extra height `lines` would add to the current page's footnote area. */
  private notesExtra(lines: Line[]) {
    if (!lines.length) return 0;
    return lines.reduce((s, l) => s + l.asc + l.desc, 0) + (this.notesHeight() ? 0 : NOTES_SEPARATOR);
  }

  /**
   * Adds footnote lines to the current page, whose body now ends at `bodyY`.
   * Lines that don't fit (only possible for a note taller than the free
   * page) continue at the bottom of the next page.
   */
  private addFootnotes(lines: Line[], bodyY: number) {
    let page = this.pageNumber;
    for (const line of lines) {
      const h = line.asc + line.desc;
      const room = this.bottom - bodyY - this.notesHeight(page) - (this.footnoteLines.get(page)?.length ? 0 : NOTES_SEPARATOR);
      if (h > room && this.footnoteLines.get(page)?.length) {
        page++;
        bodyY = this.top;
      }
      this.footnoteLines.set(page, [...(this.footnoteLines.get(page) || []), line]);
    }
  }

  /** Draws every page's footnote area (separator rule + notes) above the bottom margin. */
  drawFootnotes() {
    const current = this.pageNumber;
    this.footnoteLines.forEach((lines, page) => {
      // continuation lines may point past the last page when nothing followed them
      while (page > this.pdf.getNumberOfPages()) this.pdf.addPage();
      this.pdf.setPage(page);
      let y = this.bottom - this.notesHeight(page);
      this.pdf.setDrawColor(180, 180, 180);
      this.pdf.setLineWidth(0.75);
      this.pdf.line(this.left, y + NOTES_SEPARATOR / 2, this.left + this.contentWidth * 0.33, y + NOTES_SEPARATOR / 2);
      y += NOTES_SEPARATOR;
      for (const line of lines) {
        this.drawLine(line, this.left, this.contentWidth, 'left', y + line.asc);
        y += line.asc + line.desc;
      }
    });
    this.pdf.setPage(Math.max(current, 1));
  }

  /** Draws one laid-out line with its alignment (justify spreads the spaces). */
  private drawLine(line: Line, left: number, width: number, align: NonNullable<ParaBlock['align']>, baseline: number) {
    let x = left;
    const spaces = line.pieces.filter(p => p.kind === 'text' && p.space).length;
    let extra = 0;
    if (align === 'center') x += (width - line.width) / 2;
    else if (align === 'right') x += width - line.width;
    else if (align === 'justify' && !line.hardBreak && spaces) extra = (width - line.width) / spaces;
    for (const p of line.pieces) x += this.drawPiece(p, x, baseline, extra);
  }

  private measure(text: string, font: PdfFont, style: RunStyle, size: number) {
    this.pdf.setFont(font, fontStyle(style));
    this.pdf.setFontSize(size);
    return this.pdf.getTextWidth(text);
  }

  private textPiece(text: string, style: RunStyle, baseSize: number, space: boolean): TextPiece {
    const font = pdfFontFor(style.font);
    const size = style.sub || style.sup ? baseSize * 0.65 : baseSize;
    return { kind: 'text', text, style, font, size, baseSize, width: this.measure(text, font, style, size), space };
  }

  private pieces(runs: Run[], baseSize: number, maxWidth: number, pre: boolean): Piece[] {
    const out: Piece[] = [];
    for (const run of runs) {
      if (run.type === 'break') out.push({ kind: 'break' });
      else if (run.type === 'tab') out.push(this.textPiece('    ', {}, baseSize, true));
      else if (run.type === 'image') {
        const img = this.images.get(run.src);
        if (!img) {
          if (run.alt) out.push(this.textPiece(`[${toPdfText(run.alt)}]`, { italic: true }, baseSize, false));
          continue;
        }
        let { w, h } = imageDisplaySize(run, img, maxWidth);
        const maxH = (this.bottom - this.top) * 0.95;
        if (h > maxH) {
          w *= maxH / h;
          h = maxH;
        }
        out.push({ kind: 'image', img, w, h });
      } else if (run.type === 'note') {
        // same look as the editor's reference (blue, bold superscript)
        const piece = this.textPiece(run.label, { ...run.style, sup: true, bold: true, color: run.style.color || '3b82f6' }, run.style.sizePt || baseSize, false);
        if (run.noteType === 'footnote') piece.note = run;
        out.push(piece);
      } else if (run.type === 'math') {
        out.push(this.mathPiece(run, baseSize, maxWidth));
      } else {
        const size = run.style.sizePt || baseSize;
        const text = toPdfText(run.text);
        const tokens = pre ? text.split(/( +)/) : text.split(/(\s+)/);
        for (const tok of tokens) {
          if (!tok) continue;
          const space = /^\s+$/.test(tok);
          out.push(this.textPiece(space && !pre ? ' ' : tok, run.style, size, space));
        }
      }
    }
    return out;
  }

  /** An equation as one unbreakable box (scaled down when wider than the line). */
  private mathPiece(run: Extract<Run, { type: 'math' }>, baseSize: number, maxWidth: number): MathPiece {
    const size = run.style.sizePt || baseSize;
    const color = run.style.color ? hexToRgb(run.style.color) : ([17, 17, 17] as [number, number, number]);
    // the editor keeps 4px around inline equations
    const pad = run.display ? 0 : 3;
    let box = layoutMath(this.pdf, run.latex, size, run.display, color);
    if (box.w + pad * 2 > maxWidth && box.w > 0) box = layoutMath(this.pdf, run.latex, Math.max(4, (size * (maxWidth - pad * 2)) / box.w), run.display, color);
    return { kind: 'math', box, w: box.w + pad * 2, display: run.display, size };
  }

  private metrics(p: InlinePiece, lh: number) {
    if (p.kind === 'image') return { asc: p.h, desc: 2 };
    const size = p.kind === 'math' ? p.size : p.baseSize;
    const half = (size * (lh - 1)) / 2;
    if (p.kind === 'math') {
      // at least a normal text line; display equations get a little air above and below
      const air = p.display ? size * 0.35 : 0;
      return { asc: Math.max(size * 0.8, p.box.asc) + half + air, desc: Math.max(size * 0.2, p.box.desc) + half + air };
    }
    return { asc: size * 0.8 + half, desc: size * 0.2 + half };
  }

  private breakLines(pieces: Piece[], firstWidth: number, width: number, lh: number, emptySize: number): Line[] {
    const lines: Line[] = [];
    let line: Line = { pieces: [], width: 0, asc: 0, desc: 0, hardBreak: false };
    const avail = () => (lines.length === 0 ? firstWidth : width);
    const push = (hard: boolean) => {
      while (line.pieces.length && line.pieces[line.pieces.length - 1].kind === 'text' && (line.pieces[line.pieces.length - 1] as TextPiece).space) {
        line.width -= (line.pieces.pop() as TextPiece).width;
      }
      if (!line.pieces.length) {
        const half = (emptySize * (lh - 1)) / 2;
        line.asc = emptySize * 0.8 + half;
        line.desc = emptySize * 0.2 + half;
      }
      line.hardBreak = hard;
      lines.push(line);
      line = { pieces: [], width: 0, asc: 0, desc: 0, hardBreak: false };
    };
    const add = (p: InlinePiece) => {
      const m = this.metrics(p, lh);
      line.asc = Math.max(line.asc, m.asc);
      line.desc = Math.max(line.desc, m.desc);
      line.pieces.push(p);
      line.width += pieceWidth(p);
    };
    for (const p of pieces) {
      if (p.kind === 'break') {
        push(true);
        continue;
      }
      if (p.kind === 'text' && p.space) {
        if (line.pieces.length) add(p);
        continue;
      }
      const w = pieceWidth(p);
      if (line.width + w > avail() + 0.01 && line.pieces.some(x => !(x.kind === 'text' && x.space))) push(false);
      if (p.kind === 'text' && p.width > avail()) {
        // a single word wider than the line: split by characters
        let chunk = '';
        for (const ch of p.text) {
          const next = chunk + ch;
          if (this.measure(next, p.font, p.style, p.size) > avail() - line.width && chunk) {
            add(this.textPiece(chunk, p.style, p.baseSize, false));
            push(false);
            chunk = ch;
          } else chunk = next;
        }
        if (chunk) add(this.textPiece(chunk, p.style, p.baseSize, false));
        continue;
      }
      add(p);
    }
    if (line.pieces.length || !lines.length) push(true);
    else lines[lines.length - 1].hardBreak = true;
    return lines;
  }

  private drawPiece(p: InlinePiece, x: number, baseline: number, extraSpace: number): number {
    const pdf = this.pdf;
    if (p.kind === 'math') {
      p.box.draw(pdf, x + (p.w - p.box.w) / 2, baseline);
      return p.w;
    }
    if (p.kind === 'image') {
      try {
        pdf.addImage(p.img.dataUrl, IMAGE_FORMAT[p.img.type], x, baseline - p.h, p.w, p.h);
      } catch (err) {
        console.warn('[PDF] image skipped', err);
      }
      return p.w;
    }
    const w = p.width + (p.space ? extraSpace : 0);
    const s = p.style;
    const shift = s.sup ? -p.baseSize * 0.33 : s.sub ? p.baseSize * 0.15 : 0;
    if (s.highlight) {
      pdf.setFillColor(...hexToRgb(s.highlight));
      pdf.rect(x, baseline - p.baseSize * 0.85, w, p.baseSize * 1.1, 'F');
    }
    const [r, g, b] = s.color ? hexToRgb(s.color) : [17, 17, 17];
    if (!p.space) {
      pdf.setFont(p.font, fontStyle(s));
      pdf.setFontSize(p.size);
      pdf.setTextColor(r, g, b);
      pdf.text(p.text, x, baseline + shift);
    }
    if (s.underline || s.strike) {
      pdf.setDrawColor(r, g, b);
      pdf.setLineWidth(Math.max(0.4, p.size / 18));
      if (s.underline) pdf.line(x, baseline + shift + p.size * 0.12, x + w, baseline + shift + p.size * 0.12);
      if (s.strike) pdf.line(x, baseline + shift - p.size * 0.28, x + w, baseline + shift - p.size * 0.28);
    }
    if (s.link && !p.space) pdf.link(x, baseline - p.size * 0.85, w, p.size * 1.1, { url: s.link });
    return w;
  }

  para(block: ParaBlock, box: { left: number; right: number } = { left: this.left, right: this.right }) {
    const lh = this.opts.forceLineHeight ?? block.lineHeight ?? this.model.baseLineHeight;
    const baseSize = block.baseStyle.sizePt || this.model.baseSizePt;
    const listIndent = block.list ? (block.list.level + 1) * 24 : 0;
    const left = box.left + block.indentPt + listIndent;
    let right = box.right - (block.rightIndentPt || 0);
    if (block.maxWidthPt) right = Math.min(right, left + block.maxWidthPt);
    const width = Math.max(24, right - left);
    const first = block.firstLinePt || 0;
    const pieces = this.pieces(block.runs, baseSize, width, !!block.code);
    const lines = this.breakLines(pieces, width - first, width, lh, baseSize);

    const before = block.spaceBeforePt ?? 0;
    const space = Math.max(this.pendingSpace, before);
    if (this.y > this.top) this.y += space;
    const pad = block.code ? 6 : block.background ? 3 : 0;
    if (pad) this.y += pad;

    lines.forEach((line, i) => {
      const h = line.asc + line.desc;
      // keep headings with at least one following line
      const reserve = block.heading && i === lines.length - 1 ? h + baseSize * 1.5 : h;
      // the line's footnotes must fit at the bottom of the same page, or the line moves on
      const notes = this.lineFootnotes(line);
      if (this.y + reserve > this.bodyBottom - this.notesExtra(notes) && this.y > this.top) this.newPage();
      const lineLeft = left + (i === 0 ? first : 0);
      const lineWidth = width - (i === 0 ? first : 0);
      if (block.background) {
        this.pdf.setFillColor(...hexToRgb(block.background));
        this.pdf.rect(left - pad, this.y - (i === 0 ? pad : 0), width + pad * 2, h + (i === 0 ? pad : 0) + (i === lines.length - 1 ? pad : 0), 'F');
      }
      if (block.quote) {
        this.pdf.setDrawColor(209, 213, 219);
        this.pdf.setLineWidth(3);
        for (let q = 0; q < block.quote; q++) {
          const qx = box.left + block.indentPt - 10 - q * 14;
          this.pdf.line(qx, this.y, qx, this.y + h);
        }
      }
      const baseline = this.y + line.asc;
      if (i === 0 && block.list?.marker) {
        const marker = listMarker(block.list, true);
        this.pdf.setFont(pdfFontFor(block.baseStyle.font), block.list.ordered ? 'normal' : 'bold');
        this.pdf.setFontSize(baseSize);
        this.pdf.setTextColor(17, 17, 17);
        this.pdf.text(toPdfText(marker), left - 18, baseline);
      }
      this.drawLine(line, lineLeft, lineWidth, block.align || 'left', baseline);
      this.y += h;
      if (notes.length) this.addFootnotes(notes, this.y);
    });
    if (pad) this.y += pad;
    this.pendingSpace = block.spaceAfterPt ?? 0;
  }

  table(table: TableBlock) {
    // cells are plain text (jspdf-autotable): equations in their ASCII-safe linear form
    const cellText = (blocks: Block[]) => toPdfText(blocksToText(blocks, { tableCells: true, math: latex => latexToUnicode(latex, { ascii: true }) }).replace(/\n{2,}/g, '\n').trim());
    const headRows: any[][] = [];
    const bodyRows: any[][] = [];
    table.rows.forEach((row, i) => {
      const cells = row.map(cell => {
        const para = cell.blocks.find(b => b.type === 'para') as ParaBlock | undefined;
        return {
          content: cellText(cell.blocks),
          colSpan: cell.colspan,
          rowSpan: cell.rowspan,
          styles: {
            ...(cell.background ? { fillColor: hexToRgb(cell.background) } : {}),
            ...(cell.header ? { fontStyle: 'bold' } : {}),
            ...(para?.align && para.align !== 'justify' ? { halign: para.align } : {}),
          },
        };
      });
      if (i === headRows.length && row.length && row.every(c => c.header)) headRows.push(cells);
      else bodyRows.push(cells);
    });
    if (this.y > this.top) this.y += Math.max(this.pendingSpace, 4);
    if (this.y + 30 > this.bodyBottom) this.newPage();
    const font = pdfFontFor(this.model.baseFont);
    const border = table.style === 'bordered' ? { lineColor: [51, 51, 51] as [number, number, number], lineWidth: 1.2 } : { lineColor: [204, 204, 204] as [number, number, number], lineWidth: 0.5 };
    // pages autoTable adds keep this section's page size and orientation
    const pdf = this.pdf as any;
    const addPage = pdf.addPage;
    const format = [this.pageW, this.pageH];
    const orientation = this.landscape ? 'landscape' : 'portrait';
    pdf.addPage = (...args: unknown[]) => addPage.apply(pdf, args.length ? args : [format, orientation]);
    try {
      this.drawTable(table, headRows, bodyRows, font, border);
    } finally {
      pdf.addPage = addPage;
    }
    this.y = ((this.pdf as any).lastAutoTable?.finalY ?? this.y) + 6;
    this.pendingSpace = 0;
    // footnotes referenced in cells go to the page where the table ends
    const cellNotes = tableFootnotes(table).flatMap(n => this.noteLines(n));
    if (cellNotes.length) this.addFootnotes(cellNotes, this.y);
  }

  private drawTable(table: TableBlock, headRows: any[], bodyRows: any[], font: string, border: { lineColor: [number, number, number]; lineWidth: number }) {
    autoTable(this.pdf, {
      startY: this.y,
      head: headRows,
      body: bodyRows,
      theme: table.style === 'minimal' ? 'plain' : table.style === 'striped' ? 'striped' : 'grid',
      // keeps clear of footnotes already placed on the page the table starts on
      margin: { left: this.left + table.indentPt, right: this.pageW - this.right, top: this.top, bottom: this.pageH - this.bodyBottom },
      tableWidth: this.contentWidth - table.indentPt,
      styles: { font, fontSize: this.model.baseSizePt - 1, cellPadding: 4, textColor: [17, 17, 17], overflow: 'linebreak', valign: 'top', ...border },
      headStyles: { fillColor: [247, 247, 247], textColor: [17, 17, 17], fontStyle: 'bold' },
      alternateRowStyles: table.style === 'striped' ? { fillColor: [249, 249, 249] } : undefined,
    });
  }

  hr() {
    this.y += Math.max(this.pendingSpace, 6);
    if (this.y + 6 > this.bodyBottom) this.newPage();
    this.pdf.setDrawColor(209, 213, 219);
    this.pdf.setLineWidth(0.75);
    this.pdf.line(this.left, this.y, this.right, this.y);
    this.y += 6;
    this.pendingSpace = 0;
  }

  blocks(blocks: Block[]) {
    for (const b of blocks) {
      if (b.type === 'para') this.para(b);
      else if (b.type === 'table') this.table(b);
      else if (b.type === 'hr') this.hr();
      else if (b.type === 'pageBreak') this.newPage();
      else if (b.type === 'sectionBreak') {
        if (b.settings.orientation) this.landscape = b.settings.orientation === 'landscape';
        this.newPage();
        this.sectionStarts.push({ page: this.pdf.getNumberOfPages(), settings: b.settings });
      }
    }
  }

  /** Endnotes at the end of the document (footnotes sit at the bottom of their pages). */
  endnotes() {
    const endnotes = this.model.notes.filter(n => n.noteType === 'endnote');
    if (!endnotes.length) return;
    const noteBlock = (label: string, content: string): ParaBlock => ({
      type: 'para',
      indentPt: 0,
      runs: [
        { type: 'text', text: label, style: { sup: true, sizePt: 9 } },
        { type: 'text', text: ` ${content}`, style: { sizePt: 9 } },
      ],
      baseStyle: { sizePt: 9 },
      spaceAfterPt: 2,
    });
    this.pendingSpace = 16;
    this.para({ type: 'para', indentPt: 0, runs: [{ type: 'text', text: this.opts.labels.endnotes, style: { bold: true, sizePt: 10 } }], baseStyle: { sizePt: 10 }, spaceAfterPt: 4 });
    endnotes.forEach(n => this.para(noteBlock(n.label, n.content)));
  }

  headersAndFooters() {
    const pdf = this.pdf;
    const total = pdf.getNumberOfPages();
    const headerY = Math.max(20, this.opts.margins.top / 2);
    const font = pdfFontFor(this.model.baseFont);
    const breaks = this.sectionStarts.map(x => x.settings);
    for (let i = 1; i <= total; i++) {
      // Section of this page, its settings, and the number shown (sections can restart numbering)
      let sectionIndex = 0;
      let sectionFirst = 1;
      let numberBase = 1;
      let numberFrom = 1;
      this.sectionStarts.forEach((sec, k) => {
        if (sec.page > i) return;
        sectionIndex = k + 1;
        sectionFirst = sec.page;
        if (sec.settings.restartNumbering) {
          numberBase = sec.settings.startAt;
          numberFrom = sec.page;
        }
      });
      const shown = numberBase + (i - numberFrom);
      const r = resolveSection(this.model.sectionSource, breaks, sectionIndex);
      const position = this.opts.pageNumberPosition ?? r.pageNumberPosition;
      const showNumbers = this.opts.showPageNumbers ?? r.showPageNumbers;
      const format = r.pageNumberFormat;
      const fmt = this.opts.pageNumberFormat || ((n: number) => formatPageNumber(n, total, format, this.opts.labels.pageOf));
      const firstOfSection = i === sectionFirst;
      const skipNumber = (this.opts.skipFirstPageNumber && i === 1) || (r.differentFirstPage && firstOfSection);
      const headerText = toPdfText(htmlToPlainText(r.header));
      const footerText = toPdfText(htmlToPlainText(r.footer));
      pdf.setPage(i);
      const footerY = this.pageH - Math.max(16, this.opts.margins.bottom / 2) + 4;
      pdf.setFont(font, 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(90, 90, 90);
      const draw = (where: 'header' | 'footer', text: string, y: number) => {
        const page = fmt(shown);
        if (r.differentFirstPage && firstOfSection) return;
        const numPos = showNumbers && position.startsWith(where) && !skipNumber ? position.split('-')[1] : null;
        // same rules as the editor's page chrome: placeholders filled, and text
        // plus a centred number shows both unless the text has its own {PAGE}
        let center = text ? fillPlaceholders(text, shown, total, this.opts.pageNumberFormat ? 'decimal' : format).split('\n')[0] : '';
        if (numPos === 'center') center = center && !/\{PAGE\}/.test(text) ? `${center} ${page}` : center || page;
        if (center) pdf.text(center, this.pageW / 2, y, { align: 'center', maxWidth: this.contentWidth * 0.6 });
        if (numPos === 'left') pdf.text(page, this.left, y);
        if (numPos === 'right') pdf.text(page, this.right, y, { align: 'right' });
      };
      draw('header', headerText, headerY);
      draw('footer', footerText, footerY);
    }
  }
}

export type PdfBuildResult = { kind: 'pdf'; pdf: jsPDF; droppedSymbols: string[] } | { kind: 'unsupported-script'; chars: string[] };

/** Text the standard fonts must cover (equations are drawn by pdfMath.ts, which has its own fallbacks). */
const allModelText = (model: ExportModel) =>
  [blocksToText(model.blocks, { math: () => '' }), ...model.notes.map(n => n.content), htmlToPlainText(model.header), htmlToPlainText(model.footer)].join('\n');

/** Builds the PDF (or reports that the text needs the print fallback). */
export const buildPdf = async (doc: DocumentData, labels: { endnotes?: string; pageOf?: string } = {}): Promise<PdfBuildResult> => {
  const model = buildExportModel(doc);
  const bad = unsupportedPdfChars(allModelText(model));
  if (bad.script.length) return { kind: 'unsupported-script', chars: bad.script };
  const droppedSymbols = bad.symbols;
  const images = await resolveImages(model.blocks);
  // UI-language labels the standard fonts can't draw (e.g. Cyrillic) fall back to English
  const pdfLabel = (label: string | undefined, fallback: string) => (label && !unsupportedPdfChars(label).script.length ? toPdfText(label) : fallback);
  const endnotesLabel = pdfLabel(labels.endnotes, 'Endnotes');
  const pageOfLabel = pdfLabel(labels.pageOf, 'Page {PAGE} of {PAGES}');

  if (model.isScreenplay) {
    // Industry layout: US Letter, Courier 12, 1.5" left and 1" other margins,
    // single spacing, page numbers "n." (none on page 1).
    const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true });
    const writer = new PdfWriter(pdf, model, images, {
      margins: { top: 72, right: 72, bottom: 72, left: 108 },
      forceLineHeight: 1,
      labels: { endnotes: endnotesLabel },
      pageNumberFormat: n => `${n}.`,
      showPageNumbers: true,
      pageNumberPosition: 'header-right',
      skipFirstPageNumber: true,
    });
    writer.blocks(model.blocks);
    writer.endnotes();
    writer.drawFootnotes();
    writer.headersAndFooters();
    return { kind: 'pdf', pdf, droppedSymbols };
  }

  const { page } = model;
  const pdf = new jsPDF({
    unit: 'pt',
    format: [page.landscape ? page.heightPt : page.widthPt, page.landscape ? page.widthPt : page.heightPt],
    orientation: page.landscape ? 'landscape' : 'portrait',
    compress: true,
  });
  pdf.setProperties({ title: model.title, creator: 'Penko Writer' });
  const m = page.marginPt;
  const writer = new PdfWriter(pdf, model, images, { margins: { top: m, right: m, bottom: m, left: m }, labels: { endnotes: endnotesLabel, pageOf: pageOfLabel } });
  writer.blocks(model.blocks);
  writer.endnotes();
  writer.drawFootnotes();
  writer.headersAndFooters();
  return { kind: 'pdf', pdf, droppedSymbols };
};
