/**
 * Markdown <-> HTML conversion for Penko Writer.
 *
 * - markdown -> HTML: `marked` (GitHub Flavored Markdown) plus small inline
 *   extensions for footnotes (`[^1]` / `[^1]: text`) and equations
 *   (`$x$`, `$$x$$`). The result is always sanitized.
 * - HTML -> markdown: `turndown` + `turndown-plugin-gfm`, with rules for the
 *   editor's custom nodes (footnotes, equations, citations, page breaks,
 *   highlights, code blocks, tables).
 */
import { Marked, type TokenizerAndRendererExtension } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { escapeHtml, sanitizeHtml } from '../editor/sanitize';

/* ------------------------------------------------------------------ */
/* Markdown -> HTML                                                    */
/* ------------------------------------------------------------------ */

interface FootnoteState {
  defs: Map<string, string>;
  counters: { footnote: number; endnote: number };
  numbers: Map<string, number>;
}

let fnState: FootnoteState = { defs: new Map(), counters: { footnote: 0, endnote: 0 }, numbers: new Map() };

const isEndnoteLabel = (label: string) => /^en\d+$/i.test(label);

const footnoteDef: TokenizerAndRendererExtension = {
  name: 'penkoFootnoteDef',
  level: 'block',
  start(src: string) {
    const m = src.match(/(^|\n)\[\^[^\]\s]+\]:/);
    return m ? (m.index || 0) + m[1].length : undefined;
  },
  tokenizer(src: string) {
    const m = /^\[\^([^\]\s]+)\]:[ \t]*([^\n]*(?:\n(?: {2,}|\t)[^\n]*)*)(?:\n+|$)/.exec(src);
    if (!m) return undefined;
    fnState.defs.set(m[1], m[2].replace(/\n\s+/g, ' ').trim());
    return { type: 'penkoFootnoteDef', raw: m[0] };
  },
  renderer() {
    return '';
  },
};

const footnoteRef: TokenizerAndRendererExtension = {
  name: 'penkoFootnoteRef',
  level: 'inline',
  start(src: string) {
    const i = src.indexOf('[^');
    return i >= 0 ? i : undefined;
  },
  tokenizer(src: string) {
    const m = /^\[\^([^\]\s]+)\](?!:)/.exec(src);
    if (!m) return undefined;
    return { type: 'penkoFootnoteRef', raw: m[0], label: m[1] };
  },
  renderer(token: any) {
    const label = token.label as string;
    const noteType = isEndnoteLabel(label) ? 'endnote' : 'footnote';
    let n = fnState.numbers.get(label);
    if (!n) {
      n = ++fnState.counters[noteType];
      fnState.numbers.set(label, n);
    }
    const content = fnState.defs.get(label) || '';
    return `<sup data-type="footnote" data-note-type="${noteType}" data-number="${n}" data-content="${escapeHtml(content)}">${n}</sup>`;
  },
};

const blockMath: TokenizerAndRendererExtension = {
  name: 'penkoBlockMath',
  level: 'block',
  start(src: string) {
    const m = src.match(/(^|\n)\$\$/);
    return m ? (m.index || 0) + m[1].length : undefined;
  },
  tokenizer(src: string) {
    const m = /^\$\$([\s\S]+?)\$\$[ \t]*(?:\n+|$)/.exec(src);
    if (!m) return undefined;
    return { type: 'penkoBlockMath', raw: m[0], latex: m[1].trim() };
  },
  renderer(token: any) {
    return `<p><span data-type="equation" data-display="true" data-latex="${escapeHtml(token.latex)}"></span></p>\n`;
  },
};

const inlineMath: TokenizerAndRendererExtension = {
  name: 'penkoInlineMath',
  level: 'inline',
  start(src: string) {
    const i = src.indexOf('$');
    return i >= 0 ? i : undefined;
  },
  tokenizer(src: string) {
    // $$display$$ inside a paragraph, or $inline$ (pandoc rules: no space
    // after the opening / before the closing $, closing $ not followed by a digit)
    let m = /^\$\$([^$]+?)\$\$/.exec(src);
    if (m) return { type: 'penkoInlineMath', raw: m[0], latex: m[1].trim(), display: true };
    m = /^\$(?=\S)((?:\\\$|[^$\n])+?)(?<=\S)\$(?!\d)/.exec(src);
    if (m) return { type: 'penkoInlineMath', raw: m[0], latex: m[1], display: false };
    return undefined;
  },
  renderer(token: any) {
    return `<span data-type="equation"${token.display ? ' data-display="true"' : ''} data-latex="${escapeHtml(token.latex)}"></span>`;
  },
};

const md = new Marked({ gfm: true, breaks: false, extensions: [footnoteDef, footnoteRef, blockMath, inlineMath] } as any);

/** Convert (GitHub Flavored) Markdown to sanitized HTML. */
export const markdownToHtml = (markdown: string): string => {
  if (!markdown || !markdown.trim()) return '<p></p>';
  fnState = { defs: new Map(), counters: { footnote: 0, endnote: 0 }, numbers: new Map() };
  const html = md.parse(markdown.replace(/\r\n?/g, '\n'), { async: false }) as string;
  return sanitizeHtml(html);
};

/* ------------------------------------------------------------------ */
/* HTML -> Markdown                                                    */
/* ------------------------------------------------------------------ */

/**
 * Markdown-escape plain text. Less aggressive than turndown's default: only
 * characters that would actually change meaning are escaped, so `snake_case`
 * and `2 * 3` stay readable.
 */
const escapeMarkdownText = (text: string): string => {
  let s = text
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\*/g, (_m, offset: number, str: string) => {
      const prev = str[offset - 1] || ' ';
      const next = str[offset + 1] || ' ';
      return /\s/.test(prev) && /\s/.test(next) ? '*' : '\\*';
    })
    // underscores only matter at word boundaries (intraword _ is literal in GFM)
    .replace(/_/g, (_m, offset: number, str: string) => {
      const prev = str[offset - 1] || ' ';
      const next = str[offset + 1] || ' ';
      return /[A-Za-z0-9]/.test(prev) && /[A-Za-z0-9]/.test(next) ? '_' : '\\_';
    })
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/~~/g, '\\~\\~')
    .replace(/\$/g, '\\$')
    .replace(/&(?=#?\w+;)/g, '&amp;')
    .replace(/<(?=[A-Za-z/!?])/g, '&lt;');
  // block-level markers at the start of a line
  s = s
    .replace(/^(\s*)#/gm, '$1\\#')
    .replace(/^(\s*)>/gm, '$1\\>')
    .replace(/^(\s*)([-+])(\s)/gm, '$1\\$2$3')
    .replace(/^(\s*)(\d+)\.(\s)/gm, '$1$2\\.$3')
    .replace(/^(\s*)(=+|-{3,})(\s*)$/gm, '$1\\$2$3')
    .replace(/\|/g, '\\|');
  return s;
};

const PAGE_BREAK_MD = '\n\n<div data-type="page-break" style="page-break-after: always"></div>\n\n';

const equationMarkdown = (el: HTMLElement) => {
  const latex = el.getAttribute('data-latex') || '';
  return el.getAttribute('data-display') === 'true' ? `$$${latex}$$` : `$${latex}$`;
};

let noteDefs: string[] = [];
let noteCounters = { footnote: 0, endnote: 0 };

const cellMarkdown = (service: TurndownService, cell: HTMLElement) =>
  service
    .turndown(cell.innerHTML)
    .replace(/\n+/g, '<br>')
    .replace(/(?<!\\)\|/g, '\\|')
    .trim();

const createTurndown = () => {
  const service = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    // Atom nodes (equations, page breaks) have no text; don't drop them as blank.
    blankReplacement: (_content, node: any) => {
      const type = node.getAttribute?.('data-type');
      if (type === 'equation') return equationMarkdown(node);
      if (type === 'page-break') return PAGE_BREAK_MD;
      return node.isBlock ? '\n\n' : '';
    },
  });
  (service as any).escape = escapeMarkdownText;
  service.use(gfm);

  // Named "Title" paragraphs read as the document's top heading
  service.addRule('penkoTitle', {
    filter: node => node.nodeName === 'P' && (node as HTMLElement).getAttribute('data-style') === 'title',
    replacement: content => (content.trim() ? `\n\n# ${content.trim()}\n\n` : ''),
  });

  service.addRule('penkoHighlight', {
    filter: 'mark',
    replacement: content => (content ? `<mark>${content}</mark>` : ''),
  });

  service.addRule('penkoUnderline', {
    filter: ['u', 'ins'] as any,
    replacement: (content, node) =>
      content && !(node as HTMLElement).classList?.contains('track-insert') ? `<u>${content}</u>` : content,
  });

  service.addRule('penkoSubSup', {
    filter: ['sub', 'sup'] as any,
    replacement: (content, node) => (content ? `<${node.nodeName.toLowerCase()}>${content}</${node.nodeName.toLowerCase()}>` : ''),
  });

  service.addRule('penkoKbd', {
    filter: 'kbd' as any,
    replacement: content => (content ? `<kbd>${content}</kbd>` : ''),
  });

  service.addRule('penkoStrike', {
    filter: ['del', 's', 'strike'] as any,
    replacement: content => (content.trim() ? `~~${content}~~` : content),
  });

  service.addRule('penkoFencedCode', {
    filter: node => node.nodeName === 'PRE',
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const code = el.querySelector('code');
      const cls = `${code?.className || ''} ${el.className || ''}`;
      let lang = el.getAttribute('data-language') || (cls.match(/language-([\w+#-]+)/) || [])[1] || '';
      if (lang === 'plaintext' || lang === 'text') lang = '';
      const text = (code || el).textContent || '';
      const longest = Math.max(2, ...(text.match(/`+/g) || []).map(s => s.length));
      const fence = '`'.repeat(longest + 1);
      return `\n\n${fence}${lang}\n${text.replace(/\n$/, '')}\n${fence}\n\n`;
    },
  });

  service.addRule('penkoTable', {
    filter: 'table',
    replacement: (_content, node) => {
      const table = node as HTMLTableElement;
      const rows = Array.from(table.rows);
      if (!rows.length) return '';
      const hasSpans = table.querySelector('[colspan]:not([colspan="1"]),[rowspan]:not([rowspan="1"])');
      if (hasSpans) return `\n\n${table.outerHTML}\n\n`;
      const cols = Math.max(...rows.map(r => r.cells.length));
      const toLine = (cells: string[]) => `| ${Array.from({ length: cols }, (_, i) => cells[i] ?? '').join(' | ')} |`;
      const lines: string[] = [];
      rows.forEach((row, i) => {
        lines.push(toLine(Array.from(row.cells).map(c => cellMarkdown(service, c as HTMLElement))));
        if (i === 0) lines.push(toLine(Array.from({ length: cols }, () => '---')));
      });
      return `\n\n${lines.join('\n')}\n\n`;
    },
  });

  service.addRule('penkoFootnote', {
    filter: node => node.nodeName === 'SUP' && (node as HTMLElement).getAttribute('data-type') === 'footnote',
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const kind = el.getAttribute('data-note-type') === 'endnote' ? 'endnote' : 'footnote';
      const n = ++noteCounters[kind];
      const label = kind === 'endnote' ? `en${n}` : String(n);
      noteDefs.push(`[^${label}]: ${(el.getAttribute('data-content') || '').replace(/\s+/g, ' ').trim()}`);
      return `[^${label}]`;
    },
  });

  service.addRule('penkoEquation', {
    filter: node => (node as HTMLElement).getAttribute?.('data-type') === 'equation',
    replacement: (_content, node) => equationMarkdown(node as HTMLElement),
  });

  service.addRule('penkoCitation', {
    filter: node => (node as HTMLElement).getAttribute?.('data-type') === 'citation',
    replacement: (_content, node) => escapeMarkdownText(node.textContent || ''),
  });

  service.addRule('penkoPageBreak', {
    filter: node => (node as HTMLElement).getAttribute?.('data-type') === 'page-break',
    replacement: () => PAGE_BREAK_MD,
  });

  // Tiptap's resize wrappers or empty spans should never leave artefacts
  service.addRule('penkoImage', {
    filter: 'img',
    replacement: (_content, node) => {
      const el = node as HTMLImageElement;
      const src = el.getAttribute('src') || '';
      if (!src) return '';
      const alt = (el.getAttribute('alt') || '').replace(/[[\]]/g, '');
      const title = el.getAttribute('title');
      return `![${alt}](${src.replace(/\)/g, '%29').replace(/ /g, '%20')}${title ? ` "${title.replace(/"/g, '\\"')}"` : ''})`;
    },
  });

  return service;
};

let turndownInstance: TurndownService | null = null;

/** Convert editor HTML to GitHub Flavored Markdown. */
export const htmlToMarkdown = (html: string): string => {
  if (!html || !html.trim()) return '';
  if (!turndownInstance) turndownInstance = createTurndown();
  noteDefs = [];
  noteCounters = { footnote: 0, endnote: 0 };
  // Tiptap wraps list item content in <p>; unwrap so lists stay tight.
  let body = html;
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    doc.body.querySelectorAll('li > p:only-child, th > p:only-child, td > p:only-child').forEach(p => {
      while (p.firstChild) p.parentNode!.insertBefore(p.firstChild, p);
      p.remove();
    });
    body = doc.body.innerHTML;
  }
  let out = turndownInstance.turndown(body);
  if (noteDefs.length) out += `\n\n${noteDefs.join('\n')}`;
  return out.replace(/\n{3,}/g, '\n\n').trim() + '\n';
};

/** True when the HTML contains nothing a user would call content. */
export const isHtmlEmpty = (html: string): boolean => !html || !html.replace(/<(p|br)\s*\/?>|<\/p>/gi, '').trim();
