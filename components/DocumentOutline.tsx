
import React, { useEffect, useState, useRef } from 'react';
import { ChevronDown, ChevronRight, GripVertical, List } from 'lucide-react';
import { t, LanguageCode } from '../utils/translations';

interface HeadingNode {
  id: string;
  level: number; // 1-6 for H1-H6
  text: string;
  element: HTMLElement;
  children: HeadingNode[];
  isCollapsed?: boolean;
}

interface DocumentOutlineProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
  editorRef: React.RefObject<HTMLDivElement>;
  onContentReorder?: (headingId: string, targetId: string, position: 'before' | 'after') => void;
}

export const DocumentOutline: React.FC<DocumentOutlineProps> = ({
  isOpen,
  onClose,
  darkMode,
  uiLanguage,
  editorRef,
  onContentReorder
}) => {
  const [outline, setOutline] = useState<HeadingNode[]>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  // Extract headings from editor content
  const extractHeadings = (): HeadingNode[] => {
    if (!editorRef.current) return [];

    const editorElement = editorRef.current.getContentElement();
    if (!editorElement) return [];

    const headings = editorElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const nodes: HeadingNode[] = [];
    const stack: HeadingNode[] = [];

    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.substring(1));
      const text = heading.textContent || 'Untitled';
      const id = heading.id || `heading-${index}`;

      // Ensure heading has an ID for navigation
      if (!heading.id) {
        heading.id = id;
      }

      const node: HeadingNode = {
        id,
        level,
        text,
        element: heading as HTMLElement,
        children: [],
        isCollapsed: false
      };

      // Build hierarchy
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        nodes.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    });

    return nodes;
  };

  // Refresh outline when editor content changes
  useEffect(() => {
    if (!isOpen || !editorRef.current) return;

    const editorElement = editorRef.current.getContentElement();
    if (!editorElement) return;

    const updateOutline = () => {
      setOutline(extractHeadings());
    };

    // Initial extraction
    updateOutline();

    // Set up MutationObserver to watch for content changes
    const observer = new MutationObserver(updateOutline);
    observer.observe(editorElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return () => observer.disconnect();
  }, [isOpen, editorRef]);

  // Scroll to heading when clicked
  const handleHeadingClick = (node: HeadingNode) => {
    node.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Highlight briefly
    node.element.style.backgroundColor = darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)';
    setTimeout(() => {
      node.element.style.backgroundColor = '';
    }, 1000);
  };

  // Toggle collapse state
  const toggleCollapse = (nodeId: string, nodes: HeadingNode[]): HeadingNode[] => {
    return nodes.map(node => {
      if (node.id === nodeId) {
        return { ...node, isCollapsed: !node.isCollapsed };
      }
      if (node.children.length > 0) {
        return { ...node, children: toggleCollapse(nodeId, node.children) };
      }
      return node;
    });
  };

  const handleToggleCollapse = (nodeId: string) => {
    setOutline(prev => toggleCollapse(nodeId, prev));
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, nodeId: string) => {
    setDraggedItem(nodeId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, nodeId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItem(nodeId);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();

    if (!draggedItem || draggedItem === targetId) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    // Call reorder callback if provided
    if (onContentReorder) {
      onContentReorder(draggedItem, targetId, 'before');
    }

    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  // Render outline tree recursively
  const renderNode = (node: HeadingNode, depth: number = 0): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isDragging = draggedItem === node.id;
    const isDragOver = dragOverItem === node.id;

    return (
      <div key={node.id} className="outline-node">
        <div
          className={`
            flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer text-sm
            transition-all
            ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}
            ${isDragging ? 'opacity-50' : ''}
            ${isDragOver ? (darkMode ? 'bg-blue-900/30' : 'bg-blue-100') : ''}
          `}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          draggable
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragOver={(e) => handleDragOver(e, node.id)}
          onDrop={(e) => handleDrop(e, node.id)}
          onDragEnd={handleDragEnd}
        >
          {/* Drag handle */}
          <GripVertical size={14} className="opacity-40 flex-shrink-0" />

          {/* Collapse toggle */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleCollapse(node.id);
              }}
              className="flex-shrink-0 opacity-60 hover:opacity-100"
            >
              {node.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : (
            <span className="w-3.5" />
          )}

          {/* Heading text */}
          <div
            onClick={() => handleHeadingClick(node)}
            className="flex-1 truncate"
            title={node.text}
            style={{
              fontWeight: node.level <= 2 ? '600' : '400',
              fontSize: node.level === 1 ? '14px' : '13px'
            }}
          >
            {node.text}
          </div>
        </div>

        {/* Children (if not collapsed) */}
        {hasChildren && !node.isCollapsed && (
          <div className="outline-children">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  const bg = darkMode ? 'bg-[#1e1e1e] border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-900';

  return (
    <div className={`fixed right-0 top-0 h-full w-64 border-l shadow-lg z-50 flex flex-col ${bg}`}>
      {/* Header */}
      <div className={`p-3 border-b flex items-center justify-between ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <List size={16} className="text-blue-500" />
          {t(uiLanguage, 'documentOutline')}
        </h3>
        <button
          onClick={onClose}
          className="opacity-60 hover:opacity-100 text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {t(uiLanguage, 'close')}
        </button>
      </div>

      {/* Outline content */}
      <div className="flex-1 overflow-y-auto p-2">
        {outline.length === 0 ? (
          <div className="text-center text-sm opacity-50 mt-8">
            {t(uiLanguage, 'noHeadingsFound')}
          </div>
        ) : (
          <div className="space-y-0.5">
            {outline.map(node => renderNode(node, 0))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className={`p-2 border-t text-xs opacity-50 text-center ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        {t(uiLanguage, 'outlineHint')}
      </div>
    </div>
  );
};
