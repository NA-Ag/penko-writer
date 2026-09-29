import type { AnyExtension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontFamily, FontSize, BackgroundColor } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { CharacterCount } from '@tiptap/extensions';
import type * as Y from 'yjs';

import { GlobalStyles, PenkoParagraph, PenkoHeading, Div, PageBreak, Kbd, BlockStyleCommands, PenkoBold, PenkoItalic } from './blocks';
import { PenkoImage } from './media';
import { References, Footnote, CitationNode, Bibliography, Equation, TableOfContents } from './references';
import { CommentMark, Insertion, Deletion, TrackChanges } from './review';
import { PenkoCodeBlock } from './codeBlock';
import { Pagination } from './pagination';
import { SectionBreak } from './sections';
import { Screenplay } from './screenplay';
import { Search } from './search';
import { ParagraphStyles } from './paragraphStyles';

export interface CollaborationConfig {
  document: Y.Doc;
  provider: any;
  user: { name: string; color: string };
}

export interface ExtensionOptions {
  collaboration?: CollaborationConfig | null;
  /** Lightweight editors (focus mode, mobile) skip pagination. */
  paginate?: boolean;
}

type CollabBuilder = (collab: CollaborationConfig) => AnyExtension[];
let collabBuilder: CollabBuilder | null = null;

/** Called by ./collab (loaded lazily with the collaboration dialog). */
export const registerCollaborationBuilder = (builder: CollabBuilder) => {
  collabBuilder = builder;
};

export const createExtensions = (opts: ExtensionOptions = {}): AnyExtension[] => {
  const collab = opts.collaboration;
  const list: AnyExtension[] = [
    StarterKit.configure({
      paragraph: false,
      heading: false,
      codeBlock: false,
      bold: false,
      italic: false,
      undoRedo: collab ? false : { depth: 200 },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        protocols: ['http', 'https', 'mailto', 'tel'],
        isAllowedUri: (url: string, ctx: any) => /^(https?:|mailto:|tel:|#|\/)/i.test(url) || (!/^[a-z][a-z0-9+.-]*:/i.test(url) && ctx.defaultValidate(`https://${url}`)),
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
      },
      dropcursor: { color: '#3b82f6', width: 2 },
    }),
    PenkoParagraph,
    PenkoBold,
    PenkoItalic,
    PenkoHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
    GlobalStyles,
    ParagraphStyles,
    BlockStyleCommands,
    Div,
    PageBreak,
    SectionBreak,
    Kbd,
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    BackgroundColor,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
    Table.configure({ resizable: true, allowTableNodeSelection: true, cellMinWidth: 20 }),
    TableRow,
    TableHeader,
    TableCell,
    Subscript,
    Superscript,
    PenkoImage,
    PenkoCodeBlock,
    References,
    Footnote,
    CitationNode,
    Bibliography,
    Equation,
    TableOfContents,
    CommentMark,
    Insertion,
    Deletion,
    TrackChanges,
    Screenplay,
    Search,
    CharacterCount,
  ];
  if (opts.paginate !== false) list.push(Pagination);
  if (collab) {
    if (!collabBuilder) throw new Error('Collaboration extensions not loaded: import editor/extensions/collab first');
    list.push(...collabBuilder(collab));
  }
  return list;
};
