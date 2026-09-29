/**
 * OpenDocument Text (content.xml) -> HTML.
 *
 * Walks the XML tree: headings (text:h + outline level), paragraphs, spans
 * with automatic / common styles (bold, italic, underline, strike, super/sub,
 * colour, background, font size / family), paragraph alignment and indent,
 * links, (nested) bullet / numbered lists, tables (with spans), images from
 * Pictures/ (as data URLs), line breaks, tabs, repeated spaces (text:s),
 * footnotes / endnotes and sections.
 */
import { escapeHtml, safeUrl } from '../editor/sanitize';

interface OdfStyle {
  family: string;
  parent?: string;
  text: Record<string, string>;
  para: Record<string, string>;
  /** defined in styles.xml (document defaults like "Text body"), not an automatic style */
  common: boolean;
}

type ListKind = Record<number, 'ol' | 'ul'>;

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

const elementChildren = (el: Element) => Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1);

const collectStyles = (doc: Document | null, styles: Map<string, OdfStyle>, lists: Map<string, ListKind>, common: boolean) => {
  if (!doc) return;
  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el.nodeName === 'style:style') {
      const name = el.getAttribute('style:name');
      if (!name) continue;
      const style: OdfStyle = { family: el.getAttribute('style:family') || '', parent: el.getAttribute('style:parent-style-name') || undefined, text: {}, para: {}, common };
      elementChildren(el).forEach(child => {
        const target = child.nodeName === 'style:text-properties' ? style.text : child.nodeName === 'style:paragraph-properties' ? style.para : null;
        if (!target) return;
        Array.from(child.attributes).forEach(a => (target[a.name] = a.value));
      });
      styles.set(name, style);
    } else if (el.nodeName === 'text:list-style') {
      const name = el.getAttribute('style:name');
      if (!name) continue;
      const kinds: ListKind = {};
      elementChildren(el).forEach(level => {
        const lvl = parseInt(level.getAttribute('text:level') || '1', 10);
        kinds[lvl] = level.nodeName === 'text:list-level-style-number' ? 'ol' : 'ul';
      });
      lists.set(name, kinds);
    }
  }
};

export interface OdtParseOptions {
  stylesXml?: string;
  /** "Pictures/abc.png" -> data URL */
  images?: Record<string, string>;
}

export const parseOdtContent = (contentXml: string, opts: OdtParseOptions = {}): string => {
  const doc = parseXml(contentXml);
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid ODT: content.xml is not well-formed XML');
  const styles = new Map<string, OdfStyle>();
  const lists = new Map<string, ListKind>();
  collectStyles(opts.stylesXml ? parseXml(opts.stylesXml) : null, styles, lists, true);
  collectStyles(doc, styles, lists, false);

  // Document-default fonts/sizes/colours from common styles are left to the editor's defaults.
  const COMMON_TEXT_KEYS = ['fo:font-weight', 'fo:font-style', 'style:text-underline-style', 'style:text-line-through-style', 'style:text-position'];
  const resolve = (name: string | null, kind: 'text' | 'para'): Record<string, string> => {
    const out: Record<string, string> = {};
    const chain: OdfStyle[] = [];
    let current = name ? styles.get(name) : undefined;
    let guard = 0;
    while (current && guard++ < 20) {
      chain.unshift(current);
      current = current.parent ? styles.get(current.parent) : undefined;
    }
    chain.forEach(s => {
      if (kind === 'para') Object.assign(out, s.para);
      else if (!s.common) Object.assign(out, s.text);
      else COMMON_TEXT_KEYS.forEach(k => s.text[k] !== undefined && (out[k] = s.text[k]));
    });
    return out;
  };

  const textCss = (props: Record<string, string>) => {
    const css: string[] = [];
    const wrap: string[] = [];
    if (/bold|[6-9]00/.test(props['fo:font-weight'] || '')) wrap.push('strong');
    if (/italic|oblique/.test(props['fo:font-style'] || '')) wrap.push('em');
    const ul = props['style:text-underline-style'];
    if (ul && ul !== 'none') wrap.push('u');
    const lt = props['style:text-line-through-style'];
    if (lt && lt !== 'none') wrap.push('s');
    const pos = props['style:text-position'] || '';
    if (/^super|^\d/.test(pos) && !/^0/.test(pos) && !/^-/.test(pos)) wrap.push('sup');
    else if (/^sub|^-/.test(pos)) wrap.push('sub');
    if (props['fo:color'] && /^#[0-9a-f]{6}$/i.test(props['fo:color'])) css.push(`color: ${props['fo:color']}`);
    const bg = props['fo:background-color'];
    if (bg && /^#[0-9a-f]{6}$/i.test(bg)) css.push(`background-color: ${bg}`);
    const size = props['fo:font-size'];
    if (size && /^[\d.]+pt$/.test(size)) css.push(`font-size: ${size}`);
    const font = props['style:font-name'] || props['fo:font-family'];
    if (font) css.push(`font-family: ${font.replace(/['";]/g, '')}`);
    return { css, wrap };
  };

  const applyText = (html: string, props: Record<string, string>, skipSize = false) => {
    if (!html) return html;
    const { css, wrap } = textCss(props);
    const cssUsed = skipSize ? css.filter(c => !c.startsWith('font-size')) : css;
    let out = cssUsed.length ? `<span style="${escapeHtml(cssUsed.join('; '))}">${html}</span>` : html;
    for (const tag of wrap.reverse()) out = `<${tag}>${out}</${tag}>`;
    return out;
  };

  const paraStyleAttr = (props: Record<string, string>) => {
    const css: string[] = [];
    const align = props['fo:text-align'];
    if (align === 'center' || align === 'justify' || align === 'right' || align === 'end') css.push(`text-align: ${align === 'end' ? 'right' : align}`);
    const ml = props['fo:margin-left'];
    if (ml && /^[\d.]+(cm|mm|in|pt)$/.test(ml) && parseFloat(ml) > 0) css.push(`margin-left: ${ml}`);
    const ti = props['fo:text-indent'];
    if (ti && /^-?[\d.]+(cm|mm|in|pt)$/.test(ti) && parseFloat(ti) !== 0) css.push(`text-indent: ${ti}`);
    return css.length ? ` style="${escapeHtml(css.join('; '))}"` : '';
  };

  const notes: { kind: string; text: string }[] = [];

  const inline = (el: Element): string => {
    let out = '';
    el.childNodes.forEach(node => {
      if (node.nodeType === 3) {
        out += escapeHtml(node.nodeValue || '');
        return;
      }
      if (node.nodeType !== 1) return;
      const child = node as Element;
      switch (child.nodeName) {
        case 'text:span':
          out += applyText(inline(child), resolve(child.getAttribute('text:style-name'), 'text'));
          break;
        case 'text:a': {
          const href = safeUrl(child.getAttribute('xlink:href') || '');
          const inner = inline(child);
          out += href ? `<a href="${escapeHtml(href)}">${inner}</a>` : inner;
          break;
        }
        case 'text:line-break':
          out += '<br>';
          break;
        case 'text:tab':
          out += '\t';
          break;
        case 'text:s': {
          const n = Math.max(1, parseInt(child.getAttribute('text:c') || '1', 10) || 1);
          out += ' '.repeat(Math.min(n, 200));
          break;
        }
        case 'text:note': {
          const kind = child.getAttribute('text:note-class') === 'endnote' ? 'endnote' : 'footnote';
          const body = Array.from(child.childNodes).find(n => n.nodeName === 'text:note-body') as Element | undefined;
          const text = (body?.textContent || '').replace(/\s+/g, ' ').trim();
          notes.push({ kind, text });
          out += `<sup data-type="footnote" data-note-type="${kind}" data-content="${escapeHtml(text)}">${notes.length}</sup>`;
          break;
        }
        case 'draw:frame':
          out += frame(child);
          break;
        case 'text:soft-page-break':
        case 'text:bookmark':
        case 'text:bookmark-start':
        case 'text:bookmark-end':
        case 'office:annotation':
        case 'office:annotation-end':
          break;
        default:
          out += inline(child);
      }
    });
    return out;
  };

  const frame = (el: Element): string => {
    const image = el.getElementsByTagName('draw:image')[0];
    if (!image) return '';
    const href = image.getAttribute('xlink:href') || '';
    const src = opts.images?.[href] || opts.images?.[href.replace(/^\.\//, '')];
    if (!src) return '';
    const toPx = (v: string | null) => {
      if (!v) return 0;
      const n = parseFloat(v);
      if (/cm$/.test(v)) return Math.round((n / 2.54) * 96);
      if (/mm$/.test(v)) return Math.round((n / 25.4) * 96);
      if (/in$/.test(v)) return Math.round(n * 96);
      if (/pt$/.test(v)) return Math.round((n / 72) * 96);
      return Math.round(n);
    };
    const w = toPx(el.getAttribute('svg:width'));
    const h = toPx(el.getAttribute('svg:height'));
    const title = el.getElementsByTagName('svg:title')[0]?.textContent || el.getAttribute('draw:name') || '';
    return `<img src="${escapeHtml(src)}"${w ? ` width="${w}"` : ''}${h ? ` height="${h}"` : ''}${title ? ` alt="${escapeHtml(title)}"` : ''}>`;
  };

  const paragraph = (el: Element, tag: string, namedStyle?: 'title' | 'subtitle'): string => {
    const styleName = el.getAttribute('text:style-name');
    // headings / Title / Subtitle keep their own look; only span-level formatting is applied inside them
    const textProps = tag === 'p' && !namedStyle ? resolve(styleName, 'text') : {};
    const paraProps = resolve(styleName, 'para');
    const content = applyText(inline(el), textProps);
    return `<${tag}${namedStyle ? ` data-style="${namedStyle}"` : ''}${paraStyleAttr(paraProps)}>${content}</${tag}>`;
  };

  const list = (el: Element, level: number, inheritedStyle: string | null): string => {
    const styleName = el.getAttribute('text:style-name') || inheritedStyle;
    const kind = (styleName && lists.get(styleName)?.[level]) || 'ul';
    let out = '';
    elementChildren(el).forEach(item => {
      if (item.nodeName !== 'text:list-item' && item.nodeName !== 'text:list-header') return;
      let inner = '';
      elementChildren(item).forEach(child => {
        if (child.nodeName === 'text:list') inner += list(child, level + 1, styleName);
        else inner += blocks(child, level, styleName);
      });
      out += `<li>${inner || '<p></p>'}</li>`;
    });
    return `<${kind}>${out}</${kind}>`;
  };

  const table = (el: Element): string => {
    const rows: string[] = [];
    const walkRows = (parent: Element, header: boolean) => {
      elementChildren(parent).forEach(child => {
        if (child.nodeName === 'table:table-header-rows') walkRows(child, true);
        else if (child.nodeName === 'table:table-rows' || child.nodeName === 'table:table-row-group') walkRows(child, header);
        else if (child.nodeName === 'table:table-row') {
          const cells = elementChildren(child)
            .filter(c => c.nodeName === 'table:table-cell')
            .map(c => {
              const cs = parseInt(c.getAttribute('table:number-columns-spanned') || '1', 10);
              const rs = parseInt(c.getAttribute('table:number-rows-spanned') || '1', 10);
              const tag = header ? 'th' : 'td';
              const inner = elementChildren(c).map(b => blocks(b, 0, null)).join('') || '<p></p>';
              return `<${tag}${cs > 1 ? ` colspan="${cs}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''}>${inner}</${tag}>`;
            });
          rows.push(`<tr>${cells.join('')}</tr>`);
        }
      });
    };
    walkRows(el, false);
    return `<table><tbody>${rows.join('')}</tbody></table>`;
  };

  const blocks = (el: Element, level = 0, listStyle: string | null = null): string => {
    switch (el.nodeName) {
      case 'text:h': {
        const lvl = Math.min(6, Math.max(1, parseInt(el.getAttribute('text:outline-level') || '1', 10) || 1));
        return paragraph(el, `h${lvl}`);
      }
      case 'text:p': {
        const name = el.getAttribute('text:style-name') || '';
        // paragraphs styled "Heading N" / "Title" without text:h
        const parentChain = [name, styles.get(name)?.parent || ''].join(' ');
        const m = /Heading_20_(\d)/.exec(parentChain);
        if (m) return paragraph(el, `h${Math.min(6, parseInt(m[1], 10))}`);
        if (/(^|\s)Title(\s|$)/.test(parentChain)) return paragraph(el, 'p', 'title');
        if (/(^|\s)Subtitle(\s|$)/.test(parentChain)) return paragraph(el, 'p', 'subtitle');
        return paragraph(el, 'p');
      }
      case 'text:list':
        return list(el, level + 1, listStyle);
      case 'table:table':
        return table(el);
      case 'text:section':
      case 'text:index-body':
      case 'text:table-of-content':
      case 'text:illustration-index':
      case 'text:alphabetical-index':
      case 'text:bibliography':
        return elementChildren(el).map(c => blocks(c, level, listStyle)).join('');
      case 'draw:frame':
        return `<p>${frame(el)}</p>`;
      case 'text:soft-page-break':
      case 'text:sequence-decls':
      case 'text:variable-decls':
      case 'text:user-field-decls':
      case 'office:forms':
      case 'text:index-title-template':
      case 'text:table-of-content-source':
        return '';
      default:
        return el.textContent?.trim() ? `<p>${inline(el)}</p>` : '';
    }
  };

  const body = doc.getElementsByTagName('office:text')[0];
  if (!body) throw new Error('Invalid ODT: no text body');
  const html = elementChildren(body)
    .map(el => blocks(el))
    .join('');
  return html || '<p></p>';
};
