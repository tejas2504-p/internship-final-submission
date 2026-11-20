"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  GitBranch,
  PenTool,
  Users,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Circle,
  Plus,
  MessageSquare,
  Search,
  Check,
  MousePointer2,
  LayoutGrid,
  Square,
  Type,
  MoveRight,
} from "lucide-react";

export function WorkflowComparison() {
  // Interactive checklist state for Card 1 (Write and document)
  const [meetingTasks, setMeetingTasks] = React.useState([
    { id: 1, text: "Implement live document synchronization", done: true },
    { id: 2, text: "Ship interactive spatial whiteboard", done: true },
    { id: 3, text: "Increase team adoption across workspaces", done: false },
    { id: 4, text: "Celebrate milestone release 🎉", done: false },
  ]);

  // Interactive selected node state for Card 2 (Map your ideas)
  const [selectedNode, setSelectedNode] = React.useState<string>("market");

  // Interactive swatches state for Card 3 (Sketch concepts)
  const [activeColor, setActiveColor] = React.useState<string>("#3b82f6");

  // Interactive project toggle for Card 4 (Collaborate live)
  const [selectedProject, setSelectedProject] = React.useState<string>("figma");

  const toggleTask = (id: number) => {
    setMeetingTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  return (
    <section id="workflow" className="py-24 md:py-36 relative bg-slate-50/50 border-t border-slate-200 overflow-hidden">
      {/* Background ambient sunset glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-sky-100/40 rounded-full blur-[160px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header matching exact prompt & screenshot */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-700 mb-4 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
            <span>Explore the possibilities</span>
          </div>

          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
            Turn ideas into organized work.
          </h2>

          <p className="mt-4 text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Create documents, visualize complex ideas, sketch concepts, and collaborate with your team in one connected workspace.
          </p>
        </div>

        {/* 2x2 Bento Grid: Four Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Card 1: Write and document */}
          <div className="group rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-xl hover:border-sky-300 transition-all duration-300">
            <div className="space-y-4">
              {/* Card Header */}
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight group-hover:text-sky-600 transition-colors">
                    Write and document
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Create structured documents, specifications, and project notes.
                  </p>
                </div>
              </div>

              {/* Visual Preview Window: Meeting Notes Document */}
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 sm:p-5 relative overflow-hidden shadow-inner">
                <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs space-y-3">
                  {/* Editor Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-[11px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-sky-500" />
                      <span>Collaborative text editor</span>
                    </span>
                    <div className="flex items-center -space-x-1.5">
                      <div className="w-5 h-5 rounded-full bg-sky-500 border border-white text-white text-[9px] font-bold flex items-center justify-center">
                        SC
                      </div>
                      <div className="w-5 h-5 rounded-full bg-purple-500 border border-white text-white text-[9px] font-bold flex items-center justify-center">
                        AR
                      </div>
                    </div>
                  </div>

                  {/* Document Title */}
                  <h4 className="text-lg font-bold text-slate-900 tracking-tight">
                    Meeting notes
                  </h4>

                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    In a collaborative text editor, people can type collectively and embed all kinds of content types together in real-time.
                  </p>

                  {/* Agenda Section */}
                  <div className="space-y-1 pt-1 text-xs text-slate-700">
                    <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider font-mono">
                      Agenda
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1 text-[11px]">
                      <li>Welcome and sprint deliverables alignment</li>
                      <li>Plan to make our workspace fully collaborative</li>
                    </ul>
                  </div>

                  {/* Next Steps Checklist */}
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                    <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider font-mono">
                      Next steps
                    </span>
                    {meetingTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => toggleTask(t.id)}
                        className={`flex items-center gap-2 text-xs cursor-pointer select-none py-0.5 transition-colors ${
                          t.done ? "text-slate-400 line-through" : "text-slate-800 hover:text-sky-600"
                        }`}
                      >
                        {t.done ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        )}
                        <span className="text-[11px]">{t.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating comment badge */}
                <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-xs px-2 py-1 rounded-full border border-slate-200 text-[10px] font-mono text-slate-600 flex items-center gap-1 shadow-xs">
                  <MessageSquare className="w-3 h-3 text-sky-500" />
                  <span>8 comments</span>
                </div>
              </div>
            </div>

            {/* Action Link */}
            <div className="pt-6 flex items-center justify-between border-t border-slate-100 mt-6">
              <span className="text-xs text-slate-400 font-mono">Rich-Text Block Studio</span>
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors group/link"
              >
                <span>Explore Feature</span>
                <ArrowRight className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Card 2: Map your ideas */}
          <div className="group rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-xl hover:border-sky-300 transition-all duration-300">
            <div className="space-y-4">
              {/* Card Header */}
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight group-hover:text-sky-600 transition-colors">
                    Map your ideas
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Build flowcharts, diagrams, and visual workflows.
                  </p>
                </div>
              </div>

              {/* Visual Preview Window: Mindmap / Spatial Canvas */}
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-dot-pattern bg-slate-50/70 p-4 sm:p-5 relative overflow-hidden shadow-inner min-h-[250px]">
                {/* Canvas Mini Bar */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pb-2 mb-2 border-b border-slate-200/60">
                  <span className="font-semibold text-slate-800">Launch Product Plan</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200">Zoom: 100%</span>
                  </div>
                </div>

                {/* Flowchart Mindmap Tree */}
                <div className="flex flex-col items-center justify-center py-2 space-y-3">
                  {/* Central Node */}
                  <div
                    onClick={() => setSelectedNode("center")}
                    className={`px-4 py-2 rounded-xl bg-white border text-xs font-bold shadow-xs cursor-pointer transition-all ${
                      selectedNode === "center"
                        ? "border-sky-500 ring-2 ring-sky-300 text-sky-700 scale-105"
                        : "border-slate-300 text-slate-900"
                    }`}
                  >
                    Launch Product Plan
                  </div>

                  {/* SVG Connector Branch */}
                  <svg className="w-64 h-8 text-slate-400 -my-1" viewBox="0 0 256 32" fill="none">
                    <path
                      d="M 128 0 L 128 16 L 32 16 L 32 32 M 128 16 L 96 16 L 96 32 M 128 16 L 160 16 L 160 32 M 128 16 L 224 16 L 224 32"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>

                  {/* Branch Nodes */}
                  <div className="grid grid-cols-4 gap-2 text-center w-full max-w-sm">
                    <div
                      onClick={() => setSelectedNode("market")}
                      className={`px-2 py-1.5 rounded-lg bg-emerald-50 border text-[10px] font-medium shadow-xs cursor-pointer transition-all ${
                        selectedNode === "market"
                          ? "border-emerald-500 ring-1 ring-emerald-400 text-emerald-800 scale-105"
                          : "border-emerald-200 text-emerald-700"
                      }`}
                    >
                      Research
                    </div>
                    <div
                      onClick={() => setSelectedNode("brand")}
                      className={`px-2 py-1.5 rounded-lg bg-purple-50 border text-[10px] font-medium shadow-xs cursor-pointer transition-all ${
                        selectedNode === "brand"
                          ? "border-purple-500 ring-1 ring-purple-400 text-purple-800 scale-105"
                          : "border-purple-200 text-purple-700"
                      }`}
                    >
                      Identity
                    </div>
                    <div
                      onClick={() => setSelectedNode("feedback")}
                      className={`px-2 py-1.5 rounded-lg bg-sky-50 border text-[10px] font-medium shadow-xs cursor-pointer transition-all ${
                        selectedNode === "feedback"
                          ? "border-sky-500 ring-1 ring-sky-400 text-sky-800 scale-105"
                          : "border-sky-200 text-sky-700"
                      }`}
                    >
                      Feedback
                    </div>
                    <div
                      onClick={() => setSelectedNode("testing")}
                      className={`px-2 py-1.5 rounded-lg bg-amber-50 border text-[10px] font-medium shadow-xs cursor-pointer transition-all ${
                        selectedNode === "testing"
                          ? "border-amber-500 ring-1 ring-amber-400 text-amber-800 scale-105"
                          : "border-amber-200 text-amber-700"
                      }`}
                    >
                      Testing
                    </div>
                  </div>
                </div>

                {/* Pinned Sticky Note on Canvas */}
                <div className="mt-3 p-2.5 rounded-lg bg-amber-100/90 border border-amber-300 text-[10px] text-amber-900 shadow-xs max-w-[260px] mx-auto -rotate-1">
                  &ldquo;Review marketing copy before launch milestone&rdquo;
                </div>
              </div>
            </div>

            {/* Action Link */}
            <div className="pt-6 flex items-center justify-between border-t border-slate-100 mt-6">
              <span className="text-xs text-slate-400 font-mono">Infinite Spatial Canvas</span>
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors group/link"
              >
                <span>Explore Feature</span>
                <ArrowRight className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Card 3: Sketch concepts */}
          <div className="group rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-xl hover:border-sky-300 transition-all duration-300">
            <div className="space-y-4">
              {/* Card Header */}
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <PenTool className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight group-hover:text-sky-600 transition-colors">
                    Sketch concepts
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Draw wireframes, add sticky notes, and brainstorm.
                  </p>
                </div>
              </div>

              {/* Visual Preview Window: Sketchboard Wireframes & Shapes */}
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 relative overflow-hidden shadow-inner min-h-[250px]">
                {/* Sketchboard Tools Header */}
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    {["#ef4444", "#3b82f6", "#10b981", "#f59e0b"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setActiveColor(c)}
                        className={`w-3.5 h-3.5 rounded-full transition-transform ${
                          activeColor === c ? "scale-125 ring-2 ring-slate-400 ring-offset-1" : "hover:scale-110"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Wireframe &amp; Notes</span>
                </div>

                {/* Wireframe Mockup Layout */}
                <div className="border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 pb-1.5 border-b border-slate-200">
                    <span className="font-semibold">High Fidelity Wireframe</span>
                    <span className="text-[9px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-medium">On Hold</span>
                  </div>

                  {/* 3 Wireframe Cards */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 rounded-lg border border-slate-300 bg-white text-center">
                      <span className="text-[10px] font-mono text-slate-500 block">[ Hero ]</span>
                      <div className="h-1.5 w-8 bg-slate-200 rounded mx-auto mt-1" />
                    </div>
                    <div className="p-2 rounded-lg border border-slate-300 bg-white text-center">
                      <span className="text-[10px] font-mono text-slate-500 block">[ Stats ]</span>
                      <div className="h-1.5 w-8 bg-slate-200 rounded mx-auto mt-1" />
                    </div>
                    <div className="p-2 rounded-lg border border-slate-300 bg-white text-center">
                      <span className="text-[10px] font-mono text-slate-500 block">[ Flow ]</span>
                      <div className="h-1.5 w-8 bg-slate-200 rounded mx-auto mt-1" />
                    </div>
                  </div>

                  {/* Wireframe Sticky Note */}
                  <div className="p-2 rounded-lg bg-rose-100/90 border border-rose-300/80 text-[10px] text-rose-900 shadow-xs rotate-1 max-w-[240px]">
                    &ldquo;Add dark mode support to spatial canvas view&rdquo;
                  </div>
                </div>
              </div>
            </div>

            {/* Action Link */}
            <div className="pt-6 flex items-center justify-between border-t border-slate-100 mt-6">
              <span className="text-xs text-slate-400 font-mono">Vector Sketchboard</span>
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors group/link"
              >
                <span>Explore Feature</span>
                <ArrowRight className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Card 4: Collaborate live */}
          <div className="group rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-xl hover:border-sky-300 transition-all duration-300">
            <div className="space-y-4">
              {/* Card Header */}
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight group-hover:text-sky-600 transition-colors">
                    Collaborate live
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Edit together, share feedback, and keep everyone aligned.
                  </p>
                </div>
              </div>

              {/* Visual Preview Window: Project Dashboard & Presence */}
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-900 text-white p-4 sm:p-5 relative overflow-hidden shadow-inner min-h-[250px]">
                {/* Header */}
                <div className="flex items-center justify-between text-xs pb-2 mb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">Dashboard</span>
                    <span className="text-[10px] text-slate-400 font-mono">10 active projects</span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live peers
                  </span>
                </div>

                {/* Project Rows */}
                <div className="space-y-2.5">
                  <div
                    onClick={() => setSelectedProject("figma")}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedProject === "figma"
                        ? "bg-slate-800/90 border-sky-500 ring-1 ring-sky-400"
                        : "bg-slate-800/40 border-slate-700/60 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">Figma Design System</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-medium border border-amber-500/30">
                        In Progress
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Progress</span>
                      <span className="text-sky-400 font-bold">80%</span>
                    </div>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                      <div className="bg-gradient-to-r from-sky-400 to-indigo-500 h-full rounded-full w-4/5" />
                    </div>
                  </div>

                  <div
                    onClick={() => setSelectedProject("mobile")}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedProject === "mobile"
                        ? "bg-slate-800/90 border-sky-500 ring-1 ring-sky-400"
                        : "bg-slate-800/40 border-slate-700/60 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">Mobile App Design</span>
                      <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-medium border border-sky-500/30">
                        Active
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Progress</span>
                      <span className="text-sky-400 font-bold">65%</span>
                    </div>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                      <div className="bg-gradient-to-r from-sky-400 to-indigo-500 h-full rounded-full w-[65%]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Link */}
            <div className="pt-6 flex items-center justify-between border-t border-slate-100 mt-6">
              <span className="text-xs text-slate-400 font-mono">Multiplayer Collaboration</span>
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors group/link"
              >
                <span>Explore Feature</span>
                <ArrowRight className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
