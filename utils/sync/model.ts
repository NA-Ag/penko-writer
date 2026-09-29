import * as Y from 'yjs';
import type { Node as PMNode, Schema } from '@tiptap/pm/model';
import { updateYFragment, yXmlFragmentToProseMirrorRootNode } from '@tiptap/y-tiptap';
import type { DocumentData } from '../../types';

/**
 * The CRDT model of a synced document (one Y.Doc per document):
 *
 * - `default` (Y.XmlFragment): the content, in the same layout the Tiptap
 *   Collaboration extension uses. Local edits are applied as minimal diffs
 *   (y-prosemirror's updateYFragment), so concurrent edits merge per character.
 * - `fields` (Y.Map): every other document field as a last-writer-wins
 *   register, keyed `field␟device`. Each device only writes its own key and
 *   readers pick the newest timestamp, so concurrent offline changes resolve by
 *   wall-clock time (not by Yjs client order). Comments and citations are merged
 *   per item (`field␟itemId␟device`), so comments added on two devices both
 *   survive and deletions propagate as tombstones.
 *
 * The index (a separate Y.Doc, channel "index") records which documents exist:
 * `docId␟device → { a: alive, t }`, newest entry wins.
 */

export const CONTENT = 'default';
const FIELDS = 'fields';
const INDEX = 'docs';
const SEP = '\u001f';

/** Fields that are not synced as registers (content is the CRDT, the rest is local/legacy). */
const LOCAL_ONLY = new Set(['id', 'content', 'lastModified', 'currentUser', 'trackChanges', 'footnotes']);
/** Arrays of `{ id }` objects merged item by item. */
const BY_ID = new Set(['comments', 'citations']);
/** Synthetic register holding the document's modification time. */
const MODIFIED = '_modified';

export const LOCAL_ORIGIN = 'penko-local';

/** Overlapping marks (comments) are stored as `name--hash` text attributes (see y-prosemirror). */
const yattr2markname = (attr: string) => /(.*)(--[a-zA-Z0-9+/=]{8})$/.exec(attr)?.[1] ?? attr;

interface Entry {
  v?: unknown;
  /** deleted / unset */
  d?: 1;
  t: number;
  /** array position (by-id items) */
  o?: number;
}

/** JSON with sorted keys; `undefined` properties are dropped (like JSON.stringify). */
export const stableStringify = (v: unknown): string => {
  if (v === undefined) return 'undefined';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(x => (x === undefined ? 'null' : stableStringify(x))).join(',')}]`;
  const obj = v as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter(k => obj[k] !== undefined)
    .sort()
    .map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
};
export const sameValue = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const same = sameValue;
const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

const newer = (a: { t: number; dev: string } | undefined, t: number, dev: string) => !a || t > a.t || (t === a.t && dev > a.dev);

/* ------------------------------------------------------------------ */
/* Fields                                                              */
/* ------------------------------------------------------------------ */

interface Resolved {
  scalars: Map<string, Entry & { dev: string }>;
  items: Map<string, Map<string, Entry & { dev: string }>>;
}

const resolveRaw = (ydoc: Y.Doc): Resolved => {
  const scalars = new Map<string, Entry & { dev: string }>();
  const items = new Map<string, Map<string, Entry & { dev: string }>>();
  ydoc.getMap<Entry>(FIELDS).forEach((e, key) => {
    if (!e || typeof e.t !== 'number') return;
    const parts = key.split(SEP);
    if (parts.length === 2) {
      const [field, dev] = parts;
      if (newer(scalars.get(field), e.t, dev)) scalars.set(field, { ...e, dev });
    } else if (parts.length === 3) {
      const [field, id, dev] = parts;
      let m = items.get(field);
      if (!m) items.set(field, (m = new Map()));
      if (newer(m.get(id), e.t, dev)) m.set(id, { ...e, dev });
    }
  });
  return { scalars, items };
};

const itemsToArray = (m: Map<string, Entry> | undefined) =>
  m
    ? Array.from(m.entries())
        .filter(([, e]) => !e.d)
        .sort((a, b) => (a[1].o ?? 0) - (b[1].o ?? 0) || (a[0] < b[0] ? -1 : 1))
        .map(([, e]) => clone(e.v))
    : undefined;

export interface ResolvedFields {
  fields: Partial<DocumentData>;
  /** Newest modification time recorded by any device (0 if none). */
  modified: number;
  /** True when no device ever wrote a field (nothing to materialise). */
  empty: boolean;
}

/** The merged value of every synced field. Fields that were unset are present with `undefined`. */
export const resolveFields = (ydoc: Y.Doc): ResolvedFields => {
  const { scalars, items } = resolveRaw(ydoc);
  const fields: Record<string, unknown> = {};
  let modified = 0;
  scalars.forEach((e, field) => {
    if (field === MODIFIED) modified = Number(e.v) || 0;
    else fields[field] = e.d ? undefined : clone(e.v);
  });
  items.forEach((m, field) => (fields[field] = itemsToArray(m)));
  return { fields: fields as Partial<DocumentData>, modified, empty: scalars.size === 0 && items.size === 0 };
};

/**
 * Records the local document's fields: only fields whose value differs from
 * the merged state are written (with timestamp `now`). Returns true if
 * anything was written.
 */
export const writeLocalFields = (ydoc: Y.Doc, doc: DocumentData, device: string, now: number): boolean => {
  const { scalars, items } = resolveRaw(ydoc);
  const map = ydoc.getMap<Entry>(FIELDS);
  const record = doc as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(record), ...scalars.keys(), ...items.keys()]);
  let changed = false;
  const put = (key: string, e: Entry) => {
    map.set(key, e);
    changed = true;
  };
  ydoc.transact(() => {
    keys.forEach(field => {
      if (LOCAL_ONLY.has(field) || field === MODIFIED || field.includes(SEP)) return;
      if (BY_ID.has(field)) {
        const local = Array.isArray(record[field]) ? (record[field] as { id?: unknown }[]) : [];
        const known = items.get(field) || new Map();
        const localIds = new Set<string>();
        local.forEach((item, o) => {
          if (!item || typeof item.id !== 'string' || item.id.includes(SEP)) return;
          localIds.add(item.id);
          const e = known.get(item.id);
          if (!e || e.d || !same(e.v, item)) put(`${field}${SEP}${item.id}${SEP}${device}`, { v: clone(item), t: now, o });
        });
        known.forEach((e, id) => {
          if (!e.d && !localIds.has(id)) put(`${field}${SEP}${id}${SEP}${device}`, { d: 1, t: now });
        });
        return;
      }
      const e = scalars.get(field);
      const current = e && !e.d ? e.v : undefined;
      const value = record[field];
      if (same(value, current)) return;
      if (value === undefined && !e) return;
      put(`${field}${SEP}${device}`, value === undefined ? { d: 1, t: now } : { v: clone(value), t: now });
    });
  }, LOCAL_ORIGIN);
  return changed;
};

/** Stamps the document's modification time (called whenever a local change was recorded). */
export const writeModified = (ydoc: Y.Doc, device: string, lastModified: number) => {
  const map = ydoc.getMap<Entry>(FIELDS);
  const key = `${MODIFIED}${SEP}${device}`;
  const prev = map.get(key);
  if (prev && Number(prev.v) >= lastModified) return;
  ydoc.transact(() => map.set(key, { v: lastModified, t: lastModified }), LOCAL_ORIGIN);
};

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

export const contentFragment = (ydoc: Y.Doc) => ydoc.getXmlFragment(CONTENT);

/** Applies the local content as a minimal diff against the CRDT. */
export const writeLocalContent = (ydoc: Y.Doc, node: PMNode) => {
  ydoc.transact(() => updateYFragment(ydoc, contentFragment(ydoc), node, { mapping: new Map(), isOMark: new Map() }), LOCAL_ORIGIN);
};

/** The merged content as a ProseMirror document, or null if no content was ever written. */
export const readContent = (ydoc: Y.Doc, schema: Schema): PMNode | null => {
  const frag = contentFragment(ydoc);
  if (frag.length === 0) return null;
  const node = yXmlFragmentToProseMirrorRootNode(frag, schema);
  try {
    node.check();
    return node;
  } catch {
    return schema.topNodeType.createAndFill(null, node.content) || node;
  }
};

/**
 * Node / mark types in the CRDT that this version of the app doesn't know
 * (written by a newer version on another device). Materialising such a
 * document would silently drop them — and the next local edit would delete
 * them everywhere — so the engine leaves those documents alone.
 */
export const unknownTypes = (ydoc: Y.Doc, schema: Schema): string[] => {
  const unknown = new Set<string>();
  const walk = (t: Y.XmlElement | Y.XmlFragment | Y.XmlText | Y.XmlHook) => {
    if (t instanceof Y.XmlText) {
      (t.toDelta() as { attributes?: Record<string, unknown> }[]).forEach(op => {
        Object.keys(op.attributes || {}).forEach(attr => {
          const name = yattr2markname(attr);
          if (name !== 'ychange' && !schema.marks[name]) unknown.add(name);
        });
      });
      return;
    }
    if (t instanceof Y.XmlElement && !schema.nodes[t.nodeName]) unknown.add(t.nodeName);
    if (t instanceof Y.XmlElement || t instanceof Y.XmlFragment) t.toArray().forEach(c => walk(c as Y.XmlElement));
  };
  walk(contentFragment(ydoc));
  return Array.from(unknown);
};

/** Same check for an incoming update, before it is merged (cheap: only the new structs). */
export const unknownTypesInUpdate = (update: Uint8Array, schema: Schema): string[] => {
  const unknown = new Set<string>();
  for (const s of Y.decodeUpdate(update).structs) {
    if (!(s instanceof Y.Item)) continue;
    const c = s.content;
    if (c instanceof Y.ContentType && c.type instanceof Y.XmlElement && !schema.nodes[c.type.nodeName]) unknown.add(c.type.nodeName);
    else if (c instanceof Y.ContentFormat) {
      const name = yattr2markname(c.key);
      if (name !== 'ychange' && !schema.marks[name]) unknown.add(name);
    }
  }
  return Array.from(unknown);
};

/* ------------------------------------------------------------------ */
/* Index (which documents exist)                                       */
/* ------------------------------------------------------------------ */

export interface IndexEntry {
  alive: boolean;
  t: number;
}

export const setIndexEntry = (index: Y.Doc, docId: string, device: string, alive: boolean, t: number) => {
  index.transact(() => index.getMap<{ a: number; t: number }>(INDEX).set(`${docId}${SEP}${device}`, { a: alive ? 1 : 0, t }), LOCAL_ORIGIN);
};

export const resolveIndex = (index: Y.Doc): Map<string, IndexEntry> => {
  const best = new Map<string, IndexEntry & { dev: string }>();
  index.getMap<{ a: number; t: number }>(INDEX).forEach((e, key) => {
    const [docId, dev] = key.split(SEP);
    if (!docId || !dev || !e || typeof e.t !== 'number') return;
    if (newer(best.get(docId), e.t, dev)) best.set(docId, { alive: !!e.a, t: e.t, dev });
  });
  const out = new Map<string, IndexEntry>();
  best.forEach((e, id) => out.set(id, { alive: e.alive, t: e.t }));
  return out;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** A brand-new, never edited document (not worth syncing until it has content). */
export const isPristine = (doc: DocumentData) =>
  !doc.title && (!doc.content || /^\s*(<p>\s*<\/p>\s*)?$/.test(doc.content)) && !doc.comments?.length && !doc.header && !doc.footer;

/** Per-client end clocks of the structs contained in an update (what it tells a receiver). */
export const updateClocks = (update: Uint8Array): Record<string, number> => {
  const out: Record<string, number> = {};
  const { structs } = Y.decodeUpdate(update);
  for (const s of structs) {
    if (s instanceof Y.Skip) continue;
    const end = s.id.clock + s.length;
    const k = String(s.id.client);
    if ((out[k] || 0) < end) out[k] = end;
  }
  return out;
};

export const mergeClocks = (a: Record<string, number>, b: Record<string, number>) => {
  const out = { ...a };
  Object.entries(b).forEach(([k, v]) => {
    if ((out[k] || 0) < v) out[k] = v;
  });
  return out;
};

export const clocksOf = (ydoc: Y.Doc): Record<string, number> => {
  const out: Record<string, number> = {};
  Y.decodeStateVector(Y.encodeStateVector(ydoc)).forEach((clock, client) => (out[String(client)] = clock));
  return out;
};

export const encodeClocks = (clocks: Record<string, number>) => Y.encodeStateVector(new Map(Object.entries(clocks).map(([k, v]) => [Number(k), v])));
