/**
 * The DocumentData fields a .penko file carries (what `sanitizeDocumentFields`
 * in penkoFormat.ts reads). Other fields (device or sync state) are neither
 * written to files nor cleared when a document is replaced by a file's copy.
 */
export const DOCUMENT_FILE_FIELDS = [
  'id', 'title', 'content', 'createdAt', 'lastModified', 'pageConfig', 'language', 'header', 'footer', 'showPageNumbers',
  'differentFirstPage', 'pageNumberFormat', 'pageNumberPosition', 'comments', 'citations', 'trackingEnabled', 'isScreenplay',
  'isMarkdownMode', 'markdownSource', 'styles',
] as const;
