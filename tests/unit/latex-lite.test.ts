import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { latexToOmml, latexToUnicode, ommlToLatex, parseLatex } from '../../utils/latexLite';
import { buildDocxBlob } from '../../utils/docxExport';
import { markDocxMath, restoreDocxMath } from '../../utils/docxMath';
import type { DocumentData } from '../../types';

const M_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const omml = (latex: string, display = false) =>
  new DOMParser().parseFromString(`<root xmlns:m="${M_NS}">${latexToOmml(latex, display)}</root>`, 'application/xml');

describe('latexLite parser', () => {
  it('parses scripts, fractions, roots and big operators', () => {
    expect(parseLatex('x^2')).toEqual([{ k: 'scripts', base: [{ k: 'ord', text: 'x' }], sup: [{ k: 'ord', text: '2', variant: 'normal' }] }]);
    const [frac] = parseLatex('\\frac{a}{b}');
    expect(frac).toMatchObject({ k: 'frac', num: [{ text: 'a' }], den: [{ text: 'b' }] });
    expect(parseLatex('\\sqrt[3]{x}')[0]).toMatchObject({ k: 'sqrt', index: [{ text: '3' }], body: [{ text: 'x' }] });
    const [sum] = parseLatex('\\sum_{i=1}^n i^2 + 1');
    expect(sum).toMatchObject({ k: 'nary', op: '∑', sub: [{ text: 'i' }, { text: '=' }, { text: '1' }], sup: [{ text: 'n' }] });
    // the operator's body stops at the next + at the same level
    expect((sum as { body: unknown[] }).body).toHaveLength(1);
    expect(parseLatex('x_i^2')[0]).toMatchObject({ k: 'scripts', sub: [{ text: 'i' }], sup: [{ text: '2' }] });
    expect(parseLatex('\\left( x \\right]')[0]).toMatchObject({ k: 'delim', open: '(', close: ']' });
  });

  it('never throws and degrades unknown input to text', () => {
    for (const junk of ['', '{', '}}^_', '\\frac', '\\left(', '\\sqrt[', '\\begin{x}', '^^^', '\\', 'a_{b_{c_{d}}}', '{'.repeat(200)]) {
      expect(() => parseLatex(junk)).not.toThrow();
      expect(() => latexToUnicode(junk)).not.toThrow();
      expect(() => latexToOmml(junk)).not.toThrow();
    }
    expect(latexToUnicode('\\foo + 1')).toBe('foo + 1');
  });
});

describe('Unicode / ASCII linear form', () => {
  it.each([
    ['E=mc^2', 'E = mc²'],
    ['\\frac{a+b}{2}', '(a + b)/2'],
    ['\\sqrt{x+1}', '√(x + 1)'],
    ['\\alpha \\leq \\beta', 'α ≤ β'],
    ['x_i^2 + y_{ij}', 'xᵢ² + yᵢⱼ'],
    ['-x', '−x'],
    ['a \\neq b \\to \\infty', 'a ≠ b → ∞'],
    ['\\sin x + \\log(y)', 'sin x + log(y)'],
    ['\\text{if } x > 0', 'if x > 0'],
    ['\\mathbb{R}^n', 'ℝⁿ'],
    ["f'(x)", 'f′(x)'],
    ['\\int_0^1 f(x)\\,dx', '∫₀¹ f(x) dx'],
  ])('%s -> %s', (latex, text) => {
    expect(latexToUnicode(latex)).toBe(text);
  });

  it('has an ASCII-safe variant', () => {
    expect(latexToUnicode('E=mc^2', { ascii: true })).toBe('E = mc^2');
    expect(latexToUnicode('\\alpha \\leq \\beta^{n+1}', { ascii: true })).toBe('alpha <= beta^(n + 1)');
  });
});

describe('OMML', () => {
  it('writes Word math structures', () => {
    expect(latexToOmml('E=mc^2')).toBe(
      '<m:oMath><m:r><m:t xml:space="preserve">E</m:t></m:r><m:r><m:t xml:space="preserve">=</m:t></m:r><m:r><m:t xml:space="preserve">m</m:t></m:r><m:sSup><m:e><m:r><m:t xml:space="preserve">c</m:t></m:r></m:e><m:sup><m:r><m:t xml:space="preserve">2</m:t></m:r></m:sup></m:sSup></m:oMath>',
    );
    expect(latexToOmml('\\frac{1}{2}', true)).toMatch(/^<m:oMathPara><m:oMath><m:f><m:num>.*<\/m:num><m:den>.*<\/m:den><\/m:f><\/m:oMath><\/m:oMathPara>$/);
    expect(latexToOmml('\\sqrt{x}')).toContain('<m:degHide m:val="1"/>');
    expect(latexToOmml('\\sum_{i}^{n} i')).toContain('<m:chr m:val="∑"/>');
    expect(latexToOmml('\\left( x \\right)')).toContain('<m:begChr m:val="("/>');
    expect(latexToOmml('\\sin x')).toContain('<m:func><m:fName>');
    expect(latexToOmml('a < b & c')).toContain('&lt;');
    // well-formed XML for every construct
    for (const l of ['\\hat{x}', '\\overline{AB}', '\\binom{n}{k}', '\\lim_{x\\to 0} f', '\\text{a & b}', '\\sqrt[3]{2}', 'x_1^2']) {
      expect(omml(l).getElementsByTagName('parsererror')).toHaveLength(0);
    }
  });

  it('reads OMML back to equivalent LaTeX', () => {
    for (const latex of ['E=mc^2', '\\frac{a+b}{2}', '\\sqrt[3]{x+1}', '\\sum_{i=1}^{n} i^2', '\\alpha \\leq \\beta', '\\left( x \\right)', '\\lim_{x\\to 0} \\frac{\\sin x}{x}', '\\hat{x}']) {
      const doc = omml(latex);
      const back = ommlToLatex(doc.getElementsByTagNameNS(M_NS, 'oMath')[0]);
      expect(latexToUnicode(back)).toBe(latexToUnicode(latex));
    }
  });
});

describe('DOCX equations', () => {
  const doc = (content: string): DocumentData => ({ id: 'm', title: 'Math', content, createdAt: 0, lastModified: 0 });

  it('exports real Word math and imports it back as equation nodes', async () => {
    const blob = await buildDocxBlob(doc('<p>Energy <span data-type="equation" data-latex="E=mc^2"></span> and</p><p><span data-type="equation" data-display="true" data-latex="\\frac{a}{b}"></span></p>'));
    const buffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('<m:oMathPara>');
    expect(xml).not.toContain('E=mc^2');

    const marked = await markDocxMath(zip, buffer);
    const markedXml = await (await JSZip.loadAsync(marked)).file('word/document.xml')!.async('string');
    expect(markedXml).not.toContain('<m:oMath');
    // mammoth would output the marker text inside paragraphs
    const text = Array.from(new DOMParser().parseFromString(markedXml, 'application/xml').getElementsByTagName('w:t')).map(t => t.textContent).join('|');
    const html = restoreDocxMath(`<p>${text}</p>`);
    expect(html).toContain('data-latex="E=mc^2"');
    expect(html).toContain('data-display="true" data-latex="\\frac{a}{b}"');
  });
});
