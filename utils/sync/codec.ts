import { createDocument, getHTMLFromFragment, getSchema } from '@tiptap/core';
import type { Node as PMNode, Schema } from '@tiptap/pm/model';
import { createExtensions } from '../../editor/extensions';
import { parseOptionsFor, prepareHtmlForEditor } from '../../editor/sanitize';

/** Document HTML <-> ProseMirror documents with the editor's schema (same parsing as the editor). */

let schema: Schema | null = null;
export const syncSchema = (): Schema => (schema ??= getSchema(createExtensions({ paginate: false })));

export const htmlToNode = (html: string, s: Schema = syncSchema()): PMNode => {
  const clean = prepareHtmlForEditor(html || '<p></p>');
  return createDocument(clean, s, parseOptionsFor(clean));
};

export const nodeToHtml = (node: PMNode, s: Schema = syncSchema()): string => getHTMLFromFragment(node.content, s);
