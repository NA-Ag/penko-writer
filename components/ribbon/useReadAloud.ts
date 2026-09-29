import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { LanguageCode, t } from '../../utils/translations';
import type { ReadAloudState } from './types';

interface Toasts {
  info: (msg: string) => void;
  warning: (msg: string) => void;
}

const synthesis = (): SpeechSynthesis | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined' ? window.speechSynthesis : null;

/**
 * Text-to-speech for the selection (or the whole document when nothing is
 * selected). Speech stops when the document changes or the ribbon unmounts.
 */
export const useReadAloud = (editor: Editor | null, docId: string | undefined, language: string | undefined, uiLanguage: LanguageCode, toast: Toasts): ReadAloudState => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const stop = useCallback(() => {
    synthesis()?.cancel();
    setIsSpeaking(false);
  }, []);

  // A different document (or unmount) ends the reading
  useEffect(() => stop, [docId, stop]);

  const toggle = () => {
    const synth = synthesis();
    if (!synth) {
      toast.warning(t(uiLanguage, 'ttsUnsupported'));
      return;
    }
    if (synth.speaking || isSpeaking) {
      stop();
      return;
    }
    let text = '';
    if (editor && !editor.isDestroyed) {
      const { from, to, empty } = editor.state.selection;
      text = empty ? editor.getText({ blockSeparator: '\n' }) : editor.state.doc.textBetween(from, to, '\n', ' ');
    }
    if (!text.trim()) {
      toast.info(t(uiLanguage, 'nothingToRead'));
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    if (language) utterance.lang = language;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    synth.speak(utterance);
  };

  return { isSpeaking, toggle };
};
