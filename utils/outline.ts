import type { Node as PMNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';

export interface OutlineHeading {
  index: number;
  pos: number;
  level: number;
  text: string;
  /** Only top-level headings can be dragged (sections are ranges of top-level blocks). */
  topLevel: boolean;
}

export const collectHeadings = (doc: PMNode): OutlineHeading[] => {
  const out: OutlineHeading[] = [];
  doc.descendants((node, pos, parent) => {
    if (node.type.name === 'heading') {
      out.push({ index: out.length, pos, level: node.attrs.level || 1, text: node.textContent.trim(), topLevel: parent === doc });
      return false;
    }
    return true;
  });
  return out;
};

/** Range of a section: the heading plus everything up to the next heading of the same or higher level. */
export const sectionRange = (doc: PMNode, headingPos: number): { from: number; to: number } | null => {
  const $pos = doc.resolve(headingPos);
  if ($pos.depth !== 0) return null;
  const heading = doc.nodeAt(headingPos);
  if (!heading || heading.type.name !== 'heading') return null;
  const level = heading.attrs.level || 1;
  let to = doc.content.size;
  let found = false;
  doc.forEach((node, offset) => {
    if (found || offset <= headingPos) return;
    if (node.type.name === 'heading' && (node.attrs.level || 1) <= level) {
      to = offset;
      found = true;
    }
  });
  return { from: headingPos, to };
};

/**
 * Move the section starting at `sourcePos` before (or after the section of)
 * the heading at `targetPos`. Returns false when the move is a no-op/invalid.
 */
export const moveSection = (tr: Transaction, sourcePos: number, targetPos: number, placement: 'before' | 'after'): boolean => {
  const doc = tr.doc;
  const source = sectionRange(doc, sourcePos);
  const target = sectionRange(doc, targetPos);
  if (!source || !target) return false;
  const insertAt = placement === 'before' ? target.from : target.to;
  if (insertAt >= source.from && insertAt <= source.to) return false;
  const slice = doc.slice(source.from, source.to);
  tr.delete(source.from, source.to);
  tr.insert(tr.mapping.map(insertAt), slice.content);
  return true;
};
