import { PAGE_MARGINS, PAGE_SIZES } from '../constants';

/** Converts a CSS length in mm / cm / in / px to millimetres. */
export const lengthToMm = (value: string): number => {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return 0;
  if (/cm$/.test(value)) return n * 10;
  if (/in$/.test(value)) return n * 25.4;
  if (/px$/.test(value)) return (n * 25.4) / 96;
  return n; // mm
};

/** Page geometry used by the ruler (all in millimetres, unscaled). */
export const rulerGeometry = (pageConfig?: { size?: 'A4' | 'Letter'; orientation?: 'portrait' | 'landscape'; margins?: keyof typeof PAGE_MARGINS }) => {
  const size = PAGE_SIZES[pageConfig?.size || 'A4'] || PAGE_SIZES.A4;
  const landscape = pageConfig?.orientation === 'landscape';
  const widthMm = lengthToMm(landscape ? size.height : size.width);
  const marginMm = lengthToMm(PAGE_MARGINS[pageConfig?.margins || 'normal'] ?? PAGE_MARGINS.normal);
  const contentMm = Math.max(0, widthMm - marginMm * 2);
  return { widthMm, marginMm, contentMm, ticks: Math.ceil(contentMm / 10) };
};

/**
 * Options for a toolbar <select> that must always be able to show the current
 * value (e.g. a font that is not in the list, or a 10.5pt size).
 */
export const fontOptionsWith = (fonts: string[], current: string): { options: string[]; value: string } => {
  const match = fonts.find(f => f.toLowerCase() === current.toLowerCase());
  return match ? { options: fonts, value: match } : { options: [current, ...fonts], value: current };
};

export const sizeOptionsWith = (sizes: string[], current: string): string[] =>
  sizes.includes(current) ? sizes : [...sizes, current].sort((a, b) => parseFloat(a) - parseFloat(b));

export const LINE_SPACINGS = ['1.0', '1.15', '1.5', '2.0', '2.5', '3.0'];

/** Reads the line-height from a block's inline style and maps it onto a select option. */
export const lineSpacingFromStyle = (style: string | null | undefined): string | null => {
  const m = /(?:^|;)\s*line-height\s*:\s*([^;]+)/i.exec(style || '');
  if (!m) return null;
  const raw = m[1].trim();
  return LINE_SPACINGS.find(v => parseFloat(v) === parseFloat(raw)) || raw;
};
