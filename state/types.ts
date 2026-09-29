import type { DocumentData } from '../types';
import type { useToast } from '../utils/useToast';

export type AppToast = ReturnType<typeof useToast>;
export type DocPatch = Partial<DocumentData> | ((d: DocumentData) => Partial<DocumentData>);

export type PageNumberPosition = 'header-left' | 'header-center' | 'header-right' | 'footer-left' | 'footer-center' | 'footer-right';

export interface EditorStats {
  words: number;
  characters: number;
  text: string;
}

export interface SelectedImageInfo {
  pos: number;
  attrs: Record<string, any>;
  dom: HTMLElement | null;
}
