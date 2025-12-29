import React from 'react';
import { X, FileText } from 'lucide-react';
import { TEMPLATES } from '../utils/templates';
import { Template } from '../types';
import { useFocusTrap } from '../utils/hooks';
import { t, LanguageCode } from '../utils/translations';

interface TemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: Template) => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
}

// Generate template-specific preview based on template ID
const getTemplatePreview = (templateId: string, isDark: boolean) => {
  const baseColor = isDark ? 'bg-current' : 'bg-current';

  switch (templateId) {
    case 'blank':
      return (
        <div className="p-4 space-y-2 opacity-40">
          <div className="h-2 w-3/4 bg-current rounded"></div>
          <div className="h-2 w-full bg-current rounded"></div>
          <div className="h-2 w-5/6 bg-current rounded"></div>
        </div>
      );

    case 'resume-creative':
      return (
        <div className="flex h-full">
          <div className="w-1/3 bg-slate-700 p-2 space-y-2">
            <div className="w-8 h-8 rounded-full bg-slate-500 mx-auto"></div>
            <div className="space-y-1 opacity-60">
              <div className="h-1 w-full bg-white rounded"></div>
              <div className="h-1 w-3/4 bg-white rounded"></div>
            </div>
          </div>
          <div className="flex-1 p-2 space-y-1.5 opacity-50">
            <div className="h-2 w-1/2 bg-current rounded"></div>
            <div className="h-1 w-1/3 bg-current rounded"></div>
            <div className="h-1 w-full bg-current rounded mt-2"></div>
            <div className="h-1 w-full bg-current rounded"></div>
          </div>
        </div>
      );

    case 'resume-modern':
      return (
        <div className="p-3 space-y-2 opacity-40">
          <div className="h-1.5 w-1/2 bg-current rounded mx-auto"></div>
          <div className="h-0.5 w-full bg-current rounded"></div>
          <div className="space-y-1 mt-2">
            <div className="h-1 w-1/3 bg-current rounded"></div>
            <div className="h-1 w-full bg-current rounded"></div>
            <div className="h-1 w-5/6 bg-current rounded"></div>
          </div>
        </div>
      );

    case 'cover-letter':
      return (
        <div className="p-3 space-y-2 opacity-35">
          <div className="h-1 w-1/4 bg-current rounded ml-auto"></div>
          <div className="space-y-1 mt-3">
            <div className="h-1 w-1/3 bg-current rounded"></div>
            <div className="h-1 w-1/4 bg-current rounded"></div>
          </div>
          <div className="space-y-1 mt-3">
            <div className="h-1 w-full bg-current rounded"></div>
            <div className="h-1 w-full bg-current rounded"></div>
            <div className="h-1 w-3/4 bg-current rounded"></div>
          </div>
        </div>
      );

    case 'project-proposal':
      return (
        <div className="p-3 space-y-2 opacity-40">
          <div className="h-2 w-2/3 bg-blue-600 rounded"></div>
          <div className="h-1 w-full bg-blue-400 rounded"></div>
          <div className="border-l-2 border-blue-600 pl-2 py-1 bg-blue-50/50 mt-2">
            <div className="h-1 w-full bg-current rounded"></div>
            <div className="h-1 w-3/4 bg-current rounded mt-1"></div>
          </div>
          <div className="grid grid-cols-3 gap-1 mt-2">
            <div className="h-3 bg-blue-100 rounded"></div>
            <div className="h-3 bg-blue-100 rounded"></div>
            <div className="h-3 bg-blue-100 rounded"></div>
          </div>
        </div>
      );

    case 'flyer-event':
      return (
        <div className="bg-gradient-to-br from-purple-900 to-black p-3 h-full flex flex-col items-center justify-center text-white">
          <div className="h-3 w-3/4 bg-pink-500 rounded mb-1"></div>
          <div className="h-4 w-1/2 bg-white rounded"></div>
          <div className="h-0.5 w-8 bg-white rounded my-2"></div>
          <div className="h-1 w-2/3 bg-white/70 rounded"></div>
        </div>
      );

    case 'academic-paper':
      return (
        <div className="p-3 space-y-2 opacity-35">
          <div className="text-center space-y-1 mt-4">
            <div className="h-1 w-3/4 bg-current rounded mx-auto"></div>
            <div className="h-0.5 w-1/2 bg-current rounded mx-auto"></div>
            <div className="h-0.5 w-1/3 bg-current rounded mx-auto"></div>
          </div>
          <div className="space-y-1 mt-4">
            <div className="h-1 w-full bg-current rounded"></div>
            <div className="h-1 w-full bg-current rounded"></div>
            <div className="h-1 w-5/6 bg-current rounded"></div>
          </div>
        </div>
      );

    case 'lesson-plan':
      return (
        <div className="p-2 space-y-1.5 opacity-40">
          <div className="h-2 w-1/2 bg-green-700 rounded"></div>
          <div className="space-y-0.5">
            <div className="flex gap-1">
              <div className="h-1 w-1/4 bg-green-600 rounded"></div>
              <div className="h-1 flex-1 bg-current rounded"></div>
            </div>
            <div className="flex gap-1">
              <div className="h-1 w-1/4 bg-green-600 rounded"></div>
              <div className="h-1 flex-1 bg-current rounded"></div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-0.5 mt-2">
            <div className="h-2 bg-green-100 rounded"></div>
            <div className="h-2 bg-green-100 rounded"></div>
            <div className="h-2 bg-green-100 rounded"></div>
          </div>
        </div>
      );

    case 'recipe':
      return (
        <div className="p-3 space-y-2 opacity-40">
          <div className="h-2 w-3/4 bg-orange-600 rounded mx-auto"></div>
          <div className="flex gap-2 mt-2">
            <div className="flex-1 space-y-1">
              <div className="h-1 w-full bg-current rounded"></div>
              <div className="h-1 w-3/4 bg-current rounded"></div>
              <div className="h-1 w-5/6 bg-current rounded"></div>
            </div>
            <div className="w-0.5 bg-orange-200"></div>
            <div className="flex-1 space-y-1">
              <div className="h-1 w-full bg-current rounded"></div>
              <div className="h-1 w-full bg-current rounded"></div>
              <div className="h-1 w-3/4 bg-current rounded"></div>
            </div>
          </div>
        </div>
      );

    case 'certificate':
      return (
        <div className="border-4 border-double border-yellow-600 p-2 h-full flex flex-col items-center justify-center opacity-50">
          <div className="h-2 w-2/3 bg-yellow-700 rounded mb-1"></div>
          <div className="h-1 w-1/2 bg-yellow-600 rounded mb-2"></div>
          <div className="h-1 w-1/3 border-b-2 border-yellow-700"></div>
          <div className="w-6 h-6 rounded-full bg-yellow-600 mt-2"></div>
        </div>
      );

    case 'brochure':
      return (
        <div className="flex h-full">
          <div className="flex-1 bg-blue-50 p-1.5 space-y-1 opacity-60">
            <div className="h-1 w-3/4 bg-blue-600 rounded"></div>
            <div className="h-0.5 w-full bg-current rounded"></div>
            <div className="h-0.5 w-5/6 bg-current rounded"></div>
          </div>
          <div className="flex-1 p-1.5 space-y-1 opacity-60">
            <div className="h-1 w-2/3 bg-current rounded mx-auto"></div>
            <div className="h-0.5 w-1/2 bg-current rounded mx-auto"></div>
          </div>
          <div className="flex-1 bg-blue-700 p-1.5 flex flex-col items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-white/80 mb-1"></div>
            <div className="h-1 w-3/4 bg-white rounded"></div>
          </div>
        </div>
      );

    case 'invoice':
      return (
        <div className="p-3 space-y-2 opacity-40">
          <div className="flex justify-between items-start">
            <div className="h-2 w-1/3 bg-blue-700 rounded"></div>
            <div className="space-y-0.5">
              <div className="h-0.5 w-12 bg-current rounded ml-auto"></div>
              <div className="h-0.5 w-10 bg-current rounded ml-auto"></div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-0.5 mt-3">
            <div className="h-1 bg-blue-700 rounded"></div>
            <div className="h-1 bg-blue-700 rounded"></div>
            <div className="h-1 bg-blue-700 rounded"></div>
            <div className="h-1 bg-blue-700 rounded"></div>
          </div>
          <div className="space-y-0.5">
            <div className="h-0.5 w-full bg-current rounded"></div>
            <div className="h-0.5 w-full bg-current rounded"></div>
          </div>
        </div>
      );

    case 'newsletter':
      return (
        <div className="space-y-1 opacity-50">
          <div className="bg-green-600 p-2 text-center">
            <div className="h-1.5 w-2/3 bg-white rounded mx-auto"></div>
          </div>
          <div className="p-2 space-y-1">
            <div className="h-1 w-1/2 bg-current rounded"></div>
            <div className="h-0.5 w-full bg-current rounded"></div>
            <div className="h-0.5 w-5/6 bg-current rounded"></div>
          </div>
          <div className="grid grid-cols-2 gap-1 px-2">
            <div className="h-4 bg-gray-100 rounded"></div>
            <div className="h-4 bg-gray-100 rounded"></div>
          </div>
        </div>
      );

    case 'meeting-notes':
      return (
        <div className="p-3 space-y-2 opacity-40">
          <div className="h-2 w-2/3 bg-yellow-700 rounded border-b-2 border-yellow-700"></div>
          <div className="grid grid-cols-2 gap-0.5 mt-2">
            <div className="h-1 bg-yellow-100 rounded"></div>
            <div className="h-1 bg-yellow-100 rounded"></div>
          </div>
          <div className="space-y-0.5 mt-2">
            <div className="h-0.5 w-full bg-current rounded"></div>
            <div className="h-0.5 w-5/6 bg-current rounded"></div>
            <div className="h-0.5 w-3/4 bg-current rounded"></div>
          </div>
        </div>
      );

    case 'screenplay':
      return (
        <div className="bg-gradient-to-br from-purple-900 via-indigo-800 to-blue-900 p-2 h-full text-white font-mono text-xs opacity-90">
          <div className="space-y-1">
            <div className="h-1 w-3/4 bg-white rounded font-bold"></div>
            <div className="space-y-0.5 ml-2">
              <div className="h-0.5 w-full bg-white/70 rounded"></div>
              <div className="h-0.5 w-5/6 bg-white/70 rounded"></div>
            </div>
            <div className="h-0.5 w-1/3 bg-white rounded ml-8"></div>
            <div className="space-y-0.5 ml-4">
              <div className="h-0.5 w-2/3 bg-white/70 rounded"></div>
            </div>
            <div className="mt-2 text-center">
              <div className="h-1 w-16 bg-purple-300 rounded mx-auto"></div>
              <div className="text-[0.4rem] mt-1 opacity-60">SCREENPLAY</div>
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="p-4 space-y-2 opacity-30">
          <div className="h-2 w-3/4 bg-current rounded"></div>
          <div className="h-2 w-full bg-current rounded"></div>
          <div className="h-2 w-5/6 bg-current rounded"></div>
        </div>
      );
  }
};

export const TemplateDialog: React.FC<TemplateDialogProps> = ({ isOpen, onClose, onSelect, darkMode, uiLanguage }) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  if (!isOpen) return null;

  const bg = darkMode ? 'bg-[#222] border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900';
  const hover = darkMode ? 'hover:bg-[#333]' : 'hover:bg-gray-50';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="template-dialog-title">
      <div ref={dialogRef} className={`w-full max-w-4xl max-h-[90vh] rounded-lg shadow-2xl border flex flex-col relative overflow-hidden ${bg}`}>
        <div className={`p-5 border-b flex justify-between items-center ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h2 id="template-dialog-title" className="text-xl font-bold flex items-center gap-2">
              <FileText className="text-blue-500" />
              {t(uiLanguage, 'templateDialogTitle')}
            </h2>
            <p className="text-sm opacity-60 mt-1">{t(uiLanguage, 'templateDialogSubtitle')}</p>
          </div>
          <button onClick={onClose} className="opacity-50 hover:opacity-100" aria-label="Close"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
             {TEMPLATES.map(template => (
               <button
                 key={template.id}
                 onClick={() => onSelect(template)}
                 className={`flex flex-col text-left group transition-transform hover:-translate-y-1 focus:outline-none`}
               >
                 <div className={`aspect-[3/4] w-full rounded shadow-sm group-hover:shadow-lg transition-all mb-3 relative overflow-hidden ${template.thumbnail} ${darkMode ? 'opacity-80' : ''}`}>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5"></div>
                    {getTemplatePreview(template.id, darkMode)}
                 </div>
                 <span className="font-semibold text-sm">{t(uiLanguage, template.nameKey)}</span>
                 <span className="text-xs opacity-50">{t(uiLanguage, template.categoryKey)}</span>
               </button>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};