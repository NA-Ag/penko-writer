import type { Transaction } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';

/**
 * Helpers that let plugins skip whole-document work when a transaction can't
 * have affected what they care about (most keystrokes only touch text).
 */

export interface ChangedRange {
  /** Range in the document before the transaction. */
  oldFrom: number;
  oldTo: number;
  /** Range in the document after the transaction. */
  newFrom: number;
  newTo: number;
}

export const changedRanges = (trs: readonly Transaction[]): { ranges: ChangedRange[]; before: PMNode | null } => {
  const ranges: ChangedRange[] = [];
  let before: PMNode | null = null;
  for (const tr of trs) {
    if (!tr.docChanged) continue;
    if (!before) before = tr.before;
    tr.mapping.maps.forEach((map, i) => {
      const rest = tr.mapping.slice(i + 1);
      const invertPrev = tr.mapping.slice(0, i).invert();
      map.forEach((oldStart, oldEnd, newStart, newEnd) => {
        ranges.push({
          oldFrom: invertPrev.map(oldStart, -1),
          oldTo: invertPrev.map(oldEnd, 1),
          newFrom: rest.map(newStart, -1),
          newTo: rest.map(newEnd, 1),
        });
      });
    });
  }
  return { ranges, before };
};

const clamp = (doc: PMNode, n: number) => Math.max(0, Math.min(n, doc.content.size));

/** True when any changed range (old or new side) contains a node matching `test`. */
export const touchesNodes = (trs: readonly Transaction[], newDoc: PMNode, test: (node: PMNode) => boolean): boolean => {
  const { ranges, before } = changedRanges(trs);
  if (!ranges.length) return false;
  let found = false;
  const scan = (doc: PMNode, from: number, to: number) => {
    const a = clamp(doc, from);
    const b = clamp(doc, Math.max(to, from));
    // widen to the enclosing textblock so edits inside a heading count as touching it
    const $a = doc.resolve(a);
    const start = $a.depth > 0 ? $a.before($a.depth) : a;
    doc.nodesBetween(start, Math.min(doc.content.size, b + 1), node => {
      if (found) return false;
      if (test(node)) found = true;
      return !found;
    });
  };
  for (const r of ranges) {
    if (before) scan(before, r.oldFrom, r.oldTo);
    if (!found) scan(newDoc, r.newFrom, r.newTo);
    if (found) break;
  }
  return found;
};
