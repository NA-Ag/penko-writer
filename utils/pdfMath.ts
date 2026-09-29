/**
 * Equation layout for the jsPDF export: the LaTeX tree from latexLite.ts is
 * laid out as nested boxes (TeX-like: scripts, stacked fractions, radicals,
 * big operators with limits, stretched delimiters, accents) and drawn with
 * the standard PDF fonts: Times for letters / digits (italic variables, like
 * KaTeX on screen) and the standard Symbol font for Greek letters and math
 * symbols. Symbol is one of the 14 standard PDF fonts, so nothing needs to be
 * embedded, the glyphs are real (not transliterated) and copy / paste yields
 * the right Unicode characters. Characters neither font has fall back to a
 * readable ASCII spelling ("ℵ" → "aleph").
 */
import type { jsPDF } from 'jspdf';
import { asciiMath, parseLatex, type MathNode } from './latexLite';

export interface MathBox {
  w: number;
  /** height above the baseline */
  asc: number;
  /** depth below the baseline */
  desc: number;
  draw: (pdf: jsPDF, x: number, baseline: number) => void;
}

type Rgb = [number, number, number];

/* ------------------------------------------------------------------ */
/* Glyphs                                                              */
/* ------------------------------------------------------------------ */

/** Unicode -> Adobe Symbol encoding code and advance width (1/1000 em). */
const SYMBOL_FONT: Record<string, [number, number]> = {
  α: [0x61, 631], β: [0x62, 549], χ: [0x63, 549], δ: [0x64, 494], ε: [0x65, 439], ϵ: [0x65, 439], φ: [0x66, 521], γ: [0x67, 411],
  η: [0x68, 603], ι: [0x69, 329], ϕ: [0x6a, 603], κ: [0x6b, 549], λ: [0x6c, 549], μ: [0x6d, 576], ν: [0x6e, 521], ο: [0x6f, 549],
  π: [0x70, 549], θ: [0x71, 521], ρ: [0x72, 549], ϱ: [0x72, 549], σ: [0x73, 603], τ: [0x74, 439], υ: [0x75, 576], ϖ: [0x76, 713],
  ω: [0x77, 686], ξ: [0x78, 493], ψ: [0x79, 686], ζ: [0x7a, 494], ς: [0x56, 439], ϑ: [0x4a, 631],
  Α: [0x41, 722], Β: [0x42, 667], Χ: [0x43, 722], Δ: [0x44, 612], Ε: [0x45, 611], Φ: [0x46, 763], Γ: [0x47, 603], Η: [0x48, 722],
  Ι: [0x49, 333], Κ: [0x4b, 722], Λ: [0x4c, 686], Μ: [0x4d, 889], Ν: [0x4e, 722], Ο: [0x4f, 722], Π: [0x50, 768], Θ: [0x51, 741],
  Ρ: [0x52, 556], Σ: [0x53, 592], Τ: [0x54, 611], Υ: [0x55, 690], Ω: [0x57, 768], Ξ: [0x58, 645], Ψ: [0x59, 795], Ζ: [0x5a, 611],
  '∀': [0x22, 713], '∃': [0x24, 549], '∋': [0x27, 439], '∗': [0x2a, 500], '−': [0x2d, 549], '≅': [0x40, 549], '∴': [0x5c, 863],
  '⊥': [0x5e, 658], '∼': [0x7e, 549], '′': [0xa2, 247], '≤': [0xa3, 549], '∞': [0xa5, 713], '↔': [0xab, 1042], '←': [0xac, 987],
  '↑': [0xad, 603], '→': [0xae, 987], '⟶': [0xae, 987], '⟵': [0xac, 987], '↓': [0xaf, 603], '″': [0xb2, 411], '≥': [0xb3, 549],
  '∝': [0xb5, 713], '∂': [0xb6, 494], '∙': [0xb7, 460], '≠': [0xb9, 549], '≡': [0xba, 549], '≈': [0xbb, 549], '…': [0xbc, 1000],
  '⋯': [0xbc, 1000], 'ℵ': [0xc0, 823], 'ℑ': [0xc1, 686], 'ℜ': [0xc2, 795], '℘': [0xc3, 987], '⊗': [0xc4, 768], '⊕': [0xc5, 768],
  '∅': [0xc6, 823], '∩': [0xc7, 768], '∪': [0xc8, 768], '⊃': [0xc9, 713], '⊇': [0xca, 713], '⊄': [0xcb, 713], '⊂': [0xcc, 713],
  '⊆': [0xcd, 713], '∈': [0xce, 713], '∉': [0xcf, 713], '∠': [0xd0, 768], '∇': [0xd1, 713], '∏': [0xd5, 823], '√': [0xd6, 549],
  '⋅': [0xd7, 250], '∧': [0xd9, 603], '∨': [0xda, 603], '⇔': [0xdb, 1042], '⇐': [0xdc, 987], '⇑': [0xdd, 603], '⇒': [0xde, 987],
  '⇓': [0xdf, 603], '⟨': [0xe1, 329], '∑': [0xe5, 713], '⟩': [0xf1, 329], '∫': [0xf2, 274], '∣': [0x7c, 200], '∥': [0x7c, 200],
  '⋃': [0xc8, 768], '⋂': [0xc7, 768], '⨁': [0xc5, 768], '⨂': [0xc4, 768], '⋁': [0xda, 603], '⋀': [0xd9, 603], '∐': [0xd5, 823],
};

const SYMBOL_WIDTHS = new Map(Object.values(SYMBOL_FONT));

const CP1252_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const winAnsi = (ch: string) => {
  const c = ch.codePointAt(0)!;
  return (c >= 0x20 && c < 0x7f) || (c >= 0xa0 && c <= 0xff) || CP1252_EXTRA.includes(ch);
};

/** Characters these two fonts can draw (everything else is spelled out). */
export const pdfMathCanDraw = (ch: string) => winAnsi(ch) || !!SYMBOL_FONT[ch];

type FontKey = 'times-italic' | 'times-normal' | 'times-bold' | 'times-bolditalic' | 'symbol';

interface Glyphs {
  font: FontKey;
  text: string;
  size: number;
  w: number;
}

const setFont = (pdf: jsPDF, font: FontKey, size: number) => {
  if (font === 'symbol') pdf.setFont('symbol', 'normal');
  else pdf.setFont('times', font.slice(6));
  pdf.setFontSize(size);
};

/** Splits text into same-font glyph runs, measured. */
const glyphRuns = (pdf: jsPDF, text: string, size: number, textFont: Exclude<FontKey, 'symbol'>): Glyphs[] => {
  const out: Glyphs[] = [];
  for (const raw of Array.from(text)) {
    let ch = raw;
    if (/[̀-ͯ⃐-⃿]/.test(ch)) continue; // combining marks: accents are drawn separately
    let font: FontKey;
    let code: string;
    const sym = SYMBOL_FONT[ch];
    if (sym && !winAnsi(ch)) {
      font = 'symbol';
      code = String.fromCharCode(sym[0]);
    } else {
      if (!winAnsi(ch)) ch = asciiMath(ch);
      font = /^[\p{L}]+$/u.test(ch) ? textFont : textFont === 'times-italic' ? 'times-normal' : textFont === 'times-bolditalic' ? 'times-bold' : textFont;
      code = ch;
    }
    const last = out[out.length - 1];
    if (last && last.font === font) last.text += code;
    else out.push({ font, text: code, size, w: 0 });
  }
  for (const g of out) {
    if (g.font === 'symbol') g.w = Array.from(g.text).reduce((sum, c) => sum + (SYMBOL_WIDTHS.get(c.charCodeAt(0)) ?? 600), 0) * (size / 1000);
    else {
      setFont(pdf, g.font, size);
      g.w = pdf.getTextWidth(g.text);
    }
  }
  return out;
};

const textBox = (pdf: jsPDF, text: string, size: number, font: Exclude<FontKey, 'symbol'>, color: Rgb): MathBox => {
  const runs = glyphRuns(pdf, text, size, font);
  const w = runs.reduce((s, g) => s + g.w, 0) + (font === 'times-italic' && /\p{L}$/u.test(text) ? size * 0.04 : 0);
  return {
    w,
    asc: size * 0.72,
    desc: size * 0.22,
    draw: (p, x, baseline) => {
      p.setTextColor(...color);
      let cx = x;
      for (const g of runs) {
        setFont(p, g.font, g.size);
        p.text(g.text, cx, baseline);
        cx += g.w;
      }
    },
  };
};

const spaceBox = (w: number): MathBox => ({ w, asc: 0, desc: 0, draw: () => {} });

const hbox = (boxes: MathBox[]): MathBox => ({
  w: boxes.reduce((s, b) => s + b.w, 0),
  asc: Math.max(0, ...boxes.map(b => b.asc)),
  desc: Math.max(0, ...boxes.map(b => b.desc)),
  draw: (p, x, baseline) => {
    let cx = x;
    for (const b of boxes) {
      b.draw(p, cx, baseline);
      cx += b.w;
    }
  },
});

/** Box raised by `shift` (negative = lowered). */
const raise = (b: MathBox, shift: number): MathBox => ({
  w: b.w,
  asc: Math.max(0, b.asc + shift),
  desc: Math.max(0, b.desc - shift),
  draw: (p, x, baseline) => b.draw(p, x, baseline - shift),
});

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

class MathLayout {
  constructor(
    private pdf: jsPDF,
    private color: Rgb,
  ) {}

  private line(p: jsPDF, width: number, pts: [number, number][]) {
    p.setDrawColor(...this.color);
    p.setLineWidth(width);
    for (let i = 1; i < pts.length; i++) p.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  }

  /** A horizontal list with TeX-like spacing (none around + − = inside scripts). */
  row(nodes: MathNode[], size: number, display: boolean, script = false): MathBox {
    const boxes: MathBox[] = [];
    const thin = size * 0.17;
    const isFn = (n: MathNode | undefined) => !!n && (n.k === 'fn' || (n.k === 'scripts' && n.base[0]?.k === 'fn'));
    const opensWith = (n: MathNode | undefined) => !!n && ((n.k === 'op' && (n.cls === 'open' || n.cls === 'bin' || n.cls === 'rel' || n.cls === 'punct')) || (n.k === 'delim' && !!n.open) || n.k === 'space');
    nodes.forEach((n, i) => {
      const prev = nodes[i - 1];
      if (n.k === 'op' && (n.cls === 'bin' || n.cls === 'rel')) {
        const unary = n.cls === 'bin' && (!prev || (prev.k === 'op' && prev.cls !== 'close' && prev.cls !== 'ord'));
        const gap = unary || script ? 0 : size * (n.cls === 'rel' ? 0.28 : 0.22);
        boxes.push(spaceBox(gap), this.node(n, size, display), spaceBox(gap));
      } else if (n.k === 'op' && n.cls === 'punct') boxes.push(this.node(n, size, display), spaceBox(script ? 0 : thin));
      else {
        // thin space between a function / big operator and what precedes it (not after an operator or bracket)
        if ((isFn(n) || n.k === 'nary') && prev && !opensWith(prev)) boxes.push(spaceBox(thin));
        boxes.push(this.node(n, size, display));
        if (isFn(n) && nodes[i + 1] && !opensWith(nodes[i + 1])) boxes.push(spaceBox(thin));
      }
    });
    return hbox(boxes);
  }

  private node(n: MathNode, size: number, display: boolean): MathBox {
    const pdf = this.pdf;
    const small = (s: number) => Math.max(4.5, s * 0.7);
    switch (n.k) {
      case 'ord':
        return textBox(pdf, n.text, size, n.variant === 'bold' ? 'times-bold' : n.variant === 'normal' || /^[\d.]+$/.test(n.text) ? 'times-normal' : 'times-italic', this.color);
      case 'op':
        return textBox(pdf, n.text, size, 'times-normal', this.color);
      case 'fn':
        return textBox(pdf, n.name, size, 'times-normal', this.color);
      case 'text':
        return textBox(pdf, n.text, size, 'times-normal', this.color);
      case 'space':
        return spaceBox(n.em * size);
      case 'scripts': {
        const base = this.row(n.base, size, display);
        const ss = small(size);
        const sup = n.sup ? this.row(n.sup, ss, false, true) : null;
        const sub = n.sub ? this.row(n.sub, ss, false, true) : null;
        const fnName = n.base.length === 1 && n.base[0].k === 'fn' ? n.base[0].name : '';
        if (display && sub && !sup && /^(lim|liminf|limsup|max|min|sup|inf|det|Pr|gcd)$/.test(fnName)) {
          // \lim_{x→0} in display style: limit centred below
          const w = Math.max(base.w, sub.w);
          const gap = size * 0.1;
          return {
            w,
            asc: base.asc,
            desc: base.desc + gap + sub.asc + sub.desc,
            draw: (p, x, baseline) => {
              base.draw(p, x + (w - base.w) / 2, baseline);
              sub.draw(p, x + (w - sub.w) / 2, baseline + base.desc + gap + sub.asc);
            },
          };
        }
        let up = sup ? Math.max(size * 0.38, base.asc - ss * 0.45) : 0;
        let down = sub ? Math.max(size * 0.2, base.desc + ss * 0.1) : 0;
        if (sup && sub) {
          // keep a small gap between the two scripts
          const gap = up - sup.desc - (sub.asc - down);
          if (gap < size * 0.12) {
            const extra = (size * 0.12 - gap) / 2;
            up += extra;
            down += extra;
          }
        }
        const parts: MathBox[] = [base];
        const scriptW = Math.max(sup?.w ?? 0, sub?.w ?? 0);
        const scriptBox: MathBox = {
          w: scriptW + size * 0.04,
          asc: sup ? up + sup.asc : sub ? Math.max(0, sub.asc - down) : 0,
          desc: sub ? down + sub.desc : 0,
          draw: (p, x, baseline) => {
            sup?.draw(p, x + size * 0.02, baseline - up);
            sub?.draw(p, x, baseline + down);
          },
        };
        parts.push(scriptBox);
        return hbox(parts);
      }
      case 'frac': {
        const fs = display ? size : Math.max(5, size * 0.78);
        const num = this.row(n.num, fs, false, !display);
        const den = this.row(n.den, fs, false, !display);
        const axis = size * 0.26;
        const thick = n.noBar ? 0 : Math.max(0.4, size * 0.045);
        const gap = size * 0.14;
        const w = Math.max(num.w, den.w) + size * 0.24;
        const numShift = axis + thick / 2 + gap + num.desc;
        const denShift = den.asc + gap + thick / 2 - axis;
        return {
          w: w + size * 0.1,
          asc: numShift + num.asc,
          desc: denShift + den.desc,
          draw: (p, x, baseline) => {
            num.draw(p, x + size * 0.05 + (w - num.w) / 2, baseline - numShift);
            den.draw(p, x + size * 0.05 + (w - den.w) / 2, baseline + denShift);
            if (thick) this.line(p, thick, [[x + size * 0.05, baseline - axis], [x + size * 0.05 + w, baseline - axis]]);
          },
        };
      }
      case 'sqrt': {
        const body = this.row(n.body, size, display);
        const index = n.index ? this.row(n.index, Math.max(4.5, size * 0.55), false, true) : null;
        const thick = Math.max(0.45, size * 0.05);
        const top = Math.max(body.asc, size * 0.7) + size * 0.16;
        const bottom = Math.max(body.desc, size * 0.12);
        const sign = size * 0.55;
        const lead = index ? Math.max(0, index.w - sign * 0.45) : 0;
        return {
          w: lead + sign + body.w + size * 0.12,
          asc: Math.max(top + thick, index ? (top + bottom) * 0.45 + index.asc + index.desc : 0),
          desc: bottom,
          draw: (p, x, baseline) => {
            const x0 = x + lead;
            const mid = baseline + bottom - (top + bottom) * 0.45;
            this.line(p, thick, [
              [x0, mid + size * 0.05],
              [x0 + sign * 0.2, mid - size * 0.02],
              [x0 + sign * 0.5, baseline + bottom],
              [x0 + sign, baseline - top],
              [x0 + sign + body.w + size * 0.08, baseline - top],
            ]);
            body.draw(p, x0 + sign + size * 0.04, baseline);
            index?.draw(p, x0 + sign * 0.45 - index.w, mid - size * 0.12 - index.desc);
          },
        };
      }
      case 'nary': {
        const gs = display ? size * 1.5 : size * 1.15;
        const integral = /[∫∬∭∮]/.test(n.op);
        const glyph = n.op === '∬' ? '∫∫' : n.op === '∭' ? '∫∫∫' : n.op === '∮' ? '∫' : n.op;
        const g = textBox(this.pdf, glyph, integral ? gs * 1.15 : gs, 'times-normal', this.color);
        // Symbol's big operators: ∑ spans about -0.11..0.75 em, ∫ -0.11..0.92 em; centre them on the math axis
        const gsz = integral ? gs * 1.15 : gs;
        const [gAsc, gDesc] = integral ? [0.92 * gsz, 0.11 * gsz] : [0.75 * gsz, 0.11 * gsz];
        const shift = size * 0.26 - (gAsc - gDesc) / 2;
        const op: MathBox = { w: g.w, asc: gAsc + shift, desc: Math.max(0, gDesc - shift), draw: (p, x, baseline) => g.draw(p, x, baseline - shift) };
        const ss = small(size);
        const sub = n.sub ? this.row(n.sub, ss, false, true) : null;
        const sup = n.sup ? this.row(n.sup, ss, false, true) : null;
        let opBox: MathBox;
        if (display && !integral) {
          // limits above / below, centred
          const w = Math.max(op.w, sub?.w ?? 0, sup?.w ?? 0);
          const gap = size * 0.12;
          opBox = {
            w,
            asc: op.asc + (sup ? gap + sup.desc + sup.asc : 0),
            desc: op.desc + (sub ? gap + sub.asc + sub.desc : 0),
            draw: (p, x, baseline) => {
              op.draw(p, x + (w - op.w) / 2, baseline);
              sup?.draw(p, x + (w - sup.w) / 2, baseline - op.asc - gap - sup.desc);
              sub?.draw(p, x + (w - sub.w) / 2, baseline + op.desc + gap + sub.asc);
            },
          };
        } else {
          const up = op.asc - (sup ? sup.asc * 0.7 : 0);
          const down = op.desc + (sub ? sub.asc * 0.3 : 0);
          const kern = integral ? size * 0.12 : size * 0.06;
          const w = op.w + Math.max(sup ? sup.w + kern : 0, sub ? sub.w + (integral ? 0 : kern) : 0);
          opBox = {
            w,
            asc: Math.max(op.asc, sup ? up + sup.asc : 0),
            desc: Math.max(op.desc, sub ? down + sub.desc : 0),
            draw: (p, x, baseline) => {
              op.draw(p, x, baseline);
              sup?.draw(p, x + op.w + kern, baseline - up);
              sub?.draw(p, x + op.w + (integral ? 0 : kern), baseline + down);
            },
          };
        }
        const body = this.row(n.body, size, display);
        return hbox(n.body.length ? [opBox, spaceBox(size * 0.12), body] : [opBox]);
      }
      case 'delim': {
        const body = this.row(n.body, size, display);
        if (!n.open && !n.close) return body;
        const h = body.asc + body.desc;
        const normal = size * 0.94;
        // taller content: scale the fence glyph so it covers the body
        const fs = h > normal * 1.15 ? (h / 0.9) : size;
        const fence = (ch: string): MathBox => {
          if (!ch) return spaceBox(0);
          const b = textBox(this.pdf, ch, fs, 'times-normal', this.color);
          // Times parentheses span about -0.2..0.7 em; centre them on the body
          const centre = (body.asc - body.desc) / 2;
          const shift = fs === size ? 0 : centre - fs * 0.25;
          return raise({ ...b, asc: fs * 0.72, desc: fs * 0.2 }, shift);
        };
        return hbox([fence(n.open), spaceBox(size * 0.03), body, spaceBox(size * 0.03), fence(n.close)]);
      }
      case 'accent': {
        const body = this.row(n.body, size, display);
        const top = Math.max(body.asc, size * 0.5);
        const lift = size * 0.1;
        const thick = Math.max(0.4, size * 0.045);
        const acc = n.accent;
        return {
          w: body.w,
          asc: top + lift + size * 0.2,
          desc: body.desc,
          draw: (p, x, baseline) => {
            body.draw(p, x, baseline);
            const y = baseline - top - lift;
            const cx = x + body.w / 2 + (n.body.length === 1 && n.body[0].k === 'ord' && !n.body[0].variant ? size * 0.06 : 0);
            const hw = Math.min(body.w / 2, size * 0.22);
            if (n.wide || acc === '̅') this.line(p, thick, [[x + size * 0.02, y], [x + body.w, y]]);
            else if (acc === '⃗') {
              this.line(p, thick, [[cx - hw, y], [cx + hw, y]]);
              this.line(p, thick, [[cx + hw - size * 0.08, y - size * 0.06], [cx + hw, y], [cx + hw - size * 0.08, y + size * 0.06]]);
            } else if (acc === '̇' || acc === '̈') {
              p.setFillColor(...this.color);
              const dots = acc === '̇' ? [cx] : [cx - size * 0.09, cx + size * 0.09];
              dots.forEach(dx => p.circle(dx, y, size * 0.035, 'F'));
            } else if (acc === '̃') {
              this.line(p, thick, [[cx - hw, y + size * 0.03], [cx - hw / 3, y - size * 0.05], [cx + hw / 3, y + size * 0.03], [cx + hw, y - size * 0.05]]);
            } else if (acc === '̌') this.line(p, thick, [[cx - hw * 0.7, y - size * 0.07], [cx, y + size * 0.02], [cx + hw * 0.7, y - size * 0.07]]);
            else if (acc === '́') this.line(p, thick, [[cx - size * 0.04, y + size * 0.02], [cx + size * 0.06, y - size * 0.08]]);
            else if (acc === '̀') this.line(p, thick, [[cx - size * 0.06, y - size * 0.08], [cx + size * 0.04, y + size * 0.02]]);
            else if (acc === '̊') p.circle(cx, y - size * 0.03, size * 0.05, 'S');
            else this.line(p, thick, [[cx - hw * 0.7, y + size * 0.02], [cx, y - size * 0.07], [cx + hw * 0.7, y + size * 0.02]]); // hat / breve
          },
        };
      }
    }
  }
}

/** Lays out an equation at `sizePt`; `display` uses display style (big operators, limits above / below). */
export const layoutMath = (pdf: jsPDF, latex: string, sizePt: number, display: boolean, color: Rgb = [17, 17, 17]): MathBox => {
  const layout = new MathLayout(pdf, color);
  const nodes = parseLatex(latex);
  const box = layout.row(nodes.length ? nodes : [{ k: 'text', text: latex }], sizePt, display);
  return box;
};
