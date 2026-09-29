/**
 * Word paragraph styles (styles.xml) for a document's named styles: Normal is
 * the document default, Title / Heading 1–6 use Word's built-in style ids,
 * Subtitle / Quote / custom styles are extra paragraph styles, so a DOCX
 * opened in Word shows (and can restyle) the same styles.
 */
import { AlignmentType, LineRuleType, UnderlineType, type IParagraphStyleOptions } from 'docx';
import type { ParagraphStyle } from '../types';
import { cssColorToHex } from './exportModel';
import { findStyle, wordStyleIds } from './paragraphStyles';

const twip = (pt: number) => Math.round(pt * 20);

const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED } as const;

type BaseStyle = Omit<IParagraphStyleOptions, 'id'>;

/** run + paragraph properties of one style */
export const docxStyleProps = (style: ParagraphStyle, opts: { mapFont: (f?: string) => string | undefined; color?: string; baseLineHeight?: number }): BaseStyle => {
  const color = cssColorToHex(style.color) || opts.color;
  const lh = style.lineHeight ?? 1.15;
  const spacing = {
    ...(style.spaceBefore ? { before: twip(style.spaceBefore) } : {}),
    ...(style.spaceAfter ? { after: twip(style.spaceAfter) } : {}),
    ...(opts.baseLineHeight !== undefined && Math.abs(lh - opts.baseLineHeight) < 0.001 ? {} : { line: Math.round(240 * lh), lineRule: LineRuleType.AUTO }),
  };
  return {
    run: {
      font: opts.mapFont(style.fontFamily || 'Calibri'),
      size: Math.round((style.fontSize || 11) * 2),
      bold: style.bold || undefined,
      italics: style.italic || undefined,
      underline: style.underline ? { type: UnderlineType.SINGLE } : undefined,
      color: color ? color.toUpperCase() : undefined,
    },
    paragraph: {
      alignment: style.align && style.align !== 'left' ? ALIGN[style.align] : undefined,
      spacing: Object.keys(spacing).length ? spacing : undefined,
      indent: style.indent ? { left: twip(style.indent) } : undefined,
      ...(style.kind === 'heading' ? { outlineLevel: (style.level || 1) - 1 } : {}),
    },
  };
};

export interface DocxStyleSet {
  default: Record<string, any>;
  paragraphStyles: IParagraphStyleOptions[];
}

/** styles.xml options for resolved styles (styles repeat Normal's line spacing only when different). */
export const buildDocxStyles = (styles: ParagraphStyle[], mapFont: (f?: string) => string | undefined): DocxStyleSet => {
  const ids = wordStyleIds(styles);
  const normal = findStyle(styles, 'normal')!;
  const base = normal.lineHeight ?? 1.15;
  const props = (s: ParagraphStyle, color?: string) => docxStyleProps(s, { mapFont, color, baseLineHeight: base });
  const normalProps = docxStyleProps(normal, { mapFont });
  const def: Record<string, any> = {
    document: {
      run: normalProps.run,
      paragraph: { spacing: { before: normalProps.paragraph?.spacing?.before, after: normalProps.paragraph?.spacing?.after ?? 0, line: Math.round(240 * base), lineRule: LineRuleType.AUTO } },
    },
    title: props(findStyle(styles, 'title')!),
  };
  [1, 2, 3, 4, 5, 6].forEach(level => {
    def[`heading${level}`] = props(findStyle(styles, `heading${level}`)!, '000000');
  });
  const extra = styles.filter(s => !/^(normal|title|heading[1-6]|code)$/.test(s.id));
  const paragraphStyles: IParagraphStyleOptions[] = extra.map(s => ({
    id: ids.get(s.id)!,
    name: s.id === 'quote' ? 'Quote' : s.id === 'subtitle' ? 'Subtitle' : s.name,
    basedOn: 'Normal',
    next: 'Normal',
    quickFormat: true,
    ...props(s, s.id === 'quote' ? '4B5563' : undefined),
  }));
  // Normal itself (Word shows it in the gallery; the docx defaults carry its formatting)
  paragraphStyles.unshift({ id: 'Normal', name: 'Normal', quickFormat: true, run: {}, paragraph: {} } as IParagraphStyleOptions);
  return { default: def, paragraphStyles };
};
