import type { Node as PMNode } from '@tiptap/pm/model';
import { escapeHtml } from './sanitize';

export type TocStyle = 'default' | 'minimal' | 'numbered';

export interface TocEntry {
  level: number;
  text: string;
  id: string;
}

export const collectHeadings = (doc: PMNode, levels: number[] = [1, 2, 3]): TocEntry[] => {
  const entries: TocEntry[] = [];
  doc.descendants(node => {
    if (node.type.name === 'heading' && levels.includes(node.attrs.level)) {
      const text = node.textContent.trim();
      if (text) entries.push({ level: node.attrs.level, text, id: node.attrs.id || '' });
    }
    // TOC nodes never contain headings; skip into everything else
    return node.type.name !== 'tableOfContents';
  });
  return entries;
};

export const tocContainerStyle = (style: TocStyle): string => {
  if (style === 'default') return 'border: 2px solid #e5e7eb; padding: 20px; margin: 20px 0; border-radius: 8px; background: #f9fafb; color: #111827;';
  if (style === 'minimal') return 'border-left: 3px solid #3b82f6; padding-left: 20px; margin: 20px 0;';
  return 'padding: 20px; margin: 20px 0;';
};

/** Static HTML for a TOC (used for export/print and the dialog preview). */
export const buildTocInnerHtml = (entries: TocEntry[], style: TocStyle, title: string, emptyText: string): string => {
  let html = `<h2 style="margin-top: 0; font-size: 1.5em; font-weight: bold; margin-bottom: 16px;">${escapeHtml(title)}</h2>`;
  if (entries.length === 0) return `${html}<p><em>${escapeHtml(emptyText)}</em></p>`;
  const listTag = style === 'numbered' ? 'ol' : 'ul';
  const listStyle = style === 'numbered' ? 'list-style: decimal; padding-left: 20px;' : 'list-style: none; padding: 0;';
  html += `<${listTag} style="${listStyle}">`;
  entries.forEach(entry => {
    const indent = (entry.level - 1) * 20;
    html += `<li style="margin: 8px 0; padding-left: ${indent}px;"><a href="#${escapeHtml(entry.id)}" style="color: #3b82f6; text-decoration: none;">${escapeHtml(entry.text)}</a></li>`;
  });
  html += `</${listTag}>`;
  return html;
};
