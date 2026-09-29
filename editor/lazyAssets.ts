/**
 * Heavy renderers that most documents never need (KaTeX for equations, Prism
 * for code highlighting) are loaded on first use instead of at startup.
 */
import type KatexType from 'katex';
import type PrismType from 'prismjs';

let katex: typeof KatexType | null = null;
let katexPromise: Promise<typeof KatexType> | null = null;
export const getKatex = () => katex;
export const loadKatex = (): Promise<typeof KatexType> =>
  (katexPromise ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([m]) => (katex = m.default)));

let prism: typeof PrismType | null = null;
let prismPromise: Promise<typeof PrismType> | null = null;
export const getPrism = () => prism;
export const loadPrism = (): Promise<typeof PrismType> => (prismPromise ??= import('./prism').then(m => (prism = m.default)));

/** Make sure rendered HTML (exports, print) includes equations and highlighting. */
export const ensureRenderAssets = () => Promise.all([loadKatex(), loadPrism()]);
