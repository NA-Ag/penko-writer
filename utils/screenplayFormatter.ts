import { ScreenplayElementType } from '../types';

/**
 * Screenplay Formatter
 * Handles auto-formatting and styling for screenplay elements
 */

// Standard screenplay margins (in inches, converted to CSS)
export const SCREENPLAY_MARGINS = {
  left: '1.5in',
  right: '1.0in',
  top: '1.0in',
  bottom: '1.0in',
};

// Element-specific indentation from left margin
export const SCREENPLAY_INDENTS = {
  'scene-heading': '0in',
  'action': '0in',
  'character': '3.7in',
  'parenthetical': '3.1in',
  'dialogue': '2.5in',
  'transition': 'right', // right-aligned
};

// Element widths
export const SCREENPLAY_WIDTHS = {
  'scene-heading': 'auto',
  'action': 'auto',
  'character': 'auto',
  'parenthetical': '3.5in',
  'dialogue': '3.5in',
  'transition': 'auto',
};

/**
 * Detect screenplay element type from content
 */
export function detectScreenplayElement(text: string): ScreenplayElementType {
  const trimmed = text.trim();

  // Scene heading: starts with INT., EXT., INT/EXT., or I/E
  if (/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(trimmed)) {
    return 'scene-heading';
  }

  // Transition: ends with "TO:" and is all caps
  if (trimmed === trimmed.toUpperCase() && trimmed.endsWith('TO:')) {
    return 'transition';
  }

  // Parenthetical: text in parentheses
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return 'parenthetical';
  }

  // Character: all uppercase text (but not a scene heading or transition)
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 0 && !trimmed.includes('.')) {
    return 'character';
  }

  // Default to action
  return 'action';
}

/**
 * Apply CSS styles for a screenplay element type
 */
export function getScreenplayElementStyle(type: ScreenplayElementType): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    fontFamily: 'Courier, "Courier New", monospace',
    fontSize: '12pt',
    lineHeight: '1.5',
    marginBottom: '0',
  };

  switch (type) {
    case 'scene-heading':
      return {
        ...baseStyle,
        textTransform: 'uppercase',
        fontWeight: 'bold',
        marginTop: '24px',
        marginBottom: '12px',
      };

    case 'action':
      return {
        ...baseStyle,
        marginBottom: '12px',
      };

    case 'character':
      return {
        ...baseStyle,
        textTransform: 'uppercase',
        textAlign: 'left',
        marginLeft: SCREENPLAY_INDENTS.character,
        marginTop: '12px',
        marginBottom: '0',
      };

    case 'parenthetical':
      return {
        ...baseStyle,
        marginLeft: SCREENPLAY_INDENTS.parenthetical,
        marginBottom: '0',
        fontStyle: 'normal',
      };

    case 'dialogue':
      return {
        ...baseStyle,
        marginLeft: SCREENPLAY_INDENTS.dialogue,
        maxWidth: SCREENPLAY_WIDTHS.dialogue,
        marginBottom: '12px',
      };

    case 'transition':
      return {
        ...baseStyle,
        textTransform: 'uppercase',
        textAlign: 'right',
        marginTop: '12px',
        marginBottom: '12px',
      };

    default:
      return baseStyle;
  }
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

/**
 * Generate HTML for a screenplay element
 */
export function generateScreenplayHTML(type: ScreenplayElementType, content: string): string {
  const style = getScreenplayElementStyle(type);
  const styleString = Object.entries(style)
    .map(([key, value]) => {
      // Convert camelCase to kebab-case
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value}`;
    })
    .join('; ');

  const formattedContent = formatScreenplayText(content, type);
  const className = `screenplay-${type}`;

  return `<p class="${className}" style="${styleString}" data-screenplay-type="${type}">${formattedContent}</p>`;
}

/**
 * Parse screenplay HTML back to element type
 */
export function parseScreenplayHTML(html: string): { type: ScreenplayElementType; content: string } | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const element = doc.body.firstChild as HTMLElement;

  if (!element) return null;

  const type = element.getAttribute('data-screenplay-type') as ScreenplayElementType;
  const content = element.textContent || '';

  if (!type) {
    // Try to detect from content
    return {
      type: detectScreenplayElement(content),
      content,
    };
  }

  return { type, content };
}

/**
 * Calculate approximate screenplay page count
 * Rule of thumb: 1 page = 1 minute of screen time
 * Average screenplay page has ~55 lines
 */
export function calculateScreenplayPages(content: string): number {
  const lines = content.split('\n').length;
  const pages = Math.ceil(lines / 55);
  return Math.max(1, pages);
}

/**
 * Common character name storage for autocomplete
 */
export class ScreenplayCharacterList {
  private characters: Set<string> = new Set();

  addCharacter(name: string) {
    if (name && name.trim().length > 0) {
      this.characters.add(name.trim().toUpperCase());
    }
  }

  getCharacters(): string[] {
    return Array.from(this.characters).sort();
  }

  getSuggestions(partial: string): string[] {
    const upper = partial.toUpperCase();
    return this.getCharacters().filter(char => char.startsWith(upper));
  }

  clear() {
    this.characters.clear();
  }
}
