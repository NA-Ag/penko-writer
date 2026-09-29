import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, List } from 'lucide-react';
import { t, LanguageCode } from '../utils/translations';
import { useApp } from '../AppContext';
import { collectHeadings, moveSection, OutlineHeading } from '../utils/outline';

interface HeadingNode {
  id: string;
  level: number; // 1-6 for H1-H6
  text: string;
  heading: OutlineHeading;
  children: HeadingNode[];
  isCollapsed?: boolean;
}

interface DocumentOutlineProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
}

const buildTree = (headings: OutlineHeading[], collapsed: Set<string>, untitled: string): HeadingNode[] => {
  const nodes: HeadingNode[] = [];
  const stack: HeadingNode[] = [];
  headings.forEach(h => {
    const id = `heading-${h.index}`;
    const node: HeadingNode = { id, level: h.level, text: h.text || untitled, heading: h, children: [], isCollapsed: collapsed.has(id) };
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) stack.pop();
    if (stack.length === 0) nodes.push(node);
    else stack[stack.length - 1].children.push(node);
    stack.push(node);
  });
  return nodes;
};

export const DocumentOutline: React.FC<DocumentOutlineProps> = ({
  isOpen,
  onClose,
  darkMode,
  uiLanguage,
}) => {
  const { editor } = useApp();
  const [headings, setHeadings] = useState<OutlineHeading[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ id: string; placement: 'before' | 'after' } | null>(null);

  // Live list of headings from the document
  useEffect(() => {
    if (!isOpen || !editor || editor.isDestroyed) {
      setHeadings([]);
      return;
    }
    let timer = 0;
    const update = () => {
      if (!editor.isDestroyed) setHeadings(collectHeadings(editor.state.doc));
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(update, 150);
    };
    update();
    editor.on('update', schedule);
    return () => {
      window.clearTimeout(timer);
      editor.off('update', schedule);
    };
  }, [isOpen, editor]);

  const outline = buildTree(headings, collapsed, t(uiLanguage, 'rvUntitledHeading'));

  // Put the cursor in the heading and scroll it into view (in #editor-scroll-container)
  const handleHeadingClick = (node: HeadingNode) => {
    if (!editor || editor.isDestroyed) return;
    const pos = node.heading.pos;
    const current = editor.state.doc.nodeAt(pos);
    if (!current || current.type.name !== 'heading') return;
    editor.chain().focus().setTextSelection(pos + 1 + current.content.size).run();
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    dom?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  };

  const handleToggleCollapse = (nodeId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  // Drag and drop: move a whole section (heading + its content) in one undoable transaction
  const findNode = (id: string, nodes: HeadingNode[] = outline): HeadingNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const child = findNode(id, n.children);
      if (child) return child;
    }
    return null;
  };

  const handleDragStart = (e: React.DragEvent, node: HeadingNode) => {
    if (!node.heading.topLevel) {
      e.preventDefault();
      return;
    }
    setDraggedItem(node.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.text);
  };

  const handleDragOver = (e: React.DragEvent, node: HeadingNode) => {
    if (!draggedItem || !node.heading.topLevel) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const placement = e.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
    if (dragOverItem?.id !== node.id || dragOverItem.placement !== placement) setDragOverItem({ id: node.id, placement });
  };

  const handleDrop = (e: React.DragEvent, target: HeadingNode) => {
    e.preventDefault();
    const source = draggedItem ? findNode(draggedItem) : null;
    const placement = dragOverItem?.placement || 'before';
    setDraggedItem(null);
    setDragOverItem(null);
    if (!source || !editor || editor.isDestroyed || source.id === target.id) return;
    const tr = editor.state.tr;
    if (moveSection(tr, source.heading.pos, target.heading.pos, placement)) {
      editor.view.dispatch(tr.scrollIntoView());
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  // Render outline tree recursively
  const renderNode = (node: HeadingNode, depth: number = 0): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isDragging = draggedItem === node.id;
    const isDragOver = dragOverItem?.id === node.id;
    const dropLine = isDragOver ? (dragOverItem!.placement === 'before' ? 'border-t-2 border-blue-500' : 'border-b-2 border-blue-500') : '';

    return (
      <div key={node.id} className="outline-node">
        <div
          className={`
            flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer text-sm
            transition-all
            ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}
            ${isDragging ? 'opacity-50' : ''}
            ${isDragOver ? (darkMode ? 'bg-blue-900/30' : 'bg-blue-100') : ''}
            ${dropLine}
          `}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          draggable={node.heading.topLevel}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => handleDragOver(e, node)}
          onDrop={(e) => handleDrop(e, node)}
          onDragEnd={handleDragEnd}
        >
          {/* Drag handle */}
          <GripVertical size={14} className="opacity-40 flex-shrink-0" aria-hidden="true" />

          {/* Collapse toggle */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleCollapse(node.id);
              }}
              className="flex-shrink-0 opacity-60 hover:opacity-100"
              aria-expanded={!node.isCollapsed}
              aria-label={t(uiLanguage, node.isCollapsed ? 'rvExpandSection' : 'rvCollapseSection')}
            >
              {node.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : (
            <span className="w-3.5" />
          )}

          {/* Heading text */}
          <div
            onClick={() => handleHeadingClick(node)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleHeadingClick(node);
              }
            }}
            role="button"
            tabIndex={0}
            aria-level={node.level}
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
    <div
      role="complementary"
      aria-labelledby="outline-panel-title"
      data-outline-panel=""
      // Esc closes the panel while focus is inside it
      onKeyDown={e => {
        if (e.key === 'Escape' && !e.defaultPrevented) {
          e.preventDefault();
          onClose();
        }
      }}
      className={`fixed right-0 top-0 h-full w-64 border-l shadow-lg z-50 flex flex-col ${bg}`}>
      {/* Header */}
      <div className={`p-3 border-b flex items-center justify-between ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <h3 id="outline-panel-title" className="font-semibold text-sm flex items-center gap-2">
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
