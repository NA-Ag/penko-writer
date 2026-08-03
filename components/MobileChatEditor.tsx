import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../AppContext';
import { Send, Bold, Italic, List, Heading, Trash2, Edit2, ArrowLeft, MoreVertical, FileText } from 'lucide-react';
import { htmlToMarkdown } from './markdownConverter';

export const MobileChatEditor: React.FC = () => {
  const {
    currentDoc,
    setCurrentDoc,
    darkMode,
    uiLanguage,
    onShowStats,
    onShowSpellCheck
  } = useApp();

  const [inputText, setInputText] = useState('');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [activeFormats, setActiveFormats] = useState<{ bold: boolean; italic: boolean }>({ bold: false, italic: false });
  const [showDocMenu, setShowDocMenu] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  if (!currentDoc) return null;

  // Slices HTML into block nodes
  const getBlocks = () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(currentDoc.content || '<p><br></p>', 'text/html');
    return Array.from(doc.body.children) as HTMLElement[];
  };

  const blocks = getBlocks();

  // Scroll to bottom on load
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentDoc.content]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(currentDoc.content || '<p><br></p>', 'text/html');
    const body = doc.body;

    // Apply formatting
    let text = inputText;
    if (activeFormats.bold) text = `<strong>${text}</strong>`;
    if (activeFormats.italic) text = `<em>${text}</em>`;
    const blockHtml = `<p>${text}</p>`;

    if (editIndex !== null) {
      // Editing in-place
      const target = body.children[editIndex];
      if (target) {
        target.innerHTML = text;
      }
      setEditIndex(null);
    } else {
      // Appending new message block
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = blockHtml;
      if (tempDiv.firstChild) {
        body.appendChild(tempDiv.firstChild);
      }
    }

    // Save document state
    setCurrentDoc(prev => prev ? {
      ...prev,
      content: body.innerHTML,
      lastModified: Date.now()
    } : null);

    setInputText('');
    setActiveFormats({ bold: false, italic: false });
  };

  const handleEdit = (index: number, text: string) => {
    setInputText(text);
    setEditIndex(index);
  };

  const handleDelete = (index: number) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(currentDoc.content || '<p><br></p>', 'text/html');
    const body = doc.body;

    if (body.children[index]) {
      body.children[index].remove();
    }

    setCurrentDoc(prev => prev ? {
      ...prev,
      content: body.innerHTML,
      lastModified: Date.now()
    } : null);
  };

  const toggleFormat = (format: 'bold' | 'italic') => {
    setActiveFormats(prev => ({
      ...prev,
      [format]: !prev[format]
    }));
  };

  const wordCount = blocks.reduce((acc, block) => acc + (block.textContent || '').trim().split(/\s+/).filter(Boolean).length, 0);

  return (
    <div className={`flex flex-col h-full w-full ${darkMode ? 'bg-zinc-950 text-gray-100' : 'bg-gray-100 text-gray-900'}`}>
      {/* Header bar */}
      <div className={`p-4 border-b flex justify-between items-center z-10 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="font-bold text-sm truncate max-w-[180px]">{currentDoc.title || 'Untitled Document'}</h1>
            <p className="text-[10px] opacity-60 font-medium uppercase tracking-wider">{blocks.length} paragraphs • {wordCount} words</p>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setShowDocMenu(!showDocMenu)} className="p-1 hover:opacity-80">
            <MoreVertical size={20} />
          </button>
          {showDocMenu && (
            <div className={`absolute right-0 mt-2 w-48 rounded-xl shadow-xl border p-2 z-20 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100'}`}>
              <button 
                onClick={() => { onShowStats(); setShowDocMenu(false); }}
                className="w-full text-left p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-xs"
              >
                📊 Show Stats
              </button>
              <button 
                onClick={() => { onShowSpellCheck(); setShowDocMenu(false); }}
                className="w-full text-left p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-xs"
              >
                🔍 Spellcheck
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
        {blocks.length === 0 || (blocks.length === 1 && !blocks[0].textContent?.trim()) ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 p-8">
            <div className="text-4xl mb-2">💬</div>
            <p className="text-sm font-semibold">Start your document conversation</p>
            <p className="text-xs max-w-xs mt-1">Text a paragraph below to add it directly to this document.</p>
          </div>
        ) : (
          blocks.map((block, index) => {
            const isHeading = ['h1', 'h2', 'h3'].includes(block.tagName.toLowerCase());
            const text = block.textContent || '';
            const html = block.innerHTML;

            return (
              <div key={index} className="flex flex-col group items-end max-w-[85%] self-end">
                <div className={`p-3 rounded-2xl shadow-sm text-sm border transition-all duration-200 relative break-words w-full
                  ${darkMode 
                    ? 'bg-blue-600/20 border-blue-500/20 text-blue-100' 
                    : 'bg-blue-500 text-white border-blue-600/10'}`}
                >
                  <div dangerouslySetInnerHTML={{ __html: html }} className={isHeading ? 'font-bold text-base' : ''} />
                  
                  {/* Action buttons (Edit & Delete) */}
                  <div className="absolute top-1/2 -left-16 transform -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEdit(index, text)}
                      className={`p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                      title="Edit paragraph"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button 
                      onClick={() => handleDelete(index)}
                      className={`p-1.5 rounded-full hover:bg-red-500/10 text-red-500`}
                      title="Delete paragraph"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input controls & field */}
      <div className={`p-4 border-t ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200 shadow-inner'}`}>
        {/* Formatting toggle toolbar */}
        <div className="flex gap-2 mb-3 items-center">
          <button 
            onClick={() => toggleFormat('bold')}
            className={`p-2 rounded-lg text-xs font-bold transition-colors ${activeFormats.bold ? 'bg-blue-600 text-white' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10'}`}
          >
            <Bold size={14} />
          </button>
          <button 
            onClick={() => toggleFormat('italic')}
            className={`p-2 rounded-lg text-xs font-italic transition-colors ${activeFormats.italic ? 'bg-blue-600 text-white' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10'}`}
          >
            <Italic size={14} />
          </button>
          {editIndex !== null && (
            <span className="text-[10px] text-amber-500 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full ml-auto">
              Editing Block #{editIndex + 1}
            </span>
          )}
        </div>

        {/* Input box */}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            placeholder={editIndex !== null ? "Edit paragraph content..." : "Text a new paragraph..."}
            className={`flex-1 p-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
              darkMode 
                ? 'bg-zinc-950 border-zinc-800 text-gray-200' 
                : 'bg-gray-50 border-gray-200 text-gray-800'
            }`}
          />
          <button 
            onClick={handleSend}
            className="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all transform active:scale-95 shadow-md"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
