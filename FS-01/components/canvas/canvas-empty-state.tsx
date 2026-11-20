"use client";

import * as React from "react";
import {
  Sparkles,
  StickyNote,
  Type,
  Square,
  Circle,
  Lock,
} from "lucide-react";
import { CanvasNodeType } from "@/types/canvas";

interface CanvasEmptyStateProps {
  canEdit: boolean;
  onAddNode: (type: CanvasNodeType) => void;
}

export function CanvasEmptyState({ canEdit, onAddNode }: CanvasEmptyStateProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none z-10">
      <div className="max-w-lg w-full bg-white/95 dark:bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/90 dark:border-slate-200 shadow-xl shadow-slate-900/5 dark:shadow-black/40 p-8 text-center space-y-6 pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-500 p-0.5 shadow-md shadow-indigo-500/20 mx-auto flex items-center justify-center">
          <div className="w-full h-full bg-white dark:bg-white rounded-[14px] flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-900">
            Spatial Canvas Ready
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
            Brainstorm freeform ideas, pin sticky notes, diagram product architecture, and sketch workflows right beside your documents.
          </p>
        </div>

        {/* Quick Add Actions */}
        {canEdit ? (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Get Started with an Object
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => onAddNode("STICKY")}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100/80 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 transition-all hover:scale-105 active:scale-95 group shadow-xs focus-ring"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-200/80 dark:bg-amber-800/60 flex items-center justify-center text-amber-800 dark:text-amber-200 group-hover:scale-110 transition-transform">
                  <StickyNote className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold">Sticky Note</span>
              </button>

              <button
                type="button"
                onClick={() => onAddNode("TEXT")}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-50/70 hover:bg-slate-100/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-200 text-slate-900 dark:text-slate-900 transition-all hover:scale-105 active:scale-95 group shadow-xs focus-ring"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-200/80 dark:bg-slate-700 flex items-center justify-center text-slate-800 dark:text-slate-800 group-hover:scale-110 transition-transform">
                  <Type className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold">Text Block</span>
              </button>

              <button
                type="button"
                onClick={() => onAddNode("RECTANGLE")}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100/80 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800/80 text-sky-900 dark:text-sky-200 transition-all hover:scale-105 active:scale-95 group shadow-xs focus-ring"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-200/80 dark:bg-sky-800/60 flex items-center justify-center text-sky-800 dark:text-sky-200 group-hover:scale-110 transition-transform">
                  <Square className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold">Rectangle</span>
              </button>

              <button
                type="button"
                onClick={() => onAddNode("CIRCLE")}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200 transition-all hover:scale-105 active:scale-95 group shadow-xs focus-ring"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-200/80 dark:bg-emerald-800/60 flex items-center justify-center text-emerald-800 dark:text-emerald-200 group-hover:scale-110 transition-transform">
                  <Circle className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold">Circle</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>This canvas is empty and in read-only mode for viewers.</span>
          </div>
        )}

        {/* Shortcuts & Tips Cheat Sheet */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 justify-center">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-50 border border-slate-200 dark:border-slate-200 font-mono text-slate-700 dark:text-slate-300">
              V
            </kbd>
            <span>Select & Move</span>
          </div>
          <div className="flex items-center gap-1.5 justify-center">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-50 border border-slate-200 dark:border-slate-200 font-mono text-slate-700 dark:text-slate-300">
              Space+Drag
            </kbd>
            <span>Pan Canvas</span>
          </div>
          <div className="flex items-center gap-1.5 justify-center">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-50 border border-slate-200 dark:border-slate-200 font-mono text-slate-700 dark:text-slate-300">
              Scroll
            </kbd>
            <span>Pan / Zoom</span>
          </div>
          <div className="flex items-center gap-1.5 justify-center">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-50 border border-slate-200 dark:border-slate-200 font-mono text-slate-700 dark:text-slate-300">
              Del
            </kbd>
            <span>Delete Selected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
