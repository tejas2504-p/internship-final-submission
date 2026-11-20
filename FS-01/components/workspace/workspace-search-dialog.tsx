"use client";

import * as React from "react";
import Link from "next/link";
import { Search, FileText, Layout, X, Loader2, ArrowRight, Clock } from "lucide-react";
import { WorkspaceSearchResults } from "@/types/workspace";

interface WorkspaceSearchDialogProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function WorkspaceSearchDialog({
  workspaceId,
  isOpen,
  onClose,
}: WorkspaceSearchDialogProps) {
  const [query, setQuery] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [results, setResults] = React.useState<WorkspaceSearchResults | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClose = React.useCallback(() => {
    setQuery("");
    setResults(null);
    onClose();
  }, [onClose]);

  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Debounced search
  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      const timer = setTimeout(() => {
        setResults(null);
        setIsLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(trimmed)}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.results);
        }
      } catch (err: unknown) {
        console.error("Search failed:", err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, workspaceId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 sm:px-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-white rounded-2xl shadow-2xl dark:shadow-black/60 border border-slate-200 dark:border-slate-200 overflow-hidden z-10 flex flex-col max-h-[75vh] animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-200 bg-slate-50/50 dark:bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, notes, canvas objects..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-900 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
          />
          {isLoading && <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />}
          {query && !isLoading && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-50 border border-slate-200 dark:border-slate-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!query.trim() && (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
              Type to search across document titles, text bodies, and spatial canvas notes.
            </div>
          )}

          {query.trim() && !isLoading && results && results.total === 0 && (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
              No results found for &ldquo;<span className="font-semibold">{query}</span>&rdquo;.
            </div>
          )}

          {results && results.total > 0 && (
            <div className="space-y-4">
              {/* Pages */}
              {results.pages.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
                    Pages ({results.pages.length})
                  </div>
                  <div className="space-y-1">
                    {results.pages.map((item) => (
                      <Link
                        key={item.id}
                        href={item.url}
                        onClick={handleClose}
                        className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 transition-colors border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50"
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-900 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate flex items-center justify-between">
                            <span>{item.title}</span>
                            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 dark:text-indigo-400 shrink-0" />
                          </div>
                          {item.snippet && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                              {item.snippet}
                            </p>
                          )}
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              Updated {new Date(item.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Canvases */}
              {results.canvases.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
                    Spatial Canvases ({results.canvases.length})
                  </div>
                  <div className="space-y-1">
                    {results.canvases.map((item) => (
                      <Link
                        key={item.id}
                        href={item.url}
                        onClick={handleClose}
                        className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-sky-50/60 dark:hover:bg-sky-950/40 transition-colors border border-transparent hover:border-sky-100 dark:hover:border-sky-900/50"
                      >
                        <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Layout className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-900 group-hover:text-sky-600 dark:group-hover:text-sky-400 truncate flex items-center justify-between">
                            <span>{item.title}</span>
                            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-sky-600 dark:text-sky-400 shrink-0" />
                          </div>
                          {item.snippet && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                              {item.snippet}
                            </p>
                          )}
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              Updated {new Date(item.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-50 border-t border-slate-200 dark:border-slate-200 text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
          <span>Navigate with Tab, Enter to select</span>
          <span>SyncSpace Quick Search</span>
        </div>
      </div>
    </div>
  );
}

