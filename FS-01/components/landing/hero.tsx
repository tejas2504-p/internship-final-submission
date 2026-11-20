"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Floating3DOrbs } from "@/components/ui/floating-3d-orbs";

interface HeroProps {
  onGetStarted: () => void;
  onExploreFeatures?: () => void;
}

const PILL_WORDS = [
  {
    word: "Ideas",
    bg: "bg-[#f3e8ff]",
    dot: "bg-[#8b5cf6]",
    border: "border-[#e9d5ff]",
  },
  {
    word: "Designs",
    bg: "bg-[#ccfbf1]",
    dot: "bg-[#0d9488]",
    border: "border-[#99f6e4]",
  },
  {
    word: "Workflows",
    bg: "bg-[#dbeafe]",
    dot: "bg-[#2563eb]",
    border: "border-[#bfdbfe]",
  },
  {
    word: "Projects",
    bg: "bg-[#dcfce7]",
    dot: "bg-[#16a34a]",
    border: "border-[#bbf7d0]",
  },
  {
    word: "Solutions",
    bg: "bg-[#e0f2fe]",
    dot: "bg-[#0284c7]",
    border: "border-[#bae6fd]",
  },
  {
    word: "Possibilities",
    bg: "bg-[#fef3c7]",
    dot: "bg-[#d97706]",
    border: "border-[#fde68a]",
  },
] as const;

function HeroAnimatedPill() {
  const [index, setIndex] = React.useState(0);
  const [prevIndex, setPrevIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setIndex((curr) => {
        setPrevIndex(curr);
        return (curr + 1) % PILL_WORDS.length;
      });

      const clearTimer = setTimeout(() => {
        setPrevIndex(null);
      }, 400);

      return () => clearTimeout(clearTimer);
    }, 2200);

    return () => clearInterval(interval);
  }, []);

  const current = PILL_WORDS[index];
  const prev = prevIndex !== null ? PILL_WORDS[prevIndex] : null;

  return (
    <span className="relative inline-flex items-center justify-center align-middle mx-1.5 sm:mx-2.5 md:mx-3 overflow-hidden h-[1.3em] rounded-full">
      {/* Invisible placeholder for natural layout width */}
      <span className="invisible inline-flex items-center gap-2 sm:gap-3 px-3.5 sm:px-5 md:px-6 py-0.5 sm:py-1 rounded-full border border-transparent select-none pointer-events-none">
        <span className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 rounded-full shrink-0" />
        <span>{current.word}</span>
      </span>

      {/* Outgoing pill */}
      {prev && (
        <span
          key={`prev-${prev.word}-${index}`}
          className={`absolute inset-0 inline-flex items-center justify-center gap-2 sm:gap-3 px-3.5 sm:px-5 md:px-6 py-0.5 sm:py-1 rounded-full text-slate-900 border ${prev.border} ${prev.bg} animate-pill-out`}
        >
          <span className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 rounded-full ${prev.dot} shrink-0`} />
          <span>{prev.word}</span>
        </span>
      )}

      {/* Incoming / Active pill */}
      <span
        key={`curr-${current.word}`}
        className={`absolute inset-0 inline-flex items-center justify-center gap-2 sm:gap-3 px-3.5 sm:px-5 md:px-6 py-0.5 sm:py-1 rounded-full text-slate-900 border ${current.border} ${current.bg} ${
          prev ? "animate-pill-in" : ""
        }`}
      >
        <span className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 rounded-full ${current.dot} shrink-0`} />
        <span>{current.word}</span>
      </span>
    </span>
  );
}

export function Hero({ onGetStarted, onExploreFeatures }: HeroProps) {
  const handleExploreClick = () => {
    if (onExploreFeatures) {
      onExploreFeatures();
    } else {
      const demoElement = document.getElementById("demo");
      if (demoElement) {
        demoElement.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
      {/* 3D Floating Liquid Metallic Orbs matching video */}
      <Floating3DOrbs />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Editorial Top Bar / Studio Micro-Tag */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 sm:mb-12 border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
            <span className="text-sky-600 font-semibold">SyncSpace Platform</span>
            <span className="hidden md:inline text-slate-400">•</span>
            <span className="hidden md:inline text-slate-600">Structured Docs × Collaborative Canvas × Sketchboard</span>
          </div>

          <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
            <span>Modern visual workspace for high-velocity teams</span>
            <ArrowDownRight className="w-3.5 h-3.5 text-sky-600" />
          </div>
        </div>

        {/* Hero Title with cycling animated pill */}
        <div className="text-center">
          <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[88px] xl:text-[96px] font-extrabold tracking-tight sm:tracking-[-0.035em] text-slate-900 max-w-6xl mx-auto leading-[1.15] sm:leading-[1.06]">
            <span className="block">One Workspace.</span>
            <span className="inline-flex items-center justify-center flex-wrap gap-x-2 sm:gap-x-3.5 md:gap-x-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600">
                Infinite
              </span>
              <HeroAnimatedPill />
            </span>
          </h1>

          {/* Hero Subtitle */}
          <p className="mt-8 text-base sm:text-lg md:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed font-normal">
            SyncSpace brings structured documentation and visual collaboration together in one workspace. Create, organize, and collaborate with your team in real time.
          </p>

          {/* Action Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto sm:max-w-none">
            <Link href="/register" className="w-full sm:w-auto">
              <Button
                variant="glow"
                size="lg"
                className="w-full sm:w-auto px-8"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>

            <Link href="/demo" className="w-full sm:w-auto">
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto px-7"
              >
                <span>Live Demo</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
