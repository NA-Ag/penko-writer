import { Extension, Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, Transaction, EditorState } from '@tiptap/pm/state';
import { ReplaceStep, canJoin } from '@tiptap/pm/transform';
import { isHistoryTransaction } from '@tiptap/pm/history';
import { Fragment, Node as PMNode, Slice, MarkType } from '@tiptap/pm/model';

/* ------------------------------------------------------------------ */
/* Comments                                                            */
/* ------------------------------------------------------------------ */

export const CommentMark = Mark.create({
  name: 'comment',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return {
      commentId: { default: null, parseHTML: el => el.getAttribute('data-comment-id') },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-comment-id]', priority: 60 }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'comment-highlight', 'data-comment-id': HTMLAttributes.commentId }), 0];
  },
});

/** Collect [from, to] ranges covered by a mark with the given attribute. */
export const findMarkRanges = (doc: PMNode, markName: string, attr: string, value: string) => {
  const ranges: { from: number; to: number }[] = [];
  doc.descendants((node, pos) => {
    if (!node.isInline) return true;
    const mark = node.marks.find(m => m.type.name === markName && m.attrs[attr] === value);
    if (mark) {
      const last = ranges[ranges.length - 1];
      if (last && last.to === pos) last.to = pos + node.nodeSize;
      else ranges.push({ from: pos, to: pos + node.nodeSize });
    }
    return true;
  });
  return ranges;
};

/* ------------------------------------------------------------------ */
/* Track changes                                                       */
/* ------------------------------------------------------------------ */

const changeAttrs = () => ({
  changeId: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute('data-change-id') },
  author: { default: '', parseHTML: (el: HTMLElement) => el.getAttribute('data-author') || '' },
  timestamp: { default: 0, parseHTML: (el: HTMLElement) => parseInt(el.getAttribute('data-timestamp') || '0', 10) || 0 },
});

export const Insertion = Mark.create({
  name: 'insertion',
  inclusive: true,
  excludes: 'deletion',
  addAttributes: changeAttrs,
  parseHTML() {
    return [{ tag: 'ins[data-change-id]' }, { tag: 'span.track-insert[data-change-id]' }];
  },
  renderHTML({ HTMLAttributes: a }) {
    return ['ins', { class: 'track-insert', 'data-change-id': a.changeId, 'data-author': a.author, 'data-timestamp': a.timestamp, title: a.author }, 0];
  },
});

export const Deletion = Mark.create({
  name: 'deletion',
  inclusive: false,
  excludes: 'insertion',
  addAttributes: changeAttrs,
  parseHTML() {
    return [{ tag: 'del[data-change-id]' }, { tag: 'span.track-delete[data-change-id]' }];
  },
  renderHTML({ HTMLAttributes: a }) {
    return ['del', { class: 'track-delete', 'data-change-id': a.changeId, 'data-author': a.author, 'data-timestamp': a.timestamp, title: a.author }, 0];
  },
});

export const trackChangesKey = new PluginKey<{ enabled: boolean; author: string }>('trackChanges');
const SKIP_META = 'penkoTrackSkip';

export interface TrackedChange {
  id: string;
  type: 'insert' | 'delete';
  author: string;
  timestamp: number;
  content: string;
}

/** List of tracked changes currently in the document, in order. */
export const collectTrackedChanges = (doc: PMNode): TrackedChange[] => {
  const map = new Map<string, TrackedChange>();
  doc.descendants(node => {
    const brk = node.isTextblock ? node.attrs.trackBreak : null;
    if (brk && !map.has(brk.changeId)) {
      map.set(brk.changeId, { id: brk.changeId, type: brk.type, author: brk.author, timestamp: brk.timestamp, content: '¶' });
    }
    if (!node.isInline) return true;
    for (const mark of node.marks) {
      if (mark.type.name !== 'insertion' && mark.type.name !== 'deletion') continue;
      const id = mark.attrs.changeId;
      const existing = map.get(id);
      const text = node.isText ? node.text || '' : '￼';
      if (existing) existing.content += text;
      else map.set(id, { id, type: mark.type.name === 'insertion' ? 'insert' : 'delete', author: mark.attrs.author, timestamp: mark.attrs.timestamp, content: text });
    }
    return true;
  });
  return Array.from(map.values());
};

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Strip insertion marks from content being deleted; mark the rest as deletion. */
const markDeleted = (fragment: Fragment, deletion: MarkType, insertion: MarkType, attrs: any): Fragment => {
  const nodes: PMNode[] = [];
  fragment.forEach(node => {
    if (node.isInline) {
      if (node.marks.some(m => m.type === insertion)) return; // deleting own tracked insertion: really delete
      if (node.marks.some(m => m.type === deletion)) nodes.push(node);
      else nodes.push(node.mark(deletion.create(attrs).addToSet(node.marks)));
    } else {
      nodes.push(node.copy(markDeleted(node.content, deletion, insertion, attrs)));
    }
  });
  return Fragment.fromArray(nodes);
};

const trackTransaction = (tr: Transaction, oldState: EditorState, newState: EditorState, author: string): Transaction | null => {
  const schema = newState.schema;
  const insertion = schema.marks.insertion;
  const deletion = schema.marks.deletion;
  if (!insertion || !deletion) return null;

  const out = newState.tr;
  const now = Date.now();
  let changed = false;

  tr.steps.forEach((step, i) => {
    if (!(step instanceof ReplaceStep)) return;
    const { from, to, slice } = step as any as { from: number; to: number; slice: Slice };
    const docBefore = tr.docs[i];
    // Map the step's position (in the doc after step i) to the final document.
    const restMapping = tr.mapping.slice(i + 1);
    const insertedFrom = restMapping.map(from, -1);
    const insertedTo = restMapping.map(from + slice.size, 1);
    const start = out.mapping.map(insertedFrom, -1);
    const end = out.mapping.map(insertedTo, 1);

    // Reuse the id of an adjacent insertion by the same author so typing is one change.
    const $pos = out.doc.resolve(Math.max(0, Math.min(start, out.doc.content.size)));
    const before = $pos.nodeBefore?.marks.find(m => m.type === insertion && m.attrs.author === author && now - m.attrs.timestamp < 5 * 60 * 1000);
    const insAttrs = before ? before.attrs : { changeId: newId(), author, timestamp: now };

    if (slice.size > 0 && end > start) {
      out.addMark(start, end, insertion.create(insAttrs));
      out.removeMark(start, end, deletion);
      changed = true;
      // New paragraph breaks (Enter): mark the block that now starts inside the insertion
      if (slice.openStart > 0 || slice.content.childCount > 1) {
        out.doc.nodesBetween(start, end, (node, pos) => {
          if (node.isTextblock && pos > start && pos < end && !node.attrs.trackBreak) {
            out.setNodeMarkup(pos, undefined, { ...node.attrs, trackBreak: { type: 'insert', changeId: newId(), author, timestamp: now } });
          }
          return !node.isTextblock;
        });
      }
    }

    if (to > from) {
      const deleted = docBefore.slice(from, to);
      // Joining with a paragraph break the same author inserted while tracking: just join.
      const $to = docBefore.resolve(to);
      const ownBreak = $to.parent.isTextblock && $to.parent.attrs.trackBreak;
      if (deleted.content.textBetween(0, deleted.content.size, '', '\ufffc') === '' && ownBreak && ownBreak.type === 'insert' && ownBreak.author === author) {
        return;
      }
      // Continue an adjacent deletion by the same author (repeated Backspace /
      // Delete) so it shows up as one change instead of one per character.
      const $at = out.doc.resolve(Math.max(0, Math.min(start, out.doc.content.size)));
      const isRecentDel = (m: { type: MarkType; attrs: any }) => m.type === deletion && m.attrs.author === author && now - m.attrs.timestamp < 5 * 60 * 1000;
      const adjacentDel = $at.nodeAfter?.marks.find(isRecentDel) || $at.nodeBefore?.marks.find(isRecentDel);
      const delAttrs = adjacentDel ? adjacentDel.attrs : { changeId: newId(), author, timestamp: now };
      const content = markDeleted(deleted.content, deletion, insertion, delAttrs);
      if (content.size > 0) {
        const reinsertion = new Slice(content, deleted.openStart, deleted.openEnd);
        const beforeSize = out.doc.content.size;
        try {
          out.replace(start, start, reinsertion);
        } catch {
          return;
        }
        const added = out.doc.content.size - beforeSize;
        changed = true;
        // Paragraph breaks that were removed come back marked as deleted (¶)
        if (deleted.openStart > 0 || deleted.content.childCount > 1) {
          const delBreak = { type: 'delete', changeId: delAttrs.changeId, author, timestamp: now };
          out.doc.nodesBetween(start, start + added + 1, (node, pos) => {
            if (node.isTextblock && pos > start && pos <= start + added) {
              if (!node.attrs.trackBreak) out.setNodeMarkup(pos, undefined, { ...node.attrs, trackBreak: delBreak });
            }
            return !node.isTextblock;
          });
        }
        // Backspace: keep the caret before the struck-out text; delete: after it.
        // (When text was typed over a selection the mapped caret — after the
        // new text — is already right.)
        const wasBackspace = oldState.selection.empty && oldState.selection.from === to;
        const caret = wasBackspace ? start : start + added;
        if (slice.size === 0 && (tr.selectionSet || oldState.selection.empty)) {
          try {
            out.setSelection(TextSelection.create(out.doc, Math.min(caret, out.doc.content.size)));
          } catch {
            /* ignore */
          }
        }
      }
    }
  });

  if (!changed) return null;
  out.setMeta(SKIP_META, true);
  return out;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    trackChanges: {
      setTrackChanges: (enabled: boolean, author?: string) => ReturnType;
      acceptChange: (changeId: string) => ReturnType;
      rejectChange: (changeId: string) => ReturnType;
      acceptAllChanges: () => ReturnType;
      rejectAllChanges: () => ReturnType;
    };
  }
}

const resolveChange = (state: EditorState, tr: Transaction, changeId: string | null, accept: boolean) => {
  const { insertion, deletion } = state.schema.marks;
  // Work from the end so positions stay valid.
  const targets: { from: number; to: number; type: 'insertion' | 'deletion'; id: string }[] = [];
  state.doc.descendants((node, pos) => {
    if (!node.isInline) return true;
    for (const mark of node.marks) {
      if ((mark.type === insertion || mark.type === deletion) && (changeId === null || mark.attrs.changeId === changeId)) {
        targets.push({ from: pos, to: pos + node.nodeSize, type: mark.type.name as any, id: mark.attrs.changeId });
      }
    }
    return true;
  });
  targets.sort((a, b) => a.from - b.from);
  // A change that spans a block boundary (e.g. "st¶sec") is stored as several
  // ranges; when its text is removed, remove the boundary too so the blocks
  // join again, as they would have without tracking.
  const merged: typeof targets = [];
  for (const t of targets) {
    const prev = merged[merged.length - 1];
    const removes = (x: { type: string }) => (accept && x.type === 'deletion') || (!accept && x.type === 'insertion');
    if (prev && prev.id === t.id && prev.type === t.type && removes(t) && t.from > prev.to) {
      let inlineBetween = false;
      state.doc.nodesBetween(prev.to, t.from, (node, pos) => {
        if (node.isInline && pos >= prev.to && pos + node.nodeSize <= t.from) inlineBetween = true;
        return !inlineBetween;
      });
      if (!inlineBetween) {
        prev.to = t.to;
        continue;
      }
    }
    merged.push({ ...t });
  }
  targets.length = 0;
  targets.push(...merged.reverse());
  for (const t of targets) {
    const removeText = (accept && t.type === 'deletion') || (!accept && t.type === 'insertion');
    if (removeText) tr.delete(t.from, t.to);
    else tr.removeMark(t.from, t.to, t.type === 'insertion' ? insertion : deletion);
  }

  // Paragraph breaks: accepting a deleted ¶ / rejecting an inserted one joins the blocks
  const breaks: { pos: number; join: boolean }[] = [];
  state.doc.descendants((node, pos) => {
    const brk = node.isTextblock ? node.attrs.trackBreak : null;
    if (brk && (changeId === null || brk.changeId === changeId)) {
      breaks.push({ pos, join: (accept && brk.type === 'delete') || (!accept && brk.type === 'insert') });
    }
    return !node.isTextblock;
  });
  for (const b of breaks.reverse()) {
    const pos = tr.mapping.map(b.pos, 1);
    const node = tr.doc.nodeAt(pos);
    if (!node || !node.isTextblock) continue;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, trackBreak: null });
    if (b.join && canJoin(tr.doc, pos)) tr.join(pos);
  }
  tr.setMeta(SKIP_META, true);
  return targets.length > 0 || breaks.length > 0;
};

export const TrackChanges = Extension.create<{ enabled: boolean; author: string }>({
  name: 'trackChanges',
  addOptions() {
    return { enabled: false, author: 'User' };
  },
  addCommands() {
    return {
      setTrackChanges:
        (enabled: boolean, author?: string) =>
        ({ tr, dispatch }: any) => {
          if (dispatch) tr.setMeta(trackChangesKey, { enabled, author }).setMeta('addToHistory', false);
          return true;
        },
      acceptChange: (id: string) => ({ state, tr }: any) => resolveChange(state, tr, id, true),
      rejectChange: (id: string) => ({ state, tr }: any) => resolveChange(state, tr, id, false),
      acceptAllChanges: () => ({ state, tr }: any) => resolveChange(state, tr, null, true),
      rejectAllChanges: () => ({ state, tr }: any) => resolveChange(state, tr, null, false),
    } as any;
  },
  addProseMirrorPlugins() {
    const opts = this.options;
    return [
      new Plugin({
        key: trackChangesKey,
        state: {
          init: () => ({ enabled: opts.enabled, author: opts.author }),
          apply: (tr, value) => {
            const meta = tr.getMeta(trackChangesKey);
            if (meta) return { enabled: meta.enabled, author: meta.author || value.author };
            return value;
          },
        },
        appendTransaction: (transactions, oldState, newState) => {
          const pluginState = trackChangesKey.getState(newState);
          if (!pluginState?.enabled) return null;
          const relevant = transactions.filter(
            t =>
              t.docChanged &&
              !t.getMeta(SKIP_META) &&
              !t.getMeta('y-sync$') &&
              !isHistoryTransaction(t) && // undo/redo must not be re-tracked
              t.getMeta('addToHistory') !== false &&
              !t.getMeta('preventTrack'),
          );
          // Only track plain single user transactions; combined/programmatic ones pass through.
          if (relevant.length !== 1 || transactions.length !== 1) return null;
          return trackTransaction(relevant[0], oldState, newState, pluginState.author);
        },
      }),
    ];
  },
});
