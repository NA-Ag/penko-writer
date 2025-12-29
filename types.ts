import React from 'react';

export interface Comment {
  id: string;
  rangeId: string; // ID of the highlighted range
  author: string;
  text: string;
  timestamp: number;
  resolved: boolean;
  replies: CommentReply[];
}

export interface CommentReply {
  id: string;
  author: string;
  text: string;
  timestamp: number;
}

export interface TrackChange {
  id: string;
  type: 'insert' | 'delete' | 'format';
  author: string;
  timestamp: number;
  content?: string;
  oldContent?: string;
  rangeId: string;
  accepted?: boolean;
  rejected?: boolean;
}

export interface FootnoteData {
  type: 'footnote' | 'endnote';
  content: string;
  number: number;
}

export interface Citation {
  id: string;
  type: 'book' | 'journal' | 'website' | 'article';
  author: string;
  title: string;
  year: string;
  publisher?: string;
  journal?: string;
  volume?: string;
  pages?: string;
  url?: string;
  accessDate?: string;
}

export interface DocumentData {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  lastModified: number;
  pageConfig?: PageConfig;
  language?: string;
  header?: string;
  footer?: string;
  showPageNumbers?: boolean;
  pageNumberPosition?: 'header-left' | 'header-center' | 'header-right' | 'footer-left' | 'footer-center' | 'footer-right';
  comments?: Comment[];
  trackChanges?: TrackChange[];
  trackingEnabled?: boolean;
  currentUser?: string;
  footnotes?: FootnoteData[];
  citations?: Citation[];
  isScreenplay?: boolean; // Enables screenplay editing mode
  isMarkdownMode?: boolean; // Enables markdown editing mode
}

export interface PageConfig {
  size: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  margins: 'normal' | 'narrow' | 'wide' | 'none';
  cols?: 1 | 2 | 3;
}

export interface HistorySnapshot {
  timestamp: number;
  content: string;
  title: string;
}

export interface SelectionContext {
  type: 'text' | 'image' | 'table' | 'none';
  data?: any;
}

export interface Template {
  id: string;
  name: string;
  nameKey: string; // Translation key for template name
  category: string;
  categoryKey: string; // Translation key for category
  content: string;
  thumbnail: string; // CSS color or gradient
  pageConfig?: PageConfig;
  isScreenplay?: boolean; // Special screenplay mode
}

// Screenplay-specific types
export type ScreenplayElementType =
  | 'scene-heading'    // INT./EXT. LOCATION - TIME (all caps)
  | 'action'           // Description text (left-aligned)
  | 'character'        // Character name (centered, all caps)
  | 'parenthetical'    // (wryly) - direction under character
  | 'dialogue'         // Character speech (centered)
  | 'transition';      // CUT TO:, FADE TO: (right-aligned)

export interface ScreenplayElement {
  id: string;
  type: ScreenplayElementType;
  content: string;
}

// Interface exposed by Editor to App/Ribbon
export interface EditorHandle {
  focus: () => void;
  getInnerHtml: () => string;
  getInnerText: () => string;
  getContentElement: () => HTMLDivElement | null;
  addTableRow: () => void;
  deleteTableRow: () => void;
  addTableColumn: () => void;
  deleteTableColumn: () => void;
  mergeCells: () => void;
  splitCell: () => void;
  setTableStyle: (style: 'default' | 'bordered' | 'striped' | 'minimal') => void;
  setColumnWidth: (width: string) => void;
  resizeImage: (percent: number) => void;
  alignImage: (align: 'left' | 'center' | 'right') => void;
  rotateImage: (degrees: number) => void;
  setImageBorder: (style: 'none' | 'thin' | 'medium' | 'thick' | 'rounded') => void;
  replaceImage: (newDataUrl: string) => Promise<void>;
  getSelectedImage: () => HTMLImageElement | null;
}

export type EditorAction = 
  | 'bold' 
  | 'italic' 
  | 'underline' 
  | 'strikethrough'
  | 'subscript'
  | 'superscript'
  | 'justifyLeft' 
  | 'justifyCenter' 
  | 'justifyRight' 
  | 'justifyFull'
  | 'insertOrderedList' 
  | 'insertUnorderedList'
  | 'indent'
  | 'outdent'
  | 'undo'
  | 'redo'
  | 'formatBlock'
  | 'removeFormat'
  | 'foreColor'
  | 'hiliteColor'
  | 'insertHorizontalRule'
  | 'createLink'
  | 'unlink'
  | 'insertHTML'
  | 'insertImage';

export interface RibbonGroup {
  label: string;
  items: RibbonItem[];
}

export interface RibbonItem {
  icon: React.ReactNode;
  label: string;
  action: string;
  value?: string;
  isActive?: boolean;
}