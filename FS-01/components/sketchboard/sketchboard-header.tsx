"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Grid,
  Palette,
  Download,
  HelpCircle,
  Check,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldAlert,
  ChevronDown,
  Plus,
  Maximize2,
  RotateCcw,
} from "lucide-react";
import {
  GridMode,
  CanvasBgTheme,
  SketchboardSaveStatus,
  CollabConnectionStatus,
  SketchboardCollaborator,
  SketchboardSummary,
} from "@/types/sketchboard";

interface SketchboardHeaderProps {
  workspaceId: string;
  workspaceName?: string;
  boardId?: string;
  boardName: string;
  onUpdateBoardName: (name: string) => void;
  saveStatus: SketchboardSaveStatus;
  collabStatus?: CollabConnectionStatus;
  collaborators?: SketchboardCollaborator[];
  canEdit?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  gridMode: GridMode;
  onToggleGridMode: (mode: GridMode) => void;
  canvasBg: CanvasBgTheme;
  onChangeCanvasBg: (bg: CanvasBgTheme) => void;
  onFitToScreen?: () => void;
  onResetZoom?: () => void;
  onOpenExportModal: () => void;
  onOpenShortcutsModal: () => void;
  authorName?: string;
}

export function SketchboardHeader({
  workspaceId,
  workspaceName = "Workspace",
  boardId,
  boardName,
  onUpdateBoardName,
  saveStatus,
  collabStatus = "connected",
  collaborators = [],
  canEdit = true,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  gridMode,
  onToggleGridMode,
  canvasBg,
  onChangeCanvasBg,
  onFitToScreen,
  onResetZoom,
  onOpenExportModal,
  onOpenShortcutsModal,
  authorName = "You",
}: SketchboardHeaderProps) {
  const router = useRouter();
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(boardName);
  const [prevBoardName, setPrevBoardName] = useState(boardName);
  const [gridMenuOpen, setGridMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [boardsMenuOpen, setBoardsMenuOpen] = useState(false);
  const [workspaceBoards, setWorkspaceBoards] = useState<SketchboardSummary[]>([]);
  const [isLoadingBoards, setIsLoadingBoards] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);

  if (prevBoardName !== boardName) {
    setPrevBoardName(boardName);
    setLocalName(boardName);
  }

  const loadWorkspaceBoards = async () => {
    try {
      setIsLoadingBoards(true);
      const res = await fetch(`/api/workspaces/${workspaceId}/sketchboards`);
      if (res.ok) {
        const data = await res.json();
        setWorkspaceBoards(data.boards || []);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingBoards(false);
    }
  };

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newBoardTitle.trim() || "Untitled Sketchboard";
    try {
      setIsCreatingBoard(true);
      const res = await fetch(`/api/workspaces/${workspaceId}/sketchboards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: title }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewBoardTitle("");
        setBoardsMenuOpen(false);
        router.push(`/workspaces/${workspaceId}/sketchboard/${data.sketchboard.id}`);
      }
    } catch {
      // Ignored
    } finally {
      setIsCreatingBoard(false);
    }
  };

  const handleSaveName = () => {
    const trimmed = localName.trim();
    if (trimmed) {
      onUpdateBoardName(trimmed);
    } else {
      setLocalName(boardName);
    }
    setIsEditingName(false);
  };

  return (
    <header className="absolute top-3 left-4 right-4 z-30 flex items-center justify-between gap-3 pointer-events-none">
      {/* Left Block: Back, Board Title, Save status */}
      <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg px-3 py-2 pointer-events-auto">
        <Link
          href={`/workspaces/${workspaceId}`}
          title={`Return to ${workspaceName}`}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="h-4 w-px bg-slate-200" />

        {/* Board Title */}
        {isEditingName ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") {
                  setLocalName(boardName);
                  setIsEditingName(false);
                }
              }}
              autoFocus
              className="text-sm font-semibold text-slate-900 px-2 py-0.5 border border-sky-400 rounded-lg outline-none bg-sky-50/50 max-w-[200px]"
            />
            <button
              type="button"
              onClick={handleSaveName}
              className="p-1 text-sky-600 hover:text-sky-700"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <div
              onClick={() => setIsEditingName(true)}
              title="Click to rename board"
              className="flex items-center gap-2 cursor-pointer group"
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900 group-hover:text-sky-600 transition-colors truncate max-w-[180px] sm:max-w-[240px]">
                  {boardName}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {workspaceName} • Sketchboard
                </span>
              </div>
            </div>

            {/* Board Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!boardsMenuOpen) loadWorkspaceBoards();
                  setBoardsMenuOpen(!boardsMenuOpen);
                }}
                title="Switch or create whiteboard"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {boardsMenuOpen && (
                <div
                  className="absolute left-0 top-10 bg-white border border-slate-200/90 rounded-2xl shadow-2xl p-2.5 flex flex-col gap-1.5 w-64 animate-in fade-in zoom-in-95 z-50 pointer-events-auto"
                  onMouseLeave={() => setBoardsMenuOpen(false)}
                >
                  <div className="text-[10px] font-semibold text-slate-400 px-2 uppercase tracking-wider flex items-center justify-between">
                    <span>Workspace Whiteboards</span>
                    {isLoadingBoards && <span className="text-[9px] animate-pulse">Loading...</span>}
                  </div>

                  <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
                    {workspaceBoards.length === 0 && !isLoadingBoards && (
                      <div className="text-[11px] text-slate-400 px-2 py-1">No other boards</div>
                    )}
                    {workspaceBoards.map((b) => (
                      <Link
                        key={b.id}
                        href={`/workspaces/${workspaceId}/sketchboard/${b.id}`}
                        onClick={() => setBoardsMenuOpen(false)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors ${
                          boardId === b.id || (!boardId && b.name === boardName)
                            ? "bg-sky-50 text-sky-700 font-semibold"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span className="truncate max-w-[150px]">{b.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {b.elementsCount} obj
                        </span>
                      </Link>
                    ))}
                  </div>

                  {canEdit && (
                    <form onSubmit={handleCreateBoard} className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newBoardTitle}
                        onChange={(e) => setNewBoardTitle(e.target.value)}
                        placeholder="New board name..."
                        className="flex-1 text-xs px-2 py-1 rounded-lg border border-slate-200 outline-none focus:border-sky-500 bg-slate-50"
                      />
                      <button
                        type="submit"
                        disabled={isCreatingBoard}
                        className="p-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        {/* Save Status Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium">
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Saved</span>
            </span>
          )}
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-sky-600 animate-pulse">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>Saving...</span>
            </span>
          )}
          {saveStatus === "unsaved" && (
            <span className="flex items-center gap-1 text-amber-600">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Unsaved changes</span>
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1 text-rose-600" title="Retrying auto-save...">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Save Failed</span>
            </span>
          )}
          {saveStatus === "conflict" && (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Sync Conflict</span>
            </span>
          )}
          {!canEdit && (
            <span className="ml-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-slate-500" />
              <span>View Only</span>
            </span>
          )}
        </div>
      </div>

      {/* Middle Block: Undo, Redo, Grid, Canvas Theme */}
      <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg p-1.5 pointer-events-auto">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-0.5" />

        {/* Grid Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setGridMenuOpen(!gridMenuOpen)}
            title="Grid Options"
            className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${
              gridMode !== "none"
                ? "text-sky-600 bg-sky-50"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>

          {gridMenuOpen && (
            <div
              className="absolute left-1/2 -translate-x-1/2 top-10 bg-white border border-slate-200/90 rounded-xl shadow-xl p-1.5 flex flex-col gap-1 w-28 animate-in fade-in zoom-in-95"
              onMouseLeave={() => setGridMenuOpen(false)}
            >
              <div className="text-[10px] font-semibold text-slate-400 px-1 uppercase tracking-wider">
                Grid Style
              </div>
              <button
                type="button"
                onClick={() => {
                  onToggleGridMode("dots");
                  setGridMenuOpen(false);
                }}
                className={`text-left px-2 py-1 text-xs rounded-lg transition-colors ${
                  gridMode === "dots" ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Dots Pattern
              </button>
              <button
                type="button"
                onClick={() => {
                  onToggleGridMode("grid");
                  setGridMenuOpen(false);
                }}
                className={`text-left px-2 py-1 text-xs rounded-lg transition-colors ${
                  gridMode === "grid" ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Grid Lines
              </button>
              <button
                type="button"
                onClick={() => {
                  onToggleGridMode("none");
                  setGridMenuOpen(false);
                }}
                className={`text-left px-2 py-1 text-xs rounded-lg transition-colors ${
                  gridMode === "none" ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                No Grid
              </button>
            </div>
          )}
        </div>

        {/* Canvas Theme Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setThemeMenuOpen(!themeMenuOpen)}
            title="Canvas Background"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <Palette className="w-4 h-4" />
          </button>

          {themeMenuOpen && (
            <div
              className="absolute left-1/2 -translate-x-1/2 top-10 bg-white border border-slate-200/90 rounded-xl shadow-xl p-1.5 flex flex-col gap-1 w-32 animate-in fade-in zoom-in-95"
              onMouseLeave={() => setThemeMenuOpen(false)}
            >
              <div className="text-[10px] font-semibold text-slate-400 px-1 uppercase tracking-wider">
                Background
              </div>
              <button
                type="button"
                onClick={() => {
                  onChangeCanvasBg("white");
                  setThemeMenuOpen(false);
                }}
                className={`flex items-center gap-2 px-2 py-1 text-xs rounded-lg transition-colors ${
                  canvasBg === "white" ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="w-3 h-3 rounded-full border border-slate-300 bg-white" />
                <span>Pure White</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeCanvasBg("cream");
                  setThemeMenuOpen(false);
                }}
                className={`flex items-center gap-2 px-2 py-1 text-xs rounded-lg transition-colors ${
                  canvasBg === "cream" ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="w-3 h-3 rounded-full border border-amber-200 bg-[#fafaf9]" />
                <span>Cream</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeCanvasBg("slate");
                  setThemeMenuOpen(false);
                }}
                className={`flex items-center gap-2 px-2 py-1 text-xs rounded-lg transition-colors ${
                  canvasBg === "slate" ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="w-3 h-3 rounded-full border border-slate-300 bg-[#f8fafc]" />
                <span>Slate Soft</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeCanvasBg("dark");
                  setThemeMenuOpen(false);
                }}
                className={`flex items-center gap-2 px-2 py-1 text-xs rounded-lg transition-colors ${
                  canvasBg === "dark" ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="w-3 h-3 rounded-full border border-slate-700 bg-[#0f172a]" />
                <span>Midnight</span>
              </button>
            </div>
          )}
        </div>

        {/* Fit to Content and Reset Zoom */}
        {(onResetZoom || onFitToScreen) && (
          <>
            <div className="h-4 w-px bg-slate-200 mx-0.5" />
            {onResetZoom && (
              <button
                type="button"
                onClick={onResetZoom}
                title="Reset Zoom to 100% (Ctrl+0)"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            {onFitToScreen && (
              <button
                type="button"
                onClick={onFitToScreen}
                title="Fit to Screen (Shift+1)"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Right Block: Collaborators Presence, Export, Shortcuts */}
      <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg px-2.5 py-1.5 pointer-events-auto">
        {/* Connection status indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200/60 text-[10px] font-medium mr-1">
          {collabStatus === "connected" && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-700 font-semibold">Live</span>
            </>
          )}
          {collabStatus === "connecting" && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-spin" />
              <span className="text-sky-700">Connecting...</span>
            </>
          )}
          {collabStatus === "reconnecting" && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              <span className="text-amber-700">Reconnecting</span>
            </>
          )}
          {collabStatus === "disconnected" && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span className="text-slate-500">Offline</span>
            </>
          )}
        </div>

        {/* Collaborators presence avatars */}
        <div className="flex items-center -space-x-1.5 mr-1" title={`${collaborators.length + 1} online in board`}>
          {/* Local User Avatar */}
          <div
            className="w-7 h-7 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-semibold ring-2 ring-white shadow-xs"
            title={`${authorName} (You)`}
          >
            {authorName.charAt(0).toUpperCase()}
          </div>

          {/* Remote Collaborators */}
          {collaborators.slice(0, 3).map((peer) => (
            <div
              key={peer.clientId}
              style={{ backgroundColor: peer.color || "#10b981" }}
              className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-semibold ring-2 ring-white shadow-xs animate-in fade-in zoom-in-75"
              title={`${peer.userName} (${peer.role})`}
            >
              {peer.userName.charAt(0).toUpperCase()}
            </div>
          ))}

          {collaborators.length > 3 && (
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold ring-2 ring-white shadow-xs">
              +{collaborators.length - 3}
            </div>
          )}
        </div>

        {/* Shortcuts button */}
        <button
          type="button"
          onClick={onOpenShortcutsModal}
          title="Keyboard shortcuts (?)"
          className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Export / Share Button */}
        <button
          type="button"
          onClick={onOpenExportModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold shadow-sm shadow-sky-500/20 transition-all hover:scale-[1.02]"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
}

