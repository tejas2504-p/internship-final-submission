"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  LayoutGrid,
  PenTool,
  Users,
  ArrowRight,
  CheckCircle2,
  Circle,
  MessageSquare,
  Plus,
  Sparkles,
  MoveRight,
  Layers,
  FilePlus2,
  Shapes,
  Palette,
  Maximize2,
  Smile,
  Check,
  MousePointer2,
  Square,
  Diamond,
  GitBranch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function CollaborationStudio() {
  // Interactive state for Card 1 (Document Studio)
  const [docTasks, setDocTasks] = React.useState([
    { id: 1, text: "Product requirements specification", done: true },
    { id: 2, text: "Technical architecture review", done: true },
    { id: 3, text: "Launch readiness checklist", done: false },
  ]);

  // Interactive state for Card 2 (Spatial Canvas)
  const [selectedCanvasNode, setSelectedCanvasNode] = React.useState<string | null>("auth");

  // Interactive state for Card 3 (Sketchboard)
  const [activeSketchColor, setActiveSketchColor] = React.useState<string>("#3b82f6");

  // Interactive state for Card 4 (Live Collaboration)
  const [commentLiked, setCommentLiked] = React.useState<boolean>(false);

  // Active workflow step state
  const [activeWorkflowStep, setActiveWorkflowStep] = React.useState<number>(1);

  const toggleDocTask = (id: number) => {
    setDocTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  return (
    <section id="features-studio" className="py-20 md:py-32 relative overflow-hidden bg-white">
      <div id="demo" className="sr-only" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <Badge variant="brand" size="md" className="mb-4">
            <Sparkles className="w-3.5 h-3.5 mr-1 text-sky-500" />
            Interactive Collaboration Studio
          </Badge>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
            One Platform. <br className="hidden sm:inline" />
            Every Way to Collaborate.
          </h2>
          <p className="mt-5 text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            From structured documents to visual brainstorming, SyncSpace brings your team&apos;s ideas, workflows, and collaboration together in one connected workspace.
          </p>
        </div>

        {/* Bento Grid: Four Large Interactive Feature Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Card 1: Document Studio */}
          <div className="group rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-xl hover:border-sky-300 transition-all duration-300">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight group-hover:text-sky-600 transition-colors">
                      Document Studio
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Create structured documents with rich-text editing, blocks, and checklists.
                    </p>
                  </div>
                </div>
              </div>

              {/* Visual Preview Window */}
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 sm:p-5 relative overflow-hidden shadow-inner">
                {/* Editor Bar */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/70 text-xs">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                    <span className="font-bold text-slate-900 px-1.5 py-0.5 rounded bg-white border border-slate-200">H1</span>
                    <span className="font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200">B</span>
                    <span className="italic px-1.5 py-0.5 rounded bg-white border border-slate-200">I</span>
                    <span className="underline px-1.5 py-0.5 rounded bg-white border border-slate-200">U</span>
                  </div>
                  <div className="flex items-center -space-x-1.5">
                    <div className="w-6 h-6 rounded-full bg-sky-500 border-2 border-white text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                      SC
                    </div>
                    <div className="w-6 h-6 rounded-full bg-purple-500 border-2 border-white text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                      AR
                    </div>
                  </div>
                </div>

                {/* Document Body */}
                <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs space-y-3">
                  <h4 className="text-base font-bold text-slate-900">
                    Small business collaboration
                  </h4>

                  {/* Colored Block Accents */}
                  <div className="h-2 w-28 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500" />
                  <div className="h-2 w-44 rounded-full bg-slate-200" />

                  {/* Interactive Checklist */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    {docTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => toggleDocTask(task.id)}
                        className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                          task.done ? "text-slate-400 line-through bg-slate-50" : "text-slate-700 hover:bg-sky-50/50"
                        }`}
                      >
                        {task.done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                        <span>{task.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="pt-6 flex items-center justify-between border-t border-slate-100 mt-6">
              <span className="text-xs text-slate-400 font-mono">Structured Block Editor</span>
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors group/link"
              >
                <span>Explore Document Studio</span>
                <ArrowRight className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Card 2: Spatial Canvas */}
          <div className="group rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-xl hover:border-sky-300 transition-all duration-300">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                    <GitBranch className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight group-hover:text-sky-600 transition-colors">
                      Spatial Canvas
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Build diagrams, connect ideas, and visualize workflows.
                    </p>
                  </div>
                </div>
              </div>

              {/* Visual Preview Window */}
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-dot-pattern bg-slate-50/70 p-4 sm:p-5 relative overflow-hidden shadow-inner min-h-[220px]">
                {/* Flowchart Diagram */}
                <div className="flex flex-col items-center justify-center py-2 space-y-3">
                  {/* Top Node */}
                  <div
                    onClick={() => setSelectedCanvasNode("signup")}
                    className={`px-4 py-2 rounded-xl bg-white border text-xs font-semibold shadow-xs cursor-pointer transition-all ${
                      selectedCanvasNode === "signup" ? "border-sky-500 ring-2 ring-sky-300 text-sky-700 scale-105" : "border-slate-200 text-slate-800"
                    }`}
                  >
                    Sign-up request
                  </div>

                  {/* SVG Connector Branch */}
                  <svg className="w-48 h-8 text-slate-400 -my-1" viewBox="0 0 192 32" fill="none">
                    <path d="M 96 0 L 96 16 L 32 16 L 32 32 M 96 16 L 160 16 L 160 32" stroke="currentColor" strokeWidth="1.5" />
                  </svg>

                  {/* Child Branches */}
                  <div className="flex items-center gap-6">
                    <div
                      onClick={() => setSelectedCanvasNode("db")}
                      className={`px-3 py-2 rounded-xl bg-white border text-[11px] font-medium shadow-xs cursor-pointer transition-all ${
                        selectedCanvasNode === "db" ? "border-sky-500 ring-2 ring-sky-300 text-sky-700 scale-105" : "border-slate-200 text-slate-700"
                      }`}
                    >
                      User Database
                    </div>

                    <div
                      onClick={() => setSelectedCanvasNode("auth")}
                      className={`px-3 py-2 rounded-xl bg-white border text-[11px] font-medium shadow-xs cursor-pointer transition-all ${
                        selectedCanvasNode === "auth" ? "border-sky-500 ring-2 ring-sky-300 text-sky-700 scale-105" : "border-slate-200 text-slate-700"
                      }`}
                    >
                      Auth Provider
                    </div>
                  </div>
                </div>

                {/* Floating Properties Badge on Canvas */}
                <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] font-mono text-slate-500 shadow-xs">
                  <span>Zoom: 100% • 3 nodes</span>
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="pt-6 flex items-center justify-between border-t border-slate-100 mt-6">
              <span className="text-xs text-slate-400 font-mono">Infinite Visual Whiteboard</span>
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors group/link"
              >
                <span>Explore Spatial Canvas</span>
                <ArrowRight className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Card 3: Sketchboard */}
          <div className="group rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-xl hover:border-sky-300 transition-all duration-300">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                    <PenTool className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight group-hover:text-sky-600 transition-colors">
                      Sketchboard
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Draw freely, create wireframes, and brainstorm visually.
                    </p>
                  </div>
                </div>
              </div>

              {/* Visual Preview Window */}
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 relative overflow-hidden shadow-inner min-h-[220px]">
                {/* Sketchboard Tools */}
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    {["#ef4444", "#3b82f6", "#10b981", "#f59e0b"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setActiveSketchColor(c)}
                        className={`w-4 h-4 rounded-full transition-transform ${
                          activeSketchColor === c ? "scale-125 ring-2 ring-slate-400 ring-offset-1" : "hover:scale-110"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Vector Wireframing</span>
                </div>

                {/* Hand-Drawn Style Wireframe Layout */}
                <div className="border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50/40 relative">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 pb-2 border-b border-slate-200">
                    <span>User Dashboard</span>
                    <span className="text-[9px] bg-slate-200 px-1.5 py-0.5 rounded">v1.0</span>
                  </div>

                  {/* Wireframe Mock Cards */}
                  <div className="grid grid-cols-3 gap-2 mt-2.5">
                    <div className="h-12 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-[10px] text-slate-400 font-mono">
                      [ Hero ]
                    </div>
                    <div className="h-12 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-[10px] text-slate-400 font-mono">
                      [ Stats ]
                    </div>
                    <div className="h-12 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-[10px] text-slate-400 font-mono">
                      [ Actions ]
                    </div>
                  </div>

                  {/* Pinned Sticky Note on Wireframe */}
                  <div className="mt-2.5 p-2 rounded-lg bg-amber-100/90 border border-amber-300/80 text-[10px] text-amber-900 shadow-xs -rotate-1 max-w-[240px]">
                    &ldquo;Review mobile breakpoint spacing before release&rdquo;
                  </div>
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="pt-6 flex items-center justify-between border-t border-slate-100 mt-6">
              <span className="text-xs text-slate-400 font-mono">Freehand Wireframes &amp; Shapes</span>
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors group/link"
              >
                <span>Explore Sketchboard</span>
                <ArrowRight className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Card 4: Live Collaboration */}
          <div className="group rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-xl hover:border-sky-300 transition-all duration-300">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight group-hover:text-sky-600 transition-colors">
                      Live Collaboration
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Work together with shared editing, comments, and presence.
                    </p>
                  </div>
                </div>
              </div>

              {/* Visual Preview Window */}
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 sm:p-5 relative overflow-hidden shadow-inner min-h-[220px]">
                {/* Browser Tab Header */}
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200/70 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-semibold text-slate-800 text-xs">Onboarding screens</span>
                  </div>
                  <div className="flex items-center -space-x-1.5">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                      MC
                    </div>
                    <div className="w-6 h-6 rounded-full bg-sky-500 border-2 border-white text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                      SC
                    </div>
                  </div>
                </div>

                {/* Live Threaded Comment Card */}
                <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-bold flex items-center justify-center">
                        M
                      </div>
                      <span className="text-xs font-semibold text-slate-900">Maya Chen</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">2m ago</span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed pl-7">
                    &ldquo;Can you share the wireframe link here for the design review?&rdquo;
                  </p>

                  <div className="pt-2 pl-7 flex items-center gap-3">
                    <button
                      onClick={() => setCommentLiked(!commentLiked)}
                      className={`text-[11px] font-medium flex items-center gap-1 transition-colors ${
                        commentLiked ? "text-sky-600 font-bold" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Smile className="w-3 h-3" />
                      <span>{commentLiked ? "1 reaction" : "React"}</span>
                    </button>
                    <span className="text-[11px] text-slate-400 cursor-pointer hover:text-slate-600">
                      Reply...
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="pt-6 flex items-center justify-between border-t border-slate-100 mt-6">
              <span className="text-xs text-slate-400 font-mono">Real-Time Presence &amp; Threads</span>
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors group/link"
              >
                <span>Explore Live Collaboration</span>
                <ArrowRight className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* Caption Below Feature Cards */}
        <p className="text-center text-xs sm:text-sm font-medium text-slate-400 mt-10 font-mono">
          One connected workspace for your entire team.
        </p>

        {/* Section 4: Interactive Workflow ("From Ideas to Execution") */}
        <div className="mt-16 sm:mt-24 rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-sm relative overflow-hidden">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              From Ideas to Execution
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 font-normal">
              A simple visual explanation of the SyncSpace workflow.
            </p>
          </div>

          {/* Horizontal 4-Step Connected Workflow */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Step 1: Create */}
            <div
              onClick={() => setActiveWorkflowStep(1)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 group ${
                activeWorkflowStep === 1
                  ? "bg-sky-50/50 border-sky-300 shadow-sm ring-1 ring-sky-300"
                  : "bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm shadow-xs">
                  <FilePlus2 className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono font-bold text-slate-400 group-hover:text-sky-600 transition-colors">
                  01
                </span>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Create</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Start a document or team workspace with structured rich-text blocks.
                </p>
              </div>
            </div>

            {/* Step 2: Visualize */}
            <div
              onClick={() => setActiveWorkflowStep(2)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 group ${
                activeWorkflowStep === 2
                  ? "bg-sky-50/50 border-sky-300 shadow-sm ring-1 ring-sky-300"
                  : "bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm shadow-xs">
                  <Shapes className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono font-bold text-slate-400 group-hover:text-purple-600 transition-colors">
                  02
                </span>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Visualize</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Build diagrams and organize ideas freely on the infinite spatial canvas.
                </p>
              </div>
            </div>

            {/* Step 3: Collaborate */}
            <div
              onClick={() => setActiveWorkflowStep(3)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 group ${
                activeWorkflowStep === 3
                  ? "bg-sky-50/50 border-sky-300 shadow-sm ring-1 ring-sky-300"
                  : "bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shadow-xs">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono font-bold text-slate-400 group-hover:text-emerald-600 transition-colors">
                  03
                </span>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Collaborate</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Work together with real-time peer editing, shared presence, and comments.
                </p>
              </div>
            </div>

            {/* Step 4: Organize */}
            <div
              onClick={() => setActiveWorkflowStep(4)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 group ${
                activeWorkflowStep === 4
                  ? "bg-sky-50/50 border-sky-300 shadow-sm ring-1 ring-sky-300"
                  : "bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm shadow-xs">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono font-bold text-slate-400 group-hover:text-amber-600 transition-colors">
                  04
                </span>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Organize</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Keep documents, boards, and team discussions permanently connected.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Retain alias export for backwards compatibility
export const InteractivePreview = CollaborationStudio;
