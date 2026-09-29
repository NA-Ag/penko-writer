/**
 * Word equations (OMML) on DOCX import. mammoth drops `<m:oMath>` entirely,
 * so before conversion each equation is replaced by a text marker carrying
 * its LaTeX (see latexLite.ts `ommlToLatex`); afterwards the markers become
 * the editor's equation nodes again. Our own DOCX export writes OMML, so this
 * keeps equations through a DOCX round trip.
 */
import type JSZip from 'jszip';
import { escapeHtml } from '../editor/sanitize';
import { ommlToLatex } from './latexLite';

const M_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const MARK = (display: boolean, latex: string) => `⟦penko-eq:${display ? 'd' : 'i'}:${encodeURIComponent(latex).replace(/'/g, '%27')}⟧`;
const MARK_RE = /⟦penko-eq:([di]):([^⟧]*)⟧/g;

/**
 * Replaces the equations in `word/document.xml` of `zip` with markers.
 * Returns the DOCX to convert (the original when there is no math).
 */
export const markDocxMath = async (zip: JSZip, original: ArrayBuffer): Promise<ArrayBuffer> => {
  try {
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml || !/<m:oMath[\s>]/.test(xml)) return original;
    const dom = new DOMParser().parseFromString(xml, 'application/xml');
    const marker = (el: Element, display: boolean, latex: string) => {
      const r = dom.createElementNS(W_NS, 'w:r');
      const t = dom.createElementNS(W_NS, 'w:t');
      t.textContent = MARK(display, latex);
      r.appendChild(t);
      el.replaceWith(r);
    };
    Array.from(dom.getElementsByTagNameNS(M_NS, 'oMathPara')).forEach(para => {
      const latex = Array.from(para.getElementsByTagNameNS(M_NS, 'oMath')).map(ommlToLatex).join(' \\\\ ');
      marker(para, true, latex);
    });
    Array.from(dom.getElementsByTagNameNS(M_NS, 'oMath')).forEach(math => marker(math, false, ommlToLatex(math)));
    zip.file('word/document.xml', new XMLSerializer().serializeToString(dom));
    return await zip.generateAsync({ type: 'arraybuffer' });
  } catch (err) {
    console.warn('[Import] DOCX equations not converted', err);
    return original;
  }
};

/** Turns the markers in mammoth's HTML back into equation nodes. */
export const restoreDocxMath = (html: string): string =>
  html.replace(MARK_RE, (_, kind: string, encoded: string) => {
    let latex = '';
    try {
      latex = decodeURIComponent(encoded);
    } catch {
      latex = encoded;
    }
    return latex ? `<span data-type="equation"${kind === 'd' ? ' data-display="true"' : ''} data-latex="${escapeHtml(latex)}"></span>` : '';
  });
