/**
 * Small, real RTF reader: tokenizes control words / groups and produces HTML.
 *
 * Supported: paragraphs (\par, \pard) with alignment (\ql \qc \qr \qj) and
 * indents (\li \fi), line breaks (\line), tabs, page breaks, bold / italic /
 * underline / strike / super / sub, font size (\fs), font family (\f via
 * the font table), colours (\cf, \cb, \highlight via the colour table),
 * \'hh escapes decoded with the document / font code page, \uN unicode with
 * \ucN fallback skipping, simple tables (\trowd \intbl \cell \row), footnotes
 * and PNG / JPEG pictures. Destinations that aren't text (font table,
 * stylesheet, info, headers, fields instructions, \* destinations …) are skipped.
 */
import { escapeHtml } from '../editor/sanitize';
import { bytesToBase64 } from './base64';

interface CharFmt {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  sup: boolean;
  sub: boolean;
  fontSize: number; // half-points, 0 = default
  font: number; // -1 = default
  color: number; // 0 = auto
  bg: number; // 0 = none
}

interface ParaFmt {
  align: '' | 'left' | 'center' | 'right' | 'justify';
  leftIndent: number; // twips
  firstIndent: number; // twips
  inTable: boolean;
  style: number; // \sN paragraph style, -1 = none
}

interface State {
  chr: CharFmt;
  para: ParaFmt;
  /** destination this group writes to */
  dest: 'text' | 'skip' | 'fonttbl' | 'colortbl' | 'stylesheet' | 'pict' | 'footnote';
  uc: number;
  codepage: number;
}

interface Run {
  text: string;
  fmt: CharFmt;
  /** pre-built HTML (images, footnote references) */
  html?: string;
}

const DEFAULT_CHR: CharFmt = { bold: false, italic: false, underline: false, strike: false, sup: false, sub: false, fontSize: 0, font: -1, color: 0, bg: 0 };
const DEFAULT_PARA: ParaFmt = { align: '', leftIndent: 0, firstIndent: 0, inTable: false, style: -1 };

const SKIP_DESTINATIONS = new Set([
  'info', 'header', 'headerl', 'headerr', 'headerf', 'footer', 'footerl', 'footerr', 'footerf', 'fldinst',
  'themedata', 'colorschememapping', 'latentstyles', 'datastore', 'xmlnstbl', 'listtable', 'listoverridetable', 'rsidtbl',
  'generator', 'pgdsctbl', 'objdata', 'bkmkstart', 'bkmkend', 'filetbl', 'revtbl', 'fonttbl_alt', 'object', 'nonshppict',
  'shp', 'shpinst', 'sp', 'sn', 'sv', 'xe', 'tc', 'template', 'author', 'operator', 'title', 'subject', 'keywords',
  'comment', 'doccomm', 'company', 'category', 'userprops', 'annotation', 'atnid', 'atnauthor', 'mmathpr', 'listpicture',
]);

const CHARSET_CODEPAGE: Record<number, number> = {
  0: 1252, 77: 10000, 128: 932, 129: 949, 130: 1361, 134: 936, 136: 950, 161: 1253, 162: 1254, 163: 1258,
  177: 1255, 178: 1256, 186: 1257, 204: 1251, 222: 874, 238: 1250,
};

const decoders = new Map<number, TextDecoder | null>();
const decodeBytes = (bytes: number[], codepage: number): string => {
  if (!decoders.has(codepage)) {
    const label = codepage === 932 ? 'shift_jis' : codepage === 936 ? 'gbk' : codepage === 949 ? 'euc-kr' : codepage === 950 ? 'big5' : codepage === 10000 ? 'macintosh' : `windows-${codepage}`;
    try {
      decoders.set(codepage, new TextDecoder(label));
    } catch {
      decoders.set(codepage, null);
    }
  }
  const dec = decoders.get(codepage) || decoders.get(1252) || null;
  if (dec) return dec.decode(new Uint8Array(bytes));
  return String.fromCharCode(...bytes);
};

export interface RtfResult {
  html: string;
}

export const parseRtf = (input: string): RtfResult => {
  const fonts: Record<number, { name: string; charset: number }> = {};
  const colors: (string | null)[] = [];
  let docCodepage = 1252;
  let defaultFont = -1;
  const styleNames: Record<number, string> = {};
  let styleNum = -1;
  let styleName = '';

  // output
  const blocks: string[] = [];
  let runs: Run[] = [];
  let paraFmt: ParaFmt = { ...DEFAULT_PARA };
  let tableRows: string[][] = [];
  let currentRow: string[] = [];
  let cellParas: string[] = [];
  let footnoteBuf: Run[] | null = null;

  // font / colour table parse state
  let fontNum = -1;
  let fontCharset = 0;
  let fontName = '';
  let colorParts: { r?: number; g?: number; b?: number } = {};
  // picture state
  let pict: { hex: string; type: string; w: number; h: number; wGoal: number; hGoal: number } | null = null;

  const stack: State[] = [];
  let st: State = { chr: { ...DEFAULT_CHR }, para: paraFmt, dest: 'text', uc: 1, codepage: 1252 };
  let pendingBytes: number[] = [];
  let skipChars = 0;
  let groupStartedDest = false; // next control word may be a destination name

  const target = (): Run[] => (st.dest === 'footnote' && footnoteBuf ? footnoteBuf : runs);

  const emit = (text: string) => {
    if (!text) return;
    if (st.dest === 'fonttbl') {
      fontName += text;
      return;
    }
    if (st.dest === 'stylesheet') {
      styleName += text;
      return;
    }
    if (st.dest !== 'text' && st.dest !== 'footnote') return;
    const list = target();
    const last = list[list.length - 1];
    if (last && !last.html && sameFmt(last.fmt, st.chr)) last.text += text;
    else list.push({ text, fmt: { ...st.chr } });
  };

  const flushBytes = () => {
    if (!pendingBytes.length) return;
    const fontCp = st.chr.font >= 0 && fonts[st.chr.font] ? CHARSET_CODEPAGE[fonts[st.chr.font].charset] : undefined;
    const text = decodeBytes(pendingBytes, fontCp && fontCp !== 1252 ? fontCp : st.codepage || docCodepage);
    pendingBytes = [];
    emit(text);
  };

  const runsToHtml = (list: Run[], heading = false) =>
    list
      .map(r => {
        if (r.html) return r.html;
        let html = escapeHtml(r.text).replace(/\n/g, '<br>');
        const f = r.fmt;
        const styles: string[] = [];
        if (f.fontSize && !heading) styles.push(`font-size: ${f.fontSize / 2}pt`);
        if (f.font >= 0 && f.font !== defaultFont && fonts[f.font]?.name) styles.push(`font-family: ${escapeHtml(fonts[f.font].name.replace(/[;"]/g, ''))}`);
        if (f.color && colors[f.color]) styles.push(`color: ${colors[f.color]}`);
        if (f.bg && colors[f.bg]) styles.push(`background-color: ${colors[f.bg]}`);
        if (styles.length) html = `<span style="${styles.join('; ')}">${html}</span>`;
        if (f.sup) html = `<sup>${html}</sup>`;
        if (f.sub) html = `<sub>${html}</sub>`;
        if (f.strike) html = `<s>${html}</s>`;
        if (f.underline) html = `<u>${html}</u>`;
        if (f.italic) html = `<em>${html}</em>`;
        if (f.bold && !heading) html = `<strong>${html}</strong>`;
        return html;
      })
      .join('');

  const headingLevel = () => {
    const name = (styleNames[paraFmt.style] || '').toLowerCase();
    const m = /^(?:heading|überschrift|titre|título|titolo)\s*(\d)/.exec(name);
    if (m) return Math.min(6, Math.max(1, parseInt(m[1], 10)));
    return name === 'title' ? 1 : 0;
  };

  const paragraphHtml = () => {
    const styles: string[] = [];
    const level = headingLevel();
    if (paraFmt.align && paraFmt.align !== 'left') styles.push(`text-align: ${paraFmt.align}`);
    if (paraFmt.leftIndent > 0) styles.push(`margin-left: ${Math.round(paraFmt.leftIndent / 20)}pt`);
    if (paraFmt.firstIndent) styles.push(`text-indent: ${Math.round(paraFmt.firstIndent / 20)}pt`);
    const inner = runsToHtml(runs, level > 0);
    const tag = level ? `h${level}` : 'p';
    return `<${tag}${styles.length ? ` style="${styles.join('; ')}"` : ''}>${inner}</${tag}>`;
  };

  const flushTable = () => {
    if (currentRow.length) {
      tableRows.push(currentRow);
      currentRow = [];
    }
    if (!tableRows.length) return;
    blocks.push(`<table><tbody>${tableRows.map(r => `<tr>${r.map(c => `<td>${c || '<p></p>'}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    tableRows = [];
  };

  const endParagraph = () => {
    flushBytes();
    if (paraFmt.inTable || st.para.inTable) {
      cellParas.push(paragraphHtml());
    } else {
      flushTable();
      blocks.push(paragraphHtml());
    }
    runs = [];
  };

  const endCell = () => {
    flushBytes();
    if (runs.length) cellParas.push(paragraphHtml());
    runs = [];
    currentRow.push(cellParas.join(''));
    cellParas = [];
  };

  const endRow = () => {
    if (runs.length || cellParas.length) endCell();
    tableRows.push(currentRow);
    currentRow = [];
  };

  const closeGroup = () => {
    flushBytes();
    const closing = st;
    const parent = stack.pop();
    if (closing.dest === 'stylesheet' && styleNum >= 0) {
      styleNames[styleNum] = styleName.replace(/;\s*$/, '').trim();
      styleNum = -1;
      styleName = '';
    }
    if (closing.dest === 'fonttbl' && fontNum >= 0 && fontName.trim()) {
      fonts[fontNum] = { name: fontName.replace(/;\s*$/, '').trim(), charset: fontCharset };
      fontNum = -1;
      fontName = '';
    }
    if (closing.dest === 'pict' && pict && (!parent || parent.dest !== 'pict')) {
      const mime = pict.type === 'png' ? 'image/png' : pict.type === 'jpeg' ? 'image/jpeg' : '';
      if (mime && pict.hex.length > 16) {
        const bytes = new Uint8Array(pict.hex.length >> 1);
        for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(pict.hex.substr(i * 2, 2), 16);
        const w = pict.wGoal ? Math.round(pict.wGoal / 15) : 0;
        const h = pict.hGoal ? Math.round(pict.hGoal / 15) : 0;
        const img = `<img src="data:${mime};base64,${bytesToBase64(bytes)}"${w ? ` width="${w}"` : ''}${h ? ` height="${h}"` : ''}>`;
        if (!(parent && parent.dest === 'footnote')) runs.push({ text: '', fmt: { ...DEFAULT_CHR }, html: img });
      }
      pict = null;
    }
    if (closing.dest === 'footnote' && (!parent || parent.dest !== 'footnote') && footnoteBuf) {
      const footnoteText = footnoteBuf.map(r => r.text).join('').replace(/\s+/g, ' ').trim();
      footnoteBuf = null;
      runs.push({ text: '', fmt: { ...DEFAULT_CHR }, html: `<sup data-type="footnote" data-note-type="footnote" data-content="${escapeHtml(footnoteText)}">*</sup>` });
    }
    if (parent) st = parent;
  };

  const len = input.length;
  let i = 0;
  while (i < len) {
    const ch = input[i];
    if (ch === '{') {
      flushBytes();
      stack.push(st);
      st = { ...st, chr: { ...st.chr }, para: st.para };
      groupStartedDest = true;
      i++;
      continue;
    }
    if (ch === '}') {
      closeGroup();
      groupStartedDest = false;
      i++;
      continue;
    }
    if (ch === '\\') {
      const next = input[i + 1];
      if (next === "'") {
        const hex = input.substr(i + 2, 2);
        i += 4;
        if (skipChars > 0) {
          skipChars--;
          continue;
        }
        if (st.dest === 'text' || st.dest === 'footnote' || st.dest === 'fonttbl' || st.dest === 'stylesheet') pendingBytes.push(parseInt(hex, 16));
        continue;
      }
      if (next === '\\' || next === '{' || next === '}') {
        flushBytes();
        if (skipChars > 0) skipChars--;
        else emit(next);
        i += 2;
        groupStartedDest = false;
        continue;
      }
      if (next === '~') { flushBytes(); emit('\u00a0'); i += 2; continue; }
      if (next === '_') { flushBytes(); emit('\u2011'); i += 2; continue; }
      if (next === '-') { i += 2; continue; }
      if (next === '*') {
        // ignorable destination: skip the whole group unless we know it
        const m = /^\\\*\\([a-zA-Z]+)/.exec(input.slice(i, i + 40));
        const known = m && (m[1] === 'footnote');
        if (!known) st.dest = 'skip';
        i += 2;
        continue;
      }
      if (next === '\n' || next === '\r') {
        endParagraph();
        i += 2;
        continue;
      }
      const m = /^\\([a-zA-Z]{1,32})(-?\d{1,10})? ?/.exec(input.slice(i, i + 48));
      if (!m) {
        i += 2;
        continue;
      }
      i += m[0].length;
      const word = m[1];
      const hasParam = m[2] !== undefined;
      const param = hasParam ? parseInt(m[2], 10) : 1;
      const isDestStart = groupStartedDest;
      groupStartedDest = false;
      if (word !== 'u') flushBytes();

      if (st.dest === 'skip') continue;
      if (st.dest === 'pict') {
        if (word === 'pngblip') pict!.type = 'png';
        else if (word === 'jpegblip') pict!.type = 'jpeg';
        else if (word === 'picwgoal') pict!.wGoal = param;
        else if (word === 'pichgoal') pict!.hGoal = param;
        else if (word === 'picw') pict!.w = param;
        else if (word === 'pich') pict!.h = param;
        continue;
      }
      if (st.dest === 'fonttbl') {
        if (word === 'f') {
          if (fontNum >= 0 && fontName.trim()) fonts[fontNum] = { name: fontName.replace(/;\s*$/, '').trim(), charset: fontCharset };
          fontNum = param;
          fontName = '';
          fontCharset = 0;
        } else if (word === 'fcharset') fontCharset = param;
        else if (word === 'panose' || word === 'falt') st.dest = 'skip';
        continue;
      }
      if (st.dest === 'stylesheet') {
        if (word === 's' && hasParam) {
          styleNum = param;
          styleName = '';
        }
        continue;
      }
      if (st.dest === 'colortbl') {
        if (word === 'red') colorParts.r = param;
        else if (word === 'green') colorParts.g = param;
        else if (word === 'blue') colorParts.b = param;
        continue;
      }

      if (isDestStart && SKIP_DESTINATIONS.has(word)) {
        st.dest = 'skip';
        continue;
      }
      switch (word) {
        case 'ansicpg': docCodepage = param; st.codepage = param; break;
        case 'deff': defaultFont = param; break;
        case 'fonttbl': st.dest = 'fonttbl'; break;
        case 'stylesheet': st.dest = 'stylesheet'; styleNum = -1; styleName = ''; break;
        case 's': paraFmt.style = param; break;
        case 'colortbl': st.dest = 'colortbl'; colorParts = {}; break;
        case 'pict': st.dest = 'pict'; pict = { hex: '', type: '', w: 0, h: 0, wGoal: 0, hGoal: 0 }; break;
        case 'footnote':
          st.dest = 'footnote';
          footnoteBuf = [];
          break;
        case 'uc': st.uc = param; break;
        case 'u': {
          flushBytes();
          const code = param < 0 ? param + 65536 : param;
          emit(String.fromCharCode(code));
          skipChars = st.uc;
          break;
        }
        case 'par': endParagraph(); break;
        case 'sect': endParagraph(); break;
        case 'line': emit('\n'); break;
        case 'tab': emit('\t'); break;
        case 'page':
          endParagraph();
          flushTable();
          blocks.push('<div data-type="page-break"></div>');
          break;
        case 'emdash': emit('\u2014'); break;
        case 'endash': emit('\u2013'); break;
        case 'bullet': emit('\u2022'); break;
        case 'lquote': emit('\u2018'); break;
        case 'rquote': emit('\u2019'); break;
        case 'ldblquote': emit('\u201c'); break;
        case 'rdblquote': emit('\u201d'); break;
        case 'pard':
          paraFmt = { ...DEFAULT_PARA };
          st.para = paraFmt;
          break;
        case 'plain': st.chr = { ...DEFAULT_CHR }; break;
        case 'ql': paraFmt.align = 'left'; break;
        case 'qc': paraFmt.align = 'center'; break;
        case 'qr': paraFmt.align = 'right'; break;
        case 'qj': paraFmt.align = 'justify'; break;
        case 'li': paraFmt.leftIndent = param; break;
        case 'fi': paraFmt.firstIndent = param; break;
        case 'intbl': paraFmt.inTable = true; break;
        case 'cell': endCell(); break;
        case 'row': endRow(); break;
        case 'b': st.chr.bold = !hasParam || param !== 0; break;
        case 'i': st.chr.italic = !hasParam || param !== 0; break;
        case 'ul': case 'uld': case 'uldb': case 'ulw': st.chr.underline = !hasParam || param !== 0; break;
        case 'ulnone': st.chr.underline = false; break;
        case 'strike': case 'striked': st.chr.strike = !hasParam || param !== 0; break;
        case 'super': st.chr.sup = true; st.chr.sub = false; break;
        case 'sub': st.chr.sub = true; st.chr.sup = false; break;
        case 'nosupersub': st.chr.sup = false; st.chr.sub = false; break;
        case 'fs': st.chr.fontSize = param; break;
        case 'f': st.chr.font = param; break;
        case 'cf': st.chr.color = param; break;
        case 'cb': case 'highlight': case 'chcbpat': st.chr.bg = param; break;
        default:
          break;
      }
      continue;
    }
    // plain text
    if (ch === '\r' || ch === '\n') {
      i++;
      continue;
    }
    if (st.dest === 'pict') {
      // picture data: take the whole hex run at once (images can be megabytes)
      let j = i;
      while (j < len && !'\\{}'.includes(input[j])) j++;
      pict!.hex += input.slice(i, j).replace(/[^0-9a-fA-F]/g, '');
      i = j;
      continue;
    }
    if (st.dest === 'colortbl') {
      if (ch === ';') {
        const { r, g, b } = colorParts;
        colors.push(r === undefined && g === undefined && b === undefined ? null : `#${[r || 0, g || 0, b || 0].map(n => n.toString(16).padStart(2, '0')).join('')}`);
        colorParts = {};
      }
      i++;
      continue;
    }
    // gather a run of plain characters
    let j = i;
    while (j < len && !'\\{}\r\n'.includes(input[j])) j++;
    let chunk = input.slice(i, j);
    i = j;
    groupStartedDest = false;
    flushBytes();
    if (skipChars > 0) {
      const n = Math.min(skipChars, chunk.length);
      chunk = chunk.slice(n);
      skipChars -= n;
    }
    emit(chunk);
  }
  flushBytes();
  if (runs.length) endParagraph();
  flushTable();

  const html = blocks.join('');
  return { html: html || '<p></p>' };
};

const sameFmt = (a: CharFmt, b: CharFmt) =>
  a.bold === b.bold && a.italic === b.italic && a.underline === b.underline && a.strike === b.strike && a.sup === b.sup && a.sub === b.sub &&
  a.fontSize === b.fontSize && a.font === b.font && a.color === b.color && a.bg === b.bg;
