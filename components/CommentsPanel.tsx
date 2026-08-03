import React, { useState } from 'react';
import { X, MessageSquare, Check, Reply, Trash2, User } from 'lucide-react';
import { Comment, CommentReply } from '../types';

interface CommentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  comments: Comment[];
  currentUser: string;
  onAddComment: (text: string, rangeId: string) => void;
  onReplyToComment: (commentId: string, text: string) => void;
  onResolveComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onHighlightComment: (commentId: string) => void;
}

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  isOpen,
  onClose,
  darkMode,
  comments,
  currentUser,
  onAddComment,
  onReplyToComment,
  onResolveComment,
  onDeleteComment,
  onHighlightComment
}) => {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const handleReply = (commentId: string) => {
    if (replyText.trim()) {
      onReplyToComment(commentId, replyText);
      setReplyText('');
      setReplyingTo(null);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  const activeComments = comments.filter(c => !c.resolved);
  const resolvedComments = comments.filter(c => c.resolved);

  return (
    <div
      role="region"
      aria-label="Comments panel"
      className={`fixed right-0 top-0 h-full w-96 shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
        darkMode ? 'bg-[#1a1a1a] border-l border-gray-800' : 'bg-white border-l border-gray-200'
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
          <h2 id="comments-panel-title" className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Comments ({activeComments.length})
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close comments panel"
          className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
        >
          <X size={20} />
        </button>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeComments.length === 0 && (
          <div className={`text-center py-12 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
            <p>No comments yet</p>
            <p className="text-sm mt-2">Select text and click "Add Comment" to start</p>
          </div>
        )}

        {activeComments.map(comment => (
          <div
            key={comment.id}
            role="article"
            aria-label={`Comment by ${comment.author}`}
            tabIndex={0}
            className={`rounded-lg p-4 cursor-pointer transition-all ${
              darkMode ? 'bg-[#0f0f0f] hover:bg-[#2a2a2a]' : 'bg-gray-50 hover:bg-gray-100'
            }`}
            onClick={() => onHighlightComment(comment.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onHighlightComment(comment.id);
              }
            }}
          >
            {/* Comment Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  darkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                }`}>
                  <User size={16} />
                </div>
                <div>
                  <div className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {comment.author}
                  </div>
                  <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {formatTimestamp(comment.timestamp)}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onResolveComment(comment.id); }}
                  aria-label="Resolve comment"
                  className={`p-1.5 rounded transition-colors ${
                    darkMode ? 'hover:bg-green-600/20 text-green-400' : 'hover:bg-green-50 text-green-600'
                  }`}
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteComment(comment.id); }}
                  aria-label="Delete comment"
                  className={`p-1.5 rounded transition-colors ${
                    darkMode ? 'hover:bg-red-600/20 text-red-400' : 'hover:bg-red-50 text-red-600'
                  }`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Comment Text */}
            <p className={`text-sm mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {comment.text}
            </p>

            {/* Replies */}
            {comment.replies.length > 0 && (
              <div className={`space-y-2 pl-4 border-l-2 ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
                {comment.replies.map(reply => (
                  <div key={reply.id} className="py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                        darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
                      }`}>
                        <User size={12} />
                      </div>
                      <span className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {reply.author}
                      </span>
                      <span className={`text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                        {formatTimestamp(reply.timestamp)}
                      </span>
                    </div>
                    <p className={`text-sm pl-8 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {reply.text}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Reply Input */}
            {replyingTo === comment.id ? (
              <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className={`w-full px-3 py-2 text-sm rounded-lg border-2 outline-none resize-none ${
                    darkMode
                      ? 'bg-[#1a1a1a] border-gray-700 text-gray-200 focus:border-blue-500'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500'
                  }`}
                  rows={2}
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleReply(comment.id)}
                    className="px-3 py-1 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => { setReplyingTo(null); setReplyText(''); }}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setReplyingTo(comment.id); }}
                className={`flex items-center gap-1 mt-2 px-2 py-1 text-xs rounded transition-colors ${
                  darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <Reply size={12} />
                Reply
              </button>
            )}
          </div>
        ))}

        {/* Resolved Comments Section */}
        {resolvedComments.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h3 className={`text-sm font-semibold mb-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Resolved ({resolvedComments.length})
            </h3>
            {resolvedComments.map(comment => (
              <div
                key={comment.id}
                className={`rounded-lg p-3 mb-2 opacity-60 ${
                  darkMode ? 'bg-[#0f0f0f]' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Check size={14} className="text-green-500" />
                  <span className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {comment.author}
                  </span>
                </div>
                <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  {comment.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
