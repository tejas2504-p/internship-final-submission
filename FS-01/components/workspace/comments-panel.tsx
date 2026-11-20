"use client";

import * as React from "react";
import {
  MessageSquare,
  Send,
  Trash2,
  X,
  AlertCircle,
  Clock,
  Loader2,
  MessageCircleOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CommentAuthor {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface CommentItem {
  id: string;
  content: string;
  pageId: string;
  authorId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  author: CommentAuthor;
  canDelete: boolean;
}

interface CommentsPanelProps {
  workspaceId: string;
  pageId: string;
  canComment: boolean;
  isOpen: boolean;
  onClose: () => void;
  onCommentCountChange?: (count: number) => void;
}

export function CommentsPanel({
  workspaceId,
  pageId,
  canComment,
  isOpen,
  onClose,
  onCommentCountChange,
}: CommentsPanelProps) {
  const [comments, setComments] = React.useState<CommentItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [newComment, setNewComment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const commentsEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Fetch comments safely in microtask
  const fetchComments = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/pages/${pageId}/comments`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load comments.");
      }
      const data = await res.json();
      const loadedComments: CommentItem[] = data.comments || [];
      setComments(loadedComments);
      onCommentCountChange?.(loadedComments.length);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading comments.");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, pageId, onCommentCountChange]);

  React.useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    Promise.resolve().then(async () => {
      if (isCancelled) return;
      await fetchComments();
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, fetchComments]);

  // Scroll to bottom when comments list changes
  React.useEffect(() => {
    if (comments.length > 0) {
      commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments.length]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canComment) return;

    const trimmed = newComment.trim();
    if (!trimmed) {
      setError("Comment cannot be empty.");
      return;
    }
    if (trimmed.length > 2000) {
      setError("Comment cannot exceed 2000 characters.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/pages/${pageId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to post comment.");
      }

      setNewComment("");
      setComments((prev) => {
        const updated = [...prev, data.comment];
        onCommentCountChange?.(updated.length);
        return updated;
      });
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to post comment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    setDeletingId(commentId);
    setError(null);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/pages/${pageId}/comments/${commentId}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete comment.");
      }

      setComments((prev) => {
        const updated = prev.filter((c) => c.id !== commentId);
        onCommentCountChange?.(updated.length);
        return updated;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete comment.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="comments-panel"
      className="w-full lg:w-96 rounded-2xl bg-white dark:bg-white border border-slate-200/90 dark:border-slate-200 shadow-xl flex flex-col h-[700px] max-h-[85vh] overflow-hidden transition-all duration-200"
    >
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-200 flex items-center justify-between bg-slate-50/70 dark:bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-2xs">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-900 tracking-tight flex items-center gap-2">
              <span>Comments</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                {comments.length}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Document discussions</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          id="close-comments-btn"
          aria-label="Close comments panel"
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors focus-ring"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-xs font-medium">Loading conversation...</span>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-2.5">
              <MessageCircleOff className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">No comments yet</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
              {canComment
                ? "Start the conversation by sharing thoughts or feedback on this page."
                : "No discussion has been started on this document yet."}
            </p>
          </div>
        ) : (
          comments.map((comment) => {
            const authorInitials = comment.author.name
              ? comment.author.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "U";

            const formattedTime = new Date(comment.createdAt).toLocaleString(
              "en-US",
              {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }
            );

            return (
              <div
                key={comment.id}
                id={`comment-${comment.id}`}
                className="group p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-50/80 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-200/80 hover:border-slate-200/80 dark:hover:border-slate-700 transition-all duration-150 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-2xs">
                      {authorInitials}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-900 truncate">
                        {comment.author.name}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{formattedTime}</span>
                      </span>
                    </div>
                  </div>

                  {comment.canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      disabled={deletingId === comment.id}
                      title="Delete comment"
                      aria-label="Delete comment"
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                    >
                      {deletingId === comment.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words pl-8">
                  {comment.content}
                </p>
              </div>
            );
          })
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Input Box Footer */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-200 bg-white dark:bg-white">
        {canComment ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a comment... (Ctrl+Enter to post)"
                rows={3}
                maxLength={2000}
                disabled={isSubmitting}
                id="comment-input"
                className="w-full text-xs text-slate-800 dark:text-slate-900 placeholder:text-slate-400 p-3 rounded-xl bg-slate-50 dark:bg-slate-50 border border-slate-200 dark:border-slate-200 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>
                {newComment.length} / 2000
              </span>

              <Button
                type="submit"
                size="sm"
                variant="primary"
                id="post-comment-btn"
                isLoading={isSubmitting}
                disabled={!newComment.trim()}
                className="gap-1.5 py-1 px-3"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post</span>
              </Button>
            </div>
          </form>
        ) : (
          <div className="py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-50 text-slate-500 dark:text-slate-400 text-xs text-center border border-slate-100 dark:border-slate-200">
            <span>Read-only viewers cannot post comments.</span>
          </div>
        )}
      </div>
    </div>
  );
}
