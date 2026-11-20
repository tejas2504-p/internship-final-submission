"use client";

import * as React from "react";
import {
  MousePointer2,
  Hand,
  StickyNote,
  Type,
  Square,
  Circle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo2,
  Redo2,
  Lock,
} from "lucide-react";
import { CanvasTool } from "@/types/canvas";
import { formatZoomPercentage } from "@/lib/canvas/utils";

interface CanvasToolbarProps {
  activeTool: CanvasTool;
  onSelectTool: (tool: CanvasTool) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToView: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canEdit: boolean;
}

export function CanvasToolbar({
  activeTool,
  onSelectTool,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToView,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  canEdit,
}: CanvasToolbarProps) {
  const tools: Array<{
    id: CanvasTool;
    label: string;
    shortcut: string;
    icon: React.ComponentType<{ className?: string }>;
    requiresEdit: boolean;
  }> = [
    { id: "select", label: "Select (V)", shortcut: "V", icon: MousePointer2, requiresEdit: false },
    { id: "hand", label: "Pan (H)", shortcut: "H", icon: Hand, requiresEdit: false },
    { id: "sticky", label: "Sticky Note (S)", shortcut: "S", icon: StickyNote, requiresEdit: true },
    { id: "text", label: "Text Block (T)", shortcut: "T", icon: Type, requiresEdit: true },
    { id: "rectangle", label: "Rectangle (R)", shortcut: "R", icon: Square, requiresEdit: true },
    { id: "circle", label: "Circle (O)", shortcut: "O", icon: Circle, requiresEdit: true },
  ];

  return (
    <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/95 dark:bg-white/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-200 shadow-lg shadow-slate-900/5 dark:shadow-black/40 select-none transition-all">
      {/* Creation and Selection Tools */}
      <div className="flex items-center gap-1">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          const isDisabled = tool.requiresEdit && !canEdit;

          return (
            <button
              key={tool.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectTool(tool.id)}
              className={`relative flex items-center justify-center w-9 h-9 rounded-xl text-xs font-medium transition-all focus-ring ${
                isActive
                  ? "bg-indigo-600 text-white shadow-xs shadow-indigo-600/30 scale-100"
                  : isDisabled
                  ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 active:scale-95"
              }`}
              title={
                isDisabled
                  ? `${tool.label} (Read-only mode)`
                  : tool.label
              }
            >
              <Icon className="w-4 h-4" />
              {isActive && (
                <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-indigo-600" />
              )}
            </button>
          );
        })}
      </div>

      <div className="h-5 w-px bg-slate-200 dark:bg-slate-50 mx-1" />

      {/* History Controls (Undo / Redo) */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors focus-ring"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={onRedo}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors focus-ring"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-5 w-px bg-slate-200 dark:bg-slate-50 mx-1" />

      {/* Zoom and Navigation Controls */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onZoomOut}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-ring"
          title="Zoom Out (-)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onResetZoom}
          className="px-2 h-7 rounded-lg text-[11px] font-mono font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-ring"
          title="Reset Zoom to 100%"
        >
          {formatZoomPercentage(zoom)}
        </button>

        <button
          type="button"
          onClick={onZoomIn}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-ring"
          title="Zoom In (+)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onFitToView}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-ring"
          title="Fit All Content to View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Read Only Status Pill */}
      {!canEdit && (
        <>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-50 mx-1" />
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-900/60 text-[11px] font-medium">
            <Lock className="w-3 h-3" />
            <span>Viewer (Read Only)</span>
          </div>
        </>
      )}
    </div>
  );
}
