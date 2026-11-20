"use client";

import React from "react";
import {
  Copy,
  Trash2,
  Layers,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  FolderPlus,
  FolderMinus,
  Sparkles,
  Lock,
  Unlock,
} from "lucide-react";
import {
  SketchElement,
  StrokeStyle,
  AlignmentType,
  SKETCH_COLORS,
  STICKY_PALETTES,
} from "@/types/sketchboard";

interface SketchboardPropertiesPanelProps {
  selectedElements: SketchElement[];
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  opacity: number;
  fontSize: number;
  textAlign: "left" | "center" | "right";
  textColor: string;
  onUpdateProperties: (patch: Partial<SketchElement>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock?: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onAlign: (type: AlignmentType) => void;
  onDistribute: (dir: "horizontal" | "vertical") => void;
}

export function SketchboardPropertiesPanel({
  selectedElements,
  strokeColor,
  fillColor,
  strokeWidth,
  strokeStyle,
  opacity,
  fontSize,
  textAlign,
  textColor,
  onUpdateProperties,
  onDuplicate,
  onDelete,
  onToggleLock,
  onGroup,
  onUngroup,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onAlign,
  onDistribute,
}: SketchboardPropertiesPanelProps) {
  const count = selectedElements.length;
  const isMulti = count > 1;
  const first = selectedElements[0];
  const isSticky = first?.type === "STICKY";
  const isText = first?.type === "TEXT";
  const isPen = first?.type === "PEN" || first?.type === "HIGHLIGHTER";
  const hasGroup = selectedElements.some((e) => !!e.groupId);
  const isLocked = count > 0 && selectedElements.every((e) => Boolean(e.isLocked));

  return (
    <div className="absolute left-4 bottom-6 z-30 max-w-sm w-72 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl p-3.5 flex flex-col gap-3 select-none text-slate-800 transition-all animate-in fade-in slide-in-from-bottom-2">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <span className="text-xs font-semibold text-slate-700">
          {count === 0
            ? "Tool Style"
            : count === 1
            ? `${first.type.charAt(0) + first.type.slice(1).toLowerCase()} Properties`
            : `${count} Selected Objects`}
        </span>

        {count > 0 && (
          <div className="flex items-center gap-1">
            {onToggleLock && (
              <button
                type="button"
                onClick={onToggleLock}
                title={isLocked ? "Unlock Object (Ctrl+Shift+L)" : "Lock Object (Ctrl+Shift+L)"}
                className={`p-1 rounded-lg transition-colors ${
                  isLocked
                    ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              type="button"
              onClick={onDuplicate}
              title="Duplicate (Ctrl+D)"
              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isLocked}
              title={isLocked ? "Cannot delete locked object" : "Delete (Delete or Backspace)"}
              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-30 disabled:pointer-events-none rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Sticky Note Palette Selector */}
      {isSticky && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-slate-500">Note Color</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {STICKY_PALETTES.map((pal) => (
              <button
                key={pal.id}
                type="button"
                onClick={() =>
                  onUpdateProperties({
                    fillColor: pal.bg,
                    strokeColor: pal.border,
                    textColor: pal.text,
                  })
                }
                title={pal.name}
                style={{ backgroundColor: pal.bg, borderColor: pal.border }}
                className={`w-6 h-6 rounded-lg border-2 transition-transform hover:scale-110 ${
                  first?.fillColor === pal.bg ? "ring-2 ring-sky-500 scale-105" : ""
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Stroke Color */}
      {!isSticky && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-slate-500">Stroke Color</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {SKETCH_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => onUpdateProperties({ strokeColor: c.hex })}
                title={c.label}
                style={{ backgroundColor: c.hex }}
                className={`w-5 h-5 rounded-md border border-slate-300 transition-transform hover:scale-110 ${
                  strokeColor === c.hex ? "ring-2 ring-sky-500 scale-110" : ""
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Fill Color (for shapes) */}
      {!isPen && !isSticky && !isText && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-slate-500">Fill Color</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => onUpdateProperties({ fillColor: "transparent" })}
              title="Transparent"
              className={`w-5 h-5 rounded-md border border-slate-300 relative overflow-hidden bg-white ${
                fillColor === "transparent" ? "ring-2 ring-sky-500 scale-110" : ""
              }`}
            >
              <span className="absolute inset-0 border-t border-rose-500 -rotate-45 origin-center" />
            </button>
            {SKETCH_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => onUpdateProperties({ fillColor: c.hex })}
                title={c.label}
                style={{ backgroundColor: c.hex }}
                className={`w-5 h-5 rounded-md border border-slate-300 transition-transform hover:scale-110 ${
                  fillColor === c.hex ? "ring-2 ring-sky-500 scale-110" : ""
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Stroke Width & Style */}
      {!isSticky && !isText && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">Width</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {[1, 2, 4, 8].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => onUpdateProperties({ strokeWidth: w })}
                  className={`flex-1 py-0.5 text-xs font-semibold rounded-lg transition-colors ${
                    strokeWidth === w ? "bg-white text-sky-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {w}px
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">Style</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {(["solid", "dashed", "dotted"] as StrokeStyle[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onUpdateProperties({ strokeStyle: s })}
                  className={`flex-1 py-0.5 text-[10px] capitalize font-medium rounded-lg transition-colors ${
                    strokeStyle === s ? "bg-white text-sky-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Text / Sticky Font Size & Align */}
      {(isText || isSticky) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">Font Size</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {[14, 18, 24, 32].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => onUpdateProperties({ fontSize: size })}
                  className={`flex-1 py-0.5 text-xs font-semibold rounded-lg transition-colors ${
                    fontSize === size ? "bg-white text-sky-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">Align</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => onUpdateProperties({ textAlign: a })}
                  className={`flex-1 py-1 flex items-center justify-center rounded-lg transition-colors ${
                    textAlign === a ? "bg-white text-sky-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {a === "left" && <AlignLeft className="w-3.5 h-3.5" />}
                  {a === "center" && <AlignCenter className="w-3.5 h-3.5" />}
                  {a === "right" && <AlignRight className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Opacity Slider */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
          <span>Opacity</span>
          <span>{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={opacity}
          onChange={(e) => onUpdateProperties({ opacity: parseFloat(e.target.value) })}
          className="w-full accent-sky-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
        />
      </div>

      {/* Layering & Grouping Actions (when objects selected) */}
      {count > 0 && (
        <div className="border-t border-slate-100 pt-2 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onSendToBack}
              title="Send to Back (Shift+[)"
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <ChevronsDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onSendBackward}
              title="Send Backward ([)"
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onBringForward}
              title="Bring Forward (])"
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onBringToFront}
              title="Bring to Front (Shift+])"
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <ChevronsUp className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {isMulti && (
              <button
                type="button"
                onClick={onGroup}
                title="Group Objects (Ctrl+G)"
                className="flex items-center gap-1 px-2 py-1 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
              >
                <FolderPlus className="w-3 h-3" />
                <span>Group</span>
              </button>
            )}
            {hasGroup && (
              <button
                type="button"
                onClick={onUngroup}
                title="Ungroup (Ctrl+Shift+G)"
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <FolderMinus className="w-3 h-3" />
                <span>Ungroup</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Multi-Selection Alignment Toolbar */}
      {isMulti && (
        <div className="border-t border-slate-100 pt-2 flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Align Selection
          </span>
          <div className="grid grid-cols-6 gap-1 bg-slate-50 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => onAlign("left")}
              title="Align Left"
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded text-center text-xs font-mono"
            >
              L
            </button>
            <button
              type="button"
              onClick={() => onAlign("center")}
              title="Align Center"
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded text-center text-xs font-mono"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => onAlign("right")}
              title="Align Right"
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded text-center text-xs font-mono"
            >
              R
            </button>
            <button
              type="button"
              onClick={() => onAlign("top")}
              title="Align Top"
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded text-center text-xs font-mono"
            >
              T
            </button>
            <button
              type="button"
              onClick={() => onAlign("middle")}
              title="Align Middle"
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded text-center text-xs font-mono"
            >
              M
            </button>
            <button
              type="button"
              onClick={() => onAlign("bottom")}
              title="Align Bottom"
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded text-center text-xs font-mono"
            >
              B
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

