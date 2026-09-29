/**
 * Splits document HTML into presentation slides.
 *
 * Slides start at H1/H2 headings found at ANY depth: wrapper containers
 * (templates wrap everything in styled <div>s) are flattened, and each slide
 * gets shallow copies of the wrappers so fonts/colours are kept. A heading
 * that directly follows another heading (title + subtitle) stays on the same
 * slide. When H1/H2 produce a single slide, H3 is used as well.
 */
import { sanitizeHtml } from '../editor/sanitize';

/** Elements that are never split even when they contain headings. */
const ATOMIC = new Set(['TABLE', 'UL', 'OL', 'DL', 'PRE', 'BLOCKQUOTE', 'FIGURE', 'P']);

interface Leaf {
  node: Node;
  ancestors: Element[];
}

const isHeading = (el: Node, levels: Set<string>) => el.nodeType === 1 && levels.has((el as Element).tagName);

const collectLeaves = (parent: Element, ancestors: Element[], selector: string, out: Leaf[]) => {
  Array.from(parent.childNodes).forEach(child => {
    if (child.nodeType === 3 && !(child.textContent || '').trim()) return; // whitespace
    if (child.nodeType === 8) return; // comment
    if (child.nodeType === 1) {
      const el = child as Element;
      if (!ATOMIC.has(el.tagName) && !/^H[1-6]$/.test(el.tagName) && el.querySelector(selector)) {
        collectLeaves(el, [...ancestors, el], selector, out);
        return;
      }
    }
    out.push({ node: child, ancestors });
  });
};

const hasRealContent = (nodes: Node[], levels: Set<string>) =>
  nodes.some(n => !isHeading(n, levels) && ((n.textContent || '').trim() || (n.nodeType === 1 && (n as Element).querySelector('img,hr,table,svg'))));

const buildSlides = (body: HTMLElement, levelsList: string[]): string[] => {
  const levels = new Set(levelsList);
  const selector = levelsList.map(l => l.toLowerCase()).join(',');
  const leaves: Leaf[] = [];
  collectLeaves(body, [], selector, leaves);

  const groups: Leaf[][] = [];
  let current: Leaf[] = [];
  leaves.forEach(leaf => {
    if (isHeading(leaf.node, levels) && hasRealContent(current.map(l => l.node), levels)) {
      groups.push(current);
      current = [];
    }
    current.push(leaf);
  });
  if (current.length) groups.push(current);

  const doc = body.ownerDocument;
  return groups
    .map(group => {
      const root = doc.createElement('div');
      // path of [source ancestor, cloned shell]
      let path: Array<[Element, Element]> = [];
      group.forEach(({ node, ancestors }) => {
        let i = 0;
        while (i < path.length && i < ancestors.length && path[i][0] === ancestors[i]) i++;
        path = path.slice(0, i);
        let parent: Element = path.length ? path[path.length - 1][1] : root;
        for (let j = i; j < ancestors.length; j++) {
          const shell = ancestors[j].cloneNode(false) as Element;
          parent.appendChild(shell);
          path.push([ancestors[j], shell]);
          parent = shell;
        }
        parent.appendChild(node.cloneNode(true));
      });
      return root.innerHTML;
    })
    .filter(html => html.trim());
};

export const splitIntoSlides = (html: string): string[] => {
  const clean = sanitizeHtml(html || '');
  const parsed = new DOMParser().parseFromString(`<body>${clean}</body>`, 'text/html');
  const body = parsed.body;
  if (!(body.textContent || '').trim() && !body.querySelector('img,table,hr')) return [];
  let slides = buildSlides(body, ['H1', 'H2']);
  if (slides.length <= 1) {
    const withH3 = buildSlides(body, ['H1', 'H2', 'H3']);
    if (withH3.length > 1) slides = withH3;
  }
  return slides.map(s => sanitizeHtml(s));
};

const parseColor = (value: string): [number, number, number] | null => {
  const v = value.trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3})$/);
  if (m) return [0, 1, 2].map(i => parseInt(m![1][i] + m![1][i], 16)) as [number, number, number];
  m = v.match(/^#([0-9a-f]{6})/);
  if (m) return [0, 2, 4].map(i => parseInt(m![1].slice(i, i + 2), 16)) as [number, number, number];
  m = v.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  if (v === 'black') return [0, 0, 0];
  return null;
};

const luminance = ([r, g, b]: [number, number, number]) => {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/**
 * True when the slide sets explicit dark text colours (e.g. templates using
 * #333) that would be unreadable on the black presentation stage.
 */
export const slideNeedsLightSurface = (html: string): boolean => {
  const re = /(?:^|[;"'\s])color\s*:\s*([^;"']+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const rgb = parseColor(m[1]);
    if (rgb && luminance(rgb) < 0.2) return true;
  }
  return false;
};
