"use client";

import * as React from "react";
import Link from "next/link";
import {
  Layers,
  FileText,
  Move,
  Columns,
  PenTool,
  Plus,
  Trash2,
  CheckCircle2,
  Circle as UncheckedCircle,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  ArrowRight,
  MousePointer2,
  X,
  Heading,
  AlignLeft,
  CheckSquare,
  Code,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DocBlock {
  id: string;
  type: "heading" | "text" | "todo" | "callout" | "code";
  content: string;
  checked?: boolean;
}

interface DemoSticky {
  id: string;
  text: string;
  color: string;
  border: string;
  textColor: string;
  author: string;
  x: number;
  y: number;
  rotation: number;
}

interface DrawingStroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

const COLOR_PALETTES = [
  { name: "Yellow", bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-900" },
  { name: "Sky", bg: "bg-sky-100", border: "border-sky-300", text: "text-sky-900" },
  { name: "Emerald", bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-900" },
  { name: "Rose", bg: "bg-rose-100", border: "border-rose-300", text: "text-rose-900" },
  { name: "Purple", bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-900" },
];

const SAMPLE_TEMPLATE_BLOCKS: DocBlock[] = [
  {
    id: "sample-1",
    type: "heading",
    content: "Product Specification & Architecture",
  },
  {
    id: "sample-2",
    type: "callout",
    content: "SyncSpace combines structured document blocks with an infinite spatial visual canvas.",
  },
  {
    id: "sample-3",
    type: "text",
    content: "Document goals, technical requirements, and visual diagrams in one connected workspace.",
  },
  {
    id: "sample-4",
    type: "todo",
    content: "Define API contracts and PostgreSQL schema",
    checked: true,
  },
  {
    id: "sample-5",
    type: "todo",
    content: "Connect frontend canvas with real-time CRDT updates",
    checked: false,
  },
];

const SAMPLE_TEMPLATE_STICKIES: DemoSticky[] = [
  {
    id: "sample-sticky-1",
    text: "Architecture: Decouple CRDT awareness from storage loops.",
    color: "bg-amber-100",
    border: "border-amber-300",
    textColor: "text-amber-900",
    author: "Architecture",
    x: 60,
    y: 80,
    rotation: -1.5,
  },
  {
    id: "sample-sticky-2",
    text: "Spatial canvas: Drag sticky notes or sketch wireframes with the pen tool.",
    color: "bg-sky-100",
    border: "border-sky-300",
    textColor: "text-sky-900",
    author: "Canvas Note",
    x: 280,
    y: 120,
    rotation: 1,
  },
];

export default function DemoPage() {
  // View mode: "dual" | "doc" | "canvas"
  const [viewMode, setViewMode] = React.useState<"dual" | "doc" | "canvas">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("mode");
      if (mode === "doc" || mode === "canvas" || mode === "dual") {
        return mode;
      }
    }
    return "dual";
  });

  // Listen for browser navigation changes
  React.useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("mode");
      if (mode === "doc" || mode === "canvas" || mode === "dual") {
        setViewMode(mode);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Document Editor State - Starts clean and empty
  const [docTitle, setDocTitle] = React.useState("");
  const [blocks, setBlocks] = React.useState<DocBlock[]>([]);
  const [showBanner, setShowBanner] = React.useState(true);

  // Canvas State - Starts clean and empty
  const [stickies, setStickies] = React.useState<DemoSticky[]>([]);
  const [selectedStickyId, setSelectedStickyId] = React.useState<string | null>(null);
  const [activeTool, setActiveTool] = React.useState<"select" | "sticky" | "pen">("select");
  const [zoomLevel, setZoomLevel] = React.useState(100);
  const [penColor, setPenColor] = React.useState("#2563eb");
  const [penWidth] = React.useState(3);

  // Freehand Drawing State
  const [strokes, setStrokes] = React.useState<DrawingStroke[]>([]);
  const [currentStroke, setCurrentStroke] = React.useState<DrawingStroke | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // Dragging state for sticky notes
  const [draggedSticky, setDraggedSticky] = React.useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // Redraw canvas on stroke updates
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;

    allStrokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  }, [strokes, currentStroke]);

  // Adjust canvas resolution to parent
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }, [viewMode]);

  const handlePointerDownCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool !== "pen") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (zoomLevel / 100);
    const y = (e.clientY - rect.top) / (zoomLevel / 100);
    setCurrentStroke({
      points: [{ x, y }],
      color: penColor,
      width: penWidth,
    });
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool !== "pen" || !currentStroke) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (zoomLevel / 100);
    const y = (e.clientY - rect.top) / (zoomLevel / 100);
    setCurrentStroke((prev) => (prev ? { ...prev, points: [...prev.points, { x, y }] } : null));
  };

  const handlePointerUpCanvas = () => {
    if (currentStroke && currentStroke.points.length > 1) {
      setStrokes((prev) => [...prev, currentStroke]);
    }
    setCurrentStroke(null);
  };

  // Sticky note dragging
  const handleStickyPointerDown = (id: string, e: React.PointerEvent) => {
    if (activeTool === "pen") return;
    e.stopPropagation();
    const sticky = stickies.find((s) => s.id === id);
    if (!sticky) return;
    setSelectedStickyId(id);
    setDraggedSticky({
      id,
      offsetX: e.clientX - sticky.x,
      offsetY: e.clientY - sticky.y,
    });
  };

  const handleGlobalPointerMove = (e: React.PointerEvent) => {
    if (!draggedSticky) return;
    const newX = Math.max(10, e.clientX - draggedSticky.offsetX);
    const newY = Math.max(10, e.clientY - draggedSticky.offsetY);
    setStickies((prev) =>
      prev.map((s) => (s.id === draggedSticky.id ? { ...s, x: newX, y: newY } : s))
    );
  };

  const handleGlobalPointerUp = () => {
    setDraggedSticky(null);
  };

  const handleAddSticky = (paletteIdx: number = 0) => {
    const palette = COLOR_PALETTES[paletteIdx % COLOR_PALETTES.length];
    const newSticky: DemoSticky = {
      id: `sticky-${Date.now()}`,
      text: "New sticky note: click to edit text.",
      color: palette.bg,
      border: palette.border,
      textColor: palette.text,
      author: "Note",
      x: 80 + Math.floor(Math.random() * 120),
      y: 80 + Math.floor(Math.random() * 100),
      rotation: Math.floor(Math.random() * 6) - 3,
    };
    setStickies((prev) => [...prev, newSticky]);
    setSelectedStickyId(newSticky.id);
    setActiveTool("select");
  };

  const handleDeleteSticky = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStickies((prev) => prev.filter((s) => s.id !== id));
    if (selectedStickyId === id) setSelectedStickyId(null);
  };

  // Document Block Handlers
  const handleAddBlock = (type: DocBlock["type"]) => {
    const newBlock: DocBlock = {
      id: `block-${Date.now()}`,
      type,
      content:
        type === "heading"
          ? "Section Heading"
          : type === "todo"
          ? "New task item"
          : type === "callout"
          ? "Important project note or architecture decision."
          : type === "code"
          ? "// Add code or configuration here"
          : "",
      checked: false,
    };
    setBlocks((prev) => [...prev, newBlock]);
  };

  const handleUpdateBlockContent = (id: string, content: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)));
  };

  const handleToggleTodo = (id: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b)));
  };

  const handleDeleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  // Optional Template Loader (Triggered only when visitor chooses)
  const handleLoadSampleTemplate = () => {
    setDocTitle("Product Specification & Architecture");
    setBlocks(SAMPLE_TEMPLATE_BLOCKS);
    setStickies(SAMPLE_TEMPLATE_STICKIES);
  };

  // Reset to clean empty session
  const handleResetSession = () => {
    setDocTitle("");
    setBlocks([]);
    setStickies([]);
    setStrokes([]);
    setZoomLevel(100);
  };

  return (
    <div
      onPointerMove={handleGlobalPointerMove}
      onPointerUp={handleGlobalPointerUp}
      className="min-h-screen flex flex-col bg-slate-100 text-slate-900 select-none overflow-hidden"
    >
      {/* Top Demo Workspace Chrome */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 z-30 flex-shrink-0">
        {/* Brand & Document Name */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-blue-600 p-0.5 shadow-xs flex items-center justify-center">
              <div className="w-full h-full bg-white rounded-[6px] flex items-center justify-center">
                <Layers className="w-4 h-4 text-sky-600" />
              </div>
            </div>
            <span className="font-bold text-base tracking-tight text-slate-900 group-hover:text-sky-600 transition-colors hidden sm:inline">
              SyncSpace
            </span>
          </Link>

          <span className="text-slate-300 hidden sm:inline">/</span>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 truncate max-w-[180px] sm:max-w-[280px]">
              {docTitle || "Untitled Document"}
            </span>
            <Badge variant="cyan" size="sm" className="font-mono text-[10px]">
              Demo Session
            </Badge>
          </div>
        </div>

        {/* Center: View Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium">
          <button
            onClick={() => setViewMode("dual")}
            className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === "dual"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Split Dual Canvas Mode"
          >
            <Columns className="w-3.5 h-3.5 text-sky-600" />
            <span className="hidden sm:inline">Dual Canvas</span>
          </button>
          <button
            onClick={() => setViewMode("doc")}
            className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === "doc"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Full Document Editor"
          >
            <FileText className="w-3.5 h-3.5 text-sky-600" />
            <span className="hidden sm:inline">Doc Mode</span>
          </button>
          <button
            onClick={() => setViewMode("canvas")}
            className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === "canvas"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Full Spatial Canvas"
          >
            <Move className="w-3.5 h-3.5 text-sky-600" />
            <span className="hidden sm:inline">Spatial Canvas</span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetSession}
            className="text-xs text-slate-600 hover:text-slate-900 hidden md:flex items-center gap-1"
            title="Clear workspace session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Session</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLoadSampleTemplate}
            className="text-xs text-sky-600 hover:text-sky-700 hover:bg-sky-50 hidden lg:flex items-center gap-1"
            title="Load sample template optionally"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Template</span>
          </Button>

          <Button asChild variant="ghost" size="sm" className="text-xs text-slate-700">
            <Link href="/login">
              Sign In
            </Link>
          </Button>

          <Button asChild variant="glow" size="sm" className="text-xs font-semibold shadow-xs">
            <Link href="/register">
              <span>Create Workspace</span>
              <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Demo Sandbox Notice Banner */}
      {showBanner && (
        <div className="bg-sky-50 border-b border-sky-200 px-4 py-2 flex items-center justify-between text-xs text-sky-900 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-600 flex-shrink-0" />
            <span>
              <strong>Interactive Demo Session:</strong> Test the editor and canvas in this local sandbox.
              To save documents permanently and collaborate in real time with teammates,{" "}
              <Link href="/register" className="font-semibold underline hover:text-sky-950">
                create a free workspace &rarr;
              </Link>
            </span>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            className="p-1 text-sky-600 hover:text-sky-900 rounded"
            title="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT PANE: Document Editor */}
        {(viewMode === "dual" || viewMode === "doc") && (
          <div
            className={`bg-white border-r border-slate-200 flex flex-col overflow-y-auto ${
              viewMode === "doc" ? "w-full" : "w-full lg:w-1/2"
            }`}
          >
            <div className={`p-6 sm:p-10 space-y-6 ${viewMode === "doc" ? "max-w-4xl mx-auto" : ""}`}>
              {/* Document Header & Title Input */}
              <div className="space-y-3 pb-4 border-b border-slate-100">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Document Editor</span>
                  <span>{blocks.length} {blocks.length === 1 ? "block" : "blocks"}</span>
                </div>

                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Untitled Document"
                  className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-sky-500 rounded px-1 -mx-1 placeholder:text-slate-300"
                />
              </div>

              {/* Block Formatting Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <button
                  onClick={() => handleAddBlock("heading")}
                  className="px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-white hover:shadow-xs transition-all flex items-center gap-1"
                >
                  <Heading className="w-3.5 h-3.5 text-sky-600" />
                  <span>Heading</span>
                </button>
                <button
                  onClick={() => handleAddBlock("text")}
                  className="px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-white hover:shadow-xs transition-all flex items-center gap-1"
                >
                  <AlignLeft className="w-3.5 h-3.5 text-sky-600" />
                  <span>Text</span>
                </button>
                <button
                  onClick={() => handleAddBlock("todo")}
                  className="px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-white hover:shadow-xs transition-all flex items-center gap-1"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-sky-600" />
                  <span>Checklist</span>
                </button>
                <button
                  onClick={() => handleAddBlock("callout")}
                  className="px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-white hover:shadow-xs transition-all flex items-center gap-1"
                >
                  <Info className="w-3.5 h-3.5 text-sky-600" />
                  <span>Callout</span>
                </button>
                <button
                  onClick={() => handleAddBlock("code")}
                  className="px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-white hover:shadow-xs transition-all flex items-center gap-1"
                >
                  <Code className="w-3.5 h-3.5 text-sky-600" />
                  <span>Code</span>
                </button>
              </div>

              {/* Document Blocks List or Clean Empty State */}
              {blocks.length === 0 ? (
                <div className="py-16 px-4 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto shadow-xs">
                    <FileText className="w-6 h-6 text-sky-500" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-slate-800">
                      Start writing your document...
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Add headings, paragraphs, checklists, or code blocks to organize your ideas.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddBlock("heading")}
                      className="text-xs bg-white text-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Heading
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddBlock("text")}
                      className="text-xs bg-white text-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Paragraph
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddBlock("todo")}
                      className="text-xs bg-white text-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Checklist
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {blocks.map((block) => (
                    <div
                      key={block.id}
                      className="group/block relative flex items-start gap-2.5 rounded-xl transition-all"
                    >
                      {/* Block Type Display */}
                      {block.type === "heading" && (
                        <div className="w-full flex items-center gap-2">
                          <input
                            type="text"
                            value={block.content}
                            onChange={(e) => handleUpdateBlockContent(block.id, e.target.value)}
                            placeholder="Heading..."
                            className="w-full text-lg sm:text-xl font-bold text-slate-900 border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-sky-500 rounded px-1"
                          />
                        </div>
                      )}

                      {block.type === "text" && (
                        <div className="w-full">
                          <textarea
                            value={block.content}
                            onChange={(e) => handleUpdateBlockContent(block.id, e.target.value)}
                            placeholder="Type paragraph text..."
                            rows={2}
                            className="w-full text-xs sm:text-sm text-slate-700 border-none bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-sky-500 rounded p-1 leading-relaxed"
                          />
                        </div>
                      )}

                      {block.type === "todo" && (
                        <div className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/60 border border-slate-200">
                          <button
                            onClick={() => handleToggleTodo(block.id)}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {block.checked ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <UncheckedCircle className="w-4 h-4 text-slate-300" />
                            )}
                          </button>
                          <input
                            type="text"
                            value={block.content}
                            onChange={(e) => handleUpdateBlockContent(block.id, e.target.value)}
                            placeholder="Checklist task..."
                            className={`flex-1 text-xs sm:text-sm border-none bg-transparent focus:outline-none ${
                              block.checked ? "line-through text-slate-400" : "text-slate-800"
                            }`}
                          />
                        </div>
                      )}

                      {block.type === "callout" && (
                        <div className="w-full p-3.5 rounded-xl bg-sky-50/80 border border-sky-200 text-xs sm:text-sm text-sky-900 flex items-start gap-2.5">
                          <Info className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                          <textarea
                            value={block.content}
                            onChange={(e) => handleUpdateBlockContent(block.id, e.target.value)}
                            placeholder="Callout note..."
                            rows={2}
                            className="w-full bg-transparent border-none text-sky-950 focus:outline-none resize-none leading-relaxed text-xs sm:text-sm"
                          />
                        </div>
                      )}

                      {block.type === "code" && (
                        <div className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs">
                          <textarea
                            value={block.content}
                            onChange={(e) => handleUpdateBlockContent(block.id, e.target.value)}
                            placeholder="// Enter code here..."
                            rows={3}
                            className="w-full bg-transparent border-none text-slate-200 font-mono text-xs focus:outline-none resize-none leading-relaxed"
                          />
                        </div>
                      )}

                      {/* Delete block button */}
                      <button
                        onClick={() => handleDeleteBlock(block.id)}
                        className="opacity-0 group-hover/block:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-opacity self-center shrink-0"
                        title="Delete block"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* RIGHT PANE: Spatial Canvas & Whiteboard */}
        {(viewMode === "dual" || viewMode === "canvas") && (
          <div
            className={`bg-slate-50 relative flex flex-col overflow-hidden ${
              viewMode === "canvas" ? "w-full" : "w-full lg:w-1/2"
            }`}
          >
            {/* Canvas Control Toolbar */}
            <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
              {/* Tool Selection Buttons */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md pointer-events-auto">
                <button
                  onClick={() => setActiveTool("select")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    activeTool === "select"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                  title="Select & Move Notes"
                >
                  <MousePointer2 className="w-3.5 h-3.5" />
                  <span>Select</span>
                </button>

                <button
                  onClick={() => handleAddSticky(0)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                  title="Add Sticky Note"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-500" />
                  <span>+ Sticky</span>
                </button>

                <button
                  onClick={() => setActiveTool("pen")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    activeTool === "pen"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                  title="Freehand Pen Tool"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Draw</span>
                </button>
              </div>

              {/* Pen Settings & Zoom Controls */}
              <div className="flex items-center gap-2 pointer-events-auto">
                {activeTool === "pen" && (
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md">
                    {["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#000000"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setPenColor(c)}
                        className={`w-5 h-5 rounded-full border-2 transition-transform ${
                          penColor === c ? "scale-110 border-slate-900" : "border-white"
                        }`}
                        style={{ backgroundColor: c }}
                        title={`Color: ${c}`}
                      />
                    ))}
                    <button
                      onClick={() => setStrokes([])}
                      className="px-2 py-1 text-[11px] text-slate-500 hover:text-rose-600 transition-colors ml-1 font-mono"
                      title="Clear drawing strokes"
                    >
                      Clear
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1 p-1 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-mono text-slate-600 px-1 font-medium">
                    {zoomLevel}%
                  </span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(200, z + 10))}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(100)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    title="Reset Zoom"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Canvas Interactive Surface */}
            <div
              className="flex-1 w-full h-full relative overflow-hidden bg-dot-pattern"
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: "top left",
              }}
            >
              {/* HTML5 Canvas Layer for Freehand Pen Drawing */}
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDownCanvas}
                onPointerMove={handlePointerMoveCanvas}
                onPointerUp={handlePointerUpCanvas}
                className={`absolute inset-0 w-full h-full ${
                  activeTool === "pen" ? "cursor-crosshair z-10" : "pointer-events-none z-0"
                }`}
              />

              {/* Clean Empty State Overlay when no notes or strokes exist */}
              {stickies.length === 0 && strokes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 p-4">
                  <div className="p-8 rounded-3xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl text-center max-w-sm space-y-4 pointer-events-auto">
                    <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center mx-auto shadow-xs">
                      <Move className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-slate-900">
                        Start creating on your canvas...
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Add sticky notes, sketch diagrams, or draw freehand ideas on an infinite spatial surface.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2.5 pt-1">
                      <Button
                        size="sm"
                        variant="glow"
                        onClick={() => handleAddSticky(0)}
                        className="text-xs"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        <span>Add Sticky Note</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveTool("pen")}
                        className="text-xs bg-white text-slate-700"
                      >
                        <PenTool className="w-3.5 h-3.5 mr-1" />
                        <span>Draw Freehand</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Interactive Sticky Notes */}
              {stickies.map((sticky) => (
                <div
                  key={sticky.id}
                  onPointerDown={(e) => handleStickyPointerDown(sticky.id, e)}
                  style={{
                    transform: `translate3d(${sticky.x}px, ${sticky.y}px, 0) rotate(${sticky.rotation}deg)`,
                  }}
                  className={`absolute w-52 p-4 rounded-2xl border ${sticky.color} ${sticky.border} ${sticky.textColor} shadow-lg cursor-grab active:cursor-grabbing transition-shadow z-20 group`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-black/10 text-[10px] font-mono">
                    <span className="font-semibold">{sticky.author}</span>
                    <button
                      onClick={(e) => handleDeleteSticky(sticky.id, e)}
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-600 transition-opacity p-0.5"
                      title="Delete note"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <textarea
                    value={sticky.text}
                    onChange={(e) => {
                      const newText = e.target.value;
                      setStickies((prev) =>
                        prev.map((s) => (s.id === sticky.id ? { ...s, text: newText } : s))
                      );
                    }}
                    className="w-full bg-transparent border-none resize-none text-xs leading-relaxed mt-2 focus:outline-none font-medium h-16"
                  />

                  <div className="flex items-center justify-between pt-1 text-[9px] font-mono opacity-60">
                    <span>Drag to move</span>
                    <span>✎ Click to edit</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Canvas Status Footer */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-mono z-10 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Spatial Canvas • Interactive Sandbox</span>
              </div>
              <div className="flex items-center gap-3">
                <span>{stickies.length} Notes</span>
                <span>•</span>
                <span>{strokes.length} Drawings</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
