import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { registerCollaborationBuilder } from './index';

/**
 * Collaboration extensions (Yjs, y-tiptap) are only needed during a live
 * session, so they live in their own chunk. Importing this module registers
 * them with createExtensions(); the collaboration dialog imports it before it
 * starts a session.
 */
registerCollaborationBuilder(collab => [
  Collaboration.configure({ document: collab.document, field: 'default' }),
  CollaborationCaret.configure({ provider: collab.provider, user: collab.user }),
]);
