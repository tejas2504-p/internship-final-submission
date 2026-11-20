"use client";

import React, { useState, useRef } from "react";
import {
  MousePointer,
  Hand,
  Pen,
  Highlighter,
  Eraser,
  Square,
  Circle,
  Diamond,
  Minus,
  MoveUpRight,
  Triangle,
  Type,
  StickyNote,
  GitCommit,
  Image as ImageIcon,
  ChevronRight,
} from "lucide-react";
import { SketchboardTool } from "@/types/sketchboard";

interface SketchboardToolbarProps {
  activeTool: SketchboardTool;
  onSelectTool: (tool: SketchboardTool) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SketchboardToolbar({
  activeTool,
  onSelectTool,
  onImageUpload,
}: SketchboardToolbarProps) {
  const [shapesMenuOpen, setShapesMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isShapeTool = [
    "rectangle",
    "circle",
    "ellipse",
    "diamond",
    "polygon",
    "line",
    "arrow",
  ].includes(activeTool);

  const renderShapeIcon = () => {
    switch (activeTool) {
      case "circle":
        return <Circle className="w-4 h-4" />;
      case "diamond":
        return <Diamond className="w-4 h-4" />;
      case "polygon":
        return <Triangle className="w-4 h-4" />;
      case "line":
        return <Minus className="w-4 h-4" />;
      case "arrow":
        return <MoveUpRight className="w-4 h-4" />;
      case "rectangle":
      default:
        return <Square className="w-4 h-4" />;
    }
  };

  return (
    <div className="absolute left-4 top-20 z-30 flex flex-col items-center bg-white border border-slate-200/90 rounded-2xl shadow-xl p-1.5 gap-1 select-none transition-all">
      {/* Hidden file input for image upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Select Tool */}
      <button
        type="button"
        onClick={() => onSelectTool("select")}
        title="Select Tool (V) - Select, move, resize, rotate"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
          activeTool === "select"
            ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
      >
        <MousePointer className="w-4 h-4" />
      </button>

      {/* Hand / Pan Tool */}
      <button
        type="button"
        onClick={() => onSelectTool("hand")}
        title="Hand / Pan Tool (H or Spacebar) - Navigate the canvas"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
          activeTool === "hand"
            ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
      >
        <Hand className="w-4 h-4" />
      </button>

      <div className="w-6 h-px bg-slate-200 my-0.5" />

      {/* Pen Tool */}
      <button
        type="button"
        onClick={() => onSelectTool("pen")}
        title="Pen Tool (P) - Smooth freehand drawing"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
          activeTool === "pen"
            ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
      >
        <Pen className="w-4 h-4" />
      </button>

      {/* Highlighter Tool */}
      <button
        type="button"
        onClick={() => onSelectTool("highlighter")}
        title="Highlighter (Shift+H) - Semi-transparent drawing strokes"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
          activeTool === "highlighter"
            ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
      >
        <Highlighter className="w-4 h-4" />
      </button>

      {/* Eraser Tool */}
      <button
        type="button"
        onClick={() => onSelectTool("eraser")}
        title="Eraser (E) - Click or drag to erase strokes & objects"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
          activeTool === "eraser"
            ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
      >
        <Eraser className="w-4 h-4" />
      </button>

      <div className="w-6 h-px bg-slate-200 my-0.5" />

      {/* Shapes Flyout Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShapesMenuOpen(!shapesMenuOpen)}
          title="Shapes - Rectangle, Circle, Diamond, Line, Arrow, Polygon"
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all relative ${
            isShapeTool
              ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          {renderShapeIcon()}
          <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-slate-400" />
        </button>

        {/* Shapes Flyout Menu */}
        {shapesMenuOpen && (
          <div
            className="absolute left-12 top-0 z-40 bg-white border border-slate-200/90 rounded-2xl shadow-xl p-2 grid grid-cols-2 gap-1.5 w-44 animate-in fade-in zoom-in-95 duration-100"
            onMouseLeave={() => setShapesMenuOpen(false)}
          >
            <div className="col-span-2 text-[10px] font-semibold text-slate-400 px-1 uppercase tracking-wider">
              Shapes
            </div>

            <button
              type="button"
              onClick={() => {
                onSelectTool("rectangle");
                setShapesMenuOpen(false);
              }}
              className={`flex items-center gap-2 p-1.5 text-xs rounded-lg transition-colors ${
                activeTool === "rectangle" ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Square className="w-3.5 h-3.5 text-sky-500" />
              <span>Rect (R)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectTool("circle");
                setShapesMenuOpen(false);
              }}
              className={`flex items-center gap-2 p-1.5 text-xs rounded-lg transition-colors ${
                activeTool === "circle" ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Circle className="w-3.5 h-3.5 text-sky-500" />
              <span>Circle (O)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectTool("diamond");
                setShapesMenuOpen(false);
              }}
              className={`flex items-center gap-2 p-1.5 text-xs rounded-lg transition-colors ${
                activeTool === "diamond" ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Diamond className="w-3.5 h-3.5 text-sky-500" />
              <span>Diamond (D)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectTool("polygon");
                setShapesMenuOpen(false);
              }}
              className={`flex items-center gap-2 p-1.5 text-xs rounded-lg transition-colors ${
                activeTool === "polygon" ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Triangle className="w-3.5 h-3.5 text-sky-500" />
              <span>Triangle</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectTool("line");
                setShapesMenuOpen(false);
              }}
              className={`flex items-center gap-2 p-1.5 text-xs rounded-lg transition-colors ${
                activeTool === "line" ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Minus className="w-3.5 h-3.5 text-sky-500" />
              <span>Line (L)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectTool("arrow");
                setShapesMenuOpen(false);
              }}
              className={`flex items-center gap-2 p-1.5 text-xs rounded-lg transition-colors ${
                activeTool === "arrow" ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <MoveUpRight className="w-3.5 h-3.5 text-sky-500" />
              <span>Arrow (A)</span>
            </button>
          </div>
        )}
      </div>

      {/* Text Tool */}
      <button
        type="button"
        onClick={() => onSelectTool("text")}
        title="Text Tool (T) - Add rich formatted text"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
          activeTool === "text"
            ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
      >
        <Type className="w-4 h-4" />
      </button>

      {/* Sticky Note Tool */}
      <button
        type="button"
        onClick={() => onSelectTool("sticky")}
        title="Sticky Note (S) - Brainstorm ideas and feedback"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
          activeTool === "sticky"
            ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
      >
        <StickyNote className="w-4 h-4" />
      </button>

      {/* Connector Tool */}
      <button
        type="button"
        onClick={() => onSelectTool("connector")}
        title="Connector Line / Arrow (C) - Connect diagram nodes"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
          activeTool === "connector"
            ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
      >
        <GitCommit className="w-4 h-4" />
      </button>

      <div className="w-6 h-px bg-slate-200 my-0.5" />

      {/* Image Upload Button */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        title="Image Upload (I) - Upload diagrams, mockups or wireframes"
        className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
      >
        <ImageIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

