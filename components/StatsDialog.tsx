
import React from 'react';
import { X, Clock, Type, AlignLeft, Hash, MessageSquare } from 'lucide-react';
import { useFocusTrap, useEscapeKey } from '../utils/hooks';
import { t, LanguageCode } from '../utils/translations';
import { computeTextStats } from '../utils/textStats';

interface StatsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  text: string;
  /** Word count from the editor (same number as the status bar). */
  words?: number;
  darkMode: boolean;
  uiLanguage: LanguageCode;
}

export const StatsDialog: React.FC<StatsDialogProps> = ({ isOpen, onClose, text, words: editorWords, darkMode, uiLanguage }) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const { words, characters: chars, charactersNoSpaces: charsNoSpace, paragraphs, sentences, readingMinutes: readingTime } = computeTextStats(text, editorWords);

  const bg = darkMode ? 'bg-[#222] border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900';
  const itemBg = darkMode ? 'bg-[#333]' : 'bg-gray-50';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stats-dialog-title"
    >
      <div ref={dialogRef} className={`w-80 rounded-lg shadow-2xl border p-6 relative ${bg}`}>
        <button onClick={onClose} className="absolute top-4 right-4 opacity-50 hover:opacity-100" aria-label={t(uiLanguage, 'close')}>
          <X size={20} />
        </button>

        <h2 id="stats-dialog-title" className="text-xl font-bold mb-6 flex items-center gap-2">
          <AlignLeft className="text-blue-500" />
          {t(uiLanguage, 'documentStatistics')}
        </h2>

        <div className="space-y-3">
           <StatItem icon={<Hash size={16} />} label={t(uiLanguage, 'words')} value={words} bg={itemBg} />
           <StatItem icon={<Type size={16} />} label={t(uiLanguage, 'characters')} value={chars} sub={`(${t(uiLanguage, 'noSpaces')}: ${charsNoSpace})`} bg={itemBg} />
           <StatItem icon={<AlignLeft size={16} />} label={t(uiLanguage, 'paragraphs')} value={paragraphs} bg={itemBg} />
           <StatItem icon={<MessageSquare size={16} />} label={t(uiLanguage, 'rvSentences')} value={sentences} bg={itemBg} />
           <StatItem icon={<Clock size={16} />} label={t(uiLanguage, 'readingTime')} value={`~${readingTime} ${t(uiLanguage, 'min')}`} bg={itemBg} />
        </div>

        <button onClick={onClose} className="mt-6 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors">
          {t(uiLanguage, 'close')}
        </button>
      </div>
    </div>
  );
};

const StatItem = ({ icon, label, value, sub, bg }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; bg: string }) => (
  <div className={`flex items-center justify-between p-3 rounded ${bg}`}>
    <div className="flex items-center gap-3 opacity-80">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
    <div className="text-right">
      <div className="font-bold">{value}</div>
      {sub && <div className="text-[10px] opacity-60">{sub}</div>}
    </div>
  </div>
);
