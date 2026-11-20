"use client";

import React, { useState } from "react";
import { Plus, Minus, Maximize2, RotateCcw } from "lucide-react";

interface SketchboardZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onSetZoom: (zoom: number) => void;
  onFitToContent: () => void;
}

export function SketchboardZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onSetZoom,
  onFitToContent,
}: SketchboardZoomControlsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const percentage = Math.round(zoom * 100);

  const presets = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="absolute right-4 bottom-6 z-30 flex items-center gap-1 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl p-1.5 select-none transition-all">
      {/* Zoom Out Button */}
      <button
        type="button"
        onClick={onZoomOut}
        title="Zoom Out (-)"
        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
      >
        <Minus className="w-4 h-4" />
      </button>

      {/* Zoom Percentage Dropdown Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          title="Zoom Level"
          className="px-2 py-1 text-xs font-semibold text-slate-700 hover:text-sky-600 rounded-lg hover:bg-slate-100 font-mono transition-colors"
        >
          {percentage}%
        </button>

        {menuOpen && (
          <div
            className="absolute bottom-10 right-0 bg-white border border-slate-200/90 rounded-xl shadow-xl p-1 flex flex-col gap-0.5 w-24 animate-in fade-in zoom-in-95 z-40"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <div className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
              Zoom
            </div>
            {presets.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  onSetZoom(val);
                  setMenuOpen(false);
                }}
                className={`text-left px-2 py-1 text-xs font-mono rounded-lg transition-colors ${
                  Math.abs(zoom - val) < 0.05
                    ? "bg-sky-50 text-sky-700 font-bold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {Math.round(val * 100)}%
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Zoom In Button */}
      <button
        type="button"
        onClick={onZoomIn}
        title="Zoom In (+)"
        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
      >
        <Plus className="w-4 h-4" />
      </button>

      <div className="w-px h-4 bg-slate-200 mx-0.5" />

      {/* Fit to Content Button */}
      <button
        type="button"
        onClick={onFitToContent}
        title="Fit to Content (Shift+1)"
        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
      >
        <Maximize2 className="w-4 h-4" />
      </button>

      {/* Reset to 100% Button */}
      <button
        type="button"
        onClick={onResetZoom}
        title="Reset Zoom to 100% (0)"
        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

