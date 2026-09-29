import { ScreenplayElementType } from '../types';

/**
 * Screenplay element detection / cycling / text formatting, used by the
 * screenplay editor extension (editor/extensions/screenplay.ts). Layout lives
 * in editor.css (screen) and exportModel.SCREENPLAY_LAYOUT (exports).
 */

/** Word paragraph style names used by the DOCX export and mapped back on import. */
export const SCREENPLAY_STYLE_NAMES: Record<ScreenplayElementType, string> = {
  'scene-heading': 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
};

/**
 * Detect screenplay element type from content
 */
export function detectScreenplayElement(text: string): ScreenplayElementType {
  const trimmed = text.trim();

  // Scene heading: starts with INT., EXT., INT/EXT., or I/E
  if (/^(INT|EXT|INT\/EXT|EXT\/INT|I\/E|EST)[.\s]/i.test(trimmed)) {
    return 'scene-heading';
  }

  // Transition: ends with "TO:" and is all caps
  if (trimmed === trimmed.toUpperCase() && (trimmed.endsWith('TO:') || /^FADE (IN|OUT)[:.]?$/.test(trimmed))) {
    return 'transition';
  }

  // Parenthetical: text in parentheses
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return 'parenthetical';
  }

  // Character: all uppercase text (but not a scene heading or transition)
  const nameOnly = trimmed.replace(/\s*\((V\.O\.|O\.S\.|O\.C\.|CONT'D|CONT’D)\)\s*$/i, '');
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && trimmed.length > 1 && !nameOnly.includes('.')) {
    return 'character';
  }

  // Default to action
  return 'action';
}

/**
 * Get the next element type when TAB is pressed
 */
export function getNextScreenplayElement(currentType: ScreenplayElementType): ScreenplayElementType {
  const cycle: ScreenplayElementType[] = ['scene-heading', 'action', 'character', 'dialogue'];
  const currentIndex = cycle.indexOf(currentType);

  if (currentIndex === -1) {
    return 'action';
  }

  return cycle[(currentIndex + 1) % cycle.length];
}

/**
 * Get the previous element type when SHIFT+TAB is pressed
 */
export function getPreviousScreenplayElement(currentType: ScreenplayElementType): ScreenplayElementType {
  const cycle: ScreenplayElementType[] = ['scene-heading', 'action', 'character', 'dialogue'];
  const currentIndex = cycle.indexOf(currentType);

  if (currentIndex === -1) {
    return 'action';
  }

  return cycle[(currentIndex - 1 + cycle.length) % cycle.length];
}

/**
 * Format text according to screenplay element type
 */
export function formatScreenplayText(text: string, type: ScreenplayElementType): string {
  switch (type) {
    case 'scene-heading':
    case 'character':
    case 'transition':
      return text.toUpperCase();

    case 'parenthetical':
      // Ensure parentheses
      if (!text.startsWith('(')) text = '(' + text;
      if (!text.endsWith(')')) text = text + ')';
      return text.toLowerCase();

    default:
      return text;
  }
}
