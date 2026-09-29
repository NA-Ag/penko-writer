/**
 * Block-level diff / merge of two HTML documents (used by version history).
 *
 * Both versions are split into their top-level blocks (paragraphs, headings,
 * lists, tables…). Blocks are compared by their HTML, so formatting changes
 * count as changes, and merging simply picks whole blocks from either side,
 * which preserves all formatting.
 */

export interface HtmlBlock {
  /** outerHTML of the block */
  html: string;
  /** plain text, for display */
  text: string;
}

export type BlockDiffOp =
  | { type: 'equal'; oldBlock: HtmlBlock; newBlock: HtmlBlock }
  | { type: 'removed'; oldBlock: HtmlBlock }
  | { type: 'added'; newBlock: HtmlBlock }
  | { type: 'changed'; oldBlock: HtmlBlock; newBlock: HtmlBlock };

/** Accept = keep the current version's side (default). Reject = take the snapshot's side. */
export type BlockDecision = 'accept' | 'reject';

const INLINE_TAGS = new Set([
  'A', 'ABBR', 'B', 'BDI', 'BDO', 'BR', 'CITE', 'CODE', 'DATA', 'DFN', 'EM', 'I', 'IMG', 'KBD', 'MARK', 'Q', 'S', 'SAMP',
  'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME', 'U', 'VAR', 'WBR', 'DEL', 'INS', 'FONT', 'STRIKE',
]);

const blockText = (el: Element): string => {
  // Join nested blocks with newlines so list items / table cells stay readable.
  const parts: string[] = [];
  const walk = (node: Node, acc: { s: string }) => {
    node.childNodes.forEach(child => {
      if (child.nodeType === 3) acc.s += child.textContent || '';
      else if (child.nodeType === 1) {
        const tag = (child as Element).tagName;
        if (tag === 'BR') acc.s += '\n';
        else if (INLINE_TAGS.has(tag)) walk(child, acc);
        else {
          if (acc.s.trim()) parts.push(acc.s);
          acc.s = '';
          walk(child, acc);
          if (acc.s.trim()) parts.push(acc.s);
          acc.s = '';
        }
      }
    });
  };
  const acc = { s: '' };
  walk(el, acc);
  if (acc.s.trim()) parts.push(acc.s);
  return parts.map(p => p.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean).join('\n');
};

/** Split HTML into its top-level blocks. Stray top-level inline content is wrapped in <p>. */
export const splitBlocks = (html: string): HtmlBlock[] => {
  const tpl = document.createElement('template');
  tpl.innerHTML = html || '';
  const blocks: HtmlBlock[] = [];
  let pendingInline: Node[] = [];
  const flushInline = () => {
    if (!pendingInline.length) return;
    const p = document.createElement('p');
    pendingInline.forEach(n => p.appendChild(n.cloneNode(true)));
    pendingInline = [];
    if ((p.textContent || '').trim() || p.querySelector('img')) blocks.push({ html: p.outerHTML, text: blockText(p) });
  };
  Array.from(tpl.content.childNodes).forEach(node => {
    if (node.nodeType === 1 && !INLINE_TAGS.has((node as Element).tagName)) {
      flushInline();
      const el = node as Element;
      blocks.push({ html: el.outerHTML, text: blockText(el) });
    } else if (node.nodeType === 3 || node.nodeType === 1) {
      pendingInline.push(node);
    }
  });
  flushInline();
  return blocks;
};

/** Longest-common-subsequence diff of two block lists (compared by HTML). */
export const diffBlocks = (oldBlocks: HtmlBlock[], newBlocks: HtmlBlock[]): BlockDiffOp[] => {
  const n = oldBlocks.length;
  const m = newBlocks.length;
  // Trim common prefix / suffix to keep the table small for typical edits.
  let start = 0;
  while (start < n && start < m && oldBlocks[start].html === newBlocks[start].html) start++;
  let endOld = n;
  let endNew = m;
  while (endOld > start && endNew > start && oldBlocks[endOld - 1].html === newBlocks[endNew - 1].html) {
    endOld--;
    endNew--;
  }
  const a = oldBlocks.slice(start, endOld);
  const b = newBlocks.slice(start, endNew);
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i].html === b[j].html ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const raw: BlockDiffOp[] = [];
  for (let k = 0; k < start; k++) raw.push({ type: 'equal', oldBlock: oldBlocks[k], newBlock: newBlocks[k] });
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i].html === b[j].html) {
      raw.push({ type: 'equal', oldBlock: a[i], newBlock: b[j] });
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      raw.push({ type: 'added', newBlock: b[j] });
      j++;
    } else {
      raw.push({ type: 'removed', oldBlock: a[i] });
      i++;
    }
  }
  for (let k = 0; k < n - endOld; k++) raw.push({ type: 'equal', oldBlock: oldBlocks[endOld + k], newBlock: newBlocks[endNew + k] });

  // Pair up runs of removed + added blocks into "changed" blocks.
  const out: BlockDiffOp[] = [];
  let idx = 0;
  while (idx < raw.length) {
    if (raw[idx].type === 'equal') {
      out.push(raw[idx++]);
      continue;
    }
    const removed: HtmlBlock[] = [];
    const added: HtmlBlock[] = [];
    while (idx < raw.length && raw[idx].type !== 'equal') {
      const op = raw[idx++];
      if (op.type === 'removed') removed.push(op.oldBlock);
      else if (op.type === 'added') added.push(op.newBlock);
    }
    const pairs = Math.min(removed.length, added.length);
    for (let k = 0; k < pairs; k++) out.push({ type: 'changed', oldBlock: removed[k], newBlock: added[k] });
    for (let k = pairs; k < removed.length; k++) out.push({ type: 'removed', oldBlock: removed[k] });
    for (let k = pairs; k < added.length; k++) out.push({ type: 'added', newBlock: added[k] });
  }
  return out;
};

/**
 * Build merged HTML. Every change defaults to the current version ("accept");
 * rejected changes take the snapshot's version of that block instead.
 */
export const mergeBlocks = (ops: BlockDiffOp[], decisions: Record<number, BlockDecision>): string => {
  const parts: string[] = [];
  ops.forEach((op, i) => {
    const reject = decisions[i] === 'reject';
    switch (op.type) {
      case 'equal':
        parts.push(op.newBlock.html);
        break;
      case 'added':
        if (!reject) parts.push(op.newBlock.html);
        break;
      case 'removed':
        if (reject) parts.push(op.oldBlock.html);
        break;
      case 'changed':
        parts.push(reject ? op.oldBlock.html : op.newBlock.html);
        break;
    }
  });
  return parts.join('') || '<p></p>';
};
