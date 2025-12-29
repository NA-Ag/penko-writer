/**
 * Markdown ↔ HTML Converter
 * Converts between Markdown and HTML for Penko Writer
 */

// Convert HTML to Markdown
export const htmlToMarkdown = (html: string): string => {
  let markdown = html;

  // Remove empty paragraphs and normalize whitespace
  markdown = markdown.replace(/<p><br><\/p>/g, '\n');
  markdown = markdown.replace(/<p>\s*<\/p>/g, '\n');

  // Headers (h1-h6)
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');

  // Bold
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');

  // Italic
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

  // Underline (not standard markdown, use HTML)
  markdown = markdown.replace(/<u[^>]*>(.*?)<\/u>/gi, '<u>$1</u>');

  // Strikethrough
  markdown = markdown.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~');
  markdown = markdown.replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~');
  markdown = markdown.replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~');

  // Links
  markdown = markdown.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Images
  markdown = markdown.replace(/<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, '![$2]($1)');
  markdown = markdown.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']*)["'][^>]*\/?>/gi, '![$1]($2)');
  markdown = markdown.replace(/<img[^>]*src=["']([^"']*)["'][^>]*\/?>/gi, '![]($1)');

  // Code blocks
  markdown = markdown.replace(/<pre[^>]*><code[^>]*class=["']language-([^"']*)["'][^>]*>(.*?)<\/code><\/pre>/gis, '```$1\n$2\n```\n\n');
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```\n\n');

  // Inline code
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

  // Unordered lists
  markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
    const items = content.match(/<li[^>]*>(.*?)<\/li>/gis);
    if (!items) return match;
    return items.map((item: string) => {
      const text = item.replace(/<li[^>]*>(.*?)<\/li>/is, '$1').trim();
      return `- ${text}`;
    }).join('\n') + '\n\n';
  });

  // Ordered lists
  markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
    const items = content.match(/<li[^>]*>(.*?)<\/li>/gis);
    if (!items) return match;
    return items.map((item: string, index: number) => {
      const text = item.replace(/<li[^>]*>(.*?)<\/li>/is, '$1').trim();
      return `${index + 1}. ${text}`;
    }).join('\n') + '\n\n';
  });

  // Blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (match, content) => {
    const lines = content.trim().split('\n');
    return lines.map(line => `> ${line.trim()}`).join('\n') + '\n\n';
  });

  // Horizontal rule
  markdown = markdown.replace(/<hr[^>]*\/?>/gi, '\n---\n\n');

  // Tables
  markdown = markdown.replace(/<table[^>]*>(.*?)<\/table>/gis, (match, content) => {
    const rows = content.match(/<tr[^>]*>(.*?)<\/tr>/gis);
    if (!rows || rows.length === 0) return match;

    const tableMarkdown: string[] = [];

    rows.forEach((row, rowIndex) => {
      const cells = row.match(/<t[hd][^>]*>(.*?)<\/t[hd]>/gis);
      if (!cells) return;

      const cellContents = cells.map(cell =>
        cell.replace(/<t[hd][^>]*>(.*?)<\/t[hd]>/is, '$1').trim()
      );

      tableMarkdown.push('| ' + cellContents.join(' | ') + ' |');

      // Add separator after header row
      if (rowIndex === 0) {
        tableMarkdown.push('| ' + cellContents.map(() => '---').join(' | ') + ' |');
      }
    });

    return tableMarkdown.join('\n') + '\n\n';
  });

  // Paragraphs
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n');

  // Line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, '  \n');

  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  markdown = markdown.replace(/&nbsp;/g, ' ');
  markdown = markdown.replace(/&amp;/g, '&');
  markdown = markdown.replace(/&lt;/g, '<');
  markdown = markdown.replace(/&gt;/g, '>');
  markdown = markdown.replace(/&quot;/g, '"');
  markdown = markdown.replace(/&#39;/g, "'");

  // Clean up extra newlines
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  markdown = markdown.trim();

  return markdown;
};

// Convert Markdown to HTML
export const markdownToHtml = (markdown: string): string => {
  let html = markdown;

  // Escape HTML first
  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Process code blocks first (to protect them from other transformations)
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    const langClass = lang ? ` class="language-${lang}"` : '';
    codeBlocks.push(`<pre><code${langClass}>${escapeHtml(code.trim())}</code></pre>`);
    return placeholder;
  });

  // Inline code
  const inlineCode: string[] = [];
  html = html.replace(/`([^`]+)`/g, (match, code) => {
    const placeholder = `__INLINE_CODE_${inlineCode.length}__`;
    inlineCode.push(`<code>${escapeHtml(code)}</code>`);
    return placeholder;
  });

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold (strong) - must come before italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic (em)
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');

  // Links - must come before images
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr />');
  html = html.replace(/^\*\*\*$/gm, '<hr />');

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // Unordered lists
  html = html.replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)\n(?!<li>)/g, '<ul>$1</ul>\n');
  html = html.replace(/(?<!<\/ul>)\n(<li>)/g, '\n<ul>$1');
  html = html.replace(/(<\/li>)\n(<li>)/g, '$1$2');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  // Note: This is simplified - a more robust implementation would be needed for mixed lists

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (match, content) => {
    const cells = content.split('|').map((cell: string) => cell.trim());
    const isHeaderSeparator = cells.every((cell: string) => /^-+$/.test(cell));
    if (isHeaderSeparator) return '<__TABLE_SEP__>';

    const cellTags = cells.map((cell: string) => `<td>${cell}</td>`).join('');
    return `<tr>${cellTags}</tr>`;
  });

  html = html.replace(/<tr>.*?<\/tr>\n<__TABLE_SEP__>\n/g, (match) => {
    return match.replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>').replace('\n<__TABLE_SEP__>\n', '\n');
  });

  html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>');

  // Paragraphs - wrap text that's not already in a block element
  html = html.split('\n\n').map(block => {
    if (block.trim() === '') return '';
    if (block.match(/^<(h[1-6]|ul|ol|blockquote|pre|table|hr)/)) return block;
    return `<p>${block.trim()}</p>`;
  }).join('\n');

  // Line breaks
  html = html.replace(/  \n/g, '<br>');

  // Restore code blocks
  codeBlocks.forEach((code, index) => {
    html = html.replace(`__CODE_BLOCK_${index}__`, code);
  });

  // Restore inline code
  inlineCode.forEach((code, index) => {
    html = html.replace(`__INLINE_CODE_${index}__`, code);
  });

  return html;
};
