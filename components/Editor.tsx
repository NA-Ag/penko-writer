import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { PageConfig, EditorHandle, SelectionContext } from '../types';
import { PAGE_MARGINS, PAGE_SIZES } from '../constants';
import { useScreenplayEditor } from '../utils/useScreenplayEditor';

interface EditorProps {
  content: string;
  onChange: (html: string, text: string) => void;
  zoom: number;
  pageConfig?: PageConfig;
  darkMode: boolean;
  pasteAsPlainText: boolean;
  language?: string;
  onContextChange: (ctx: SelectionContext) => void;
  header?: string;
  footer?: string;
  showPageNumbers?: boolean;
  pageNumberPosition?: 'header-left' | 'header-center' | 'header-right' | 'footer-left' | 'footer-center' | 'footer-right';
  isScreenplay?: boolean;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(({ content, onChange, zoom, pageConfig, darkMode, pasteAsPlainText, language = 'en-US', onContextChange, header, footer, showPageNumbers, pageNumberPosition, isScreenplay = false }, ref) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);

  // Screenplay mode hook
  const { getCharacterSuggestions } = useScreenplayEditor(contentRef, isScreenplay);

  // --- Imperative Handle for Parent ---
  useImperativeHandle(ref, () => ({
    focus: () => contentRef.current?.focus(),
    getInnerHtml: () => contentRef.current?.innerHTML || '',
    getInnerText: () => contentRef.current?.innerText || '',
    getContentElement: () => contentRef.current,

    // Table Methods
    addTableRow: () => {
      const selection = window.getSelection();
      if (!selection?.anchorNode) return;
      const tr = (selection.anchorNode as HTMLElement).closest?.('tr') || (selection.anchorNode.parentElement as HTMLElement).closest('tr');
      if (tr) {
        const newRow = tr.cloneNode(true) as HTMLTableRowElement;
        // Clear content in new row
        Array.from(newRow.cells).forEach(cell => cell.innerHTML = '&nbsp;');
        tr.parentElement?.insertBefore(newRow, tr.nextSibling);
        handleInput();
      }
    },
    deleteTableRow: () => {
      const selection = window.getSelection();
      if (!selection?.anchorNode) return;
      const tr = (selection.anchorNode as HTMLElement).closest?.('tr') || (selection.anchorNode.parentElement as HTMLElement).closest('tr');
      if (tr) {
        tr.remove();
        handleInput();
      }
    },
    addTableColumn: () => {
        const selection = window.getSelection();
        if (!selection?.anchorNode) return;
        const cell = (selection.anchorNode as HTMLElement).closest?.('td, th') || (selection.anchorNode.parentElement as HTMLElement).closest('td, th');
        if (cell) {
            const cellIndex = (cell as HTMLTableCellElement).cellIndex;
            const table = (cell as HTMLElement).closest('table');
            if(table) {
                Array.from(table.rows).forEach(row => {
                    const newCell = row.insertCell(cellIndex + 1);
                    newCell.innerHTML = '&nbsp;';
                    newCell.style.border = '1px solid ' + (darkMode ? '#666' : '#ccc');
                    newCell.style.padding = '5px';
                });
                handleInput();
            }
        }
    },
    deleteTableColumn: () => {
        const selection = window.getSelection();
        if (!selection?.anchorNode) return;
        const cell = (selection.anchorNode as HTMLElement).closest?.('td, th') || (selection.anchorNode.parentElement as HTMLElement).closest('td, th');
        if (cell) {
            const cellIndex = (cell as HTMLTableCellElement).cellIndex;
            const table = (cell as HTMLElement).closest('table');
            if(table) {
                Array.from(table.rows).forEach(row => {
                    if(row.cells.length > cellIndex) row.deleteCell(cellIndex);
                });
                handleInput();
            }
        }
    },

    // Cell Merging
    mergeCells: () => {
        const selection = window.getSelection();
        if (!selection?.anchorNode) return;
        const cell = (selection.anchorNode as HTMLElement).closest?.('td, th') || (selection.anchorNode.parentElement as HTMLElement).closest('td, th');
        if (cell) {
            const currentCell = cell as HTMLTableCellElement;
            const nextCell = currentCell.nextElementSibling as HTMLTableCellElement;

            if (nextCell && nextCell.tagName === currentCell.tagName) {
                // Merge horizontally
                const currentColSpan = parseInt(currentCell.getAttribute('colspan') || '1');
                const nextColSpan = parseInt(nextCell.getAttribute('colspan') || '1');
                currentCell.setAttribute('colspan', (currentColSpan + nextColSpan).toString());
                currentCell.innerHTML += ' ' + nextCell.innerHTML;
                nextCell.remove();
                handleInput();
            }
        }
    },

    splitCell: () => {
        const selection = window.getSelection();
        if (!selection?.anchorNode) return;
        const cell = (selection.anchorNode as HTMLElement).closest?.('td, th') || (selection.anchorNode.parentElement as HTMLElement).closest('td, th');
        if (cell) {
            const currentCell = cell as HTMLTableCellElement;
            const colSpan = parseInt(currentCell.getAttribute('colspan') || '1');

            if (colSpan > 1) {
                currentCell.setAttribute('colspan', (colSpan - 1).toString());
                const newCell = currentCell.cloneNode(false) as HTMLTableCellElement;
                newCell.removeAttribute('colspan');
                newCell.innerHTML = '&nbsp;';
                currentCell.parentElement?.insertBefore(newCell, currentCell.nextSibling);
                handleInput();
            }
        }
    },

    // Table Styling
    setTableStyle: (style: 'default' | 'bordered' | 'striped' | 'minimal') => {
        const selection = window.getSelection();
        if (!selection?.anchorNode) return;
        const table = (selection.anchorNode as HTMLElement).closest?.('table') || (selection.anchorNode.parentElement as HTMLElement).closest('table');

        if (table) {
            table.removeAttribute('data-style');
            table.setAttribute('data-style', style);

            // Apply styles based on type
            const cells = table.querySelectorAll('td, th');
            cells.forEach((cell: Element) => {
                const tdCell = cell as HTMLTableCellElement;
                switch(style) {
                    case 'bordered':
                        tdCell.style.border = '2px solid ' + (darkMode ? '#555' : '#333');
                        tdCell.style.padding = '8px';
                        break;
                    case 'striped':
                        tdCell.style.border = '1px solid ' + (darkMode ? '#666' : '#ddd');
                        tdCell.style.padding = '6px';
                        break;
                    case 'minimal':
                        tdCell.style.border = 'none';
                        tdCell.style.borderBottom = '1px solid ' + (darkMode ? '#666' : '#ddd');
                        tdCell.style.padding = '8px';
                        break;
                    default:
                        tdCell.style.border = '1px solid ' + (darkMode ? '#666' : '#ccc');
                        tdCell.style.padding = '4px';
                }
            });

            // Add striped rows for striped style
            if (style === 'striped') {
                Array.from(table.rows).forEach((row, index) => {
                    if (index % 2 === 1) {
                        row.style.backgroundColor = darkMode ? '#2a2a2a' : '#f9f9f9';
                    } else {
                        row.style.backgroundColor = '';
                    }
                });
            }

            handleInput();
        }
    },

    // Column Width
    setColumnWidth: (width: string) => {
        const selection = window.getSelection();
        if (!selection?.anchorNode) return;
        const cell = (selection.anchorNode as HTMLElement).closest?.('td, th') || (selection.anchorNode.parentElement as HTMLElement).closest('td, th');

        if (cell) {
            const cellIndex = (cell as HTMLTableCellElement).cellIndex;
            const table = (cell as HTMLElement).closest('table');

            if (table) {
                Array.from(table.rows).forEach(row => {
                    if (row.cells[cellIndex]) {
                        row.cells[cellIndex].style.width = width;
                    }
                });
                handleInput();
            }
        }
    },

    // Image Methods
    resizeImage: (percent: number) => {
        if (selectedImage) {
            selectedImage.style.width = `${percent}%`;
            selectedImage.style.height = 'auto';
            handleInput();
            // Force re-select to update UI
            setSelectedImage(selectedImage);
        }
    },
    alignImage: (align: 'left' | 'center' | 'right') => {
        if(selectedImage) {
            const div = document.createElement('div');
            div.style.textAlign = align;
            selectedImage.parentElement?.insertBefore(div, selectedImage);
            div.appendChild(selectedImage);
            handleInput();
        }
    },

    rotateImage: (degrees: number) => {
        if (selectedImage) {
            const currentRotation = selectedImage.getAttribute('data-rotation') || '0';
            const newRotation = (parseInt(currentRotation) + degrees) % 360;
            selectedImage.setAttribute('data-rotation', newRotation.toString());
            selectedImage.style.transform = `rotate(${newRotation}deg)`;
            handleInput();
            setSelectedImage(selectedImage);
        }
    },

    setImageBorder: (style: 'none' | 'thin' | 'medium' | 'thick' | 'rounded') => {
        if (selectedImage) {
            switch(style) {
                case 'none':
                    selectedImage.style.border = 'none';
                    selectedImage.style.borderRadius = '0';
                    break;
                case 'thin':
                    selectedImage.style.border = '1px solid ' + (darkMode ? '#666' : '#ccc');
                    selectedImage.style.borderRadius = '0';
                    selectedImage.style.padding = '2px';
                    break;
                case 'medium':
                    selectedImage.style.border = '3px solid ' + (darkMode ? '#555' : '#999');
                    selectedImage.style.borderRadius = '0';
                    selectedImage.style.padding = '4px';
                    break;
                case 'thick':
                    selectedImage.style.border = '6px solid ' + (darkMode ? '#444' : '#666');
                    selectedImage.style.borderRadius = '0';
                    selectedImage.style.padding = '6px';
                    break;
                case 'rounded':
                    selectedImage.style.border = '2px solid ' + (darkMode ? '#555' : '#999');
                    selectedImage.style.borderRadius = '12px';
                    selectedImage.style.padding = '4px';
                    break;
            }
            handleInput();
            setSelectedImage(selectedImage);
        }
    },

    replaceImage: async (newDataUrl: string) => {
        if (selectedImage) {
            selectedImage.src = newDataUrl;
            handleInput();
            setSelectedImage(selectedImage);
        }
    },

    getSelectedImage: () => selectedImage
  }));

  useEffect(() => {
    if (contentRef.current && contentRef.current.innerHTML !== content && !isInternalUpdate.current) {
      contentRef.current.innerHTML = content;
    }
    isInternalUpdate.current = false;
  }, [content]);

  // --- Event Handlers ---

  const handleInput = () => {
    if (contentRef.current) {
      isInternalUpdate.current = true;
      onChange(contentRef.current.innerHTML, contentRef.current.innerText);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (pasteAsPlainText) {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    }
  };

  const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || !selection.anchorNode || !contentRef.current?.contains(selection.anchorNode)) {
          return;
      }

      let node = selection.anchorNode as HTMLElement;
      if (node.nodeType === 3) node = node.parentElement as HTMLElement; // Text node -> Element

      // Detect Table
      const table = node.closest('table');
      if (table) {
          onContextChange({ type: 'table' });
          clearImageSelection();
          return;
      }

      // Detect Image (Usually handled by onClick, but cursor movement matters)
      // Browsers handle image selection differently. We mostly rely on click.
      
      // Default
      onContextChange({ type: 'text' });
  };

  const handleClick = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Image Selection Logic
      if (target.tagName === 'IMG') {
          // Deselect previous
          if (selectedImage && selectedImage !== target) {
             selectedImage.classList.remove('selected-img');
             removeResizeHandles(selectedImage);
          }

          const img = target as HTMLImageElement;
          img.classList.add('selected-img');
          addResizeHandles(img);
          setSelectedImage(img);
          onContextChange({ type: 'image', data: { src: img.src } });
          e.stopPropagation(); // Prevent text selection clearing logic immediately
          return;
      } else {
          clearImageSelection();
      }

      handleSelectionChange();
  };

  const clearImageSelection = () => {
      if (selectedImage) {
          selectedImage.classList.remove('selected-img');
          removeResizeHandles(selectedImage);
          setSelectedImage(null);
      }
  };

  // Add resize handles to image
  const addResizeHandles = (img: HTMLImageElement) => {
    // Remove any existing handles first
    removeResizeHandles(img);

    // Wrap image in a container if not already wrapped
    let wrapper = img.parentElement;
    if (!wrapper || !wrapper.classList.contains('img-resize-wrapper')) {
      wrapper = document.createElement('div');
      wrapper.className = 'img-resize-wrapper';
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      wrapper.style.lineHeight = '0';
      img.parentElement?.insertBefore(wrapper, img);
      wrapper.appendChild(img);
    }

    // Create 8 resize handles (4 corners + 4 edges)
    const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
    handles.forEach(pos => {
      const handle = document.createElement('div');
      handle.className = `img-resize-handle img-resize-${pos}`;
      handle.setAttribute('data-handle', pos);
      handle.addEventListener('mousedown', (e) => handleResizeStart(e, img, pos));
      wrapper!.appendChild(handle);
    });
  };

  // Remove resize handles from image
  const removeResizeHandles = (img: HTMLImageElement) => {
    const wrapper = img.parentElement;
    if (wrapper && wrapper.classList.contains('img-resize-wrapper')) {
      const handles = wrapper.querySelectorAll('.img-resize-handle');
      handles.forEach(handle => handle.remove());
    }
  };

  // Handle resize start
  const handleResizeStart = (e: MouseEvent, img: HTMLImageElement, handle: string) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = img.offsetWidth;
    const startHeight = img.offsetHeight;
    const aspectRatio = startWidth / startHeight;
    const maintainAspect = img.getAttribute('data-aspect-locked') !== 'false';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;

      // Calculate new dimensions based on handle
      if (handle.includes('e')) newWidth = startWidth + deltaX;
      if (handle.includes('w')) newWidth = startWidth - deltaX;
      if (handle.includes('s')) newHeight = startHeight + deltaY;
      if (handle.includes('n')) newHeight = startHeight - deltaY;

      // Maintain aspect ratio for corner handles or if locked
      if (maintainAspect || handle.length === 2) {
        if (handle.includes('e') || handle.includes('w')) {
          newHeight = newWidth / aspectRatio;
        } else {
          newWidth = newHeight * aspectRatio;
        }
      }

      // Apply minimum size
      newWidth = Math.max(50, newWidth);
      newHeight = Math.max(50, newHeight);

      img.style.width = newWidth + 'px';
      img.style.height = newHeight + 'px';
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      handleInput(); // Save changes
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleKeyUp = () => {
      handleSelectionChange();
  };

  // --- Drag and Drop Image Upload ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) return;

    // Process each image
    for (const file of imageFiles) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          let dataUrl = event.target.result as string;

          // Auto-optimize if file is >1MB
          const fileSizeKB = (dataUrl.length * 0.75) / 1024;
          if (fileSizeKB > 1024) {
            try {
              // Import compression function
              const { compressImage, shouldCompressImage } = await import('../utils/imageUtils');
              if (shouldCompressImage(dataUrl)) {
                dataUrl = await compressImage(dataUrl);
              }
            } catch (error) {
              console.error('Failed to compress image:', error);
            }
          }

          // Insert the image at cursor position
          document.execCommand('insertImage', false, dataUrl);
          handleInput();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Layout Logic ---
  const size = pageConfig?.size || 'A4';
  const orientation = pageConfig?.orientation || 'portrait';
  const margin = pageConfig?.margins || 'normal';
  const cols = pageConfig?.cols || 1;

  let width = PAGE_SIZES[size].width;
  let height = PAGE_SIZES[size].height;
  if (orientation === 'landscape') {
      [width, height] = [height, width];
  }
  const padding = PAGE_MARGINS[margin];

  // Helper function to replace {PAGE} placeholders with actual page numbers (for display)
  const renderHeaderFooterContent = (htmlContent: string, currentPage: number = 1) => {
    if (!htmlContent) return '';
    return htmlContent.replace(/\{PAGE\}/g, currentPage.toString());
  };

  return (
    <div
      className="transition-transform origin-top duration-200 ease-out flex flex-col items-center pb-20 print:transform-none print:pb-0 print:items-start"
      style={{ transform: `scale(${zoom / 100})` }}
    >
      <div
        className={`page-shadow relative transition-colors duration-200 flex flex-col
           ${darkMode ? 'bg-[#1f1f1f] text-gray-200' : 'bg-white text-black'}
           print:bg-white print:text-black print:shadow-none print:w-full print:h-auto
        `}
        style={{
          width: width,
          minHeight: height,
        }}
      >
        {/* Header */}
        {(header || (showPageNumbers && pageNumberPosition?.startsWith('header'))) && (
          <div
            className={`print-header pt-4 pb-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} print:border-gray-300`}
            style={{
              fontSize: '10pt',
              minHeight: '40px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingLeft: padding,
              paddingRight: padding
            }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: renderHeaderFooterContent(
                pageNumberPosition === 'header-left' && showPageNumbers ? '{PAGE}' : '',
                1
              )}}
              style={{ flex: 1, textAlign: 'left' }}
            />
            <div
              dangerouslySetInnerHTML={{ __html: renderHeaderFooterContent(
                header || (pageNumberPosition === 'header-center' && showPageNumbers ? '{PAGE}' : ''),
                1
              )}}
              style={{ flex: 1, textAlign: 'center' }}
            />
            <div
              dangerouslySetInnerHTML={{ __html: renderHeaderFooterContent(
                pageNumberPosition === 'header-right' && showPageNumbers ? '{PAGE}' : '',
                1
              )}}
              style={{ flex: 1, textAlign: 'right' }}
            />
          </div>
        )}

        {/* Main Content */}
        <div
          id="editor-content"
          ref={contentRef}
          role="textbox"
          aria-label="Document editor"
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          spellCheck={true}
          lang={language}
          onInput={handleInput}
          onPaste={handlePaste}
          onMouseUp={handleClick}
          onKeyUp={handleKeyUp}
          onBlur={clearImageSelection}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="outline-none cursor-text flex-1"
          style={{
            padding: padding,
            fontSize: '11pt',
            lineHeight: '1.15',
            fontFamily: '"Calibri", "Arial", sans-serif',
            textAlign: 'left',
            columnCount: cols > 1 ? cols : undefined,
            columnGap: cols > 1 ? '40px' : undefined,
            columnRule: cols > 1 ? '1px solid #e5e7eb' : undefined
          }}
        />

        {/* Footer */}
        {(footer || (showPageNumbers && pageNumberPosition?.startsWith('footer'))) && (
          <div
            className={`print-footer pb-4 pt-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} print:border-gray-300`}
            style={{
              fontSize: '10pt',
              minHeight: '40px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingLeft: padding,
              paddingRight: padding
            }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: renderHeaderFooterContent(
                pageNumberPosition === 'footer-left' && showPageNumbers ? '{PAGE}' : '',
                1
              )}}
              style={{ flex: 1, textAlign: 'left' }}
            />
            <div
              dangerouslySetInnerHTML={{ __html: renderHeaderFooterContent(
                footer || (pageNumberPosition === 'footer-center' && showPageNumbers ? '{PAGE}' : ''),
                1
              )}}
              style={{ flex: 1, textAlign: 'center' }}
            />
            <div
              dangerouslySetInnerHTML={{ __html: renderHeaderFooterContent(
                pageNumberPosition === 'footer-right' && showPageNumbers ? '{PAGE}' : '',
                1
              )}}
              style={{ flex: 1, textAlign: 'right' }}
            />
          </div>
        )}
      </div>
      
      <div className={`text-xs mt-2 select-none print:hidden ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
         End of document
      </div>
      
      <style>{`
        #editor-content img { max-width: 100%; height: auto; cursor: pointer; }
        #editor-content table { width: 100%; border-collapse: collapse; }
        #editor-content td, #editor-content th { border: 1px solid ${darkMode ? '#666' : '#ccc'}; padding: 4px; min-width: 20px; }
        ${darkMode ? `
           #editor-content { color: #e5e5e5; }
        ` : ''}

        /* Selected Image Style */
        .selected-img {
            outline: 3px solid #3b82f6;
            box-shadow: 0 0 0 1px white, 0 4px 6px rgba(0,0,0,0.3);
            position: relative;
        }

        /* Image Resize Handles */
        .img-resize-handle {
            position: absolute;
            background: white;
            border: 2px solid #3b82f6;
            width: 10px;
            height: 10px;
            z-index: 1000;
        }

        .img-resize-nw { top: -5px; left: -5px; cursor: nw-resize; }
        .img-resize-ne { top: -5px; right: -5px; cursor: ne-resize; }
        .img-resize-sw { bottom: -5px; left: -5px; cursor: sw-resize; }
        .img-resize-se { bottom: -5px; right: -5px; cursor: se-resize; }
        .img-resize-n { top: -5px; left: 50%; transform: translateX(-50%); cursor: n-resize; }
        .img-resize-s { bottom: -5px; left: 50%; transform: translateX(-50%); cursor: s-resize; }
        .img-resize-w { top: 50%; left: -5px; transform: translateY(-50%); cursor: w-resize; }
        .img-resize-e { top: 50%; right: -5px; transform: translateY(-50%); cursor: e-resize; }

        /* Spell Check Indicators */
        #editor-content [spellcheck="true"]:focus::spelling-error,
        #editor-content [spellcheck="true"]::spelling-error {
            text-decoration: wavy underline #ef4444 2px;
            text-decoration-skip-ink: none;
        }

        #editor-content [spellcheck="true"]:focus::grammar-error,
        #editor-content [spellcheck="true"]::grammar-error {
            text-decoration: wavy underline #3b82f6 2px;
            text-decoration-skip-ink: none;
        }

        /* Comment Highlights */
        .comment-highlight {
            background-color: rgba(255, 193, 7, 0.3);
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .comment-highlight:hover {
            background-color: rgba(255, 193, 7, 0.5);
        }

        @keyframes flash {
            0%, 100% { background-color: rgba(255, 193, 7, 0.3); }
            50% { background-color: rgba(255, 193, 7, 0.8); }
        }

        .comment-flash {
            animation: flash 1s ease-in-out;
        }
      `}</style>
    </div>
  );
});

Editor.displayName = 'Editor';