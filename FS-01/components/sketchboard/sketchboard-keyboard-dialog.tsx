"use client";

import React from "react";
import { X, Keyboard } from "lucide-react";

interface SketchboardKeyboardDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SketchboardKeyboardDialog({
  isOpen,
  onClose,
}: SketchboardKeyboardDialogProps) {
  if (!isOpen) return null;

  const toolShortcuts = [
    { key: "V / 1", desc: "Select & Transform" },
    { key: "H / Space", desc: "Hand / Canvas Pan" },
    { key: "P / 2", desc: "Freehand Pen" },
    { key: "Shift + H", desc: "Highlighter" },
    { key: "E", desc: "Eraser" },
    { key: "R", desc: "Rectangle Shape" },
    { key: "O", desc: "Circle / Ellipse" },
    { key: "D", desc: "Diamond Shape" },
    { key: "L", desc: "Straight Line" },
    { key: "A", desc: "Directional Arrow" },
    { key: "T", desc: "Text Box" },
    { key: "S", desc: "Sticky Note" },
    { key: "C", desc: "Connector" },
  ];

  const actionShortcuts = [
    { key: "Ctrl + C", desc: "Copy selected" },
    { key: "Ctrl + V", desc: "Paste copied" },
    { key: "Ctrl + D", desc: "Duplicate in-place" },
    { key: "Ctrl + Z", desc: "Undo" },
    { key: "Ctrl + Y", desc: "Redo" },
    { key: "Ctrl + G", desc: "Group objects" },
    { key: "Ctrl + Shift + G", desc: "Ungroup" },
    { key: "Delete", desc: "Delete selected" },
    { key: "[ / ]", desc: "Send Back / Bring Front" },
    { key: "+ / -", desc: "Zoom In / Out" },
    { key: "0", desc: "Reset zoom (100%)" },
    { key: "Esc", desc: "Cancel / Deselect" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl border border-slate-200/90 p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Keyboard Shortcuts</h3>
              <p className="text-[11px] text-slate-500">Fast workflow commands for Sketchboard</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Drawing Tools
            </div>
            <div className="space-y-1.5">
              {toolShortcuts.map((s) => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-slate-600">{s.desc}</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[11px] font-semibold text-slate-700">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Editing & Canvas
            </div>
            <div className="space-y-1.5">
              {actionShortcuts.map((s) => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-slate-600">{s.desc}</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[11px] font-semibold text-slate-700">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

