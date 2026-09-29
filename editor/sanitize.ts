import DOMPurify from 'dompurify';

/**
 * Every piece of HTML that enters the app (stored documents, imports, pastes,
 * templates, collaboration peers, markdown previews, header/footer text) goes
 * through `sanitizeHtml`. Tiptap's schema then drops anything it doesn't know,
 * so this is a defence-in-depth layer for places that render HTML directly.
 */

const FORBID_TAGS = ['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'link', 'meta', 'base', 'noscript', 'template'];

let hooksInstalled = false;
const installHooks = () => {
  if (hooksInstalled) return;
  hooksInstalled = true;
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    // Only allow data: URIs on images (base64 pictures are stored inline).
    if ((data.attrName === 'href' || data.attrName === 'xlink:href' || data.attrName === 'action') && /^\s*data:/i.test(data.attrValue)) {
      data.keepAttr = false;
    }
    // CSS expressions / url(javascript:) inside style attributes
    if (data.attrName === 'style' && /expression\s*\(|javascript:|behavior\s*:|-moz-binding/i.test(data.attrValue)) {
      data.keepAttr = false;
    }
  });
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') || '';
      if (href && !/^(https?:|mailto:|tel:|#|\/|\.)/i.test(href.trim())) node.removeAttribute('href');
      if (node.getAttribute('target') === '_blank') node.setAttribute('rel', 'noopener noreferrer');
    }
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src') || '';
      if (src && !/^(https?:|data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml);|blob:|\/)/i.test(src.trim())) node.removeAttribute('src');
    }
  });
};

export const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  installHooks();
  return DOMPurify.sanitize(html, {
    FORBID_TAGS,
    FORBID_ATTR: ['srcset', 'formaction', 'contenteditable'],
    ALLOW_DATA_ATTR: true,
    ADD_ATTR: ['colspan', 'rowspan', 'colwidth', 'data-type'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  }) as string;
};

/** Escape text for safe interpolation into HTML strings. */
export const escapeHtml = (text: string): string =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Returns a URL only when it uses a safe protocol, otherwise null. */
export const safeUrl = (url: string): string | null => {
  const trimmed = (url || '').trim();
  if (!trimmed) return null;
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null; // javascript:, data:, vbscript: ...
  return `https://${trimmed}`;
};

const FONT_SIZE_MAP: Record<string, string> = { '1': '8pt', '2': '10pt', '3': '12pt', '4': '14pt', '5': '18pt', '6': '24pt', '7': '36pt' };

/**
 * Cleans up artefacts produced by the old contentEditable/execCommand editor
 * so that previously saved documents load cleanly into the new schema.
 */
export const normalizeLegacyHtml = (html: string): string => {
  if (!html || typeof DOMParser === 'undefined') return html || '';
  if (!/<font|img-resize|selected-img|code-block-container|margin-top|&#8203;|​|citation|bibliography|footnote-ref|endnote-ref|katex-equation/i.test(html)) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const body = doc.body;

  // <font face color size> -> <span style>
  body.querySelectorAll('font').forEach(font => {
    const span = doc.createElement('span');
    const face = font.getAttribute('face');
    const color = font.getAttribute('color');
    const size = font.getAttribute('size');
    if (face) span.style.fontFamily = face;
    if (color) span.style.color = color;
    if (size && FONT_SIZE_MAP[size]) span.style.fontSize = FONT_SIZE_MAP[size];
    const existing = font.getAttribute('style');
    if (existing) span.setAttribute('style', `${existing};${span.getAttribute('style') || ''}`);
    while (font.firstChild) span.appendChild(font.firstChild);
    font.replaceWith(span);
  });

  // Image resize wrappers / handles left in saved HTML
  body.querySelectorAll('.img-resize-handle').forEach(h => h.remove());
  body.querySelectorAll('.img-resize-wrapper').forEach(w => {
    while (w.firstChild) w.parentNode?.insertBefore(w.firstChild, w);
    w.remove();
  });
  body.querySelectorAll('.selected-img').forEach(img => img.classList.remove('selected-img'));

  // Old code block widget -> plain <pre><code>
  body.querySelectorAll('.code-block-container').forEach(container => {
    const code = container.querySelector('pre code');
    const pre = doc.createElement('pre');
    const newCode = doc.createElement('code');
    const lang = (code?.className.match(/language-([\w-]+)/) || [])[1];
    if (lang) newCode.className = `language-${lang}`;
    newCode.textContent = code?.textContent || '';
    pre.appendChild(newCode);
    container.replaceWith(pre);
  });

  // Old citations: <span class="citation" data-citation-id>
  body.querySelectorAll('span.citation[data-citation-id]').forEach(span => {
    span.setAttribute('data-type', 'citation');
  });

  // Old footnotes: <sup class="footnote-ref">n</sup>
  body.querySelectorAll('sup.footnote-ref, sup.endnote-ref').forEach(sup => {
    sup.setAttribute('data-type', 'footnote');
    sup.setAttribute('data-note-type', sup.classList.contains('endnote-ref') ? 'endnote' : 'footnote');
    const num = (sup.getAttribute('data-note-id') || '').split('-').pop() || sup.textContent || '';
    sup.setAttribute('data-legacy-number', num.trim());
  });
  body.querySelectorAll('span.katex-equation[data-latex]').forEach(span => {
    span.setAttribute('data-type', 'equation');
  });

  // Fake pagination margins written by the old editor onto top-level blocks
  Array.from(body.children).forEach(el => {
    const mt = (el as HTMLElement).style?.marginTop;
    if (mt && /px$/.test(mt) && parseFloat(mt) >= 120) (el as HTMLElement).style.marginTop = '';
    if ((el as HTMLElement).getAttribute?.('style') === '') el.removeAttribute('style');
  });

  // Zero-width spaces inserted as caret placeholders
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n.nodeValue && n.nodeValue.includes('​')) n.nodeValue = n.nodeValue.replace(/​/g, '');
  }

  return body.innerHTML;
};

/** Full pipeline for any HTML entering the editor. */
export const prepareHtmlForEditor = (html: string): string => sanitizeHtml(normalizeLegacyHtml(html || ''));

/**
 * Parse options for loading HTML into the editor. HTML we produced ourselves
 * (compact, no formatting newlines outside <pre>) keeps its spaces exactly —
 * otherwise a leading or double space would be lost on every save/reload.
 * Hand-written / imported HTML (templates, files) is whitespace-collapsed as
 * browsers do.
 */
export const parseOptionsFor = (html: string): { preserveWhitespace: boolean } => ({
  preserveWhitespace: !/\n/.test(html.replace(/<pre[\s\S]*?<\/pre>/gi, '')),
});
