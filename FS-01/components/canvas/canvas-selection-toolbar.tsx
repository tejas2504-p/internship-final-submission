"use client";

import * as React from "react";
import {
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import { CanvasNode, CANVAS_COLOR_PRESETS } from "@/types/canvas";

interface CanvasSelectionToolbarProps {
  node: CanvasNode;
  onUpdateColor: (colorId: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onDeselect: () => void;
  canEdit: boolean;
  screenPos: { x: number; y: number };
}

export function CanvasSelectionToolbar({
  node,
  onUpdateColor,
  onDuplicate,
  onDelete,
  onBringForward,
  onSendBackward,
  onDeselect,
  canEdit,
  screenPos,
}: CanvasSelectionToolbarProps) {
  if (!canEdit) return null;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute z-50 flex items-center gap-1.5 p-1 rounded-xl bg-white border border-slate-200 shadow-lg shadow-slate-900/10 pointer-events-auto backdrop-blur-md select-none transition-all duration-75 cursor-default"
      style={{
        left: `${screenPos.x}px`,
        top: `${Math.max(12, screenPos.y - 48)}px`,
        transform: "translateX(-50%)",
      }}
    >
      {/* Color Presets */}
      <div className="flex items-center gap-1 px-1">
        {CANVAS_COLOR_PRESETS.map((preset) => {
          const isSelected = (node.colorId || "amber") === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onUpdateColor(preset.id);
              }}
              className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${preset.bgClass} ${
                preset.borderClass
              } ${
                isSelected
                  ? "ring-2 ring-indigo-600 ring-offset-1 scale-110"
                  : "hover:scale-105 opacity-80 hover:opacity-100"
              }`}
              title={`Color: ${preset.name}`}
            />
          );
        })}
      </div>

      <div className="h-4 w-px bg-slate-200" />

      {/* Layering & Actions */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onBringForward();
          }}
          className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Bring Forward"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onSendBackward();
          }}
          className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Send Backward"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Duplicate Object"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          title="Delete Object (Del)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDeselect();
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Deselect (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
