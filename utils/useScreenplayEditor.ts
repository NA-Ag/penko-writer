import { useEffect, useRef, useCallback } from 'react';
import {
  detectScreenplayElement,
  getNextScreenplayElement,
  getPreviousScreenplayElement,
  formatScreenplayText,
  ScreenplayCharacterList,
} from './screenplayFormatter';
import { ScreenplayElementType } from '../types';

/**
 * Hook for screenplay editor functionality
 * Handles TAB cycling, auto-formatting, and character autocomplete
 */
export function useScreenplayEditor(
  editorRef: React.RefObject<HTMLDivElement>,
  isScreenplayMode: boolean
) {
  const characterListRef = useRef(new ScreenplayCharacterList());
  const currentElementTypeRef = useRef<ScreenplayElementType>('action');

  /**
   * Get the current paragraph element at cursor
   */
  const getCurrentParagraph = useCallback((): HTMLElement | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    let node = selection.getRangeAt(0).startContainer;

    // Walk up to find the paragraph
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.tagName === 'P') {
          return element;
        }
      }
      node = node.parentNode;
    }

    return null;
  }, [editorRef]);

  /**
   * Get or set the screenplay element type for a paragraph
   */
  const getElementType = useCallback((paragraph: HTMLElement): ScreenplayElementType => {
    const dataType = paragraph.getAttribute('data-screenplay-type');
    if (dataType) return dataType as ScreenplayElementType;

    // Try to detect from content
    const text = paragraph.textContent || '';
    return detectScreenplayElement(text);
  }, []);

  const setElementType = useCallback((paragraph: HTMLElement, type: ScreenplayElementType) => {
    paragraph.setAttribute('data-screenplay-type', type);
    paragraph.className = `screenplay-${type}`;

    // Apply formatting styles
    const styles: { [key: string]: string } = {
      fontFamily: 'Courier, "Courier New", monospace',
      fontSize: '12pt',
      lineHeight: '1.5',
      marginBottom: '0',
    };

    switch (type) {
      case 'scene-heading':
        styles.textTransform = 'uppercase';
        styles.fontWeight = 'bold';
        styles.marginTop = '24px';
        styles.marginBottom = '12px';
        break;
      case 'action':
        styles.marginBottom = '12px';
        break;
      case 'character':
        styles.textTransform = 'uppercase';
        styles.textAlign = 'left';
        styles.marginLeft = '3.7in';
        styles.marginTop = '12px';
        styles.marginBottom = '0';
        break;
      case 'parenthetical':
        styles.marginLeft = '3.1in';
        styles.marginBottom = '0';
        break;
      case 'dialogue':
        styles.marginLeft = '2.5in';
        styles.maxWidth = '3.5in';
        styles.marginBottom = '12px';
        break;
      case 'transition':
        styles.textTransform = 'uppercase';
        styles.textAlign = 'right';
        styles.marginTop = '12px';
        styles.marginBottom = '12px';
        break;
    }

    Object.entries(styles).forEach(([key, value]) => {
      (paragraph.style as any)[key] = value;
    });

    currentElementTypeRef.current = type;
  }, []);

  /**
   * Handle TAB key for cycling through element types
   */
  const handleTab = useCallback((e: KeyboardEvent) => {
    if (!isScreenplayMode) return;
    if (e.key !== 'Tab') return;

    e.preventDefault();

    const paragraph = getCurrentParagraph();
    if (!paragraph) return;

    const currentType = getElementType(paragraph);
    const newType = e.shiftKey
      ? getPreviousScreenplayElement(currentType)
      : getNextScreenplayElement(currentType);

    setElementType(paragraph, newType);

    // Format text according to new type
    const text = paragraph.textContent || '';
    if (text.trim()) {
      const formattedText = formatScreenplayText(text, newType);
      if (formattedText !== text) {
        paragraph.textContent = formattedText;

        // Restore cursor to end
        const range = document.createRange();
        const sel = window.getSelection();
        if (paragraph.firstChild) {
          range.setStart(paragraph.firstChild, formattedText.length);
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
    }
  }, [isScreenplayMode, getCurrentParagraph, getElementType, setElementType]);

  /**
   * Handle ENTER key for smart element creation
   */
  const handleEnter = useCallback((e: KeyboardEvent) => {
    if (!isScreenplayMode) return;
    if (e.key !== 'Enter') return;

    const paragraph = getCurrentParagraph();
    if (!paragraph) return;

    const currentType = getElementType(paragraph);

    // Special behavior: after character name, create dialogue
    if (currentType === 'character') {
      e.preventDefault();

      // Create new paragraph for dialogue
      const newPara = document.createElement('p');
      newPara.textContent = '';
      setElementType(newPara, 'dialogue');

      paragraph.after(newPara);

      // Move cursor to new paragraph
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStart(newPara, 0);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);

      // Save character name
      const characterName = paragraph.textContent?.trim();
      if (characterName) {
        characterListRef.current.addCharacter(characterName);
      }
    }
    // After dialogue, pressing Enter twice returns to action
    else if (currentType === 'dialogue') {
      const text = paragraph.textContent?.trim();
      if (!text) {
        e.preventDefault();
        setElementType(paragraph, 'action');
      }
    }
  }, [isScreenplayMode, getCurrentParagraph, getElementType, setElementType]);

  /**
   * Auto-detect and format elements as user types
   */
  const handleInput = useCallback(() => {
    if (!isScreenplayMode) return;

    const paragraph = getCurrentParagraph();
    if (!paragraph) return;

    const text = paragraph.textContent || '';
    if (text.trim().length < 3) return; // Don't auto-detect very short text

    // Check if element type should be auto-detected
    const hasExplicitType = paragraph.hasAttribute('data-screenplay-type');

    if (!hasExplicitType) {
      const detectedType = detectScreenplayElement(text);
      setElementType(paragraph, detectedType);
    }
  }, [isScreenplayMode, getCurrentParagraph, setElementType]);

  /**
   * Get character suggestions for autocomplete
   */
  const getCharacterSuggestions = useCallback((partial: string): string[] => {
    return characterListRef.current.getSuggestions(partial);
  }, []);

  /**
   * Setup event listeners
   */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !isScreenplayMode) return;

    editor.addEventListener('keydown', handleTab);
    editor.addEventListener('keydown', handleEnter);
    editor.addEventListener('input', handleInput);

    return () => {
      editor.removeEventListener('keydown', handleTab);
      editor.removeEventListener('keydown', handleEnter);
      editor.removeEventListener('input', handleInput);
    };
  }, [editorRef, isScreenplayMode, handleTab, handleEnter, handleInput]);

  /**
   * Initialize screenplay mode styling
   */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (isScreenplayMode) {
      // Apply screenplay styling to editor
      editor.style.fontFamily = 'Courier, "Courier New", monospace';
      editor.style.fontSize = '12pt';
      editor.style.lineHeight = '1.5';

      // Scan existing paragraphs and set their types
      const paragraphs = editor.querySelectorAll('p');
      paragraphs.forEach(p => {
        const paragraph = p as HTMLElement;
        const existingType = paragraph.getAttribute('data-screenplay-type');

        if (existingType) {
          setElementType(paragraph, existingType as ScreenplayElementType);

          // Collect character names
          if (existingType === 'character') {
            const name = paragraph.textContent?.trim();
            if (name) characterListRef.current.addCharacter(name);
          }
        } else {
          const text = paragraph.textContent || '';
          if (text.trim()) {
            const type = detectScreenplayElement(text);
            setElementType(paragraph, type);
          }
        }
      });
    } else {
      // Reset styling when leaving screenplay mode
      editor.style.fontFamily = '';
      editor.style.fontSize = '';
      editor.style.lineHeight = '';
    }
  }, [editorRef, isScreenplayMode, setElementType]);

  return {
    getCharacterSuggestions,
    characterList: characterListRef.current,
  };
}
