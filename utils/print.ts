import { pageFrame, pageTops } from '../editor/extensions/pagination';

/**
 * Print exactly what the paginated editor shows: the page stack is cloned
 * into a hidden iframe with the app's stylesheets, the gaps between pages are
 * removed and a hard page break is placed before every page header, so the
 * printout (and "Save as PDF") matches the screen page for page.
 */

export interface PrintGeometry {
  pageWidth: number; // px
  pageHeight: number; // px
  pageCount: number;
  margin: number; // px
  background?: string;
  /** Per page: uses the other orientation (a section in landscape in a portrait document, or vice versa). */
  pageAlt?: boolean[];
}

const PRINT_CSS = (g: PrintGeometry) => `
  @page { size: ${g.pageWidth}px ${g.pageHeight}px; margin: 0; }
  @page penko-alt { size: ${g.pageHeight}px ${g.pageWidth}px; margin: 0; }
  .penko-print-page.penko-print-alt { page: penko-alt; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; overflow: visible !important; height: auto !important; }
  body * { visibility: visible !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .penko-print-page { position: relative; overflow: hidden; break-after: page; page-break-after: always; margin: 0; }
  .penko-print-page:last-child { break-after: auto; page-break-after: auto; }
  .penko-print-shell { position: absolute; left: 0; }
  .penko-print-shell .ProseMirror { position: relative; }
  .penko-print-shell .ProseMirror > .penko-print-block { position: absolute; left: 0; right: 0; }
  .penko-page-gap { visibility: hidden !important; }
  /* Zones stack in order (filler, footer, gap, header): normal flow gives the same vertical positions;
     relative (not static) keeps their horizontal offset on pages of the other orientation */
  .penko-page-boundary > * { position: relative !important; top: 0 !important; }
  .penko-doc .search-match, .penko-doc .search-match-current { background: none !important; outline: none !important; }
  .penko-doc [data-resize-handle], .collaboration-carets__caret, .collaboration-carets__label { display: none !important; }
  .ProseMirror-selectednode { outline: none !important; }
  .penko-doc div[data-type='page-break'] { border: none !important; }
  .penko-doc div[data-type='page-break']::after { content: none !important; }
  .penko-doc div[data-type='section-break'] { border: none !important; }
  .penko-doc div[data-type='section-break']::after { content: none !important; }
`;

const stripEditing = (el: HTMLElement) => {
  el.querySelectorAll('.penko-doc-dark').forEach(n => n.classList.remove('penko-doc-dark'));
  el.classList.remove('penko-doc-dark');
  el.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
  el.removeAttribute('contenteditable');
  return el;
};

/**
 * Fill `target` (an empty document) with the printable pages. Each printed page
 * is a fixed-size window onto the on-screen layout: only blocks intersecting
 * that page are cloned in, absolutely positioned exactly where they are on
 * screen, and the window clips them. Nodes are cloned (never serialised and
 * re-parsed, which would restructure block widgets inside paragraphs).
 */
export const populatePrintDocument = (target: Document, pageEl: HTMLElement, geometry: PrintGeometry) => {
  const head = target.head;
  const meta = target.createElement('meta');
  meta.setAttribute('charset', 'utf-8');
  head.appendChild(meta);
  const base = target.createElement('base');
  base.href = document.baseURI;
  head.appendChild(base);
  target.title = document.title;
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
    const copy = target.importNode(node, true) as HTMLElement;
    if (copy.tagName === 'LINK') (copy as HTMLLinkElement).href = (node as HTMLLinkElement).href;
    head.appendChild(copy);
  });
  const style = target.createElement('style');
  style.textContent = PRINT_CSS(geometry);
  head.appendChild(style);

  const clone = (el: Element) => stripEditing(target.importNode(el, true) as HTMLElement);
  const content = pageEl.querySelector<HTMLElement>('#editor-content');
  const root = content?.querySelector<HTMLElement>('.ProseMirror');
  if (!content || !root) {
    target.body.appendChild(clone(pageEl));
    return;
  }

  const pageRect = pageEl.getBoundingClientRect();
  // computed width, not offsetWidth: that is rounded (A4 is 793.7px) and the skew adds up page by page
  const layoutWidth = parseFloat(getComputedStyle(pageEl).width);
  const scale = layoutWidth > 0 ? pageRect.width / layoutWidth : 1;
  const rel = (r: DOMRect) => ({ top: (r.top - pageRect.top) / scale, bottom: (r.bottom - pageRect.top) / scale, left: (r.left - pageRect.left) / scale, width: r.width / scale });
  const rootBox = rel(root.getBoundingClientRect());

  const blocks = Array.from(root.children).map(el => ({ el, ...rel(el.getBoundingClientRect()) }));
  // Page-level chrome outside the editor flow (first header, last footer, notes)
  const extras = Array.from(pageEl.querySelectorAll<HTMLElement>(':scope > .penko-first-header, :scope > .penko-last-footer, :scope > .penko-notes, :scope > .penko-last-notes')).map(el => ({
    el,
    ...rel(el.getBoundingClientRect()),
  }));

  const { pageWidth: W, pageCount } = geometry;
  const alts = Array.from({ length: pageCount }, (_, k) => !!geometry.pageAlt?.[k]);
  const { tops } = pageTops({ ...geometry, gap: 24 }, alts);
  const bg = geometry.background || '#fff';
  const contentStyle = content.getAttribute('style') || '';

  for (let k = 0; k < pageCount; k++) {
    const frame = pageFrame(geometry, alts[k]);
    const P = frame.height;
    const y0 = tops[k];
    const y1 = y0 + P;
    const inPage = (b: { top: number; bottom: number }) => b.top < y1 && b.bottom > y0;

    const pageBox = target.createElement('div');
    pageBox.className = alts[k] ? 'penko-print-page penko-print-alt' : 'penko-print-page';
    pageBox.style.cssText = `width:${frame.width}px;height:${Math.floor(P) - 1}px;background:${bg};color:#000;`;
    const shell = target.createElement('div');
    shell.className = 'penko-print-shell';
    shell.style.cssText = `top:${-y0}px;left:${-frame.left}px;width:${W}px;--penko-page-bg:${bg};--penko-page-margin:${geometry.margin}px;`;

    for (const x of extras.filter(inPage)) {
      const c = clone(x.el);
      c.style.position = 'absolute';
      c.style.top = `${x.top}px`;
      c.style.bottom = 'auto';
      c.style.left = `${x.left}px`;
      c.style.right = 'auto';
      c.style.width = `${x.width}px`;
      shell.appendChild(c);
    }

    const contentClone = target.createElement('div');
    contentClone.className = content.className.replace('penko-doc-dark', '');
    contentClone.setAttribute('style', contentStyle);
    contentClone.style.position = 'absolute';
    contentClone.style.top = `${rootBox.top}px`;
    contentClone.style.left = `${rootBox.left}px`;
    contentClone.style.width = `${parseFloat(getComputedStyle(root).width) || root.offsetWidth}px`;
    contentClone.style.padding = '0';
    contentClone.style.minHeight = '0';
    contentClone.style.backgroundImage = 'none';
    const pm = target.createElement('div');
    pm.className = root.className;
    for (const b of blocks.filter(inPage)) {
      const c = clone(b.el);
      c.classList.add('penko-print-block');
      c.style.top = `${b.top - rootBox.top}px`;
      // exact on-screen box (indents, and blocks widened for a section in the other orientation)
      c.style.position = 'absolute';
      c.style.left = `${b.left - rootBox.left}px`;
      c.style.right = 'auto';
      c.style.width = `${b.width}px`;
      c.style.boxSizing = 'border-box';
      c.style.margin = '0';
      pm.appendChild(c);
    }
    contentClone.appendChild(pm);
    shell.appendChild(contentClone);
    pageBox.appendChild(shell);
    target.body.appendChild(pageBox);
  }
};

const waitForAssets = async (doc: Document) => {
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
  await Promise.all(links.map(l => (l.sheet ? Promise.resolve() : new Promise<void>(res => { l.onload = () => res(); l.onerror = () => res(); setTimeout(res, 3000); }))));
  await Promise.all(Array.from(doc.images).map(img => (img.complete ? Promise.resolve() : new Promise<void>(res => { img.onload = img.onerror = () => res(); setTimeout(res, 3000); }))));
  try {
    await (doc as any).fonts?.ready;
  } catch {
    /* ignore */
  }
};

export const printElement = async (pageEl: HTMLElement, geometry: PrintGeometry): Promise<void> => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  const win = iframe.contentWindow!;
  const doc = win.document;
  doc.open();
  doc.write('<!doctype html><html><head></head><body></body></html>');
  doc.close();
  populatePrintDocument(doc, pageEl, geometry);
  await waitForAssets(doc);

  await new Promise<void>(resolve => {
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      setTimeout(() => iframe.remove(), 500);
      resolve();
    };
    win.addEventListener('afterprint', cleanup, { once: true });
    win.focus();
    win.print();
    // Some browsers don't fire afterprint for iframes
    setTimeout(cleanup, 60000);
  });
};

export const currentPrintGeometry = (page: HTMLElement): PrintGeometry => ({
  pageWidth: Number(page.dataset.pageWidth),
  pageHeight: Number(page.dataset.pageHeight),
  pageCount: Number(page.dataset.pageCount) || 1,
  margin: Number(page.dataset.pageMargin) || 0,
  background: page.dataset.pageBackground,
  pageAlt: page.dataset.pageAlt ? Array.from(page.dataset.pageAlt, c => c === '1') : undefined,
});

/** Print the currently open document (paginated view), falling back to window.print(). */
export const printCurrentDocument = async () => {
  const page = document.querySelector<HTMLElement>('.penko-page[data-paginated="true"]');
  if (!page) {
    window.print();
    return;
  }
  await printElement(page, currentPrintGeometry(page));
};
