"use client";

import * as React from "react";
import {
  Layers,
  Database,
  Cpu,
  Lock,
  Globe,
  Radio,
  FileCode2,
  Server,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TechItem {
  name: string;
  category: "Frontend" | "Backend & Data" | "Collaboration & Auth";
  description: string;
  badge: string;
}

const TECH_STACK: TechItem[] = [
  {
    name: "Next.js 16",
    category: "Frontend",
    description: "App Router, React Server Components, and optimized API route handlers.",
    badge: "Framework",
  },
  {
    name: "React 19",
    category: "Frontend",
    description: "Modern component architecture, concurrent hooks, and UI state management.",
    badge: "UI Library",
  },
  {
    name: "TypeScript",
    category: "Frontend",
    description: "Strict end-to-end static typing across database schemas, APIs, and components.",
    badge: "Language",
  },
  {
    name: "Tailwind CSS v4",
    category: "Frontend",
    description: "Next-gen CSS framework powering the responsive, clean design system.",
    badge: "Styling",
  },
  {
    name: "Node.js",
    category: "Backend & Data",
    description: "High-throughput runtime driving API endpoints and collaboration workers.",
    badge: "Runtime",
  },
  {
    name: "PostgreSQL",
    category: "Backend & Data",
    description: "Reliable relational database with connection pooling on Neon serverless.",
    badge: "Database",
  },
  {
    name: "Prisma 7",
    category: "Backend & Data",
    description: "Declarative data modeling, automated migrations, and type-safe database queries.",
    badge: "ORM",
  },
  {
    name: "Redis",
    category: "Backend & Data",
    description: "In-memory caching and message pub/sub for real-time state delivery.",
    badge: "Cache & Queue",
  },
  {
    name: "Yjs CRDT",
    category: "Collaboration & Auth",
    description: "Conflict-free replicated data types for concurrent multi-user editing.",
    badge: "Sync Engine",
  },
  {
    name: "WebSockets",
    category: "Collaboration & Auth",
    description: "Low-latency bidirectional streaming for live cursors and document updates.",
    badge: "Protocol",
  },
  {
    name: "Better Auth",
    category: "Collaboration & Auth",
    description: "Session management, workspace role authorization, and credential protection.",
    badge: "Security",
  },
];

export function TechStackSection() {
  const [selectedCategory, setSelectedCategory] = React.useState<string>("All");

  const categories = ["All", "Frontend", "Backend & Data", "Collaboration & Auth"];

  const filteredTech =
    selectedCategory === "All"
      ? TECH_STACK
      : TECH_STACK.filter((item) => item.category === selectedCategory);

  return (
    <section id="technology" className="py-24 md:py-36 relative bg-white border-t border-slate-200 overflow-hidden">
      {/* Anchor for backward compatibility */}
      <div id="tech-stack" className="sr-only" />
      {/* Background ambient sunset glow */}
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-gradient-to-b from-sky-100/40 to-transparent rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 md:mb-20 gap-6 pb-8 border-b border-slate-200">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-xs font-mono text-sky-700 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
              <span>Technology Stack</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.1]">
              Modern, battle-tested <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600">
                engineering foundation.
              </span>
            </h2>
          </div>
          <p className="text-sm sm:text-base text-slate-600 max-w-md leading-relaxed">
            SyncSpace is built with industry-standard, production-proven technologies chosen for type safety, real-time synchronization, and high performance.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 mb-10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80"
              }`}
            >
              {cat}
            </button>
          ))}
          <span className="text-xs text-slate-400 font-mono ml-auto hidden sm:inline">
            11 verified technologies
          </span>
        </div>

        {/* Tech Stack Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredTech.map((tech) => (
            <div
              key={tech.name}
              className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-sky-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:bg-sky-50 group-hover:border-sky-200 group-hover:text-sky-600 transition-colors">
                    {tech.category === "Frontend" && <FileCode2 className="w-4 h-4" />}
                    {tech.category === "Backend & Data" && <Database className="w-4 h-4" />}
                    {tech.category === "Collaboration & Auth" && <Zap className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {tech.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                  {tech.name}
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {tech.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>{tech.category}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              </div>
            </div>
          ))}
        </div>

        {/* Architecture Summary Banner */}
        <div className="mt-14 p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 flex-shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                End-to-End Type Safety &amp; Real-Time Architecture
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                From PostgreSQL relational models via Prisma to React 19 UI components synchronized by Yjs WebSockets.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Production Ready
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
