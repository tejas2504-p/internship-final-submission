"use client";

import * as React from "react";
import {
  Users2,
  FileEdit,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Smile,
  Check,
  Lock,
  Plus,
  Minus,
  Move,
  PenTool,
  Download,
  Square,
  StickyNote,
  Maximize2,
  FolderKanban,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function Features() {
  // Accordion state matching core capabilities
  const [openAccordion, setOpenAccordion] = React.useState<number | null>(0);

  // Interactive state for Comments Card
  const [commentResolved, setCommentResolved] = React.useState(false);
  const [commentReactions, setCommentReactions] = React.useState(4);
  const [hasReacted, setHasReacted] = React.useState(false);

  // Interactive state for Permissions Card
  const [selectedRole, setSelectedRole] = React.useState<"Admin" | "Editor" | "Viewer">("Editor");

  // Interactive state for Rich-Text block type switcher
  const [activeBlockType, setActiveBlockType] = React.useState<"heading" | "todo" | "callout" | "code">("heading");

  // Interactive state for Sketchboard tools
  const [activeSketchTool, setActiveSketchTool] = React.useState<"draw" | "rectangle" | "sticky" | "connector">("draw");

  // Interactive state for Canvas zoom
  const [canvasZoom, setCanvasZoom] = React.useState<"100%" | "150%" | "75%">("100%");

  const handleToggleReaction = () => {
    if (hasReacted) {
      setCommentReactions((prev) => prev - 1);
      setHasReacted(false);
    } else {
      setCommentReactions((prev) => prev + 1);
      setHasReacted(true);
    }
  };

  const capabilities = [
    {
      id: "01",
      title: "Dual-Engine Workspace Architecture",
      tag: "Spatial Canvas × Docs",
      summary: "Draft structured hierarchical documents and diagram spatial UI systems side-by-side in one unified workspace without context switching.",
      details: "Unified workspace models keep document blocks and spatial whiteboard nodes organized within the same project. Work seamlessly across text, diagrams, and visual boards.",
    },
    {
      id: "02",
      title: "Real-Time Yjs Synchronization",
      tag: "Yjs + WebSockets",
      summary: "High-performance collaborative synchronization powered by Yjs CRDTs and WebSockets, keeping all participants continuously aligned.",
      details: "Binary delta updates stream over persistent WebSocket connections to sync changes immediately across all connected teammates, handling simultaneous edits smoothly.",
    },
    {
      id: "03",
      title: "Infinite Canvas & Vector Sketchboard",
      tag: "Hardware Accelerated",
      summary: "Freeform visual collaboration with smooth pan, zoom, geometric shapes, sticky notes, connectors, and export capabilities.",
      details: "Engineered with coordinate-space transforms that maintain sharp rendering at any zoom level, complete with PNG and SVG board export for documentation and presentations.",
    },
    {
      id: "04",
      title: "Workspace Permissions & Access Control",
      tag: "Role-Based Security",
      summary: "Granular access hierarchies enforcing strict permission policies across workspaces, documents, and whiteboard sessions.",
      details: "Protected by session authentication and server-side validation. Dedicated Admin, Editor, and Viewer permission levels protect your organization's work.",
    },
  ];

  const rolePermissions = {
    Admin: [
      { text: "Full workspace & member management", allowed: true },
      { text: "Invite, promote, or remove collaborators", allowed: true },
      { text: "Create, edit, and delete documents & sketchboards", allowed: true },
      { text: "Revert version history snapshots", allowed: true },
    ],
    Editor: [
      { text: "Full workspace & member management", allowed: false },
      { text: "Invite, promote, or remove collaborators", allowed: false },
      { text: "Create, edit, and delete documents & sketchboards", allowed: true },
      { text: "Leave comments and mention teammates", allowed: true },
    ],
    Viewer: [
      { text: "Full workspace & member management", allowed: false },
      { text: "Edit documents or sketchboard nodes", allowed: false },
      { text: "Read-only access to documents & sketchboard", allowed: true },
      { text: "Export boards to PNG, SVG, or Markdown", allowed: true },
    ],
  };

  return (
    <section id="features" className="py-24 md:py-36 relative bg-white border-t border-slate-200 overflow-hidden">
      {/* Background ambient sunset glows */}
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-gradient-to-b from-sky-100/40 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-0 w-[450px] h-[450px] bg-gradient-to-tr from-blue-100/40 to-transparent rounded-full blur-[130px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 md:mb-24 gap-6 pb-8 border-b border-slate-200">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-xs font-mono text-sky-700 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
              <span>Core Features</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.1]">
              Engineered for velocity. <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600">
                Built for modern teams.
              </span>
            </h2>
          </div>
          <p className="text-sm sm:text-base text-slate-600 max-w-md leading-relaxed">
            Everything your team needs to plan, design, and execute together: live co-authoring, modular rich-text, infinite spatial whiteboards, vector sketching, and organized workspaces.
          </p>
        </div>

        {/* Capabilities Accordion */}
        <div className="mb-24">
          <div className="flex items-center justify-between mb-6">
            <div className="text-xs font-mono uppercase tracking-widest text-slate-500">
              (Platform Capabilities)
            </div>
            <div className="text-xs font-mono text-sky-600 font-medium">
              01 — 04
            </div>
          </div>

          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {capabilities.map((item, idx) => {
              const isOpen = openAccordion === idx;
              return (
                <div
                  key={item.id}
                  className="group transition-colors duration-200"
                >
                  <button
                    onClick={() => setOpenAccordion(isOpen ? null : idx)}
                    className="w-full py-6 sm:py-8 flex items-center justify-between text-left focus:outline-none"
                  >
                    <div className="flex items-baseline gap-4 sm:gap-8">
                      <span className="font-mono text-xs sm:text-sm text-slate-400 group-hover:text-sky-600 transition-colors">
                        {item.id}
                      </span>
                      <div>
                        <h3 className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 mt-1 line-clamp-1 sm:line-clamp-none">
                          {item.summary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                      <span className="hidden md:inline-block text-xs font-mono px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
                        {item.tag}
                      </span>
                      <div className="w-8 h-8 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 group-hover:text-slate-900 group-hover:border-sky-500/40 group-hover:bg-sky-50 transition-all">
                        {isOpen ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="pb-8 pt-2 pl-8 sm:pl-16 text-sm text-slate-600 leading-relaxed max-w-3xl animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                        {item.details}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Implemented Feature Grid: 6 Real Implemented Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Card 1: Real-Time Collaboration */}
          <Card className="flex flex-col justify-between group bg-white border border-slate-200/90 shadow-xs hover:border-sky-400/60 hover:shadow-lg transition-all duration-300 rounded-2xl">
            <div>
              <CardHeader className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-600">
                    <Users2 className="w-5 h-5" />
                  </div>
                  <Badge variant="brand" size="sm">
                    Multiplayer
                  </Badge>
                </div>
                <CardTitle className="text-xl font-bold text-slate-900">Real-Time Collaboration</CardTitle>
                <CardDescription className="text-slate-600 text-xs sm:text-sm mt-1.5 leading-relaxed">
                  Work together simultaneously on documents, canvases, and sketchboards. Follow live collaborator cursors and view active participants in real time.
                </CardDescription>
              </CardHeader>

              {/* Interactive Mini Demo */}
              <CardContent className="px-6 pb-4 pt-0">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-3">
                  <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                    <span>ACTIVE COLLABORATORS</span>
                    <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      3 Online Now
                    </span>
                  </div>

                  {/* Active collaborators list */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200 shadow-xs">
                      <div className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-xs" />
                      <span className="font-semibold text-slate-800">Sarah Chen</span>
                      <span className="text-slate-500 text-[11px]">• Editing block #4</span>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200 shadow-xs">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-xs" />
                      <span className="font-semibold text-slate-800">Alex Rivera</span>
                      <span className="text-slate-500 text-[11px]">• Drawing on Sketchboard</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </div>

            <div className="px-6 pb-6 pt-2">
              <div className="text-xs text-sky-600 font-medium flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                <span>Multiplayer cursor presence & live edits</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Card>

          {/* Card 2: Rich-Text Document Editor */}
          <Card className="flex flex-col justify-between group bg-white border border-slate-200/90 shadow-xs hover:border-sky-400/60 hover:shadow-lg transition-all duration-300 rounded-2xl">
            <div>
              <CardHeader className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600">
                    <FileEdit className="w-5 h-5" />
                  </div>
                  <Badge variant="cyan" size="sm">
                    Block Editor
                  </Badge>
                </div>
                <CardTitle className="text-xl font-bold text-slate-900">Rich-Text Document Editor</CardTitle>
                <CardDescription className="text-slate-600 text-xs sm:text-sm mt-1.5 leading-relaxed">
                  Modular block editing with headings, task lists, code snippets, and callouts. Structure team knowledge, specs, and meeting notes effortlessly.
                </CardDescription>
              </CardHeader>

              {/* Interactive Mini Demo */}
              <CardContent className="px-6 pb-4 pt-0">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-3">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-mono text-[11px]">BLOCK TYPE:</span>
                    <span className="text-[10px] text-sky-600 font-mono">Click to toggle</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-slate-200/60 border border-slate-200">
                    {(["heading", "todo", "callout", "code"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setActiveBlockType(type)}
                        className={`py-1 text-[11px] rounded font-medium capitalize transition-all ${
                          activeBlockType === type
                            ? "bg-slate-900 text-white font-semibold shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  {/* Rendered block preview */}
                  <div className="p-3 rounded-lg bg-white border border-slate-200 min-h-[56px] flex items-center shadow-xs">
                    {activeBlockType === "heading" && (
                      <div className="text-sm font-bold text-slate-900">
                        # Product Spec: Real-Time Engine
                      </div>
                    )}
                    {activeBlockType === "todo" && (
                      <div className="flex items-center gap-2 text-slate-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Synchronize collaborative edits</span>
                      </div>
                    )}
                    {activeBlockType === "callout" && (
                      <div className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded border border-amber-200 w-full">
                        💡 <strong>Tip:</strong> Press &apos;/&apos; anywhere to summon blocks
                      </div>
                    )}
                    {activeBlockType === "code" && (
                      <code className="font-mono text-[11px] text-amber-800 bg-slate-100 p-1.5 rounded border border-slate-200 w-full">
                        const doc = useSyncSpaceDoc(docId);
                      </code>
                    )}
                  </div>
                </div>
              </CardContent>
            </div>

            <div className="px-6 pb-6 pt-2">
              <div className="text-xs text-amber-700 font-medium flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                <span>Slash commands &amp; markdown shortcuts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Card>

          {/* Card 3: Infinite Collaborative Canvas */}
          <Card className="flex flex-col justify-between group bg-white border border-slate-200/90 shadow-xs hover:border-sky-400/60 hover:shadow-lg transition-all duration-300 rounded-2xl">
            <div>
              <CardHeader className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600">
                    <Move className="w-5 h-5" />
                  </div>
                  <Badge variant="brand" size="sm">
                    Spatial Board
                  </Badge>
                </div>
                <CardTitle className="text-xl font-bold text-slate-900">Infinite Collaborative Canvas</CardTitle>
                <CardDescription className="text-slate-600 text-xs sm:text-sm mt-1.5 leading-relaxed">
                  Freeform spatial whiteboard with smooth pan, zoom, and spatial sticky cards. Brainstorm architectures and user journeys side-by-side.
                </CardDescription>
              </CardHeader>

              {/* Interactive Mini Demo */}
              <CardContent className="px-6 pb-4 pt-0">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-3">
                  <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                      CANVAS ZOOM:
                    </span>
                    <div className="flex items-center gap-1">
                      {(["75%", "100%", "150%"] as const).map((zoom) => (
                        <button
                          key={zoom}
                          onClick={() => setCanvasZoom(zoom)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                            canvasZoom === zoom
                              ? "bg-indigo-600 text-white font-semibold"
                              : "bg-white text-slate-600 border border-slate-200 hover:text-slate-900"
                          }`}
                        >
                          {zoom}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Canvas interactive preview */}
                  <div className="p-3 rounded-lg bg-white border border-slate-200 min-h-[56px] relative overflow-hidden flex items-center justify-center shadow-xs">
                    <div
                      className="transition-transform duration-200 flex items-center gap-3"
                      style={{
                        transform:
                          canvasZoom === "75%"
                            ? "scale(0.85)"
                            : canvasZoom === "150%"
                            ? "scale(1.15)"
                            : "scale(1)",
                      }}
                    >
                      <div className="p-2 rounded bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-medium shadow-xs">
                        📌 Architecture Map
                      </div>
                      <div className="text-slate-400 font-mono">→</div>
                      <div className="p-2 rounded bg-sky-100 border border-sky-300 text-sky-900 text-[10px] font-medium shadow-xs">
                        🚀 Sprint Deliverables
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </div>

            <div className="px-6 pb-6 pt-2">
              <div className="text-xs text-indigo-600 font-medium flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                <span>Pan, zoom &amp; freeform spatial nodes</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Card>

          {/* Card 4: Sketchboard */}
          <Card className="flex flex-col justify-between group bg-white border border-slate-200/90 shadow-xs hover:border-sky-400/60 hover:shadow-lg transition-all duration-300 rounded-2xl">
            <div>
              <CardHeader className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-600">
                    <PenTool className="w-5 h-5" />
                  </div>
                  <Badge variant="brand" size="sm">
                    Vector Whiteboard
                  </Badge>
                </div>
                <CardTitle className="text-xl font-bold text-slate-900">Sketchboard</CardTitle>
                <CardDescription className="text-slate-600 text-xs sm:text-sm mt-1.5 leading-relaxed">
                  Dedicated vector drawing whiteboard supporting freehand ink, geometric shapes, sticky notes, connectors, layer ordering, and high-resolution exports.
                </CardDescription>
              </CardHeader>

              {/* Interactive Mini Demo */}
              <CardContent className="px-6 pb-4 pt-0">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-3">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-mono text-[11px]">ACTIVE TOOL:</span>
                    <span className="text-[10px] text-purple-600 font-mono">Select tool</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-slate-200/60 border border-slate-200">
                    <button
                      onClick={() => setActiveSketchTool("draw")}
                      className={`py-1 text-[11px] rounded font-medium flex items-center justify-center gap-1 transition-all ${
                        activeSketchTool === "draw"
                          ? "bg-purple-600 text-white font-semibold shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <PenTool className="w-3 h-3" />
                      <span>Draw</span>
                    </button>
                    <button
                      onClick={() => setActiveSketchTool("rectangle")}
                      className={`py-1 text-[11px] rounded font-medium flex items-center justify-center gap-1 transition-all ${
                        activeSketchTool === "rectangle"
                          ? "bg-purple-600 text-white font-semibold shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Square className="w-3 h-3" />
                      <span>Shape</span>
                    </button>
                    <button
                      onClick={() => setActiveSketchTool("sticky")}
                      className={`py-1 text-[11px] rounded font-medium flex items-center justify-center gap-1 transition-all ${
                        activeSketchTool === "sticky"
                          ? "bg-purple-600 text-white font-semibold shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <StickyNote className="w-3 h-3" />
                      <span>Sticky</span>
                    </button>
                    <button
                      onClick={() => setActiveSketchTool("connector")}
                      className={`py-1 text-[11px] rounded font-medium flex items-center justify-center gap-1 transition-all ${
                        activeSketchTool === "connector"
                          ? "bg-purple-600 text-white font-semibold shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span>Line</span>
                    </button>
                  </div>

                  {/* Rendered tool preview */}
                  <div className="p-3 rounded-lg bg-white border border-slate-200 min-h-[56px] flex items-center justify-between shadow-xs">
                    <div className="text-xs text-slate-700">
                      {activeSketchTool === "draw" && <span>✏️ Smooth bezier vector brush active</span>}
                      {activeSketchTool === "rectangle" && <span>📐 Snappable shape with custom stroke</span>}
                      {activeSketchTool === "sticky" && <span>📝 Editable multi-color sticky note</span>}
                      {activeSketchTool === "connector" && <span>↔️ Dynamic line &amp; arrow connector</span>}
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      <Download className="w-2.5 h-2.5" /> PNG/SVG
                    </span>
                  </div>
                </div>
              </CardContent>
            </div>

            <div className="px-6 pb-6 pt-2">
              <div className="text-xs text-purple-600 font-medium flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                <span>Freehand ink, shapes &amp; PNG/SVG export</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Card>

          {/* Card 5: Comments and Discussions */}
          <Card className="flex flex-col justify-between group bg-white border border-slate-200/90 shadow-xs hover:border-sky-400/60 hover:shadow-lg transition-all duration-300 rounded-2xl">
            <div>
              <CardHeader className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-600">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <Badge variant="brand" size="sm">
                    Inline Threads
                  </Badge>
                </div>
                <CardTitle className="text-xl font-bold text-slate-900">Comments &amp; Discussions</CardTitle>
                <CardDescription className="text-slate-600 text-xs sm:text-sm mt-1.5 leading-relaxed">
                  Keep team discussions pinned to context. Post threaded comments on specific document blocks or spatial whiteboard nodes with resolution markers.
                </CardDescription>
              </CardHeader>

              {/* Interactive Mini Demo */}
              <CardContent className="px-6 pb-4 pt-0">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold text-slate-800">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                        A
                      </span>
                      <span>Alex Rivera</span>
                      <span className="text-[10px] text-slate-500 font-normal">on Block #3</span>
                    </div>

                    <button
                      onClick={() => setCommentResolved(!commentResolved)}
                      className={`text-[10px] px-2.5 py-0.5 rounded-full border transition-all ${
                        commentResolved
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold"
                          : "bg-white text-slate-600 border-slate-200 hover:text-slate-900"
                      }`}
                    >
                      {commentResolved ? "✓ Resolved" : "Mark Resolved"}
                    </button>
                  </div>

                  <p className="text-slate-700 text-xs bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                    &ldquo;Should we export the system architecture diagram before client review?&rdquo;
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={handleToggleReaction}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] transition-colors ${
                        hasReacted
                          ? "bg-sky-50 border-sky-200 text-sky-700 font-semibold"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Smile className="w-3 h-3 text-sky-500" />
                      <span>👍 {commentReactions}</span>
                    </button>
                    <span className="text-[10px] text-slate-500">1 reply from Sarah</span>
                  </div>
                </div>
              </CardContent>
            </div>

            <div className="px-6 pb-6 pt-2">
              <div className="text-xs text-sky-600 font-medium flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                <span>Threaded @mentions &amp; status resolutions</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Card>

          {/* Card 6: Workspace Management */}
          <Card className="flex flex-col justify-between group bg-white border border-slate-200/90 shadow-xs hover:border-sky-400/60 hover:shadow-lg transition-all duration-300 rounded-2xl">
            <div>
              <CardHeader className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <Badge variant="success" size="sm">
                    Access Control
                  </Badge>
                </div>
                <CardTitle className="text-xl font-bold text-slate-900">Workspace Management</CardTitle>
                <CardDescription className="text-slate-600 text-xs sm:text-sm mt-1.5 leading-relaxed">
                  Organize team collaboration across dedicated workspaces. Assign role-based permissions (Admin, Editor, Viewer) to protect shared assets.
                </CardDescription>
              </CardHeader>

              {/* Interactive Mini Demo */}
              <CardContent className="px-6 pb-4 pt-0">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-500 font-mono text-[11px]">ROLE ACCESS:</span>
                    <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-lg border border-slate-200">
                      {(["Admin", "Editor", "Viewer"] as const).map((role) => (
                        <button
                          key={role}
                          onClick={() => setSelectedRole(role)}
                          className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-all ${
                            selectedRole === role
                              ? "bg-slate-900 text-white font-semibold shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 pt-1">
                    {rolePermissions[selectedRole].slice(0, 3).map((perm, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] transition-colors ${
                          perm.allowed
                            ? "bg-white border-slate-200 text-slate-800 shadow-xs"
                            : "bg-slate-100/50 border-slate-100 text-slate-400 line-through"
                        }`}
                      >
                        {perm.allowed ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        )}
                        <span className="truncate">{perm.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </div>

            <div className="px-6 pb-6 pt-2">
              <div className="text-xs text-emerald-700 font-medium flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                <span>Multi-workspace organization &amp; RBAC</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
