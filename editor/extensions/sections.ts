import { Node } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { DocumentData } from '../../types';

/**
 * Section break (next page). Everything after it is a new section that starts
 * on a new page and can have its own header/footer and page numbering. A
 * `null` header/footer means "same as previous section" (Word's "Link to
 * previous").
 */

export interface SectionSettings {
  header: string | null;
  footer: string | null;
  showPageNumbers: boolean | null;
  pageNumberPosition: DocumentData['pageNumberPosition'] | null;
  pageNumberFormat: DocumentData['pageNumberFormat'] | null;
  differentFirstPage: boolean;
  /** Restart numbering at `startAt` instead of continuing. */
  restartNumbering: boolean;
  startAt: number;
  /** Page orientation of this section; null = same as the previous section. */
  orientation: 'portrait' | 'landscape' | null;
}

export const DEFAULT_SECTION: SectionSettings = {
  header: null,
  footer: null,
  showPageNumbers: null,
  pageNumberPosition: null,
  pageNumberFormat: null,
  differentFirstPage: false,
  restartNumbering: false,
  startAt: 1,
  orientation: null,
};

const parseSettings = (el: HTMLElement): SectionSettings => {
  try {
    const raw = JSON.parse(el.getAttribute('data-section') || '{}');
    const orientation = raw.orientation === 'portrait' || raw.orientation === 'landscape' ? raw.orientation : null;
    return { ...DEFAULT_SECTION, ...raw, startAt: Math.max(0, Number(raw.startAt ?? 1) || 1), orientation };
  } catch {
    return { ...DEFAULT_SECTION };
  }
};

export const SectionBreak = Node.create({
  name: 'sectionBreak',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      settings: {
        default: DEFAULT_SECTION,
        parseHTML: (el: HTMLElement) => parseSettings(el),
        renderHTML: (attrs: Record<string, any>) => ({ 'data-section': JSON.stringify(attrs.settings || DEFAULT_SECTION) }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="section-break"]', priority: 70 }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-type': 'section-break', class: 'section-break', style: 'page-break-after: always' }];
  },
  addCommands() {
    return {
      insertSectionBreak:
        () =>
        ({ chain }: any) =>
          chain().insertContent({ type: this.name }).run(),
    } as any;
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sections: {
      insertSectionBreak: () => ReturnType;
    };
  }
}

export interface SectionInfo {
  /** 0 = first section (settings live on the document). */
  index: number;
  /** Position of the section-break node that starts this section (null for the first). */
  pos: number | null;
  /** First page of the section (1-based). */
  firstPage: number;
  settings: SectionSettings;
}

/** Section-break nodes in document order. */
export const sectionBreaks = (doc: PMNode): { pos: number; settings: SectionSettings }[] => {
  const out: { pos: number; settings: SectionSettings }[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name === 'sectionBreak') out.push({ pos: offset, settings: { ...DEFAULT_SECTION, ...(node.attrs.settings || {}) } });
  });
  return out;
};

/** Header/footer/numbering settings in effect for a section, following "link to previous". */
export const resolveSection = (
  docSettings: Pick<DocumentData, 'header' | 'footer' | 'showPageNumbers' | 'pageNumberPosition' | 'differentFirstPage' | 'pageNumberFormat'>,
  sections: SectionSettings[],
  index: number,
) => {
  const resolved = {
    header: docSettings.header || '',
    footer: docSettings.footer || '',
    showPageNumbers: !!docSettings.showPageNumbers,
    pageNumberPosition: docSettings.pageNumberPosition || ('footer-center' as const),
    pageNumberFormat: docSettings.pageNumberFormat || ('decimal' as const),
    differentFirstPage: !!docSettings.differentFirstPage,
  };
  for (let i = 1; i <= index && i <= sections.length; i++) {
    const s = sections[i - 1];
    if (s.header !== null) resolved.header = s.header;
    if (s.footer !== null) resolved.footer = s.footer;
    if (s.showPageNumbers !== null) resolved.showPageNumbers = s.showPageNumbers;
    if (s.pageNumberPosition) resolved.pageNumberPosition = s.pageNumberPosition;
    if (s.pageNumberFormat) resolved.pageNumberFormat = s.pageNumberFormat;
    resolved.differentFirstPage = s.differentFirstPage;
  }
  return resolved;
};

/** Page number shown on `page`, honouring sections that restart numbering. */
export const displayPageNumber = (page: number, sections: SectionInfo[]): number => {
  let base = 1;
  let startPage = 1;
  for (const s of sections) {
    if (s.firstPage > page) break;
    if (s.index > 0 && s.settings.restartNumbering) {
      base = s.settings.startAt;
      startPage = s.firstPage;
    }
  }
  return base + (page - startPage);
};

export const sectionOfPage = (page: number, sections: SectionInfo[]): SectionInfo | undefined => {
  let found: SectionInfo | undefined;
  for (const s of sections) if (s.firstPage <= page) found = s;
  return found;
};

/** Orientation of every section (index 0 = the document's own page setup), following "same as previous". */
export const sectionOrientations = (base: 'portrait' | 'landscape', sections: Pick<SectionSettings, 'orientation'>[]): ('portrait' | 'landscape')[] => {
  const out = [base];
  for (const s of sections) out.push(s.orientation || out[out.length - 1]);
  return out;
};
