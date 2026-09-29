import { Citation } from '../types';
import { escapeHtml } from './sanitize';

export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'bibtex';

const bibKey = (c: Citation) => `${(c.author || 'anon').split(/[\s,]+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '')}${c.year || ''}`;

/** In-text citation, plain text (safe to put in a text node). */
export const formatInTextCitation = (c: Citation | undefined, style: CitationStyle): string => {
  if (!c) return '[?]';
  const { author, year } = c;
  switch (style) {
    case 'mla':
      return `(${author})`;
    case 'chicago':
      return `(${author} ${year})`;
    case 'bibtex':
      return `\\cite{${bibKey(c)}}`;
    case 'apa':
    default:
      return `(${author}, ${year})`;
  }
};

export const BIBLIOGRAPHY_TITLES: Record<CitationStyle, string> = {
  apa: 'References',
  mla: 'Works Cited',
  chicago: 'Bibliography',
  bibtex: 'References',
};

/** A bibliography entry as escaped HTML. */
export const formatBibliographyEntry = (c: Citation, style: CitationStyle): string => {
  const e = (s?: string) => escapeHtml(s || '');
  const author = e(c.author);
  const title = e(c.title);
  const year = e(c.year);
  const publisher = e(c.publisher);
  const journal = e(c.journal);
  const volume = e(c.volume);
  const pages = e(c.pages);
  const url = c.url ? ` ${e(c.url)}` : '';

  switch (style) {
    case 'apa':
      if (c.type === 'book') return `${author} (${year}). <i>${title}</i>. ${publisher || 'Publisher'}.`;
      if (c.type === 'journal') return `${author} (${year}). ${title}. <i>${journal}</i>, ${volume}${pages ? `, ${pages}` : ''}.`;
      return `${author} (${year}). ${title}.${url}`;
    case 'mla':
      if (c.type === 'book') return `${author}. <i>${title}</i>. ${publisher || 'Publisher'}, ${year}.`;
      if (c.type === 'journal') return `${author}. "${title}." <i>${journal}</i> ${volume} (${year})${pages ? `: ${pages}` : ''}.`;
      return `${author}. <i>${title}</i>. ${year}.${url}`;
    case 'chicago':
      if (c.type === 'book') return `${author}. <i>${title}</i>. ${publisher ? `${publisher}, ` : ''}${year}.`;
      if (c.type === 'journal') return `${author}. "${title}." <i>${journal}</i> ${volume}${pages ? ` (${year}): ${pages}` : ` (${year})`}.`;
      return `${author}. <i>${title}</i>. ${year}.${url}`;
    case 'bibtex': {
      const bibType = c.type === 'journal' ? 'article' : c.type === 'website' ? 'misc' : c.type;
      return `@${bibType}{${e(bibKey(c))},\n  author = {${author}},\n  title = {${title}},\n  year = {${year}}${journal ? `,\n  journal = {${journal}}` : ''}${publisher ? `,\n  publisher = {${publisher}}` : ''}\n}`;
    }
  }
};

/** Sort order used in bibliographies: author, then year. */
export const sortCitations = (list: Citation[]): Citation[] =>
  [...list].sort((a, b) => (a.author || '').localeCompare(b.author || '') || (a.year || '').localeCompare(b.year || ''));
