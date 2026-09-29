import { useLayoutEffect, useMemo } from 'react';
import { useApp } from '../AppContext';
import { generateStyleCss } from '../utils/paragraphStyles';

const ELEMENT_ID = 'penko-doc-styles';

/**
 * Injects the current document's named-style sheet into <head> (so prints,
 * which copy the page's stylesheets, get it too) and re-runs the page layout
 * when it changes, since paragraph heights move.
 */
export const DocumentStyleSheet: React.FC = () => {
  const { currentDoc, editor } = useApp();
  const stored = currentDoc?.styles;
  const css = useMemo(() => generateStyleCss(stored), [stored]);

  useLayoutEffect(() => {
    let el = document.getElementById(ELEMENT_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = ELEMENT_ID;
      document.head.appendChild(el);
    }
    if (el.textContent === css) return;
    el.textContent = css;
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta('penkoRepaginate', true).setMeta('addToHistory', false));
  }, [css, editor]);

  return null;
};
