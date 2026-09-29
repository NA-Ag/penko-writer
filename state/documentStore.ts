import type { DocumentData } from '../types';

/* ------------------------------------------------------------------ */
/* Document store                                                      */
/* ------------------------------------------------------------------ */

export interface DocState {
  loaded: boolean;
  docs: Record<string, DocumentData>;
  currentId: string | null;
  /** Bumped when content is replaced from outside the editor (restore, collab…). */
  revs: Record<string, number>;
}

export type DocAction =
  | { type: 'load'; docs: DocumentData[]; currentId: string | null }
  | { type: 'add'; doc: DocumentData; select?: boolean }
  | { type: 'update'; id: string; patch: Partial<DocumentData> | ((d: DocumentData) => Partial<DocumentData>); external?: boolean; touch?: boolean }
  | { type: 'delete'; id: string; fallback: DocumentData | null }
  | { type: 'select'; id: string };

export const docReducer = (state: DocState, action: DocAction): DocState => {
  switch (action.type) {
    case 'load': {
      const docs: Record<string, DocumentData> = {};
      action.docs.forEach(d => (docs[d.id] = d));
      return { loaded: true, docs, currentId: action.currentId, revs: {} };
    }
    case 'add':
      return { ...state, docs: { ...state.docs, [action.doc.id]: action.doc }, currentId: action.select === false ? state.currentId : action.doc.id };
    case 'update': {
      const prev = state.docs[action.id];
      if (!prev) return state;
      const patch = typeof action.patch === 'function' ? action.patch(prev) : action.patch;
      const next = { ...prev, ...patch, ...(action.touch === false ? {} : { lastModified: Date.now() }) };
      return {
        ...state,
        docs: { ...state.docs, [action.id]: next },
        revs: action.external ? { ...state.revs, [action.id]: (state.revs[action.id] || 0) + 1 } : state.revs,
      };
    }
    case 'delete': {
      const docs = { ...state.docs };
      delete docs[action.id];
      let currentId = state.currentId;
      if (currentId === action.id) {
        const remaining = Object.values(docs).sort((a, b) => b.lastModified - a.lastModified);
        if (remaining.length) currentId = remaining[0].id;
        else if (action.fallback) {
          docs[action.fallback.id] = action.fallback;
          currentId = action.fallback.id;
        } else currentId = null;
      }
      return { ...state, docs, currentId };
    }
    case 'select':
      return state.docs[action.id] ? { ...state, currentId: action.id } : state;
  }
};
