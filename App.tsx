import React, { useState, useEffect, useRef } from 'react';
import { Ribbon } from './components/Ribbon';
import { Editor } from './components/Editor';
import { MarkdownEditor } from './components/MarkdownEditor';
import { StatusBar } from './components/StatusBar';
import { Sidebar } from './components/Sidebar';
import { Ruler } from './components/Ruler';
import { AdvancedFindReplace } from './components/AdvancedFindReplace';
import { SpellChecker } from './components/SpellChecker';
import { StatsDialog } from './components/StatsDialog';
import { HistoryDialog } from './components/HistoryDialog';
import { DocumentOutline } from './components/DocumentOutline';
import { DiagramEditor } from './components/DiagramEditor';
import { TemplateDialog } from './components/TemplateDialog';
import { PresentationView } from './components/PresentationView';
import { SettingsDialog } from './components/SettingsDialog';
import { HeaderFooterDialog } from './components/HeaderFooterDialog';
import { LinkDialog } from './components/LinkDialog';
import { CommentsPanel } from './components/CommentsPanel';
import { TrackChangesPanel } from './components/TrackChangesPanel';
import ImportDialog from './components/ImportDialog';
import InstallPrompt from './components/InstallPrompt';
import MobileToolbar from './components/MobileToolbar';
import CollaborationDialog from './components/CollaborationDialog';
import EquationDialog from './components/EquationDialog';
import TableOfContentsDialog from './components/TableOfContentsDialog';
import FootnoteDialog from './components/FootnoteDialog';
import CitationDialog from './components/CitationDialog';
import CodeBlockDialog from './components/CodeBlockDialog';
import { ImageToolbar } from './components/ImageToolbar';
import { ImageGallery } from './components/ImageGallery';
import { FocusMode } from './components/FocusMode';
import { DocumentData, PageConfig, EditorHandle, SelectionContext, Template, Comment, CommentReply, TrackChange, Citation } from './types';
import { saveToStorage, loadFromStorage, createNewDocument, deleteFromStorage } from './utils/storage';
import { saveSnapshot } from './utils/history';
import { Minimize2 } from 'lucide-react';
import { LanguageCode } from './utils/translations';
import { useIsMobile } from './utils/hooks';
import { useToast } from './utils/useToast';
import { ToastContainer } from './components/Toast';
import KeyboardShortcutsDialog from './components/KeyboardShortcutsDialog';

const App: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [currentDoc, setCurrentDoc] = useState<DocumentData | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [showRuler, setShowRuler] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showSpellCheck, setShowSpellCheck] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [showDiagramEditor, setShowDiagramEditor] = useState(false);
  const [showHeaderFooter, setShowHeaderFooter] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [existingLink, setExistingLink] = useState<{ url: string; text: string } | null>(null);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [showTrackChangesPanel, setShowTrackChangesPanel] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCollaborationDialog, setShowCollaborationDialog] = useState(false);
  const [showEquationDialog, setShowEquationDialog] = useState(false);
  const [showTOCDialog, setShowTOCDialog] = useState(false);
  const [showFootnoteDialog, setShowFootnoteDialog] = useState(false);
  const [showCitationDialog, setShowCitationDialog] = useState(false);
  const [showCodeBlockDialog, setShowCodeBlockDialog] = useState(false);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [currentUser, setCurrentUser] = useState('User');
  const [darkMode, setDarkMode] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [rawText, setRawText] = useState('');
  const [zenMode, setZenMode] = useState(false);
  const [pasteAsPlainText, setPasteAsPlainText] = useState(false);
  const [uiLanguage, setUiLanguage] = useState<LanguageCode>('en-US');
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState(false);
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [typewriterMode, setTypewriterMode] = useState(false);
  const [wordGoal, setWordGoal] = useState<number | undefined>(undefined);

  const [selectionContext, setSelectionContext] = useState<SelectionContext>({ type: 'text' });
  const editorRef = useRef<EditorHandle>(null);

  // Mobile detection
  const isMobile = useIsMobile(768);

  // Toast notifications
  const toast = useToast();

  // Initialize
  useEffect(() => {
    const savedDocs = loadFromStorage();
    setDocuments(savedDocs);
    if (savedDocs.length > 0) {
      setCurrentDoc(savedDocs[0]);
    } else {
      handleNewDoc();
    }

    // Migrate and load theme
    let savedTheme = localStorage.getItem('penko_writer_theme');
    if (!savedTheme) {
      const oldTheme = localStorage.getItem('cloudword_theme');
      if (oldTheme) {
        localStorage.setItem('penko_writer_theme', oldTheme);
        savedTheme = oldTheme;
      }
    }
    if (savedTheme === 'dark') setDarkMode(true);

    // Migrate and load UI language
    let savedUiLang = localStorage.getItem('penko_writer_ui_lang');
    if (!savedUiLang) {
      const oldUiLang = localStorage.getItem('cloudword_ui_lang');
      if (oldUiLang) {
        localStorage.setItem('penko_writer_ui_lang', oldUiLang);
        savedUiLang = oldUiLang;
      }
    }
    if (savedUiLang) setUiLanguage(savedUiLang as LanguageCode);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + B = Bold
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        executeCommand('bold');
      }
      // Ctrl/Cmd + I = Italic
      else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        executeCommand('italic');
      }
      // Ctrl/Cmd + U = Underline
      else if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        executeCommand('underline');
      }
      // Ctrl/Cmd + S = Save (manual trigger)
      else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (currentDoc) {
          saveToStorage(currentDoc);
          toast.success('Document saved!');
        }
      }
      // Ctrl/Cmd + P = Print
      else if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        window.print();
      }
      // Ctrl/Cmd + F = Find
      else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
      // Ctrl/Cmd + O = Open/Import
      else if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        setShowImportDialog(true);
      }
      // Ctrl/Cmd + Z = Undo
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        executeCommand('undo');
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y = Redo
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        executeCommand('redo');
      }
      // Ctrl/Cmd + K = Insert Link
      else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleOpenLinkDialog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDoc]);

  // Persist Theme & Language
  useEffect(() => {
    localStorage.setItem('penko_writer_theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('penko_writer_ui_lang', uiLanguage);
  }, [uiLanguage]);

  // Auto-save
  useEffect(() => {
    if (!currentDoc) return;

    const timer = setTimeout(() => {
      saveToStorage(currentDoc);
      setDocuments(prev => prev.map(d => d.id === currentDoc.id ? currentDoc : d));
    }, 1000);

    return () => {
        clearTimeout(timer);
    };
  }, [currentDoc]);

  // Smart snapshot system - waits for meaningful pauses
  useEffect(() => {
    if (!currentDoc) return;

    const snapshotTimer = setTimeout(() => {
      // Only snapshot if there's meaningful content change
      saveSnapshot(currentDoc);
    }, 5000); // Wait 5 seconds of inactivity before snapshotting

    return () => {
        clearTimeout(snapshotTimer);
    };
  }, [currentDoc]);

  const handleNewDoc = () => {
    const newDoc = createNewDocument();
    setDocuments(prev => [newDoc, ...prev]);
    setCurrentDoc(newDoc);
  };

  const handleRemoveFromHistory = (docId: string) => {
    // Delete from localStorage
    deleteFromStorage(docId);

    // Filter out the document from the list
    setDocuments(prev => prev.filter(doc => doc.id !== docId));

    // If the removed document was currently open, switch to another document or create a new one
    if (currentDoc?.id === docId) {
      const remaining = documents.filter(doc => doc.id !== docId);
      if (remaining.length > 0) {
        setCurrentDoc(remaining[0]);
      } else {
        handleNewDoc();
      }
    }
  };

  const handleTemplateSelect = (template: Template) => {
    const newDoc = createNewDocument();
    newDoc.title = template.name;
    newDoc.content = template.content;
    if (template.pageConfig) {
      newDoc.pageConfig = template.pageConfig;
    }
    if (template.isScreenplay) {
      newDoc.isScreenplay = true;
    }
    setDocuments(prev => [newDoc, ...prev]);
    setCurrentDoc(newDoc);
    setShowTemplates(false);
    toast.success(`Template "${template.name}" loaded!`);
  };

  const handleImportDocument = (title: string, content: string) => {
    const newDoc = createNewDocument();
    newDoc.title = title;
    newDoc.content = content;
    setDocuments(prev => [newDoc, ...prev]);
    setCurrentDoc(newDoc);
    setShowImportDialog(false);
    toast.success('Document imported successfully!');
  };

  const handleOpenDoc = (id: string) => {
    const doc = documents.find(d => d.id === id);
    if (doc) setCurrentDoc(doc);
    setIsSidebarOpen(false);
  };

  const handleContentChange = (html: string, text: string) => {
    if (!currentDoc) return;
    const safeText = text || '';
    const count = safeText.trim() === '' ? 0 : safeText.trim().split(/\s+/).length;
    setWordCount(count);
    setRawText(safeText);
    setCurrentDoc(prev => prev ? { ...prev, content: html, lastModified: Date.now() } : null);
  };

  const handleTitleChange = (newTitle: string) => {
    if (!currentDoc) return;
    setCurrentDoc(prev => prev ? { ...prev, title: newTitle, lastModified: Date.now() } : null);
  };

  const handlePageConfigChange = (config: Partial<PageConfig>) => {
    if (!currentDoc) return;
    setCurrentDoc(prev => prev ? { 
        ...prev, 
        pageConfig: { ...(prev.pageConfig || { size: 'A4', orientation: 'portrait', margins: 'normal', cols: 1 }), ...config },
        lastModified: Date.now() 
    } : null);
  };

  const handleLanguageChange = (lang: string) => {
    if (!currentDoc) return;
    setCurrentDoc(prev => prev ? { ...prev, language: lang, lastModified: Date.now() } : null);
  };

  const executeCommand = (command: string, value: string | null = null) => {
    if (command === 'zoom') {
       setZoom(parseInt(value || '100'));
       return;
    }

    if (command === 'fontSize' && value) {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
          const range = selection.getRangeAt(0);
          const span = document.createElement('span');
          span.style.fontSize = value + 'pt';
          const fragment = range.extractContents();
          span.appendChild(fragment);
          range.insertNode(span);
      }
      if (editorRef.current) editorRef.current.focus();
      return;
    }

    document.execCommand(command, false, value ?? undefined);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const handleTableAction = (action: string, value?: any) => {
      if(!editorRef.current) return;
      if (action === 'addRow') editorRef.current.addTableRow();
      if (action === 'delRow') editorRef.current.deleteTableRow();
      if (action === 'addCol') editorRef.current.addTableColumn();
      if (action === 'delCol') editorRef.current.deleteTableColumn();
      if (action === 'mergeCells') editorRef.current.mergeCells();
      if (action === 'splitCell') editorRef.current.splitCell();
      if (action === 'setStyle') editorRef.current.setTableStyle(value);
      if (action === 'setWidth') editorRef.current.setColumnWidth(value);
  };

  const handleImageAction = (action: string, value?: any) => {
      if(!editorRef.current) return;
      if (action === 'resize') editorRef.current.resizeImage(value);
      if (action === 'align') editorRef.current.alignImage(value);
      if (action === 'rotate') editorRef.current.rotateImage(value);
      if (action === 'border') editorRef.current.setImageBorder(value);
      if (action === 'replace') handleReplaceImage();
  };

  const handleReplaceImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && editorRef.current) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          if (event.target?.result) {
            let dataUrl = event.target.result as string;

            // Auto-optimize if file is >1MB
            const { compressImage, shouldCompressImage } = await import('./utils/imageUtils');
            if (shouldCompressImage(dataUrl)) {
              dataUrl = await compressImage(dataUrl);
            }

            await editorRef.current?.replaceImage(dataUrl);
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleContextChange = (ctx: SelectionContext) => {
    setSelectionContext(ctx);
    // Update selected image when context changes to image
    if (ctx.type === 'image' && editorRef.current) {
      const img = editorRef.current.getSelectedImage();
      setSelectedImage(img);
    } else {
      setSelectedImage(null);
    }
  };

  const handleRestoreVersion = (content: string) => {
      if (currentDoc) {
          saveSnapshot(currentDoc);
          setCurrentDoc({ ...currentDoc, content, lastModified: Date.now() });
      }
  };

  const handleApplyCorrection = (original: string, correction: string) => {
    if (!currentDoc || !editorRef.current) return;

    const editorElement = editorRef.current.getContentElement();
    if (!editorElement) return;

    // Simple find and replace in the HTML content
    const currentContent = editorRef.current.getInnerHtml();
    const updatedContent = currentContent.replace(original, correction);

    setCurrentDoc(prev => prev ? { ...prev, content: updatedContent, lastModified: Date.now() } : null);
  };

  const handleHeaderFooterSave = (data: {
    header: string;
    footer: string;
    showPageNumbers: boolean;
    pageNumberPosition: 'header-left' | 'header-center' | 'header-right' | 'footer-left' | 'footer-center' | 'footer-right';
  }) => {
    if (!currentDoc) return;
    setCurrentDoc(prev => prev ? {
      ...prev,
      header: data.header,
      footer: data.footer,
      showPageNumbers: data.showPageNumbers,
      pageNumberPosition: data.pageNumberPosition,
      lastModified: Date.now()
    } : null);
  };

  const handleOpenLinkDialog = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const parentElement = range.commonAncestorContainer.parentElement;

      // Check if selection is within a link
      const linkElement = parentElement?.closest('a');
      if (linkElement) {
        setExistingLink({
          url: linkElement.href,
          text: linkElement.textContent || ''
        });
      } else {
        setExistingLink(null);
      }
    }
    setShowLinkDialog(true);
  };

  const handleInsertLink = (url: string, text: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const parentElement = range.commonAncestorContainer.parentElement;
      const linkElement = parentElement?.closest('a');

      if (linkElement) {
        // Update existing link
        linkElement.href = url;
        linkElement.textContent = text;
      } else {
        // Create new link
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = text;

        if (selection.toString()) {
          range.deleteContents();
        }
        range.insertNode(a);
      }

      // Trigger content update
      if (editorRef.current) {
        const html = editorRef.current.getInnerHtml();
        const textContent = editorRef.current.getInnerText();
        handleContentChange(html, textContent);
      }
    }
  };

  const handleRemoveLink = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const parentElement = range.commonAncestorContainer.parentElement;
      const linkElement = parentElement?.closest('a');

      if (linkElement) {
        const textNode = document.createTextNode(linkElement.textContent || '');
        linkElement.parentNode?.replaceChild(textNode, linkElement);

        // Trigger content update
        if (editorRef.current) {
          const html = editorRef.current.getInnerHtml();
          const textContent = editorRef.current.getInnerText();
          handleContentChange(html, textContent);
        }
      }
    }
  };

  const handleInsertEquation = (latex: string) => {
    // Create equation element with KaTeX rendering
    const equationSpan = document.createElement('span');
    equationSpan.className = 'katex-equation';
    equationSpan.setAttribute('data-latex', latex);
    equationSpan.style.display = 'inline-block';
    equationSpan.style.margin = '0 4px';

    // Render the equation using KaTeX
    try {
      const katex = require('katex');
      katex.render(latex, equationSpan, {
        throwOnError: false,
        displayMode: false,
      });
    } catch (err) {
      equationSpan.textContent = `[Equation: ${latex}]`;
    }

    // Insert into editor
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(equationSpan);

      // Move cursor after equation
      range.setStartAfter(equationSpan);
      range.setEndAfter(equationSpan);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // Trigger content update
    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  const handleInsertTOC = (tocHTML: string) => {
    // Insert TOC at cursor position
    executeCommand('insertHTML', tocHTML);

    // Trigger content update
    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  const handleInsertFootnote = (noteData: { type: 'footnote' | 'endnote'; content: string; number: number }) => {
    // Create superscript reference number
    const refSpan = document.createElement('sup');
    refSpan.className = `${noteData.type}-ref`;
    refSpan.setAttribute('data-note-id', `${noteData.type}-${noteData.number}`);
    refSpan.textContent = noteData.number.toString();
    refSpan.style.color = '#3b82f6';
    refSpan.style.cursor = 'pointer';
    refSpan.style.fontWeight = 'bold';

    // Insert into editor
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(refSpan);

      // Move cursor after reference
      range.setStartAfter(refSpan);
      range.setEndAfter(refSpan);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // Add note to document's footnotes/endnotes array
    if (currentDoc) {
      const notes = currentDoc.footnotes || [];
      notes.push(noteData);
      setCurrentDoc(prev => prev ? { ...prev, footnotes: notes, lastModified: Date.now() } : null);
    }

    // Trigger content update
    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  // Citation handlers
  const handleAddCitation = (citation: Citation) => {
    if (!currentDoc) return;
    const citations = currentDoc.citations || [];
    citations.push(citation);
    setCurrentDoc(prev => prev ? { ...prev, citations, lastModified: Date.now() } : null);
  };

  const handleDeleteCitation = (citationId: string) => {
    if (!currentDoc) return;
    const citations = (currentDoc.citations || []).filter(c => c.id !== citationId);
    setCurrentDoc(prev => prev ? { ...prev, citations, lastModified: Date.now() } : null);
  };

  const handleInsertCitation = (citationId: string, style: 'apa' | 'mla' | 'chicago' | 'bibtex') => {
    const citation = currentDoc?.citations?.find(c => c.id === citationId);
    if (!citation) return;

    let citationText = '';
    const { author, year } = citation;

    switch (style) {
      case 'apa':
        citationText = `(${author}, ${year})`;
        break;
      case 'mla':
        citationText = `(${author})`;
        break;
      case 'chicago':
        citationText = `(${author} ${year})`;
        break;
      case 'bibtex':
        citationText = `\\cite{${author.split(' ')[0].toLowerCase()}${year}}`;
        break;
    }

    executeCommand('insertHTML', `<span class="citation" data-citation-id="${citationId}">${citationText}</span>`);

    // Trigger content update
    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  const handleInsertBibliography = (style: 'apa' | 'mla' | 'chicago' | 'bibtex') => {
    const citations = currentDoc?.citations || [];
    if (citations.length === 0) return;

    let bibliographyHTML = '<div class="bibliography" style="margin-top: 40px; page-break-before: always;">';

    const titleMap = {
      apa: 'References',
      mla: 'Works Cited',
      chicago: 'Bibliography',
      bibtex: 'References'
    };

    bibliographyHTML += `<h2 style="font-size: 1.5em; font-weight: bold; margin-bottom: 20px;">${titleMap[style]}</h2>`;
    bibliographyHTML += '<div style="padding-left: 40px; text-indent: -40px;">';

    citations.forEach(citation => {
      const { author, title, year, publisher, journal, volume, pages } = citation;
      let entry = '';

      switch (style) {
        case 'apa':
          if (citation.type === 'book') {
            entry = `${author} (${year}). <i>${title}</i>. ${publisher || 'Publisher'}.`;
          } else if (citation.type === 'journal') {
            entry = `${author} (${year}). ${title}. <i>${journal}</i>, ${volume}${pages ? `, ${pages}` : ''}.`;
          } else {
            entry = `${author} (${year}). ${title}.`;
          }
          break;

        case 'mla':
          if (citation.type === 'book') {
            entry = `${author}. <i>${title}</i>. ${publisher || 'Publisher'}, ${year}.`;
          } else if (citation.type === 'journal') {
            entry = `${author}. "${title}." <i>${journal}</i> ${volume} (${year})${pages ? `: ${pages}` : ''}.`;
          } else {
            entry = `${author}. <i>${title}</i>. ${year}.`;
          }
          break;

        case 'chicago':
          if (citation.type === 'book') {
            entry = `${author}. <i>${title}</i>. ${publisher ? `${publisher}, ` : ''}${year}.`;
          } else if (citation.type === 'journal') {
            entry = `${author}. "${title}." <i>${journal}</i> ${volume}${pages ? ` (${year}): ${pages}` : ` (${year})`}.`;
          } else {
            entry = `${author}. <i>${title}</i>. ${year}.`;
          }
          break;

        case 'bibtex':
          const bibType = citation.type === 'journal' ? 'article' : citation.type;
          entry = `<pre style="font-family: monospace; margin: 10px 0;">@${bibType}{${author.split(' ')[0].toLowerCase()}${year},
  author = {${author}},
  title = {${title}},
  year = {${year}}
}</pre>`;
          break;
      }

      bibliographyHTML += `<p style="margin: 8px 0;">${entry}</p>`;
    });

    bibliographyHTML += '</div></div>';

    executeCommand('insertHTML', bibliographyHTML);

    // Trigger content update
    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  // Code block handler
  const handleInsertCodeBlock = (code: string, language: string, theme: string) => {
    // Ensure editor has focus first
    if (editorRef.current) {
      editorRef.current.focus();
    }

    // Escape HTML in code
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // Generate line numbers HTML if needed
    const lines = code.split('\n');
    const lineNumbersHTML = lines.map((_, i) => `<div style="line-height: 1.6; font-size: 14px;">${i + 1}</div>`).join('');

    // Create code block with syntax highlighting classes
    const codeBlockHTML = `
      <div class="code-block-container" style="margin: 20px 0; border-radius: 8px; overflow: hidden; background: #2d2d2d; font-family: 'Courier New', monospace;">
        <div class="code-block-header" style="background: #1e1e1e; padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #404040;">
          <span style="color: #888; font-size: 12px; text-transform: uppercase;">${language}</span>
          <button onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.querySelector('code').textContent); alert('Copied!');" style="background: #404040; color: #fff; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">Copy</button>
        </div>
        <div class="code-block-content" style="display: flex; overflow-x: auto;">
          <div class="line-numbers" style="background: #1e1e1e; padding: 12px 8px; text-align: right; color: #6e7681; user-select: none; min-width: 40px; border-right: 1px solid #404040; font-family: 'Courier New', monospace;">
            ${lineNumbersHTML}
          </div>
          <pre style="margin: 0; padding: 12px 16px; flex: 1; overflow-x: auto;"><code class="language-${language}" style="color: #d4d4d4; font-size: 14px; line-height: 1.6; white-space: pre; display: block;">${escapedCode}</code></pre>
        </div>
      </div>
    `;

    // Use document.execCommand instead to ensure proper insertion
    document.execCommand('insertHTML', false, codeBlockHTML);

    // Trigger content update
    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  // Comment handlers
  const handleAddComment = (text: string, rangeId: string) => {
    if (!currentDoc) return;

    const newComment: Comment = {
      id: crypto.randomUUID(),
      rangeId,
      author: currentUser,
      text,
      timestamp: Date.now(),
      resolved: false,
      replies: []
    };

    const updatedComments = [...(currentDoc.comments || []), newComment];
    setCurrentDoc(prev => prev ? { ...prev, comments: updatedComments, lastModified: Date.now() } : null);
  };

  const handleReplyToComment = (commentId: string, text: string) => {
    if (!currentDoc) return;

    const reply: CommentReply = {
      id: crypto.randomUUID(),
      author: currentUser,
      text,
      timestamp: Date.now()
    };

    const updatedComments = currentDoc.comments?.map(comment =>
      comment.id === commentId
        ? { ...comment, replies: [...comment.replies, reply] }
        : comment
    );

    setCurrentDoc(prev => prev ? { ...prev, comments: updatedComments, lastModified: Date.now() } : null);
  };

  const handleResolveComment = (commentId: string) => {
    if (!currentDoc) return;

    const updatedComments = currentDoc.comments?.map(comment =>
      comment.id === commentId ? { ...comment, resolved: true } : comment
    );

    setCurrentDoc(prev => prev ? { ...prev, comments: updatedComments, lastModified: Date.now() } : null);
  };

  const handleDeleteComment = (commentId: string) => {
    if (!currentDoc) return;

    const updatedComments = currentDoc.comments?.filter(comment => comment.id !== commentId);
    setCurrentDoc(prev => prev ? { ...prev, comments: updatedComments, lastModified: Date.now() } : null);
  };

  const handleHighlightComment = (commentId: string) => {
    // Find and scroll to the comment highlight in the editor
    const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
    if (commentElement) {
      commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash the highlight
      commentElement.classList.add('comment-flash');
      setTimeout(() => commentElement.classList.remove('comment-flash'), 1000);
    }
  };

  const handleCreateCommentFromSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      alert('Please select some text to comment on');
      return;
    }

    const range = selection.getRangeAt(0);
    const rangeId = crypto.randomUUID();

    // Wrap selection in a comment span
    const span = document.createElement('span');
    span.className = 'comment-highlight';
    span.setAttribute('data-comment-id', rangeId);
    span.style.cssText = 'background-color: rgba(255, 193, 7, 0.3); cursor: pointer;';

    try {
      range.surroundContents(span);
    } catch (e) {
      // If surroundContents fails, use a different approach
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }

    // Clear selection
    selection.removeAllRanges();

    // Prompt for comment text
    const text = prompt('Enter your comment:');
    if (text) {
      handleAddComment(text, rangeId);
      setShowCommentsPanel(true);
    } else {
      // Remove the highlight if user cancels
      span.replaceWith(...span.childNodes);
    }

    // Trigger content update
    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  // Track Changes handlers
  const handleToggleTracking = () => {
    if (!currentDoc) return;
    setCurrentDoc(prev => prev ? {
      ...prev,
      trackingEnabled: !prev.trackingEnabled,
      lastModified: Date.now()
    } : null);
  };

  // Screenplay Mode handler
  const handleToggleScreenplay = () => {
    if (!currentDoc) return;
    setCurrentDoc(prev => prev ? {
      ...prev,
      isScreenplay: !prev.isScreenplay,
      lastModified: Date.now()
    } : null);
  };

  // Markdown Mode handler
  const handleToggleMarkdown = () => {
    if (!currentDoc) return;
    setCurrentDoc(prev => prev ? {
      ...prev,
      isMarkdownMode: !prev.isMarkdownMode,
      lastModified: Date.now()
    } : null);
  };

  const handleAcceptChange = (changeId: string) => {
    if (!currentDoc) return;

    const change = currentDoc.trackChanges?.find(c => c.id === changeId);
    if (!change) return;

    // Apply the change to the document
    if (change.type === 'insert') {
      // The content is already in the document, just mark as accepted
      const updatedChanges = currentDoc.trackChanges?.map(c =>
        c.id === changeId ? { ...c, accepted: true } : c
      );
      setCurrentDoc(prev => prev ? { ...prev, trackChanges: updatedChanges, lastModified: Date.now() } : null);

      // Remove the tracking markup from the actual content
      const changeElement = document.querySelector(`[data-change-id="${changeId}"]`);
      if (changeElement) {
        const textContent = changeElement.textContent;
        const textNode = document.createTextNode(textContent || '');
        changeElement.parentNode?.replaceChild(textNode, changeElement);
      }
    } else if (change.type === 'delete') {
      // Remove the deleted text permanently
      const changeElement = document.querySelector(`[data-change-id="${changeId}"]`);
      if (changeElement) {
        changeElement.remove();
      }

      const updatedChanges = currentDoc.trackChanges?.map(c =>
        c.id === changeId ? { ...c, accepted: true } : c
      );
      setCurrentDoc(prev => prev ? { ...prev, trackChanges: updatedChanges, lastModified: Date.now() } : null);
    }

    // Update editor content
    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  const handleRejectChange = (changeId: string) => {
    if (!currentDoc) return;

    const change = currentDoc.trackChanges?.find(c => c.id === changeId);
    if (!change) return;

    // Revert the change
    if (change.type === 'insert') {
      // Remove the inserted content
      const changeElement = document.querySelector(`[data-change-id="${changeId}"]`);
      if (changeElement) {
        changeElement.remove();
      }
    } else if (change.type === 'delete') {
      // Restore the deleted content
      const changeElement = document.querySelector(`[data-change-id="${changeId}"]`);
      if (changeElement && change.oldContent) {
        const textNode = document.createTextNode(change.oldContent);
        changeElement.parentNode?.replaceChild(textNode, changeElement);
      }
    }

    // Mark as rejected
    const updatedChanges = currentDoc.trackChanges?.map(c =>
      c.id === changeId ? { ...c, rejected: true } : c
    );
    setCurrentDoc(prev => prev ? { ...prev, trackChanges: updatedChanges, lastModified: Date.now() } : null);

    // Update editor content
    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  const handleAcceptAllChanges = () => {
    if (!currentDoc) return;

    currentDoc.trackChanges?.forEach(change => {
      if (!change.accepted && !change.rejected) {
        handleAcceptChange(change.id);
      }
    });
  };

  const handleRejectAllChanges = () => {
    if (!currentDoc) return;

    currentDoc.trackChanges?.forEach(change => {
      if (!change.accepted && !change.rejected) {
        handleRejectChange(change.id);
      }
    });
  };

  const handleHighlightChange = (changeId: string) => {
    // Find and scroll to the change in the editor
    const changeElement = document.querySelector(`[data-change-id="${changeId}"]`);
    if (changeElement) {
      changeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash the highlight
      changeElement.classList.add('change-flash');
      setTimeout(() => changeElement.classList.remove('change-flash'), 1000);
    }
  };

  return (
    <div className={`flex h-screen w-full overflow-hidden text-sm transition-colors duration-200 ${darkMode ? 'bg-[#0f0f0f] text-gray-200' : 'bg-[#f8fafc] text-gray-900'}`}>
      
      {!zenMode && (
        <Sidebar
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          documents={documents}
          currentDoc={currentDoc}
          onSelectDoc={handleOpenDoc}
          onNewDoc={handleNewDoc}
          onNewFromTemplate={() => setShowTemplates(true)}
          onImportDoc={() => setShowImportDialog(true)}
          onSave={() => {
            if (currentDoc) {
              saveToStorage(currentDoc);
              toast.success('Document saved!');
            }
          }}
          darkMode={darkMode}
          toggleDarkMode={() => setDarkMode(!darkMode)}
          onShowHistory={() => setShowHistory(true)}
          onShowSettings={() => setShowSettings(true)}
          onShowStats={() => setShowStats(true)}
          onRemoveFromHistory={handleRemoveFromHistory}
          uiLanguage={uiLanguage}
        />
      )}

      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        {!zenMode && !isMobile && (
          <div className="px-6 pt-4 pb-2 z-30 shrink-0">
             <Ribbon
              onCommand={executeCommand}
              currentDoc={currentDoc}
              onTitleChange={handleTitleChange}
              showRuler={showRuler}
              setShowRuler={setShowRuler}
              onUpdatePageConfig={handlePageConfigChange}
              onFind={() => setShowSearch(true)}
              darkMode={darkMode}
              pasteAsPlainText={pasteAsPlainText}
              togglePasteAsPlainText={() => setPasteAsPlainText(!pasteAsPlainText)}
              onShowStats={() => setShowStats(true)}
              onToggleZenMode={() => setZenMode(true)}
              onToggleFocusMode={() => setShowFocusMode(true)}
              selectionContext={selectionContext}
              onTableAction={handleTableAction}
              onImageAction={handleImageAction}
              onPresent={() => setShowPresentation(true)}
              onShowHeaderFooter={() => setShowHeaderFooter(true)}
              onShowLinkDialog={handleOpenLinkDialog}
              onShowCommentsPanel={() => setShowCommentsPanel(true)}
              onCreateComment={handleCreateCommentFromSelection}
              onShowCollaboration={() => setShowCollaborationDialog(true)}
              onShowEquationDialog={() => setShowEquationDialog(true)}
              onShowTOCDialog={() => setShowTOCDialog(true)}
              onShowFootnoteDialog={() => setShowFootnoteDialog(true)}
              onShowCitationDialog={() => setShowCitationDialog(true)}
              onShowCodeBlockDialog={() => setShowCodeBlockDialog(true)}
              onShowTrackChangesPanel={() => setShowTrackChangesPanel(true)}
              onToggleTracking={handleToggleTracking}
              trackingEnabled={currentDoc?.trackingEnabled || false}
              uiLanguage={uiLanguage}
              isCollapsed={isRibbonCollapsed}
              setIsCollapsed={setIsRibbonCollapsed}
              isScreenplay={currentDoc?.isScreenplay || false}
              onToggleScreenplay={handleToggleScreenplay}
              isMarkdownMode={currentDoc?.isMarkdownMode || false}
              onToggleMarkdown={handleToggleMarkdown}
              onShowKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
              showOutline={showOutline}
              onToggleOutline={() => setShowOutline(!showOutline)}
              onShowDiagramEditor={() => setShowDiagramEditor(true)}
              onShowSpellCheck={() => setShowSpellCheck(true)}
            />
          </div>
        )}

        <div 
          className={`flex-1 overflow-auto flex flex-col items-center relative transition-all duration-300 ${zenMode ? 'pt-10' : ''}`}
          onClick={() => setIsSidebarOpen(false)}
        >
           {!zenMode && showRuler && (
              <div className="sticky top-0 z-20 mt-2 mb-4 drop-shadow-sm">
                 <Ruler darkMode={darkMode} />
              </div>
           )}
           
           <div className={`flex-1 flex justify-center w-full px-4 pb-32 transition-transform duration-300 ${zenMode ? 'scale-105' : ''}`}>
              {currentDoc?.isMarkdownMode ? (
                <MarkdownEditor
                  content={currentDoc?.content || ''}
                  onChange={handleContentChange}
                  darkMode={darkMode}
                  language={currentDoc?.language || 'en-US'}
                />
              ) : (
                <Editor
                  content={currentDoc?.content || ''}
                  onChange={handleContentChange}
                  zoom={zoom}
                  pageConfig={currentDoc?.pageConfig}
                  darkMode={darkMode}
                  ref={editorRef}
                  pasteAsPlainText={pasteAsPlainText}
                  language={currentDoc?.language || 'en-US'}
                  onContextChange={handleContextChange}
                  header={currentDoc?.header}
                  footer={currentDoc?.footer}
                  showPageNumbers={currentDoc?.showPageNumbers}
                  pageNumberPosition={currentDoc?.pageNumberPosition}
                  isScreenplay={currentDoc?.isScreenplay}
                />
              )}
           </div>
        </div>

        {!zenMode && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40">
             <StatusBar 
               wordCount={wordCount} 
               zoom={zoom} 
               setZoom={setZoom} 
               darkMode={darkMode} 
               onShowStats={() => setShowStats(true)}
               language={currentDoc?.language || 'en-US'}
               onChangeLanguage={handleLanguageChange}
               uiLanguage={uiLanguage}
            />
          </div>
        )}

        {zenMode && (
           <button 
             onClick={() => setZenMode(false)}
             className="fixed bottom-8 right-8 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full backdrop-blur transition-all shadow-lg z-50 group flex items-center gap-2"
           >
              <Minimize2 size={24} />
              <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap text-sm font-medium">Exit Focus</span>
           </button>
        )}

        {/* Mobile Toolbar */}
        {!zenMode && isMobile && (
          <MobileToolbar
            onCommand={executeCommand}
            darkMode={darkMode}
            onShowLinkDialog={handleOpenLinkDialog}
            onTableAction={handleTableAction}
          />
        )}
      </div>

      <AdvancedFindReplace isOpen={showSearch} onClose={() => setShowSearch(false)} darkMode={darkMode} uiLanguage={uiLanguage} editorRef={editorRef} />
      <SpellChecker
        isOpen={showSpellCheck}
        onClose={() => setShowSpellCheck(false)}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
        content={currentDoc?.content || ''}
        documentLanguage={currentDoc?.language || 'en-US'}
        onApplyCorrection={handleApplyCorrection}
      />
      <StatsDialog isOpen={showStats} onClose={() => setShowStats(false)} text={rawText} darkMode={darkMode} uiLanguage={uiLanguage} />
      <HistoryDialog isOpen={showHistory} onClose={() => setShowHistory(false)} docId={currentDoc?.id || ''} onRestore={handleRestoreVersion} darkMode={darkMode} uiLanguage={uiLanguage} currentContent={currentDoc?.content || ''} />
      <DocumentOutline isOpen={showOutline} onClose={() => setShowOutline(false)} darkMode={darkMode} uiLanguage={uiLanguage} editorRef={editorRef} />
      <DiagramEditor isOpen={showDiagramEditor} onClose={() => setShowDiagramEditor(false)} darkMode={darkMode} uiLanguage={uiLanguage} />
      <TemplateDialog isOpen={showTemplates} onClose={() => setShowTemplates(false)} onSelect={handleTemplateSelect} darkMode={darkMode} uiLanguage={uiLanguage} />
      <ImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImport={handleImportDocument}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
      />
      <SettingsDialog 
         isOpen={showSettings} 
         onClose={() => setShowSettings(false)} 
         darkMode={darkMode}
         pasteAsPlainText={pasteAsPlainText}
         setPasteAsPlainText={setPasteAsPlainText}
         showRuler={showRuler}
         setShowRuler={setShowRuler}
         uiLanguage={uiLanguage}
         setUiLanguage={setUiLanguage}
      />
      {showPresentation && currentDoc && (
          <PresentationView
             content={currentDoc.content}
             onClose={() => setShowPresentation(false)}
             darkMode={darkMode}
          />
      )}
      <HeaderFooterDialog
        isOpen={showHeaderFooter}
        onClose={() => setShowHeaderFooter(false)}
        darkMode={darkMode}
        headerContent={currentDoc?.header || ''}
        footerContent={currentDoc?.footer || ''}
        showPageNumbers={currentDoc?.showPageNumbers || false}
        pageNumberPosition={currentDoc?.pageNumberPosition || 'footer-center'}
        onSave={handleHeaderFooterSave}
      />
      <LinkDialog
        isOpen={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        darkMode={darkMode}
        onInsert={handleInsertLink}
        onRemove={handleRemoveLink}
        existingLink={existingLink}
      />
      <CollaborationDialog
        isOpen={showCollaborationDialog}
        onClose={() => setShowCollaborationDialog(false)}
        currentContent={currentDoc?.content || ''}
        onContentChange={handleContentChange}
        userName={currentUser}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
      />
      <EquationDialog
        isOpen={showEquationDialog}
        onClose={() => setShowEquationDialog(false)}
        onInsert={handleInsertEquation}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
      />
      <TableOfContentsDialog
        isOpen={showTOCDialog}
        onClose={() => setShowTOCDialog(false)}
        onInsert={handleInsertTOC}
        darkMode={darkMode}
        currentContent={currentDoc?.content || ''}
        uiLanguage={uiLanguage}
      />
      <FootnoteDialog
        isOpen={showFootnoteDialog}
        onClose={() => setShowFootnoteDialog(false)}
        onInsert={handleInsertFootnote}
        darkMode={darkMode}
        existingNotes={currentDoc?.footnotes || []}
        uiLanguage={uiLanguage}
      />
      <CitationDialog
        isOpen={showCitationDialog}
        onClose={() => setShowCitationDialog(false)}
        onInsertCitation={handleInsertCitation}
        onInsertBibliography={handleInsertBibliography}
        darkMode={darkMode}
        existingCitations={currentDoc?.citations || []}
        onAddCitation={handleAddCitation}
        onDeleteCitation={handleDeleteCitation}
        uiLanguage={uiLanguage}
      />
      <CodeBlockDialog
        isOpen={showCodeBlockDialog}
        onClose={() => setShowCodeBlockDialog(false)}
        onInsert={handleInsertCodeBlock}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
      />
      <CommentsPanel
        isOpen={showCommentsPanel}
        onClose={() => setShowCommentsPanel(false)}
        darkMode={darkMode}
        comments={currentDoc?.comments || []}
        currentUser={currentUser}
        onAddComment={handleAddComment}
        onReplyToComment={handleReplyToComment}
        onResolveComment={handleResolveComment}
        onDeleteComment={handleDeleteComment}
        onHighlightComment={handleHighlightComment}
      />

      {/* Image Toolbar - shows when image selected */}
      {selectedImage && (
        <ImageToolbar
          image={selectedImage}
          onPositionChange={(mode) => {
            const { applyImagePosition } = require('./utils/imageUtils');
            applyImagePosition(selectedImage, mode);
          }}
          onResize={(percent) => editorRef.current?.resizeImage(percent)}
          onRotate={(degrees) => {
            const { rotateImage } = require('./utils/imageUtils');
            rotateImage(selectedImage, degrees);
          }}
          onEffect={(effect, value) => {
            const { applyImageEffect } = require('./utils/imageUtils');
            applyImageEffect(selectedImage, effect, value);
          }}
          onAltText={() => {
            const currentAlt = selectedImage.alt || '';
            const newAlt = prompt('Enter alt text for accessibility:', currentAlt);
            if (newAlt !== null) {
              const { setImageAltText } = require('./utils/imageUtils');
              setImageAltText(selectedImage, newAlt);
            }
          }}
          onReplace={() => handleImageAction('replace')}
          onDelete={() => {
            if (confirm('Delete this image?')) {
              selectedImage.remove();
              setSelectedImage(null);
              toast.success('Image deleted');
            }
          }}
          darkMode={darkMode}
          language={uiLanguage}
        />
      )}

      {/* Image Gallery */}
      {showImageGallery && (
        <ImageGallery
          editorElement={editorRef.current?.getInnerHtml() ? document.getElementById('editor-content') : null}
          onClose={() => setShowImageGallery(false)}
          onImageSelect={(img) => {
            img.scrollIntoView({ behavior: 'smooth', block: 'center' });
            img.click();
          }}
          onImageDelete={(img) => {
            if (confirm('Delete this image?')) {
              img.remove();
              toast.success('Image deleted');
            }
          }}
          darkMode={darkMode}
          language={uiLanguage}
        />
      )}

      {/* PWA Install Prompt */}
      <InstallPrompt darkMode={darkMode} />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onClose={toast.closeToast} darkMode={darkMode} />

      {/* Focus Mode */}
      {showFocusMode && currentDoc && (
        <FocusMode
          content={currentDoc.content}
          onChange={(html) => {
            const div = document.createElement('div');
            div.innerHTML = html;
            const text = div.textContent || '';
            handleContentChange(html, text);
          }}
          onExit={() => setShowFocusMode(false)}
          darkMode={darkMode}
          uiLanguage={uiLanguage}
          typewriterMode={typewriterMode}
          onToggleTypewriter={() => setTypewriterMode(!typewriterMode)}
          wordGoal={wordGoal}
          onSetWordGoal={setWordGoal}
        />
      )}
    </div>
  );
};

export default App;