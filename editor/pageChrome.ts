import { DocumentData } from '../types';
import { sanitizeHtml, escapeHtml } from './sanitize';

/** Headers, footers and page numbers for the paginated layout (and print). */

export type PageNumberFormat = 'decimal' | 'roman' | 'page-of';

const toRoman = (n: number) => {
  const map: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let out = '';
  for (const [v, s] of map) while (n >= v) {
    out += s;
    n -= v;
  }
  return out;
};

export const formatPageNumber = (page: number, total: number, format: PageNumberFormat = 'decimal', pageOfLabel = 'Page {PAGE} of {PAGES}') => {
  if (format === 'roman') return toRoman(page);
  if (format === 'page-of') return pageOfLabel.replace('{PAGE}', String(page)).replace('{PAGES}', String(total));
  return String(page);
};

/** Replace {PAGE} / {PAGES} placeholders in (sanitized) header/footer HTML. */
export const fillPlaceholders = (html: string, page: number, total: number, format: PageNumberFormat = 'decimal') =>
  html.replace(/\{PAGE\}/g, escapeHtml(formatPageNumber(page, total, format === 'page-of' ? 'decimal' : format))).replace(/\{PAGES\}/g, String(total));

export interface ChromeOptions {
  pageOfLabel?: string;
  /** Number shown for this page (sections can restart numbering). Defaults to `page`. */
  displayPage?: number;
  /** Is this the first page of its section? Defaults to `page === 1`. */
  firstOfSection?: boolean;
}

/**
 * HTML for a header or footer zone on a given page, or '' when that page has
 * none (e.g. the first page with "different first page" on).
 * Layout mirrors the original header band: left / centre / right cells.
 */
export const zoneHtml = (doc: Pick<DocumentData, 'header' | 'footer' | 'showPageNumbers' | 'pageNumberPosition' | 'differentFirstPage' | 'pageNumberFormat'>, kind: 'header' | 'footer', page: number, total: number, opts: ChromeOptions = {}): string => {
  const firstOfSection = opts.firstOfSection ?? page === 1;
  const shown = opts.displayPage ?? page;
  if (doc.differentFirstPage && firstOfSection) return '';
  const content = sanitizeHtml((kind === 'header' ? doc.header : doc.footer) || '');
  const pos = doc.pageNumberPosition || 'footer-center';
  const numberHere = !!doc.showPageNumbers && pos.startsWith(kind);
  const format = (doc.pageNumberFormat || 'decimal') as PageNumberFormat;
  const num = numberHere ? escapeHtml(formatPageNumber(shown, total, format, opts.pageOfLabel)) : '';
  if (!content.trim() && !num) return '';
  const center = content.trim() ? fillPlaceholders(content, shown, total, format) : pos.endsWith('center') ? num : '';
  const left = pos.endsWith('left') ? num : '';
  const right = pos.endsWith('right') ? num : '';
  // Text plus a centred number: keep the number on the same line (inside the last block)
  const numberSpan = ` <span class="penko-page-number">${num}</span>`;
  const centerWithNumber =
    content.trim() && pos.endsWith('center') && num && !/\{PAGE\}/.test(content)
      ? /<\/(p|h[1-6]|div)>\s*$/.test(center)
        ? center.replace(/(<\/(?:p|h[1-6]|div)>)\s*$/, `${numberSpan}$1`)
        : `${center}${numberSpan}`
      : center;
  return `<div class="penko-zone-row penko-zone-${kind}"><div class="penko-zone-cell" style="text-align:left">${left}</div><div class="penko-zone-cell" style="text-align:center">${centerWithNumber}</div><div class="penko-zone-cell" style="text-align:right">${right}</div></div>`;
};
