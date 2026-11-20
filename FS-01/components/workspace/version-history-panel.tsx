"use client";

import * as React from "react";
import {
  History,
  RotateCcw,
  Eye,
  Plus,
  Clock,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Bookmark,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface VersionCreator {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface VersionItem {
  id: string;
  pageId: string;
  title: string;
  content: string;
  description?: string;
  createdById: string;
  createdAt: string | Date;
  creator: VersionCreator;
}

interface VersionHistoryPanelProps {
  workspaceId: string;
  pageId: string;
  canEdit: boolean;
  isOpen: boolean;
  previewingVersionId: string | null;
  onClose: () => void;
  onPreviewVersion: (version: VersionItem | null) => void;
  onRestoreVersion: (version: VersionItem) => Promise<void>;
  isRestoring: boolean;
  onVersionCountChange?: (count: number) => void;
}

export function VersionHistoryPanel({
  workspaceId,
  pageId,
  canEdit,
  isOpen,
  previewingVersionId,
  onClose,
  onPreviewVersion,
  onRestoreVersion,
  isRestoring,
  onVersionCountChange,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = React.useState<VersionItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = React.useState(false);
  const [checkpointNote, setCheckpointNote] = React.useState("");
  const [showNoteInput, setShowNoteInput] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const fetchVersions = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/pages/${pageId}/versions`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load version history.");
      }
      const data = await res.json();
      const list: VersionItem[] = data.versions || [];
      setVersions(list);
      onVersionCountChange?.(list.length);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading versions.");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, pageId, onVersionCountChange]);

  React.useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    Promise.resolve().then(async () => {
      if (isCancelled) return;
      await fetchVersions();
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, fetchVersions]);

  const handleCreateCheckpoint = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canEdit) return;

    setIsCreatingSnapshot(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/pages/${pageId}/versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: checkpointNote.trim() || undefined,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create version checkpoint.");
      }

      setCheckpointNote("");
      setShowNoteInput(false);
      setSuccessMsg("Snapshot saved successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);

      // Re-fetch to list in ordered history
      await fetchVersions();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create checkpoint."
      );
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleRestoreClick = async (version: VersionItem) => {
    const formatted = new Date(version.createdAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const label = version.description ? `"${version.description}"` : formatted;
    if (
      !confirm(
        `Restore document to version from ${label}?\n\nThis will apply the selected version and preserve full historical records.`
      )
    ) {
      return;
    }

    try {
      await onRestoreVersion(version);
      setSuccessMsg(`Document restored to version from ${formatted}.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchVersions();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to restore version."
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="version-history-panel"
      className="w-full lg:w-96 rounded-2xl bg-white dark:bg-white border border-slate-200/90 dark:border-slate-200 shadow-xl flex flex-col h-[700px] max-h-[85vh] overflow-hidden transition-all duration-200"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-200 flex items-center justify-between bg-slate-50/70 dark:bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-2xs">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-900 tracking-tight flex items-center gap-2">
              <span>Version History</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                {versions.length}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Checkpoints & restores</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          id="close-versions-btn"
          aria-label="Close version history"
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors focus-ring"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Notifications */}
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

      {successMsg && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Action Bar: Create deliberate checkpoint */}
      {canEdit && (
        <div className="p-3 border-b border-slate-100 dark:border-slate-200 bg-white dark:bg-white">
          {!showNoteInput ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNoteInput(true)}
              id="new-checkpoint-btn"
              className="w-full justify-center gap-1.5 border-dashed border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save Version Checkpoint</span>
            </Button>
          ) : (
            <form onSubmit={handleCreateCheckpoint} className="space-y-2">
              <input
                type="text"
                placeholder="Checkpoint name or note (e.g. Before refactor)"
                value={checkpointNote}
                onChange={(e) => setCheckpointNote(e.target.value)}
                maxLength={80}
                autoFocus
                className="w-full text-xs text-slate-800 dark:text-slate-900 placeholder:text-slate-400 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-50 border border-slate-200 dark:border-slate-200 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex items-center justify-end gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNoteInput(false)}
                  disabled={isCreatingSnapshot}
                  className="py-1 px-2.5 text-xs text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isCreatingSnapshot}
                  className="py-1 px-3 text-xs"
                >
                  Save Snapshot
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Version List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
            <span className="text-xs font-medium">Loading versions...</span>
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-2.5">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">
              No version history yet
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
              {canEdit
                ? "Click 'Save Version Checkpoint' above to record a deliberate snapshot of this document."
                : "No version snapshots have been saved for this document yet."}
            </p>
          </div>
        ) : (
          versions.map((version, index) => {
            const isLatest = index === 0;
            const isPreviewing = previewingVersionId === version.id;

            const initials = version.creator.name
              ? version.creator.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "U";

            const formattedTime = new Date(version.createdAt).toLocaleString(
              "en-US",
              {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }
            );

            return (
              <div
                key={version.id}
                id={`version-card-${version.id}`}
                className={`p-3.5 rounded-2xl border transition-all duration-150 space-y-2.5 ${
                  isPreviewing
                    ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-300 dark:ring-indigo-700 shadow-xs"
                    : "bg-slate-50/70 dark:bg-slate-50/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-200 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs"
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-sky-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-900 truncate">
                        {version.creator.name}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{formattedTime}</span>
                      </span>
                    </div>
                  </div>

                  {isLatest && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      Current
                    </span>
                  )}
                </div>

                {/* Description or Snapshot Note */}
                {version.description && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-700 dark:text-slate-300 pl-8">
                    <Bookmark className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                    <span className="italic">{version.description}</span>
                  </div>
                )}

                {/* Actions: Preview & Restore */}
                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-200/50 dark:border-slate-200/50">
                  <button
                    type="button"
                    onClick={() =>
                      onPreviewVersion(isPreviewing ? null : version)
                    }
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                      isPreviewing
                        ? "bg-indigo-600 text-white"
                        : "text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isPreviewing ? "Exit Preview" : "Preview"}</span>
                  </button>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleRestoreClick(version)}
                      disabled={isRestoring}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
