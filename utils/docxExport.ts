/**
 * DOCX export built on the `docx` library from the format-neutral export
 * model (see exportModel.ts). Supports headings, paragraph alignment /
 * indent / spacing / line height, rich runs, links, nested lists, tables
 * (header rows, col/row spans, shading), embedded images, blockquotes, code
 * blocks, horizontal rules, page breaks, real Word footnotes (endnotes are
 * listed at the end), screenplay layout, page size / orientation / margins,
 * header / footer and page numbers.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  FootnoteReferenceRun,
  Header,
  HeadingLevel,
  ImageRun,
  ImportedXmlComponent,
  LevelFormat,
  LineRuleType,
  NumberFormat,
  Packer,
  PageBreak,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  UnderlineType,
  WidthType,
  type IBordersOptions,
  type ParagraphChild,
} from 'docx';
import type { DocumentData, ScreenplayElementType } from '../types';
import { SCREENPLAY_STYLE_NAMES } from './screenplayFormatter';
import { wordStyleIds } from './paragraphStyles';
import { buildDocxStyles } from './docxStyles';
import {
  buildExportModel,
  imageDisplaySize,
  resolveImages,
  runsToText,
  type Block,
  type ExportModel,
  type ParaBlock,
  type ResolvedImage,
  type Run,
  type RunStyle,
  type TableBlock,
  htmlToBlocks,
} from './exportModel';
import { resolveSection, sectionOrientations, type SectionSettings } from '../editor/extensions/sections';
import { latexToOmml } from './latexLite';

const PT_TO_TWIP = 20;
const twip = (pt: number) => Math.round(pt * PT_TO_TWIP);

const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

const LIST_INDENT_PT = 24;

const FONT_MAP: Record<string, string> = {
  'sans-serif': 'Arial',
  serif: 'Times New Roman',
  monospace: 'Courier New',
  courier: 'Courier New',
  'source code pro': 'Consolas',
};

const mapFont = (font?: string) => (font ? FONT_MAP[font.toLowerCase()] || font : undefined);

interface Ctx {
  model: ExportModel;
  images: Map<string, ResolvedImage>;
  footnotes: Record<number, { children: Paragraph[] }>;
  nextFootnoteId: number;
  contentWidthPt: number;
  /** ordered list id -> numbering reference (for custom start values) */
  numberingRefs: Map<number, string>;
  numberingConfigs: any[];
  /** named style id -> Word style id */
  styleIds: Map<string, string>;
}

const runProps = (style: RunStyle, ctx: Ctx, rtl = false) => ({
  rightToLeft: rtl || undefined,
  bold: style.bold || undefined,
  italics: style.italic || undefined,
  underline: style.underline ? { type: UnderlineType.SINGLE } : undefined,
  strike: style.strike || undefined,
  subScript: style.sub || undefined,
  superScript: style.sup || undefined,
  color: style.color || undefined,
  shading: style.highlight ? { type: ShadingType.CLEAR, fill: style.highlight, color: 'auto' } : undefined,
  size: style.sizePt && style.sizePt !== ctx.model.baseSizePt ? Math.round(style.sizePt * 2) : undefined,
  font: mapFont(style.font),
});

const textRun = (text: string, style: RunStyle, ctx: Ctx, rtl = false) => new TextRun({ text, ...runProps(style, ctx, rtl) });

const imageRun = (run: Extract<Run, { type: 'image' }>, ctx: Ctx, maxWidthPt: number): ParagraphChild | null => {
  const img = ctx.images.get(run.src);
  if (!img) return run.alt ? new TextRun({ text: `[${run.alt}]`, italics: true }) : null;
  const { w, h } = imageDisplaySize(run, img, maxWidthPt);
  // docx transformation is in pixels (96 dpi)
  return new ImageRun({
    type: img.type,
    data: img.data,
    transformation: { width: Math.round(w / 0.75), height: Math.round(h / 0.75) },
    altText: run.alt ? { name: run.alt.slice(0, 60), description: run.alt, title: run.alt.slice(0, 60) } : undefined,
  } as any);
};

const convertRuns = (runs: Run[], ctx: Ctx, maxWidthPt: number, opts: { pageField?: boolean; rtl?: boolean } = {}): ParagraphChild[] => {
  const rtl = !!opts.rtl;
  const out: ParagraphChild[] = [];
  // group consecutive runs sharing the same link into one hyperlink
  let linkGroup: { url: string; children: TextRun[] } | null = null;
  const flushLink = () => {
    if (linkGroup) out.push(new ExternalHyperlink({ link: linkGroup.url, children: linkGroup.children }));
    linkGroup = null;
  };
  for (const run of runs) {
    if (run.type === 'text') {
      if (opts.pageField && /\{PAGES?\}/.test(run.text)) {
        flushLink();
        run.text.split(/(\{PAGES?\})/).forEach(part => {
          if (part === '{PAGE}') out.push(new TextRun({ children: [PageNumber.CURRENT], ...runProps(run.style, ctx) }));
          else if (part === '{PAGES}') out.push(new TextRun({ children: [PageNumber.TOTAL_PAGES], ...runProps(run.style, ctx) }));
          else if (part) out.push(textRun(part, run.style, ctx));
        });
        continue;
      }
      if (run.style.link) {
        if (linkGroup && linkGroup.url !== run.style.link) flushLink();
        if (!linkGroup) linkGroup = { url: run.style.link, children: [] };
        linkGroup.children.push(textRun(run.text, run.style, ctx, rtl));
        continue;
      }
      flushLink();
      out.push(textRun(run.text, run.style, ctx, rtl));
    } else if (run.type === 'break') {
      flushLink();
      out.push(new TextRun({ break: 1 }));
    } else if (run.type === 'tab') {
      flushLink();
      out.push(new TextRun({ text: '\t' }));
    } else if (run.type === 'image') {
      flushLink();
      const r = imageRun(run, ctx, maxWidthPt);
      if (r) out.push(r);
    } else if (run.type === 'math') {
      flushLink();
      // real Word math (OMML): Word edits it with its equation editor, LibreOffice imports it as a formula
      const math = (ImportedXmlComponent.fromXmlString(latexToOmml(run.latex, run.display)) as unknown as { root?: unknown[] }).root?.[0];
      if (math) out.push(math as unknown as ParagraphChild);
    } else if (run.type === 'note') {
      flushLink();
      if (run.noteType === 'footnote') {
        const id = ctx.nextFootnoteId++;
        ctx.footnotes[id] = { children: [new Paragraph({ children: [new TextRun({ text: run.content || ' ', size: 18 })] })] };
        out.push(new FootnoteReferenceRun(id));
      } else {
        out.push(new TextRun({ text: run.label, superScript: true, ...(run.style.color ? { color: run.style.color } : {}) }));
      }
    }
  }
  flushLink();
  return out;
};

const numberingFor = (block: ParaBlock, ctx: Ctx) => {
  const list = block.list!;
  if (!list.ordered) return { reference: 'penko-bullets', level: Math.min(list.level, 8), instance: list.listId };
  if (list.start !== 1) {
    let ref = ctx.numberingRefs.get(list.listId);
    if (!ref) {
      ref = `penko-numbers-${list.listId}`;
      ctx.numberingRefs.set(list.listId, ref);
      ctx.numberingConfigs.push({ reference: ref, levels: numberLevels(list.start, list.level) });
    }
    return { reference: ref, level: Math.min(list.level, 8) };
  }
  return { reference: 'penko-numbers', level: Math.min(list.level, 8), instance: list.listId };
};

/**
 * Named paragraph styles, so Word users see "Code" / "Quote" / screenplay
 * elements in the style gallery and our DOCX import maps them back.
 */
const styleId = (name: string) => name.replace(/ /g, '');

/** Title / Subtitle / custom styles (built-in headings use `heading`, Normal is the default). */
const namedStyleId = (block: ParaBlock, ctx: Ctx) =>
  block.styleId && !/^(normal|heading[1-6]|quote|code)$/.test(block.styleId) ? ctx.styleIds.get(block.styleId) : undefined;

const paragraphStyleId = (block: ParaBlock, ctx: Ctx) => {
  if (block.code) return 'Code';
  const screenplay = block.screenplay && SCREENPLAY_STYLE_NAMES[block.screenplay as ScreenplayElementType];
  if (screenplay) return styleId(screenplay);
  const named = namedStyleId(block, ctx);
  if (named) return named;
  if (block.heading) return undefined;
  return block.quote && !block.list ? 'Quote' : undefined;
};

const PARAGRAPH_STYLES = [
  { id: 'Code', name: 'Code', basedOn: 'Normal', run: { font: 'Courier New' } },
  { id: 'Quote', name: 'Quote', basedOn: 'Normal', run: { italics: true, color: '4B5563' } },
  ...Object.values(SCREENPLAY_STYLE_NAMES).map(name => ({ id: styleId(name), name, basedOn: 'Normal', run: { font: 'Courier New' } })),
];

/** A code block becomes one "Code" paragraph per line (how Word and mammoth expect it). */
const splitCodeLines = (block: ParaBlock): ParaBlock[] => {
  const lines: Run[][] = [[]];
  block.runs.forEach(r => (r.type === 'break' ? lines.push([]) : lines[lines.length - 1].push(r)));
  if (lines.length === 1) return [block];
  return lines.map((runs, i) => ({
    ...block,
    runs,
    spaceBeforePt: i === 0 ? block.spaceBeforePt : undefined,
    spaceAfterPt: i === lines.length - 1 ? block.spaceAfterPt : undefined,
  }));
};

const convertPara = (block: ParaBlock, ctx: Ctx, widthPt: number): Paragraph => {
  const listIndent = block.list ? (block.list.level + 1) * LIST_INDENT_PT : 0;
  const left = block.indentPt + listIndent;
  const maxWidth = Math.max(36, (block.maxWidthPt ? Math.min(block.maxWidthPt, widthPt - left) : widthPt - left - (block.rightIndentPt || 0)));
  const right = block.maxWidthPt ? Math.max(0, widthPt - left - block.maxWidthPt) : block.rightIndentPt || 0;
  const children = convertRuns(block.runs, ctx, maxWidth, { rtl: block.rtl });
  const lh = block.lineHeight ?? ctx.model.baseLineHeight;
  const quoteBorder: IBordersOptions | undefined = block.quote ? { left: { style: BorderStyle.SINGLE, size: 18, color: 'D1D5DB', space: 8 } } : undefined;
  return new Paragraph({
    children,
    heading: block.heading && !namedStyleId(block, ctx) ? HEADINGS[block.heading - 1] : undefined,
    style: paragraphStyleId(block, ctx),
    bidirectional: block.rtl || undefined,
    // in a right-to-left paragraph Word reads left/right as start/end
    alignment: block.align ? (block.rtl && block.align === 'right' ? AlignmentType.START : block.rtl && block.align === 'left' ? AlignmentType.END : ALIGN[block.align]) : undefined,
    numbering: block.list && block.list.marker ? numberingFor(block, ctx) : undefined,
    indent: {
      left: left ? twip(left) : undefined,
      right: right ? twip(right) : undefined,
      firstLine: block.firstLinePt && block.firstLinePt > 0 ? twip(block.firstLinePt) : undefined,
      hanging: block.list && block.list.marker ? twip(18) : block.firstLinePt && block.firstLinePt < 0 ? twip(-block.firstLinePt) : undefined,
    },
    spacing: {
      before: block.spaceBeforePt ? twip(block.spaceBeforePt) : undefined,
      after: block.spaceAfterPt ? twip(block.spaceAfterPt) : undefined,
      line: Math.round(240 * lh),
      lineRule: LineRuleType.AUTO,
    },
    shading: block.background ? { type: ShadingType.CLEAR, fill: block.background, color: 'auto' } : undefined,
    border: quoteBorder,
    keepNext: block.heading ? true : undefined,
  });
};

const cellBorders = (style: TableBlock['style']) => {
  const line = (size: number, color: string) => ({ style: BorderStyle.SINGLE, size, color });
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  if (style === 'bordered') return { top: line(12, '333333'), bottom: line(12, '333333'), left: line(12, '333333'), right: line(12, '333333') };
  if (style === 'minimal') return { top: none, left: none, right: none, bottom: line(4, 'DDDDDD') };
  return { top: line(4, 'CCCCCC'), bottom: line(4, 'CCCCCC'), left: line(4, 'CCCCCC'), right: line(4, 'CCCCCC') };
};

const convertTable = (table: TableBlock, ctx: Ctx, widthPt: number): Table => {
  const available = Math.max(72, widthPt - table.indentPt);
  const colWidth = available / table.cols;
  const borders = cellBorders(table.style);
  const rows = table.rows.map((cells, rowIndex) => {
    const isHeaderRow = cells.length > 0 && cells.every(c => c.header);
    return new TableRow({
      tableHeader: isHeaderRow && rowIndex === 0 ? true : undefined,
      children: cells.map(cell => {
        const cellWidth = colWidth * cell.colspan;
        const striped = table.style === 'striped' && rowIndex % 2 === 1 ? 'F9F9F9' : undefined;
        const fill = cell.background || (cell.header ? 'F7F7F7' : striped);
        return new TableCell({
          children: convertBlocks(cell.blocks, ctx, cellWidth - 10),
          columnSpan: cell.colspan > 1 ? cell.colspan : undefined,
          rowSpan: cell.rowspan > 1 ? cell.rowspan : undefined,
          shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
          width: { size: twip(cellWidth), type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          borders,
        });
      }),
    });
  });
  return new Table({
    rows,
    width: { size: twip(available), type: WidthType.DXA },
    columnWidths: Array.from({ length: table.cols }, () => twip(colWidth)),
    indent: table.indentPt ? { size: twip(table.indentPt), type: WidthType.DXA } : undefined,
  });
};

const convertBlocks = (blocks: Block[], ctx: Ctx, widthPt: number): (Paragraph | Table)[] => {
  const out: (Paragraph | Table)[] = [];
  for (const b of blocks) {
    if (b.type === 'para') (b.code ? splitCodeLines(b) : [b]).forEach(p => out.push(convertPara(p, ctx, widthPt)));
    else if (b.type === 'table') {
      out.push(convertTable(b, ctx, widthPt));
      out.push(new Paragraph({ children: [], spacing: { after: 0, line: 240 } }));
    } else if (b.type === 'hr') {
      out.push(new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D1D5DB', space: 1 } }, spacing: { before: 120, after: 120 } }));
    } else if (b.type === 'pageBreak') out.push(new Paragraph({ children: [new PageBreak()] }));
  }
  // table cells / documents need at least one paragraph
  if (!out.length || out[out.length - 1] instanceof Table) out.push(new Paragraph({ children: [] }));
  return out;
};

const numberLevels = (start = 1, firstCustomLevel = -1) =>
  Array.from({ length: 9 }, (_, level) => ({
    level,
    format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level % 3],
    text: `%${level + 1}.`,
    start: level === firstCustomLevel ? start : 1,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: twip((level + 1) * LIST_INDENT_PT), hanging: twip(18) } } },
  }));

const bulletLevels = () =>
  Array.from({ length: 9 }, (_, level) => ({
    level,
    format: LevelFormat.BULLET,
    text: ['•', '◦', '▪'][level % 3],
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: twip((level + 1) * LIST_INDENT_PT), hanging: twip(18) } } },
  }));

/** Header / footer paragraph: page number at left/right via tab stops, content in the middle. */
interface NumberingOptions {
  showPageNumbers: boolean;
  pageNumberPosition: NonNullable<DocumentData['pageNumberPosition']>;
  pageNumberFormat: NonNullable<DocumentData['pageNumberFormat']>;
}

const headerFooterParagraphs = (
  blocksText: Block[],
  where: 'header' | 'footer',
  ctx: Ctx,
  widthPt: number,
  pageOfLabel = 'Page {PAGE} of {PAGES}',
  numbering: NumberingOptions = ctx.model,
): Paragraph[] => {
  const { showPageNumbers, pageNumberPosition, pageNumberFormat } = numbering;
  const pos = showPageNumbers && pageNumberPosition.startsWith(where) ? pageNumberPosition.split('-')[1] : null;
  // "Page X of Y" uses Word fields for both numbers; roman numerals are set on the section
  const pageRun = (): TextRun =>
    pageNumberFormat === 'page-of'
      ? new TextRun({
          size: 20,
          children: pageOfLabel.split(/(\{PAGES?\})/).filter(Boolean).map(part => (part === '{PAGE}' ? PageNumber.CURRENT : part === '{PAGES}' ? PageNumber.TOTAL_PAGES : part)) as any,
        })
      : new TextRun({ children: [PageNumber.CURRENT], size: 20 });
  const paras: Paragraph[] = [];
  const contentBlocks = blocksText.filter(b => b.type === 'para') as ParaBlock[];
  if (!contentBlocks.length && !pos) return [];
  const firstRuns = contentBlocks[0] ? convertRuns(contentBlocks[0].runs, ctx, widthPt, { pageField: true }) : [];
  // like the editor: text + a centred number shows both, unless the text has its own {PAGE}
  const hasPageField = contentBlocks.some(b => runsToText(b.runs).includes('{PAGE}'));
  const children: ParagraphChild[] = [];
  if (pos === 'left') children.push(pageRun());
  children.push(new TextRun({ text: '\t' }));
  if (firstRuns.length) {
    children.push(...firstRuns);
    if (pos === 'center' && !hasPageField) children.push(new TextRun({ text: ' ', size: 20 }), pageRun());
  } else if (pos === 'center') children.push(pageRun());
  children.push(new TextRun({ text: '\t' }));
  if (pos === 'right') children.push(pageRun());
  paras.push(
    new Paragraph({
      children,
      tabStops: [
        { type: TabStopType.CENTER, position: twip(widthPt / 2) },
        { type: TabStopType.RIGHT, position: twip(widthPt) },
      ],
      run: { size: 20 },
    } as any),
  );
  contentBlocks.slice(1).forEach(b => paras.push(new Paragraph({ alignment: AlignmentType.CENTER, children: convertRuns(b.runs, ctx, widthPt, { pageField: true }) })));
  return paras;
};

/** Builds the .docx file for a document. */
export const buildDocxBlob = async (doc: DocumentData, labels: { endnotes?: string; pageOf?: string } = {}): Promise<Blob> => {
  const model = buildExportModel(doc);
  const images = await resolveImages([...model.blocks, ...model.headerBlocks, ...model.footerBlocks]);
  const { page } = model;
  const contentWidthPt = page.widthPt - page.marginPt * 2;
  const ctx: Ctx = { model, images, footnotes: {}, nextFootnoteId: 1, contentWidthPt, numberingRefs: new Map(), numberingConfigs: [], styleIds: wordStyleIds(model.styles) };

  // Split the body at section breaks: each part becomes a Word section with its own header/footer/numbering
  const parts: { blocks: Block[] }[] = [{ blocks: [] }];
  const breakSettings: SectionSettings[] = [];
  for (const b of model.blocks) {
    if (b.type === 'sectionBreak') {
      breakSettings.push(b.settings);
      parts.push({ blocks: [] });
    } else parts[parts.length - 1].blocks.push(b);
  }
  // Sections can switch orientation (content width grows or shrinks by the page's height - width)
  const [portraitW, portraitH] = page.landscape ? [page.heightPt, page.widthPt] : [page.widthPt, page.heightPt];
  const orientations = sectionOrientations(page.landscape ? 'landscape' : 'portrait', breakSettings);
  const widthOf = (i: number) => {
    const landscape = orientations[i] === 'landscape';
    return landscape === page.landscape ? contentWidthPt : contentWidthPt + (landscape ? 1 : -1) * (portraitH - portraitW);
  };
  const sectionChildren = parts.map((part, i) => convertBlocks(part.blocks, ctx, widthOf(i)));
  const children = sectionChildren[sectionChildren.length - 1];

  const endnotes = model.notes.filter(n => n.noteType === 'endnote');
  if (endnotes.length) {
    children.push(new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB', space: 1 } }, spacing: { before: 240, after: 120 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: labels.endnotes || 'Endnotes', bold: true })], spacing: { after: 120 } }));
    endnotes.forEach(n =>
      children.push(new Paragraph({ children: [new TextRun({ text: n.label, superScript: true }), new TextRun({ text: ` ${n.content}`, size: 18 })] })),
    );
  }

  // Header/footer for every section (sections "linked to previous" repeat the inherited content)
  const sectionChrome = parts.map((_, i) => {
    const r = resolveSection(doc, breakSettings, i);
    const headerBlocks = i === 0 ? model.headerBlocks : r.header ? htmlToBlocks(r.header, { baseSizePt: 10 }).blocks : [];
    const footerBlocks = i === 0 ? model.footerBlocks : r.footer ? htmlToBlocks(r.footer, { baseSizePt: 10 }).blocks : [];
    return { r, headerBlocks, footerBlocks, restart: i > 0 && breakSettings[i - 1].restartNumbering ? breakSettings[i - 1].startAt : null };
  });
  const moreImages = await resolveImages(sectionChrome.slice(1).flatMap(c => [...c.headerBlocks, ...c.footerBlocks]));
  moreImages.forEach((v, k) => images.set(k, v));

  const headingStyle = (level: number) => {
    const em = [2, 1.5, 1.25, 1.1, 1, 0.9][level - 1];
    return {
      run: { size: Math.round(model.baseSizePt * em * 2), bold: true, color: '000000', font: model.baseFont },
      paragraph: { spacing: { before: twip(model.baseSizePt * em * [0.67, 0.6, 0.5, 0.5, 0.5, 0.5][level - 1]), after: twip(model.baseSizePt * em * [0.4, 0.35, 0.3, 0.25, 0.25, 0.25][level - 1]) } },
    };
  };

  // The document's named styles as real Word styles (screenplays keep the fixed set)
  const named = model.styles.length ? buildDocxStyles(model.styles, mapFont) : null;
  const document = new Document({
    title: model.title,
    creator: 'Penko Writer',
    styles: {
      default: {
        ...(named
          ? named.default
          : {
              document: {
                run: { font: model.baseFont, size: model.baseSizePt * 2 },
                paragraph: { spacing: { after: 0, line: Math.round(240 * model.baseLineHeight), lineRule: LineRuleType.AUTO } },
              },
              heading1: headingStyle(1),
              heading2: headingStyle(2),
              heading3: headingStyle(3),
              heading4: headingStyle(4),
              heading5: headingStyle(5),
              heading6: headingStyle(6),
            }),
        hyperlink: { run: { color: '2563EB', underline: { type: UnderlineType.SINGLE } } },
      },
      paragraphStyles: named ? [...named.paragraphStyles, ...PARAGRAPH_STYLES.filter(p => p.id !== 'Quote')] : PARAGRAPH_STYLES,
    },
    numbering: {
      config: [
        { reference: 'penko-bullets', levels: bulletLevels() },
        { reference: 'penko-numbers', levels: numberLevels() },
        ...ctx.numberingConfigs,
      ],
    },
    footnotes: ctx.footnotes,
    sections: sectionChrome.map((c, i) => {
      const landscape = orientations[i] === 'landscape';
      const sectionWidthPt = widthOf(i);
      const numbering: NumberingOptions = { showPageNumbers: c.r.showPageNumbers, pageNumberPosition: c.r.pageNumberPosition, pageNumberFormat: c.r.pageNumberFormat };
      const headerParas = headerFooterParagraphs(c.headerBlocks, 'header', ctx, sectionWidthPt, labels.pageOf, numbering);
      const footerParas = headerFooterParagraphs(c.footerBlocks, 'footer', ctx, sectionWidthPt, labels.pageOf, numbering);
      const firstPage = c.r.differentFirstPage;
      const pageNumbers = {
        ...(c.r.pageNumberFormat === 'roman' ? { formatType: NumberFormat.LOWER_ROMAN } : {}),
        ...(c.restart !== null ? { start: c.restart } : {}),
      };
      return {
        properties: {
          page: {
            size: { width: twip(portraitW), height: twip(portraitH), orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
            margin: {
              top: twip(page.marginPt),
              bottom: twip(page.marginPt),
              left: twip(page.marginPt),
              right: twip(page.marginPt),
              header: twip(Math.max(18, page.marginPt / 2)),
              footer: twip(Math.max(18, page.marginPt / 2)),
            },
            ...(Object.keys(pageNumbers).length ? { pageNumbers } : {}),
          },
          ...(firstPage ? { titlePage: true } : {}),
        },
        headers: headerParas.length
          ? { default: new Header({ children: headerParas }), ...(firstPage ? { first: new Header({ children: [] }) } : {}) }
          : undefined,
        footers: footerParas.length
          ? { default: new Footer({ children: footerParas }), ...(firstPage ? { first: new Footer({ children: [] }) } : {}) }
          : undefined,
        children: sectionChildren[i],
      };
    }),
  });
  return Packer.toBlob(document);
};
