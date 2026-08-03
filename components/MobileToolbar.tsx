import React, { useState } from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Undo, Redo, Image as ImageIcon,
  Link as LinkIcon, MoreVertical, X, Type, Palette, Table
} from 'lucide-react';
import { COLORS } from '../constants';

interface MobileToolbarProps {
  onCommand: (cmd: string, val?: string | null) => void;
  darkMode: boolean;
  onShowLinkDialog: () => void;
  onTableAction: (action: string) => void;
}

const MobileToolbar: React.FC<MobileToolbarProps> = ({
  onCommand,
  darkMode,
  onShowLinkDialog,
  onTableAction,
}) => {
  const [showMore, setShowMore] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const buttonClass = `
    p-3 rounded-lg active:bg-gray-200 dark:active:bg-gray-700
    transition-colors touch-manipulation
    ${darkMode ? 'text-gray-300' : 'text-gray-700'}
  `;

  const insertTable = () => {
    const html = `
      <table style="width:100%; border-collapse: collapse; margin: 10px 0;">
        <tbody>
          <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
          <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
        </tbody>
      </table>
    `;
    onCommand('insertHTML', html);
    setShowMore(false);
  };

  return (
    <>
      {/* Main Toolbar - Sticky at bottom on mobile */}
      <div className={`
        sticky bottom-0 left-0 right-0 z-40
        border-t ${darkMode ? 'border-gray-700 bg-[#1e1e1e]' : 'border-gray-200 bg-white'}
        px-2 py-2 shadow-lg
      `}>
        <div className="flex items-center justify-around max-w-screen-lg mx-auto">
          {/* Undo/Redo */}
          <button onClick={() => onCommand('undo')} className={buttonClass} title="Undo">
            <Undo className="w-5 h-5" />
          </button>
          <button onClick={() => onCommand('redo')} className={buttonClass} title="Redo">
            <Redo className="w-5 h-5" />
          </button>

          {/* Divider */}
          <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

          {/* Text Formatting */}
          <button onClick={() => onCommand('bold')} className={buttonClass} title="Bold">
            <Bold className="w-5 h-5" />
          </button>
          <button onClick={() => onCommand('italic')} className={buttonClass} title="Italic">
            <Underline className="w-5 h-5" />
          </button>
          <button onClick={() => onCommand('underline')} className={buttonClass} title="Underline">
            <Italic className="w-5 h-5" />
          </button>

          {/* Divider */}
          <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

          {/* Lists */}
          <button onClick={() => onCommand('insertUnorderedList')} className={buttonClass} title="Bullet List">
            <List className="w-5 h-5" />
          </button>
          <button onClick={() => onCommand('insertOrderedList')} className={buttonClass} title="Numbered List">
            <ListOrdered className="w-5 h-5" />
          </button>

          {/* Divider */}
          <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

          {/* More options */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`${buttonClass} ${showMore ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
            title="More"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Extended Toolbar (when More is clicked) */}
      {showMore && (
        <div className={`
          fixed inset-0 z-50 flex flex-col
          ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}
        `}>
          {/* Header */}
          <div className={`
            flex items-center justify-between p-4 border-b
            ${darkMode ? 'border-gray-700' : 'border-gray-200'}
          `}>
            <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              More Tools
            </h3>
            <button
              onClick={() => setShowMore(false)}
              className={buttonClass}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6 max-w-screen-lg mx-auto">
              {/* Alignment Section */}
              <Section title="Alignment" darkMode={darkMode}>
                <div className="grid grid-cols-4 gap-2">
                  <ToolButton
                    icon={<AlignLeft />}
                    label="Left"
                    onClick={() => { onCommand('justifyLeft'); setShowMore(false); }}
                    darkMode={darkMode}
                  />
                  <ToolButton
                    icon={<AlignCenter />}
                    label="Center"
                    onClick={() => { onCommand('justifyCenter'); setShowMore(false); }}
                    darkMode={darkMode}
                  />
                  <ToolButton
                    icon={<AlignRight />}
                    label="Right"
                    onClick={() => { onCommand('justifyRight'); setShowMore(false); }}
                    darkMode={darkMode}
                  />
                  <ToolButton
                    icon={<AlignLeft />}
                    label="Justify"
                    onClick={() => { onCommand('justifyFull'); setShowMore(false); }}
                    darkMode={darkMode}
                  />
                </div>
              </Section>

              {/* Insert Section */}
              <Section title="Insert" darkMode={darkMode}>
                <div className="grid grid-cols-3 gap-2">
                  <ToolButton
                    icon={<LinkIcon />}
                    label="Link"
                    onClick={() => { onShowLinkDialog(); setShowMore(false); }}
                    darkMode={darkMode}
                  />
                  <ToolButton
                    icon={<ImageIcon />}
                    label="Image"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              onCommand('insertImage', event.target.result as string);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      };
                      input.click();
                      setShowMore(false);
                    }}
                    darkMode={darkMode}
                  />
                  <ToolButton
                    icon={<Table />}
                    label="Table"
                    onClick={() => { insertTable(); }}
                    darkMode={darkMode}
                  />
                </div>
              </Section>

              {/* Colors Section */}
              <Section title="Text Color" darkMode={darkMode}>
                <div className="grid grid-cols-8 gap-2">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => { onCommand('foreColor', color); setShowMore(false); }}
                      className="w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-gray-600 active:scale-95 transition-transform"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </Section>

              {/* Highlight Section */}
              <Section title="Highlight Color" darkMode={darkMode}>
                <div className="grid grid-cols-8 gap-2">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => { onCommand('hiliteColor', color); setShowMore(false); }}
                      className="w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-gray-600 active:scale-95 transition-transform"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </Section>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Section component
const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  darkMode: boolean;
}> = ({ title, children, darkMode }) => (
  <div>
    <h4 className={`text-sm font-semibold mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
      {title}
    </h4>
    {children}
  </div>
);

// Tool Button component
const ToolButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  darkMode: boolean;
}> = ({ icon, label, onClick, darkMode }) => (
  <button
    onClick={onClick}
    className={`
      flex flex-col items-center gap-2 p-4 rounded-xl
      active:scale-95 transition-transform
      ${darkMode
        ? 'bg-gray-800 hover:bg-gray-700 text-white'
        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
      }
    `}
  >
    <div className="w-6 h-6">{icon}</div>
    <span className="text-xs font-medium">{label}</span>
  </button>
);

export default MobileToolbar;
