import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, MessageSquare, MessageSquarePlus, Check, Reply, Trash2, User, ChevronDown, ChevronRight, RotateCcw, AlertTriangle } from 'lucide-react';
import { Comment } from '../types';
import { useApp } from '../AppContext';
import { t, LanguageCode } from '../utils/translations';
import { formatRelativeTime } from '../utils/relativeTime';

interface CommentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  comments: Comment[];
  currentUser: string;
  onAddComment: (text: string, rangeId: string) => void;
  onReplyToComment: (commentId: string, text: string) => void;
  onResolveComment: (commentId: string) => void;
  onReopenComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onHighlightComment: (commentId: string) => void;
  pendingCommentId: string | null;
  onCancelPendingComment: () => void;
  uiLanguage: LanguageCode;
}

/** Ids of all comment marks currently in the document (live while `enabled`). */
const useCommentIdsInDoc = (enabled: boolean): Set<string> | null => {
  const { editor } = useApp();
  const [ids, setIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!enabled || !editor || editor.isDestroyed) {
      setIds(null);
      return;
    }
    let timer = 0;
    const compute = () => {
      if (editor.isDestroyed) return;
      const found = new Set<string>();
      editor.state.doc.descendants(node => {
        if (!node.isInline) return true;
        node.marks.forEach(m => m.type.name === 'comment' && m.attrs.commentId && found.add(m.attrs.commentId));
        return true;
      });
      setIds(prev => (prev && prev.size === found.size && [...found].every(id => prev.has(id)) ? prev : found));
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(compute, 250);
    };
    compute();
    editor.on('update', schedule);
    return () => {
      window.clearTimeout(timer);
      editor.off('update', schedule);
    };
  }, [editor, enabled]);
  return ids;
};

/**
 * Dims the highlight of resolved comments in the document. Mounted always
 * (outside the panel) so resolved comments stay dimmed with the panel closed.
 */
export const ResolvedCommentStyles: React.FC<{ comments: Comment[]; darkMode: boolean }> = ({ comments, darkMode }) => {
  const css = useMemo(() => {
    const resolved = comments.filter(c => c.resolved);
    if (!resolved.length) return '';
    const esc = (s: string) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&'));
    const selectors = resolved.map(c => `.penko-doc .comment-highlight[data-comment-id="${esc(c.rangeId || c.id)}"]`).join(',\n');
    return `${selectors} { background-color: transparent; border-bottom: 1px dashed ${darkMode ? 'rgba(255, 193, 7, 0.45)' : 'rgba(202, 138, 4, 0.55)'}; }`;
  }, [comments, darkMode]);
  if (!css) return null;
  return <style data-penko-resolved-comments="">{css}</style>;
};

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  isOpen,
  onClose,
  darkMode,
  comments,
  onAddComment,
  onReplyToComment,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
  onHighlightComment,
  pendingCommentId,
  onCancelPendingComment,
  uiLanguage,
}) => {
  const { editor, setShowCommentsPanel, handleCreateCommentFromSelection } = useApp();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [newText, setNewText] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const idsInDoc = useCommentIdsInDoc(isOpen);

  const isPending = !!pendingCommentId && !comments.some(c => c.id === pendingCommentId);

  useEffect(() => {
    if (isPending) setNewText('');
  }, [pendingCommentId, isPending]);

  // Another document was opened: drop per-document UI state (and an unsaved
  // new comment, which belonged to the previous document).
  const pendingRef = useRef(isPending);
  pendingRef.current = isPending;
  const prevEditor = useRef(editor);
  useEffect(() => {
    if (prevEditor.current === editor) return;
    prevEditor.current = editor;
    setReplyingTo(null);
    setReplyText('');
    setConfirmDeleteId(null);
    setFocusedId(null);
    if (pendingRef.current) onCancelPendingComment();
  }, [editor, onCancelPendingComment]);

  // Clicking a highlighted span in the document focuses its comment here.
  const commentsRef = useRef(comments);
  commentsRef.current = comments;
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view.dom as HTMLElement;
    const onClick = (e: MouseEvent) => {
      const span = (e.target as HTMLElement | null)?.closest?.('[data-comment-id]');
      if (!span) return;
      const key = span.getAttribute('data-comment-id');
      const comment = commentsRef.current.find(c => c.rangeId === key || c.id === key);
      if (!comment) return;
      setShowCommentsPanel(true);
      if (comment.resolved) setShowResolved(true);
      setFocusedId(comment.id);
    };
    dom.addEventListener('click', onClick);
    return () => dom.removeEventListener('click', onClick);
  }, [editor, setShowCommentsPanel]);

  useEffect(() => {
    if (!isOpen || !focusedId) return;
    const el = panelRef.current?.querySelector<HTMLElement>(`[data-panel-comment="${CSS.escape(focusedId)}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const timer = window.setTimeout(() => setFocusedId(null), 2000);
    return () => window.clearTimeout(timer);
  }, [focusedId, isOpen]);

  const handleClose = () => {
    if (isPending) onCancelPendingComment();
    onClose();
  };

  const postNew = () => {
    if (!pendingCommentId || !newText.trim()) return;
    onAddComment(newText.trim(), pendingCommentId);
    setNewText('');
  };

  const handleReply = (commentId: string) => {
    if (replyText.trim()) {
      onReplyToComment(commentId, replyText.trim());
      setReplyText('');
      setReplyingTo(null);
    }
  };

  const formatTimestamp = (timestamp: number) => formatRelativeTime(timestamp, uiLanguage, t(uiLanguage, 'rvJustNow'));

  if (!isOpen) return null;

  const isOrphan = (c: Comment) => !!idsInDoc && !idsInDoc.has(c.rangeId || c.id) && c.id !== pendingCommentId;
  const activeComments = comments.filter(c => !c.resolved);
  const resolvedComments = comments.filter(c => c.resolved);

  const inputClass = `w-full px-3 py-2 text-sm rounded-lg border-2 outline-none resize-none ${
    darkMode ? 'bg-[#1a1a1a] border-gray-700 text-gray-200 focus:border-blue-500' : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500'
  }`;

  const deleteControls = (comment: Comment) =>
    confirmDeleteId === comment.id ? (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{t(uiLanguage, 'rvDeleteCommentQ')}</span>
        <button
          onClick={() => {
            setConfirmDeleteId(null);
            onDeleteComment(comment.id);
          }}
          className="px-2 py-0.5 text-xs rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
        >
          {t(uiLanguage, 'delete')}
        </button>
        <button
          onClick={() => setConfirmDeleteId(null)}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
        >
          {t(uiLanguage, 'cancel')}
        </button>
      </div>
    ) : (
      <button
        onClick={e => {
          e.stopPropagation();
          setConfirmDeleteId(comment.id);
        }}
        aria-label={t(uiLanguage, 'rvDeleteComment')}
        title={t(uiLanguage, 'rvDeleteComment')}
        className={`p-1.5 rounded transition-colors ${darkMode ? 'hover:bg-red-600/20 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
      >
        <Trash2 size={14} />
      </button>
    );

  return (
    <div
      ref={panelRef}
      role="complementary"
      aria-labelledby="comments-panel-title"
      onKeyDown={e => {
        if (e.key === 'Escape' && !e.defaultPrevented) {
          e.preventDefault();
          handleClose();
        }
      }}
      className={`fixed right-0 top-0 h-full w-full sm:w-96 shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
        darkMode ? 'bg-[#1a1a1a] border-l border-gray-800' : 'bg-white border-l border-gray-200'
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
          <h2 id="comments-panel-title" className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {t(uiLanguage, 'comments')} ({activeComments.length})
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {/* The panel covers the ribbon, so it offers "new comment" itself (uses the editor's selection). */}
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={handleCreateCommentFromSelection}
            disabled={isPending}
            aria-label={t(uiLanguage, 'newComment')}
            title={t(uiLanguage, 'newComment')}
            className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
          >
            <MessageSquarePlus size={20} />
          </button>
          <button
            onClick={handleClose}
            aria-label={t(uiLanguage, 'rvCloseComments')}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* New comment composer */}
        {isPending && (
          <div className={`rounded-lg p-4 ring-2 ring-blue-500 ${darkMode ? 'bg-[#0f0f0f]' : 'bg-gray-50'}`}>
            <label htmlFor="new-comment-text" className={`block text-xs font-semibold mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {t(uiLanguage, 'rvNewComment')}
            </label>
            <textarea
              id="new-comment-text"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  postNew();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelPendingComment();
                }
              }}
              placeholder={t(uiLanguage, 'rvWriteComment')}
              className={inputClass}
              rows={3}
              autoFocus
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={postNew}
                disabled={!newText.trim()}
                className="px-3 py-1 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t(uiLanguage, 'rvPostComment')}
              </button>
              <button
                onClick={onCancelPendingComment}
                className={`px-3 py-1 text-sm rounded transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
              >
                {t(uiLanguage, 'cancel')}
              </button>
              <span className={`ml-auto text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{t(uiLanguage, 'rvCtrlEnterHint')}</span>
            </div>
          </div>
        )}

        {activeComments.length === 0 && !isPending && (
          <div className={`text-center py-12 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
            <p>{t(uiLanguage, 'rvNoComments')}</p>
            <p className="text-sm mt-2">{t(uiLanguage, 'rvNoCommentsHint')}</p>
          </div>
        )}

        {activeComments.map(comment => {
          const orphan = isOrphan(comment);
          return (
            <div
              key={comment.id}
              data-panel-comment={comment.id}
              role="article"
              aria-label={t(uiLanguage, 'rvCommentBy').replace('{author}', comment.author)}
              tabIndex={0}
              className={`rounded-lg p-4 cursor-pointer transition-all ${darkMode ? 'bg-[#0f0f0f] hover:bg-[#2a2a2a]' : 'bg-gray-50 hover:bg-gray-100'} ${
                focusedId === comment.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => !orphan && onHighlightComment(comment.id)}
              onKeyDown={e => {
                // Only when the card itself has focus — never swallow keys typed in the reply box.
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (!orphan) onHighlightComment(comment.id);
                }
              }}
            >
              {/* Comment Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${darkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                    <User size={16} />
                  </div>
                  <div>
                    <div className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{comment.author}</div>
                    <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{formatTimestamp(comment.timestamp)}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {confirmDeleteId !== comment.id && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onResolveComment(comment.id);
                      }}
                      aria-label={t(uiLanguage, 'rvResolveComment')}
                      title={t(uiLanguage, 'rvResolveComment')}
                      className={`p-1.5 rounded transition-colors ${darkMode ? 'hover:bg-green-600/20 text-green-400' : 'hover:bg-green-50 text-green-600'}`}
                    >
                      <Check size={14} />
                    </button>
                  )}
                  {deleteControls(comment)}
                </div>
              </div>

              {orphan && (
                <div className={`flex items-center gap-1 mb-2 text-xs ${darkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                  <AlertTriangle size={12} />
                  {t(uiLanguage, 'rvOrphanedComment')}
                </div>
              )}

              {/* Comment Text */}
              <p className={`text-sm mb-3 whitespace-pre-wrap break-words ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{comment.text}</p>

              {/* Replies */}
              {comment.replies.length > 0 && (
                <div className={`space-y-2 pl-4 border-l-2 ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
                  {comment.replies.map(reply => (
                    <div key={reply.id} className="py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                          <User size={12} />
                        </div>
                        <span className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{reply.author}</span>
                        <span className={`text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>{formatTimestamp(reply.timestamp)}</span>
                      </div>
                      <p className={`text-sm pl-8 whitespace-pre-wrap break-words ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{reply.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Input */}
              {replyingTo === comment.id ? (
                <div className="mt-3" onClick={e => e.stopPropagation()}>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleReply(comment.id);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setReplyingTo(null);
                        setReplyText('');
                      }
                    }}
                    placeholder={t(uiLanguage, 'rvWriteReply')}
                    aria-label={t(uiLanguage, 'rvWriteReply')}
                    className={inputClass}
                    rows={2}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleReply(comment.id)}
                      className="px-3 py-1 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      {t(uiLanguage, 'rvReply')}
                    </button>
                    <button
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyText('');
                      }}
                      className={`px-3 py-1 text-sm rounded transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                    >
                      {t(uiLanguage, 'cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setReplyingTo(comment.id);
                    setReplyText('');
                  }}
                  className={`flex items-center gap-1 mt-2 px-2 py-1 text-xs rounded transition-colors ${
                    darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <Reply size={12} />
                  {t(uiLanguage, 'rvReply')}
                </button>
              )}
            </div>
          );
        })}

        {/* Resolved Comments Section */}
        {resolvedComments.length > 0 && (
          <div className={`mt-6 pt-4 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
            <button
              onClick={() => setShowResolved(v => !v)}
              aria-expanded={showResolved}
              className={`flex items-center gap-1 text-sm font-semibold mb-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}
            >
              {showResolved ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {t(uiLanguage, 'rvResolved')} ({resolvedComments.length})
            </button>
            {showResolved &&
              resolvedComments.map(comment => (
                <div
                  key={comment.id}
                  data-panel-comment={comment.id}
                  className={`rounded-lg p-3 mb-2 opacity-60 ${darkMode ? 'bg-[#0f0f0f]' : 'bg-gray-50'} ${focusedId === comment.id ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-green-500" />
                      <span className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{comment.author}</span>
                    </div>
                    <div className="flex gap-1">
                      {confirmDeleteId !== comment.id && (
                        <button
                          onClick={() => onReopenComment(comment.id)}
                          aria-label={t(uiLanguage, 'rvReopen')}
                          title={t(uiLanguage, 'rvReopen')}
                          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                            darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                          }`}
                        >
                          <RotateCcw size={12} />
                          {t(uiLanguage, 'rvReopen')}
                        </button>
                      )}
                      {deleteControls(comment)}
                    </div>
                  </div>
                  <p className={`text-sm whitespace-pre-wrap break-words ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{comment.text}</p>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
