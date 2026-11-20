"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { GithubIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

interface CtaSectionProps {
  onGetStarted?: () => void;
}

export function CtaSection({ onGetStarted }: CtaSectionProps) {
  const router = useRouter();
  const [submitted, setSubmitted] = React.useState(false);
  const [workspaceGoal, setWorkspaceGoal] = React.useState("");

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      router.push("/register");
    }, 400);
  };

  return (
    <section className="py-24 md:py-36 relative overflow-hidden bg-slate-50/50 border-t border-slate-200">
      {/* Background molten sunset flare */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-r from-sky-200/40 via-blue-200/30 to-sky-200/40 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="relative rounded-3xl border border-slate-200/90 bg-white p-8 sm:p-14 md:p-16 text-center shadow-xl overflow-hidden">
          {/* Subtle rim highlight */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-500/60 to-transparent" />

          <div className="relative z-10 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-xs font-mono mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
              <span>Get Started Today</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-[1.1]">
              Ready to build together <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600">
                in SyncSpace?
              </span>
            </h2>

            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              Unify structured documentation with an infinite spatial canvas and vector sketchboard. Create, organize, and collaborate with your team in real time.
            </p>

            {/* Quick Interactive Workspace Intent Input */}
            <form onSubmit={handleQuickSubmit} className="mt-8 max-w-md mx-auto">
              <div className="flex items-center rounded-full bg-slate-50 border border-slate-200 p-1.5 focus-within:border-sky-500/60 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all">
                <input
                  type="text"
                  placeholder="Enter your team or project name..."
                  value={workspaceGoal}
                  onChange={(e) => setWorkspaceGoal(e.target.value)}
                  className="flex-1 bg-transparent px-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-sans"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="rounded-full px-5 py-2 font-medium text-xs sm:text-sm flex-shrink-0"
                >
                  {submitted ? (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Opening...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      Start Now <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-slate-500">
              <span className="flex items-center gap-1">
                <span className="text-emerald-600 font-bold">✓</span> Free to get started
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="text-emerald-600 font-bold">✓</span> Real-time collaboration built-in
              </span>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-center gap-4">
              <a
                href="https://github.com/tejas2504-p/syncspace-collaborative-workspace"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700 transition-colors"
              >
                <GithubIcon className="w-3.5 h-3.5 text-slate-700" />
                <span>Star on GitHub</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
