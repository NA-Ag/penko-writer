/**
 * A small LaTeX-subset parser for the exporters (the editor itself renders
 * equations with KaTeX). It turns the equation source into a tree that the
 * DOCX writer emits as Word math (OMML), the PDF writer lays out as math
 * boxes, and TXT / .doc show as readable Unicode ("E = mc²").
 *
 * Covered: super/subscripts (braced or single token), \frac and friends,
 * \sqrt[n]{}, \binom, Greek letters, common operators / relations / arrows,
 * big operators (\sum \int \prod …) with limits, \left…\right delimiters,
 * accents (\hat \bar \vec …), \text / \mathrm / \mathbf / \mathbb, function
 * names (\sin \log \lim …) and spacing commands. Anything else degrades to
 * readable text (an unknown command shows its name); parsing never throws.
 */

export type MathVariant = 'italic' | 'normal' | 'bold';
export type OpClass = 'bin' | 'rel' | 'punct' | 'open' | 'close' | 'ord';

export type MathNode =
  /** identifiers, numbers: letters are italic unless `variant` says otherwise */
  | { k: 'ord'; text: string; variant?: MathVariant }
  /** operators / relations / punctuation / fences (upright) */
  | { k: 'op'; text: string; cls: OpClass; ascii?: string }
  /** upright function name (\sin, \lim, \operatorname{…}) */
  | { k: 'fn'; name: string }
  /** \text{…}: upright prose, spaces kept */
  | { k: 'text'; text: string }
  | { k: 'scripts'; base: MathNode[]; sub?: MathNode[]; sup?: MathNode[] }
  | { k: 'frac'; num: MathNode[]; den: MathNode[]; noBar?: boolean }
  | { k: 'sqrt'; body: MathNode[]; index?: MathNode[] }
  /** big operator; `body` is the term it applies to (up to the next + − = … at the same level) */
  | { k: 'nary'; op: string; ascii: string; sub?: MathNode[]; sup?: MathNode[]; body: MathNode[] }
  | { k: 'delim'; open: string; close: string; body: MathNode[] }
  /** accent is a combining character (U+0302 hat, U+0305 bar …); `wide` = \overline */
  | { k: 'accent'; accent: string; body: MathNode[]; wide?: boolean }
  | { k: 'space'; em: number };

/* ------------------------------------------------------------------ */
/* Symbol tables                                                       */
/* ------------------------------------------------------------------ */

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ',
  iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', omicron: 'ο', pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ',
  sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

/** command -> [unicode, class, ascii fallback] */
const SYMBOLS: Record<string, [string, OpClass, string]> = {
  cdot: ['⋅', 'bin', '*'], times: ['×', 'bin', 'x'], div: ['÷', 'bin', '/'], pm: ['±', 'bin', '+/-'], mp: ['∓', 'bin', '-/+'],
  ast: ['∗', 'bin', '*'], star: ['⋆', 'bin', '*'], circ: ['∘', 'bin', 'o'], bullet: ['∙', 'bin', '*'], oplus: ['⊕', 'bin', '(+)'],
  otimes: ['⊗', 'bin', '(x)'], cap: ['∩', 'bin', 'n'], cup: ['∪', 'bin', 'u'], wedge: ['∧', 'bin', '^'], land: ['∧', 'bin', '^'],
  vee: ['∨', 'bin', 'v'], lor: ['∨', 'bin', 'v'], setminus: ['∖', 'bin', '\\'],
  leq: ['≤', 'rel', '<='], le: ['≤', 'rel', '<='], geq: ['≥', 'rel', '>='], ge: ['≥', 'rel', '>='], neq: ['≠', 'rel', '!='], ne: ['≠', 'rel', '!='],
  approx: ['≈', 'rel', '~'], equiv: ['≡', 'rel', '=='], sim: ['∼', 'rel', '~'], simeq: ['≃', 'rel', '~='], cong: ['≅', 'rel', '~='],
  propto: ['∝', 'rel', '~'], ll: ['≪', 'rel', '<<'], gg: ['≫', 'rel', '>>'], in: ['∈', 'rel', 'in'], notin: ['∉', 'rel', 'not in'],
  ni: ['∋', 'rel', 'ni'], subset: ['⊂', 'rel', 'subset'], supset: ['⊃', 'rel', 'supset'], subseteq: ['⊆', 'rel', 'subseteq'],
  supseteq: ['⊇', 'rel', 'supseteq'], perp: ['⊥', 'rel', 'perp'], parallel: ['∥', 'rel', '||'], mid: ['∣', 'rel', '|'],
  to: ['→', 'rel', '->'], rightarrow: ['→', 'rel', '->'], leftarrow: ['←', 'rel', '<-'], gets: ['←', 'rel', '<-'],
  leftrightarrow: ['↔', 'rel', '<->'], Rightarrow: ['⇒', 'rel', '=>'], Leftarrow: ['⇐', 'rel', '<='], Leftrightarrow: ['⇔', 'rel', '<=>'],
  implies: ['⇒', 'rel', '=>'], iff: ['⇔', 'rel', '<=>'], mapsto: ['↦', 'rel', '|->'], uparrow: ['↑', 'rel', '^'], downarrow: ['↓', 'rel', 'v'],
  longrightarrow: ['⟶', 'rel', '-->'], longleftarrow: ['⟵', 'rel', '<--'], coloneqq: ['≔', 'rel', ':='],
  infty: ['∞', 'ord', 'inf'], partial: ['∂', 'ord', 'd'], nabla: ['∇', 'ord', 'nabla'], forall: ['∀', 'ord', 'for all'], exists: ['∃', 'ord', 'exists'],
  emptyset: ['∅', 'ord', '{}'], varnothing: ['∅', 'ord', '{}'], neg: ['¬', 'ord', '!'], lnot: ['¬', 'ord', '!'], angle: ['∠', 'ord', 'angle'],
  hbar: ['ℏ', 'ord', 'h'], ell: ['ℓ', 'ord', 'l'], aleph: ['ℵ', 'ord', 'aleph'], Re: ['ℜ', 'ord', 'Re'], Im: ['ℑ', 'ord', 'Im'], wp: ['℘', 'ord', 'p'],
  prime: ['′', 'ord', "'"], degree: ['°', 'ord', 'deg'], dots: ['…', 'ord', '...'], ldots: ['…', 'ord', '...'], cdots: ['⋯', 'ord', '...'],
  vdots: ['⋮', 'ord', ':'], ddots: ['⋱', 'ord', '...'], therefore: ['∴', 'rel', 'therefore'], because: ['∵', 'rel', 'because'],
  triangle: ['△', 'ord', 'triangle'], square: ['□', 'ord', '[]'], checkmark: ['✓', 'ord', 'v'], dagger: ['†', 'ord', '+'],
  langle: ['⟨', 'open', '<'], rangle: ['⟩', 'close', '>'], lfloor: ['⌊', 'open', '['], rfloor: ['⌋', 'close', ']'],
  lceil: ['⌈', 'open', '['], rceil: ['⌉', 'close', ']'], lvert: ['|', 'open', '|'], rvert: ['|', 'close', '|'],
  lVert: ['‖', 'open', '||'], rVert: ['‖', 'close', '||'], vert: ['|', 'ord', '|'], Vert: ['‖', 'ord', '||'],
  '{': ['{', 'open', '{'], '}': ['}', 'close', '}'], '|': ['‖', 'ord', '||'], '%': ['%', 'ord', '%'], '$': ['$', 'ord', '$'],
  '#': ['#', 'ord', '#'], '&': ['&', 'ord', '&'], _: ['_', 'ord', '_'], lbrace: ['{', 'open', '{'], rbrace: ['}', 'close', '}'],
  colon: [':', 'punct', ':'],
};

/** big operators -> [symbol, ascii] */
const NARY: Record<string, [string, string]> = {
  sum: ['∑', 'sum'], prod: ['∏', 'prod'], coprod: ['∐', 'coprod'], int: ['∫', 'int'], iint: ['∬', 'iint'], iiint: ['∭', 'iiint'],
  oint: ['∮', 'oint'], bigcup: ['⋃', 'U'], bigcap: ['⋂', 'n'], bigoplus: ['⨁', '(+)'], bigotimes: ['⨂', '(x)'], bigvee: ['⋁', 'v'], bigwedge: ['⋀', '^'],
};

const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'coth', 'log', 'ln', 'lg', 'exp',
  'lim', 'liminf', 'limsup', 'max', 'min', 'sup', 'inf', 'det', 'dim', 'ker', 'deg', 'gcd', 'arg', 'Pr', 'hom', 'mod', 'bmod',
]);

const ACCENTS: Record<string, string> = {
  hat: '̂', widehat: '̂', check: '̌', tilde: '̃', widetilde: '̃', acute: '́', grave: '̀',
  dot: '̇', ddot: '̈', breve: '̆', bar: '̅', vec: '⃗', overrightarrow: '⃗', mathring: '̊',
};

const SPACES: Record<string, number> = { ',': 0.17, thinspace: 0.17, ':': 0.22, '>': 0.22, medspace: 0.22, ';': 0.28, thickspace: 0.28, ' ': 0.33, quad: 1, qquad: 2, '!': -0.17, enspace: 0.5 };

const DOUBLE_STRUCK: Record<string, string> = { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' };

const CHAR_OPS: Record<string, OpClass> = {
  '+': 'bin', '-': 'bin', '*': 'bin', '/': 'ord', '=': 'rel', '<': 'rel', '>': 'rel', ',': 'punct', ';': 'punct', ':': 'rel',
  '!': 'close', '?': 'close', '(': 'open', '[': 'open', ')': 'close', ']': 'close', '|': 'ord', '.': 'ord',
};

/* ------------------------------------------------------------------ */
/* Tokenizer + parser                                                  */
/* ------------------------------------------------------------------ */

type Tok = { t: 'cmd'; v: string } | { t: 'char'; v: string } | { t: 'ws' };

const tokenize = (src: string): Tok[] => {
  const out: Tok[] = [];
  const chars = Array.from(src);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === '\\') {
      let j = i + 1;
      if (j < chars.length && /[a-zA-Z]/.test(chars[j])) {
        while (j < chars.length && /[a-zA-Z]/.test(chars[j])) j++;
        out.push({ t: 'cmd', v: chars.slice(i + 1, j).join('') });
        i = j - 1;
      } else if (j < chars.length) {
        out.push({ t: 'cmd', v: chars[j] });
        i = j;
      }
    } else if (/\s/.test(c)) {
      if (out[out.length - 1]?.t !== 'ws') out.push({ t: 'ws' });
    } else out.push({ t: 'char', v: c });
  }
  return out;
};

class Parser {
  private i = 0;
  private depth = 0;
  constructor(private toks: Tok[]) {}

  private peek(skipWs = true): Tok | undefined {
    let j = this.i;
    if (skipWs) while (this.toks[j]?.t === 'ws') j++;
    return this.toks[j];
  }
  private next(skipWs = true): Tok | undefined {
    if (skipWs) while (this.toks[this.i]?.t === 'ws') this.i++;
    return this.toks[this.i++];
  }
  private isChar(tok: Tok | undefined, v: string) {
    return tok?.t === 'char' && tok.v === v;
  }

  /** Parses until `}` / `\right` / `&` / `\\` (not consumed) or the end. */
  row(stop: 'brace' | 'right' | 'bracket' | 'env' | 'end' = 'end'): MathNode[] {
    const out: MathNode[] = [];
    if (++this.depth > 60) {
      this.depth--;
      return out;
    }
    while (this.i < this.toks.length) {
      const tok = this.peek();
      if (!tok) break;
      if (stop === 'brace' && this.isChar(tok, '}')) break;
      if (stop === 'bracket' && this.isChar(tok, ']')) break;
      if (stop === 'right' && tok.t === 'cmd' && tok.v === 'right') break;
      if (stop === 'env' && tok.t === 'cmd' && tok.v === 'end') break;
      if (stop !== 'brace' && stop !== 'bracket' && this.isChar(tok, '}')) {
        this.next(); // stray closing brace
        continue;
      }
      const before = this.i;
      this.atomWithScripts(out);
      if (this.i === before) this.i++; // never loop forever
    }
    this.depth--;
    return this.naryBodies(out);
  }

  /** A single argument: a braced group or one token. */
  private arg(): MathNode[] {
    const tok = this.peek();
    if (!tok) return [];
    if (this.isChar(tok, '{')) {
      this.next();
      const g = this.row('brace');
      this.next(); // }
      return g;
    }
    const out: MathNode[] = [];
    if (tok.t === 'char' && /\d/.test(tok.v)) {
      this.next();
      out.push({ k: 'ord', text: tok.v, variant: 'normal' }); // x^23 -> x²3 in TeX
      return out;
    }
    this.atom(out);
    return out;
  }

  /** Raw text of a braced argument (\text{…}, \begin{…}). */
  private rawArg(): string {
    const tok = this.peek();
    if (!this.isChar(tok, '{')) {
      const t = this.next();
      return t?.t === 'char' ? t.v : t?.t === 'cmd' ? t.v : '';
    }
    this.next();
    let depth = 0;
    let s = '';
    while (this.i < this.toks.length) {
      const t = this.toks[this.i++];
      if (t.t === 'char' && t.v === '{') depth++;
      if (t.t === 'char' && t.v === '}') {
        if (depth === 0) break;
        depth--;
      }
      s += t.t === 'ws' ? ' ' : t.t === 'cmd' ? (/^[a-zA-Z]+$/.test(t.v) ? `\\${t.v}` : t.v) : t.v;
    }
    return s;
  }

  private atomWithScripts(out: MathNode[]) {
    const tok = this.peek();
    if (tok && tok.t === 'char' && (tok.v === '^' || tok.v === '_')) {
      // script with no base
      out.push(this.scripts([]));
      return;
    }
    const start = out.length;
    this.atom(out);
    // scripts attach to the last node produced by the atom
    for (;;) {
      const t = this.peek();
      if (!(t?.t === 'char' && (t.v === '^' || t.v === '_' || t.v === "'"))) break;
      const base = out.length > start ? out.splice(out.length - 1, 1) : [];
      const last = base[0];
      if (last?.k === 'nary' && !last.body.length) {
        this.naryScripts(last);
        out.push(last);
      } else out.push(this.scripts(base));
    }
  }

  private naryScripts(node: Extract<MathNode, { k: 'nary' }>) {
    for (;;) {
      const t = this.peek();
      if (!(t?.t === 'char' && (t.v === '^' || t.v === '_'))) return;
      this.next();
      if (t.v === '^') node.sup = this.arg();
      else node.sub = this.arg();
    }
  }

  private scripts(base: MathNode[]): MathNode {
    let node: Extract<MathNode, { k: 'scripts' }>;
    const b = base[0];
    // x_i^2: add to an existing script node instead of nesting
    if (b?.k === 'scripts' && base.length === 1) node = b;
    else node = { k: 'scripts', base };
    for (;;) {
      const t = this.peek();
      if (!(t?.t === 'char' && (t.v === '^' || t.v === '_' || t.v === "'"))) break;
      if ((t.v === '^' && node.sup) || (t.v === '_' && node.sub)) break; // double script: start a new node
      this.next();
      if (t.v === "'") {
        node.sup = [...(node.sup || []), { k: 'op', text: '′', cls: 'ord', ascii: "'" }];
        continue;
      }
      const a = this.arg();
      if (t.v === '^') node.sup = [...(node.sup || []), ...a];
      else node.sub = a;
    }
    return node;
  }

  private delimToken(): string {
    const t = this.next();
    if (!t) return '';
    if (t.t === 'char') return t.v === '.' ? '' : t.v;
    if (t.t === 'cmd') return SYMBOLS[t.v]?.[0] ?? (t.v === '|' ? '‖' : t.v);
    return '';
  }

  private atom(out: MathNode[]) {
    const tok = this.next();
    if (!tok || tok.t === 'ws') return;
    if (tok.t === 'char') {
      const c = tok.v;
      if (c === '{') {
        const g = this.row('brace');
        this.next();
        // a group used as an atom keeps its content together (x^{…} handled by arg)
        if (g.length === 1) out.push(g[0]);
        else out.push({ k: 'delim', open: '', close: '', body: g });
        return;
      }
      if (c === '&') {
        out.push({ k: 'space', em: 1 });
        return;
      }
      if (c === '~') {
        out.push({ k: 'space', em: 0.33 });
        return;
      }
      if (/\d/.test(c)) {
        let text = c;
        while (this.toks[this.i]?.t === 'char' && /[\d.]/.test((this.toks[this.i] as { v: string }).v)) {
          const v = (this.toks[this.i] as { v: string }).v;
          if (v === '.' && !(this.toks[this.i + 1]?.t === 'char' && /\d/.test((this.toks[this.i + 1] as { v: string }).v))) break;
          text += v;
          this.i++;
        }
        out.push({ k: 'ord', text, variant: 'normal' });
        return;
      }
      if (/\p{L}/u.test(c)) {
        out.push({ k: 'ord', text: c });
        return;
      }
      if (c === "'") {
        out.push({ k: 'op', text: '′', cls: 'ord', ascii: "'" });
        return;
      }
      if (CHAR_OPS[c]) {
        out.push({ k: 'op', text: c === '-' ? '−' : c === '*' ? '∗' : c, cls: CHAR_OPS[c], ascii: c });
        return;
      }
      out.push({ k: 'op', text: c, cls: 'ord' });
      return;
    }
    this.command(tok.v, out);
  }

  private command(name: string, out: MathNode[]) {
    if (GREEK[name]) {
      // uppercase Greek is upright (TeX convention)
      out.push({ k: 'ord', text: GREEK[name], variant: /^[A-Z]/.test(name) ? 'normal' : undefined });
      return;
    }
    if (SYMBOLS[name]) {
      const [text, cls, ascii] = SYMBOLS[name];
      out.push({ k: 'op', text, cls, ascii });
      return;
    }
    if (NARY[name]) {
      out.push({ k: 'nary', op: NARY[name][0], ascii: NARY[name][1], body: [] });
      if (this.peek()?.t === 'cmd' && /^(limits|nolimits)$/.test((this.peek() as { v: string }).v)) this.next();
      return;
    }
    if (FUNCTIONS.has(name)) {
      out.push({ k: 'fn', name: name === 'bmod' ? 'mod' : name });
      if (this.peek()?.t === 'cmd' && /^(limits|nolimits)$/.test((this.peek() as { v: string }).v)) this.next();
      return;
    }
    if (name in SPACES) {
      out.push({ k: 'space', em: SPACES[name] });
      return;
    }
    if (ACCENTS[name]) {
      out.push({ k: 'accent', accent: ACCENTS[name], body: this.arg() });
      return;
    }
    switch (name) {
      case 'frac':
      case 'dfrac':
      case 'tfrac':
      case 'cfrac': {
        const num = this.arg();
        const den = this.arg();
        out.push({ k: 'frac', num, den });
        return;
      }
      case 'binom':
      case 'dbinom':
      case 'tbinom': {
        const num = this.arg();
        const den = this.arg();
        out.push({ k: 'delim', open: '(', close: ')', body: [{ k: 'frac', num, den, noBar: true }] });
        return;
      }
      case 'sqrt': {
        let index: MathNode[] | undefined;
        if (this.isChar(this.peek(), '[')) {
          this.next();
          index = this.row('bracket');
          this.next();
        }
        out.push({ k: 'sqrt', body: this.arg(), index: index?.length ? index : undefined });
        return;
      }
      case 'left': {
        const open = this.delimToken();
        const body = this.row('right');
        let close = '';
        if (this.peek()?.t === 'cmd') {
          this.next(); // \right
          close = this.delimToken();
        }
        out.push({ k: 'delim', open, close, body });
        return;
      }
      case 'right':
        this.delimToken(); // unmatched \right: drop it
        return;
      case 'overline':
        out.push({ k: 'accent', accent: '̅', body: this.arg(), wide: true });
        return;
      case 'underline':
      case 'boxed':
      case 'displaystyle':
      case 'textstyle':
      case 'scriptstyle':
      case 'limits':
      case 'nolimits':
      case 'nonumber':
      case 'notag':
        if (name === 'underline' || name === 'boxed') out.push(...this.arg());
        return;
      case 'text':
      case 'textrm':
      case 'textnormal':
      case 'mbox':
      case 'textit':
      case 'textbf':
      case 'textsf':
      case 'texttt':
        out.push({ k: 'text', text: this.rawArg().replace(/\\([{}$%&#_])/g, '$1') });
        return;
      case 'operatorname':
        out.push({ k: 'fn', name: this.rawArg().replace(/\\/g, '') });
        return;
      case 'mathrm':
      case 'mathsf':
      case 'mathtt':
      case 'mathbf':
      case 'boldsymbol':
      case 'bm':
      case 'mathit':
      case 'mathcal':
      case 'mathscr':
      case 'mathfrak':
      case 'mathbb': {
        const variant: MathVariant = /^(mathbf|boldsymbol|bm)$/.test(name) ? 'bold' : /^(mathrm|mathsf|mathtt|mathbb)$/.test(name) ? 'normal' : 'italic';
        const nodes = this.arg();
        const restyle = (n: MathNode): MathNode => {
          if (n.k !== 'ord') return n;
          const text = name === 'mathbb' ? Array.from(n.text).map(ch => DOUBLE_STRUCK[ch] || ch).join('') : n.text;
          return { ...n, text, variant: /^\d+$/.test(n.text) && variant === 'italic' ? 'normal' : variant };
        };
        // mathrm{abc} is one upright word
        if (variant !== 'italic' && nodes.every(n => n.k === 'ord')) {
          const text = nodes.map(n => (n as { text: string }).text).join('');
          out.push(restyle({ k: 'ord', text }));
        } else out.push(...nodes.map(restyle));
        return;
      }
      case 'begin': {
        const env = this.rawArg();
        const body = this.row('env');
        if (this.peek()?.t === 'cmd') {
          this.next(); // \end
          this.rawArg();
        }
        const fences: Record<string, [string, string]> = { pmatrix: ['(', ')'], bmatrix: ['[', ']'], Bmatrix: ['{', '}'], vmatrix: ['|', '|'], Vmatrix: ['‖', '‖'], cases: ['{', ''] };
        const f = fences[env.replace(/\*$/, '')];
        if (f) out.push({ k: 'delim', open: f[0], close: f[1], body });
        else out.push(...body);
        return;
      }
      case 'end':
        this.rawArg();
        return;
      case '\\':
      case 'newline':
      case 'cr':
        out.push({ k: 'op', text: ';', cls: 'punct' }, { k: 'space', em: 0.5 });
        return;
      case 'big':
      case 'Big':
      case 'bigg':
      case 'Bigg':
      case 'bigl':
      case 'bigr':
      case 'Bigl':
      case 'Bigr':
      case 'biggl':
      case 'biggr':
      case 'Biggl':
      case 'Biggr':
      case 'middle': {
        const d = this.delimToken();
        if (d) out.push({ k: 'op', text: d, cls: /l$/.test(name) ? 'open' : /r$/.test(name) ? 'close' : 'ord' });
        return;
      }
      case 'not': {
        const inner: MathNode[] = [];
        this.atom(inner);
        const n = inner[0];
        if (n?.k === 'op') {
          const negated: Record<string, string> = { '=': '≠', '∈': '∉', '⊂': '⊄', '≡': '≢', '<': '≮', '>': '≯', '∼': '≁' };
          out.push({ ...n, text: negated[n.text] || `${n.text}̸` });
        } else out.push(...inner);
        return;
      }
      default:
        // unknown command: show its name rather than losing it
        out.push({ k: 'ord', text: name, variant: 'normal' });
    }
  }

  /** Gives each big operator the term it applies to (up to the next + − = … at this level). */
  private naryBodies(nodes: MathNode[]): MathNode[] {
    const out: MathNode[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.k === 'nary' && !n.body.length) {
        let j = i + 1;
        while (j < nodes.length) {
          const m = nodes[j];
          if (m.k === 'op' && (m.cls === 'bin' || m.cls === 'rel' || m.cls === 'punct')) break;
          if (m.k === 'nary') break;
          j++;
        }
        n.body = nodes.slice(i + 1, j);
        // leading / trailing thin spaces (\, before dx) belong to the body as well
        out.push(n);
        i = j - 1;
      } else out.push(n);
    }
    return out;
  }
}

/** Parses a LaTeX math string. Never throws. */
export const parseLatex = (src: string): MathNode[] => {
  try {
    return new Parser(tokenize(src || '')).row();
  } catch {
    return src ? [{ k: 'text', text: src }] : [];
  }
};

/* ------------------------------------------------------------------ */
/* Unicode / ASCII linear form                                         */
/* ------------------------------------------------------------------ */

const SUP_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '−': '⁻', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ',
  T: 'ᵀ', '′': '′', '∗': '*', '*': '*',
};
const SUB_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '−': '₋', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
};

export interface LinearOptions {
  /** ASCII-safe output: Greek / symbols spelled out, scripts as ^ and _ */
  ascii?: boolean;
}

const isAtomic = (s: string) => Array.from(s).length <= 1 || /^[\p{L}\d.′]+$/u.test(s);

const linearRow = (nodes: MathNode[], o: LinearOptions): string => {
  let s = '';
  let prev: MathNode | null = null;
  for (const n of nodes) {
    const t = linearNode(n, o);
    if (n.k === 'op' && (n.cls === 'bin' || n.cls === 'rel')) {
      // unary minus / plus: no spaces
      const unary = n.cls === 'bin' && (!prev || (prev.k === 'op' && prev.cls !== 'close' && prev.cls !== 'ord'));
      s = unary ? s + t : `${s.replace(/ $/, '')} ${t} `;
    } else if (n.k === 'op' && n.cls === 'punct') s = `${s}${t} `;
    else if ((n.k === 'fn' || n.k === 'nary') && s && !/[\s(]$/.test(s)) s += ` ${t}`;
    else if ((prev?.k === 'fn' || (prev?.k === 'scripts' && prev.base[0]?.k === 'fn')) && t && !/^[\s(]/.test(t)) s += ` ${t}`;
    else s += t;
    prev = n;
  }
  return s.replace(/ {2,}/g, ' ');
};

const script = (content: MathNode[], kind: 'sup' | 'sub', o: LinearOptions): string => {
  const text = linearRow(content, o).trim();
  if (!text) return '';
  const map = kind === 'sup' ? SUP_MAP : SUB_MAP;
  const chars = Array.from(text.replace(/ /g, ''));
  if (chars.every(c => c === '′' || c === "'")) return o.ascii ? "'".repeat(chars.length) : text;
  if (!o.ascii && chars.every(c => map[c])) return chars.map(c => map[c]).join('');
  const mark = kind === 'sup' ? '^' : '_';
  return isAtomic(text) ? `${mark}${text}` : `${mark}(${text})`;
};

const wrap = (s: string) => (isAtomic(s) ? s : `(${s})`);

const linearNode = (n: MathNode, o: LinearOptions): string => {
  switch (n.k) {
    case 'ord':
      return o.ascii ? asciiText(n.text) : n.text;
    case 'op':
      return o.ascii ? (n.ascii ?? asciiText(n.text)) : n.text;
    case 'fn':
      return n.name;
    case 'text':
      return n.text;
    case 'space':
      return n.em >= 0.15 ? ' ' : '';
    case 'scripts': {
      const base = linearRow(n.base, o);
      const b = n.base.length === 1 && n.base[0].k !== 'frac' ? base : wrap(base);
      return `${b}${n.sub ? script(n.sub, 'sub', o) : ''}${n.sup ? script(n.sup, 'sup', o) : ''}`;
    }
    case 'frac': {
      const num = linearRow(n.num, o).trim();
      const den = linearRow(n.den, o).trim();
      return n.noBar ? `${num}, ${den}` : `${wrap(num)}/${wrap(den)}`;
    }
    case 'sqrt': {
      const body = linearRow(n.body, o).trim();
      if (o.ascii) return n.index ? `root(${linearRow(n.index, o)}, ${body})` : `sqrt(${body})`;
      const idx = n.index ? linearRow(n.index, o).trim() : '';
      const sign = idx === '3' ? '∛' : idx === '4' ? '∜' : idx ? `${script(n.index!, 'sup', o)}√` : '√';
      return `${sign}${wrap(body)}`;
    }
    case 'nary': {
      const op = o.ascii ? n.ascii : n.op;
      const lim = `${n.sub ? script(n.sub, 'sub', o) : ''}${n.sup ? script(n.sup, 'sup', o) : ''}`;
      const body = linearRow(n.body, o).trim();
      return `${op}${lim}${body ? ` ${body}` : ''}`;
    }
    case 'delim': {
      const open = o.ascii ? asciiText(n.open) : n.open;
      const close = o.ascii ? asciiText(n.close) : n.close;
      return `${open}${linearRow(n.body, o).trim()}${close}`;
    }
    case 'accent': {
      const body = linearRow(n.body, o).trim();
      if (o.ascii) return body;
      // combining mark after a single character; bar over longer bodies
      return Array.from(body).length === 1 ? `${body}${n.accent}` : n.wide || n.accent === '̅' ? `${Array.from(body).map(c => c + '̅').join('')}` : `${body}${n.accent}`;
    }
  }
};

const GREEK_NAMES: Record<string, string> = Object.fromEntries(Object.entries(GREEK).map(([k, v]) => [v, k]));
const ASCII_SYMBOLS: Record<string, string> = {
  ...Object.fromEntries(Object.values(SYMBOLS).map(([u, , a]) => [u, a])),
  ...Object.fromEntries(Object.values(NARY).map(([u, a]) => [u, a])),
  '−': '-', '∗': '*', '′': "'", ℂ: 'C', ℍ: 'H', ℕ: 'N', ℙ: 'P', ℚ: 'Q', ℝ: 'R', ℤ: 'Z',
};

const asciiText = (s: string) =>
  Array.from(s)
    .map(c => GREEK_NAMES[c] ?? ASCII_SYMBOLS[c] ?? c)
    .join('');

/** ASCII spelling of a single math character ("α" → "alpha", "≤" → "<="). */
export const asciiMath = (ch: string): string => asciiText(ch);

/** Readable single-line form: "E = mc²", "(a + b)/2", "√(x + 1)", "∑ᵢ₌₁ⁿ i". */
export const latexToUnicode = (latex: string, opts: LinearOptions = {}): string => {
  try {
    return linearRow(parseLatex(latex), opts).trim();
  } catch {
    return latex;
  }
};

/* ------------------------------------------------------------------ */
/* OMML (Word math)                                                    */
/* ------------------------------------------------------------------ */

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const mRun = (text: string, sty?: 'p' | 'b' | 'i', normalText = false) =>
  text
    ? `<m:r>${sty || normalText ? `<m:rPr>${normalText ? '<m:nor/>' : ''}${sty ? `<m:sty m:val="${sty}"/>` : ''}</m:rPr>` : ''}<m:t xml:space="preserve">${xmlEscape(text)}</m:t></m:r>`
    : '';

const isFnNode = (n: MathNode | undefined) => !!n && (n.k === 'fn' || (n.k === 'scripts' && n.base.length === 1 && n.base[0].k === 'fn' && !!n.sub && !n.sup));

/** Function names (\sin x, \lim_{x→0} f) become Word's m:func with the next atom as argument. */
const ommlRow = (nodes: MathNode[]): string => {
  let out = '';
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const next = nodes[i + 1];
    if (isFnNode(n) && next && !(next.k === 'op' && next.cls !== 'open' && next.cls !== 'ord') && next.k !== 'space') {
      const name =
        n.k === 'scripts'
          ? `<m:limLow>${el('e', mRun((n.base[0] as { name: string }).name, 'p'))}${el('lim', ommlRow(n.sub!))}</m:limLow>`
          : mRun((n as { name: string }).name, 'p');
      // "sin(x + 1)": the whole bracket is the argument
      let end = i + 1;
      if (next.k === 'op' && next.cls === 'open') {
        let depth = 0;
        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          if (m.k === 'op' && m.cls === 'open') depth++;
          if (m.k === 'op' && m.cls === 'close' && --depth === 0) {
            end = j;
            break;
          }
        }
      }
      out += `<m:func><m:fName>${name}</m:fName>${el('e', ommlRow(nodes.slice(i + 1, end + 1)))}</m:func>`;
      i = end;
      continue;
    }
    out += ommlNode(n);
  }
  return out;
};
const el = (name: string, inner: string) => (inner ? `<m:${name}>${inner}</m:${name}>` : `<m:${name}/>`);

const ommlNode = (n: MathNode): string => {
  switch (n.k) {
    case 'ord': {
      // multi-letter identifiers (\mathrm{abc}) and numbers are upright; single letters use math italic
      const sty = n.variant === 'bold' ? 'b' : n.variant === 'normal' && /\p{L}/u.test(n.text) ? 'p' : undefined;
      return mRun(n.text, sty);
    }
    case 'op':
      return mRun(n.text);
    case 'fn':
      return mRun(n.name, 'p');
    case 'text':
      return mRun(n.text, 'p', true);
    case 'space':
      return n.em <= 0 ? '' : mRun(n.em >= 1 ? ' '.repeat(Math.round(n.em)) : n.em >= 0.28 ? ' ' : n.em >= 0.22 ? ' ' : ' ');
    case 'scripts': {
      const e = el('e', ommlRow(n.base));
      if (n.sub && n.sup) return `<m:sSubSup>${e}${el('sub', ommlRow(n.sub))}${el('sup', ommlRow(n.sup))}</m:sSubSup>`;
      if (n.sup) return `<m:sSup>${e}${el('sup', ommlRow(n.sup))}</m:sSup>`;
      if (n.sub) return `<m:sSub>${e}${el('sub', ommlRow(n.sub))}</m:sSub>`;
      return ommlRow(n.base);
    }
    case 'frac':
      return `<m:f>${n.noBar ? '<m:fPr><m:type m:val="noBar"/></m:fPr>' : ''}${el('num', ommlRow(n.num))}${el('den', ommlRow(n.den))}</m:f>`;
    case 'sqrt':
      return n.index
        ? `<m:rad>${el('deg', ommlRow(n.index))}${el('e', ommlRow(n.body))}</m:rad>`
        : `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/>${el('e', ommlRow(n.body))}</m:rad>`;
    case 'nary': {
      const pr = [
        n.op === '∫' ? '' : `<m:chr m:val="${xmlEscape(n.op)}"/>`,
        `<m:limLoc m:val="${/[∫∬∭∮]/.test(n.op) ? 'subSup' : 'undOvr'}"/>`,
        n.sub ? '' : '<m:subHide m:val="1"/>',
        n.sup ? '' : '<m:supHide m:val="1"/>',
      ].join('');
      return `<m:nary><m:naryPr>${pr}</m:naryPr>${el('sub', n.sub ? ommlRow(n.sub) : '')}${el('sup', n.sup ? ommlRow(n.sup) : '')}${el('e', ommlRow(n.body))}</m:nary>`;
    }
    case 'delim':
      if (!n.open && !n.close) return ommlRow(n.body);
      return `<m:d><m:dPr><m:begChr m:val="${xmlEscape(n.open)}"/><m:endChr m:val="${xmlEscape(n.close)}"/></m:dPr>${el('e', ommlRow(n.body))}</m:d>`;
    case 'accent':
      if (n.wide) return `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr>${el('e', ommlRow(n.body))}</m:bar>`;
      return `<m:acc><m:accPr><m:chr m:val="${n.accent}"/></m:accPr>${el('e', ommlRow(n.body))}</m:acc>`;
  }
};

/**
 * Word math XML for an equation: `<m:oMath>` (inline) or `<m:oMathPara>`
 * (display — Word centres it on its own line). Relies on the `m` namespace
 * being declared on the document root (the `docx` package does that).
 */
export const latexToOmml = (latex: string, display = false): string => {
  const inner = ommlRow(parseLatex(latex)) || mRun(latex);
  const math = `<m:oMath>${inner}</m:oMath>`;
  return display ? `<m:oMathPara>${math}</m:oMathPara>` : math;
};

/* ------------------------------------------------------------------ */
/* OMML -> LaTeX (DOCX import)                                         */
/* ------------------------------------------------------------------ */

const REVERSE_SYMBOLS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [name, ch] of Object.entries(GREEK)) if (!map[ch]) map[ch] = `\\${name}`;
  for (const [name, [ch]] of Object.entries(SYMBOLS)) if (!map[ch] && /^[a-zA-Z]+$/.test(name) && ch.length === 1 && !/[{}|%$#&_]/.test(ch)) map[ch] = `\\${name}`;
  for (const [name, [ch]] of Object.entries(NARY)) map[ch] = `\\${name}`;
  map['−'] = '-';
  map['∗'] = '*';
  map['′'] = "'";
  map[' '] = '\\,';
  map[' '] = '\\:';
  map[' '] = '\\;';
  map[' '] = '\\quad ';
  return map;
})();

const texText = (s: string) =>
  Array.from(s)
    .map(c => {
      const r = REVERSE_SYMBOLS[c];
      return r ? (/^\\[a-zA-Z]+$/.test(r) ? `${r} ` : r) : c;
    })
    .join('')
    .replace(/ +$/, '');

const mVal = (e: Element | null | undefined) => e?.getAttribute('m:val') ?? e?.getAttributeNS?.('http://schemas.openxmlformats.org/officeDocument/2006/math', 'val') ?? null;
const kids = (e: Element, local?: string) => Array.from(e.children).filter(c => !local || c.localName === local);
const kid = (e: Element, local: string) => kids(e, local)[0] as Element | undefined;
const group = (s: string) => (Array.from(s).length === 1 ? s : `{${s}}`);

const DELIM_TEX: Record<string, string> = { '{': '\\{', '}': '\\}', '⟨': '\\langle', '⟩': '\\rangle', '‖': '\\|', '⌊': '\\lfloor', '⌋': '\\rfloor', '⌈': '\\lceil', '⌉': '\\rceil', '': '.' };

const ommlChildren = (e: Element | undefined): string => (e ? kids(e).map(ommlToTex).join('') : '');

const ommlToTex = (e: Element): string => {
  switch (e.localName) {
    case 'r': {
      const t = kids(e, 't').map(x => x.textContent || '').join('');
      const rPr = kid(e, 'rPr');
      if (rPr && kid(rPr, 'nor')) return `\\text{${t}}`;
      const sty = rPr ? mVal(kid(rPr, 'sty')) : null;
      if (sty === 'p' && /^[a-zA-Z]{2,}$/.test(t)) return FUNCTIONS.has(t) ? `\\${t} ` : `\\mathrm{${t}}`;
      if (sty === 'b' && /^\p{L}+$/u.test(t)) return `\\mathbf{${t}}`;
      return texText(t);
    }
    case 'sSup':
      return `${group(ommlChildren(kid(e, 'e')))}^${group(ommlChildren(kid(e, 'sup')))}`;
    case 'sSub':
      return `${group(ommlChildren(kid(e, 'e')))}_${group(ommlChildren(kid(e, 'sub')))}`;
    case 'sSubSup':
      return `${group(ommlChildren(kid(e, 'e')))}_${group(ommlChildren(kid(e, 'sub')))}^${group(ommlChildren(kid(e, 'sup')))}`;
    case 'f': {
      const noBar = mVal(kid(kid(e, 'fPr') || e, 'type')) === 'noBar';
      return `\\${noBar ? 'binom' : 'frac'}{${ommlChildren(kid(e, 'num'))}}{${ommlChildren(kid(e, 'den'))}}`;
    }
    case 'rad': {
      const deg = ommlChildren(kid(e, 'deg'));
      return `\\sqrt${deg ? `[${deg}]` : ''}{${ommlChildren(kid(e, 'e'))}}`;
    }
    case 'nary': {
      const pr = kid(e, 'naryPr');
      const chr = (pr && mVal(kid(pr, 'chr'))) || '∫';
      const op = REVERSE_SYMBOLS[chr] || chr;
      const sub = ommlChildren(kid(e, 'sub'));
      const sup = ommlChildren(kid(e, 'sup'));
      return `${op}${sub ? `_${group(sub)}` : ''}${sup ? `^${group(sup)}` : ''} ${ommlChildren(kid(e, 'e'))}`;
    }
    case 'd': {
      const pr = kid(e, 'dPr');
      const beg = pr && kid(pr, 'begChr') ? mVal(kid(pr, 'begChr')) ?? '(' : '(';
      const end = pr && kid(pr, 'endChr') ? mVal(kid(pr, 'endChr')) ?? ')' : ')';
      const sep = (pr && mVal(kid(pr, 'sepChr'))) || '|';
      const inner = kids(e, 'e').map(ommlChildren).join(sep === '|' ? ',' : sep);
      if (beg === '(' && end === ')' && /^\\binom/.test(inner)) return inner;
      return `\\left${DELIM_TEX[beg] ?? beg}${inner}\\right${DELIM_TEX[end] ?? end}`;
    }
    case 'acc': {
      const chr = mVal(kid(kid(e, 'accPr') || e, 'chr')) || '̂';
      const name = Object.entries(ACCENTS).find(([, c]) => c === chr)?.[0] || 'hat';
      return `\\${name}{${ommlChildren(kid(e, 'e'))}}`;
    }
    case 'bar':
      return `\\overline{${ommlChildren(kid(e, 'e'))}}`;
    case 'func':
      return `${ommlChildren(kid(e, 'fName'))} ${ommlChildren(kid(e, 'e'))}`;
    case 'limLow':
      return `${ommlChildren(kid(e, 'e'))}_{${ommlChildren(kid(e, 'lim'))}}`;
    case 'limUpp':
      return `${ommlChildren(kid(e, 'e'))}^{${ommlChildren(kid(e, 'lim'))}}`;
    case 'm':
      return `\\begin{matrix}${kids(e, 'mr').map(r => kids(r, 'e').map(ommlChildren).join(' & ')).join(' \\\\ ')}\\end{matrix}`;
    case 'eqArr':
      return kids(e, 'e').map(ommlChildren).join(' \\\\ ');
    case 'box':
    case 'borderBox':
    case 'groupChr':
    case 'phant':
    case 'e':
    case 'oMath':
      return ommlChildren(e.localName === 'e' || e.localName === 'oMath' ? e : kid(e, 'e'));
    case 'rPr':
    case 'ctrlPr':
      return '';
    default:
      return e.localName.endsWith('Pr') ? '' : ommlChildren(e);
  }
};

/** LaTeX source of a Word `<m:oMath>` element (best effort, never throws). */
export const ommlToLatex = (oMath: Element): string => {
  try {
    return ommlToTex(oMath).replace(/\s{2,}/g, ' ').trim();
  } catch {
    return oMath.textContent || '';
  }
};
