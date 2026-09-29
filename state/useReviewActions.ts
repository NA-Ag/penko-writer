import React, { useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/core';
import { DocumentData, Comment, CommentReply } from '../types';
import { generateId } from '../utils/storage';
import { LanguageCode, t } from '../utils/translations';
import { findMarkRanges } from '../editor/extensions/review';

import type { AppToast, DocPatch } from './types';

/** Comments, tracked changes and document mode toggles. */
export interface ReviewDeps {
  editorRef: React.MutableRefObject<Editor | null>;
  currentDocRef: React.MutableRefObject<DocumentData | null>;
  currentUser: string;
  setPendingCommentId: React.Dispatch<React.SetStateAction<string | null>>;
  setShowCommentsPanel: React.Dispatch<React.SetStateAction<boolean>>;
  toastRef: React.MutableRefObject<AppToast>;
  uiLangRef: React.MutableRefObject<LanguageCode>;
  updateCurrentDoc: (patch: DocPatch) => void;
  flushPendingEdits: () => void;
}

export const useReviewActions = (deps: ReviewDeps) => {
  const { editorRef, currentDocRef, currentUser, setPendingCommentId, setShowCommentsPanel, toastRef, uiLangRef, updateCurrentDoc, flushPendingEdits } = deps;


  const handleAddComment = useCallback(
    (text: string, rangeId: string) => {
      const comment: Comment = { id: rangeId, rangeId, author: currentUserRef.current, text, timestamp: Date.now(), resolved: false, replies: [] };
      updateCurrentDoc(d => ({ comments: [...(d.comments || []).filter(c => c.id !== rangeId), comment] }));
      setPendingCommentId(p => (p === rangeId ? null : p));
    },
    [updateCurrentDoc],
  );
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const handleReplyToComment = useCallback(
    (commentId: string, text: string) => {
      const reply: CommentReply = { id: generateId(), author: currentUserRef.current, text, timestamp: Date.now() };
      updateCurrentDoc(d => ({ comments: (d.comments || []).map(c => (c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c)) }));
    },
    [updateCurrentDoc],
  );

  const setCommentResolved = useCallback(
    (commentId: string, resolved: boolean) => updateCurrentDoc(d => ({ comments: (d.comments || []).map(c => (c.id === commentId ? { ...c, resolved } : c)) })),
    [updateCurrentDoc],
  );
  const handleResolveComment = useCallback((id: string) => setCommentResolved(id, true), [setCommentResolved]);
  const handleReopenComment = useCallback((id: string) => setCommentResolved(id, false), [setCommentResolved]);

  const removeCommentMark = (commentKey: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const type = ed.schema.marks.comment;
    const ranges = findMarkRanges(ed.state.doc, 'comment', 'commentId', commentKey);
    if (!ranges.length) return;
    const tr = ed.state.tr;
    ranges.forEach(r => tr.removeMark(r.from, r.to, type));
    tr.setMeta('preventTrack', true);
    ed.view.dispatch(tr);
  };

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      const comment = currentDocRef.current?.comments?.find(c => c.id === commentId);
      removeCommentMark(comment?.rangeId || commentId);
      updateCurrentDoc(d => ({ comments: (d.comments || []).filter(c => c.id !== commentId) }));
    },
    [updateCurrentDoc],
  );

  const handleHighlightComment = useCallback((commentId: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const comment = currentDocRef.current?.comments?.find(c => c.id === commentId);
    const key = comment?.rangeId || commentId;
    const el = ed.view.dom.querySelector(`[data-comment-id="${CSS.escape(key)}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ed.view.dom.querySelectorAll(`[data-comment-id="${CSS.escape(key)}"]`).forEach(node => {
        node.classList.add('comment-flash');
        setTimeout(() => node.classList.remove('comment-flash'), 1000);
      });
    }
    const range = findMarkRanges(ed.state.doc, 'comment', 'commentId', key)[0];
    if (range) ed.commands.setTextSelection(range);
  }, []);

  const handleCreateCommentFromSelection = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const { from, to, empty } = ed.state.selection;
    if (empty) {
      toastRef.current.info(t(uiLangRef.current, 'selectTextToComment'));
      return;
    }
    const id = generateId();
    const tr = ed.state.tr.addMark(from, to, ed.schema.marks.comment.create({ commentId: id }));
    tr.setMeta('preventTrack', true);
    ed.view.dispatch(tr);
    setPendingCommentId(id);
    setShowCommentsPanel(true);
  }, []);

  const handleCancelPendingComment = useCallback(() => {
    setPendingCommentId(id => {
      if (id && !currentDocRef.current?.comments?.some(c => c.id === id)) removeCommentMark(id);
      return null;
    });
  }, []);

  const handleToggleTracking = useCallback(() => updateCurrentDoc(d => ({ trackingEnabled: !d.trackingEnabled })), [updateCurrentDoc]);
  const handleToggleScreenplay = useCallback(() => updateCurrentDoc(d => ({ isScreenplay: !d.isScreenplay })), [updateCurrentDoc]);
  const handleToggleMarkdown = useCallback(() => {
    flushPendingEdits();
    updateCurrentDoc(d => ({ isMarkdownMode: !d.isMarkdownMode }));
  }, [flushPendingEdits, updateCurrentDoc]);

  const handleAcceptChange = useCallback((id: string) => void editorRef.current?.commands.acceptChange(id), []);
  const handleRejectChange = useCallback((id: string) => void editorRef.current?.commands.rejectChange(id), []);
  const handleAcceptAllChanges = useCallback(() => void editorRef.current?.commands.acceptAllChanges(), []);
  const handleRejectAllChanges = useCallback(() => void editorRef.current?.commands.rejectAllChanges(), []);
  const handleHighlightChange = useCallback((changeId: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const el = ed.view.dom.querySelector(`[data-change-id="${CSS.escape(changeId)}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    let range = findMarkRanges(ed.state.doc, 'insertion', 'changeId', changeId)[0] || findMarkRanges(ed.state.doc, 'deletion', 'changeId', changeId)[0];
    if (range) ed.commands.setTextSelection(range);
  }, []);

  return {
    handleAddComment,
    handleReplyToComment,
    handleResolveComment,
    handleReopenComment,
    handleDeleteComment,
    handleHighlightComment,
    handleCreateCommentFromSelection,
    handleCancelPendingComment,
    handleToggleTracking,
    handleToggleScreenplay,
    handleToggleMarkdown,
    handleAcceptChange,
    handleRejectChange,
    handleAcceptAllChanges,
    handleRejectAllChanges,
    handleHighlightChange,
  };
};
