"use client";

import React from "react";
import { StickyNote, GitMerge, Layout, PenTool, Sparkles } from "lucide-react";
import { SketchElement } from "@/types/sketchboard";
import { createDefaultSketchElement } from "@/lib/sketchboard/utils";

interface SketchboardEmptyStateProps {
  onAddStarterElements: (elements: SketchElement[]) => void;
  authorName?: string;
}

export function SketchboardEmptyState({
  onAddStarterElements,
  authorName = "You",
}: SketchboardEmptyStateProps) {
  const handleAddBrainstormTemplate = () => {
    const starters: SketchElement[] = [
      createDefaultSketchElement("STICKY", { x: 140, y: 120 }, {
        text: "💡 What are our primary goals for this sprint?",
        fillColor: "#fef3c7",
        strokeColor: "#fde68a",
        textColor: "#78350f",
        authorName,
      }),
      createDefaultSketchElement("STICKY", { x: 380, y: 120 }, {
        text: "🚀 Architecture & technical approach to test",
        fillColor: "#e0f2fe",
        strokeColor: "#bae6fd",
        textColor: "#0369a1",
        authorName,
      }),
      createDefaultSketchElement("STICKY", { x: 620, y: 120 }, {
        text: "⚠️ Potential risks & mitigation plans",
        fillColor: "#ffe4e6",
        strokeColor: "#fecdd3",
        textColor: "#9f1239",
        authorName,
      }),
    ];
    onAddStarterElements(starters);
  };

  const handleAddFlowchartTemplate = () => {
    const starters: SketchElement[] = [
      createDefaultSketchElement("RECTANGLE", { x: 120, y: 140 }, {
        width: 160,
        height: 80,
        strokeColor: "#0284c7",
        fillColor: "#f0f9ff",
      }),
      createDefaultSketchElement("TEXT", { x: 145, y: 165 }, {
        text: "Start Request",
        fontSize: 16,
      }),
      createDefaultSketchElement("CONNECTOR", { x: 280, y: 180 }, {
        startPoint: { x: 280, y: 180 },
        endPoint: { x: 380, y: 180 },
        strokeColor: "#0284c7",
        arrowEnd: true,
      }),
      createDefaultSketchElement("DIAMOND", { x: 380, y: 120 }, {
        width: 120,
        height: 120,
        strokeColor: "#8b5cf6",
        fillColor: "#f5f3ff",
      }),
      createDefaultSketchElement("TEXT", { x: 405, y: 165 }, {
        text: "Valid Auth?",
        fontSize: 14,
        textColor: "#6b21a8",
      }),
      createDefaultSketchElement("CONNECTOR", { x: 500, y: 180 }, {
        startPoint: { x: 500, y: 180 },
        endPoint: { x: 600, y: 180 },
        strokeColor: "#10b981",
        arrowEnd: true,
      }),
      createDefaultSketchElement("RECTANGLE", { x: 600, y: 140 }, {
        width: 160,
        height: 80,
        strokeColor: "#10b981",
        fillColor: "#ecfdf5",
      }),
      createDefaultSketchElement("TEXT", { x: 630, y: 165 }, {
        text: "Return Data",
        fontSize: 16,
        textColor: "#047857",
      }),
    ];
    onAddStarterElements(starters);
  };

  const handleAddWireframeTemplate = () => {
    const starters: SketchElement[] = [
      createDefaultSketchElement("RECTANGLE", { x: 160, y: 100 }, {
        width: 520,
        height: 340,
        strokeColor: "#475569",
        fillColor: "#ffffff",
        strokeWidth: 2,
      }),
      createDefaultSketchElement("RECTANGLE", { x: 180, y: 120 }, {
        width: 480,
        height: 50,
        strokeColor: "#cbd5e1",
        fillColor: "#f8fafc",
      }),
      createDefaultSketchElement("TEXT", { x: 200, y: 132 }, {
        text: "SyncSpace • Navigation Bar",
        fontSize: 16,
        textColor: "#334155",
      }),
      createDefaultSketchElement("RECTANGLE", { x: 180, y: 190 }, {
        width: 300,
        height: 220,
        strokeColor: "#cbd5e1",
        fillColor: "#f1f5f9",
      }),
      createDefaultSketchElement("STICKY", { x: 500, y: 200 }, {
        width: 160,
        height: 160,
        text: "Wireframe Notes:\n• Mobile responsive\n• Collapsible sidebar",
        fillColor: "#e0f2fe",
        strokeColor: "#bae6fd",
        textColor: "#0369a1",
        authorName,
      }),
    ];
    onAddStarterElements(starters);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-3xl p-6 shadow-2xl text-center space-y-5 pointer-events-auto animate-in fade-in zoom-in-95">
        <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto border border-sky-100 shadow-xs">
          <Sparkles className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Infinite Whiteboard Ready
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            Create sketches, user flows, architecture diagrams, or brainstorm with sticky notes. Choose a quick template to start:
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleAddBrainstormTemplate}
            className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 text-slate-700 hover:text-amber-900 transition-all group"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <StickyNote className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold">Brainstorm</span>
          </button>

          <button
            type="button"
            onClick={handleAddFlowchartTemplate}
            className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 text-slate-700 hover:text-sky-900 transition-all group"
          >
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <GitMerge className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold">Flowchart</span>
          </button>

          <button
            type="button"
            onClick={handleAddWireframeTemplate}
            className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-900 transition-all group"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Layout className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold">Wireframe</span>
          </button>
        </div>
      </div>
    </div>
  );
}

