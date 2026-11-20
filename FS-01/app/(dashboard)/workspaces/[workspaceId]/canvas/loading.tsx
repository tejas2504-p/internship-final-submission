import { Loader2 } from "lucide-react";

export default function CanvasLoading() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#fbfbfa] dark:bg-white">
      {/* Top Navbar Skeleton */}
      <header className="h-14 border-b border-slate-200/90 dark:border-slate-200 bg-white/90 dark:bg-white/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-50 animate-pulse" />
          <div className="w-24 h-4 bg-slate-200 dark:bg-slate-50 rounded animate-pulse" />
          <div className="w-16 h-4 bg-slate-100 dark:bg-slate-50/60 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-50 animate-pulse" />
          <div className="w-16 h-8 rounded-lg bg-slate-200 dark:bg-slate-50 animate-pulse" />
        </div>
      </header>

      {/* Main Canvas Loading Surface */}
      <div className="relative flex-1 w-full h-full bg-dot-pattern flex items-center justify-center">
        <div className="p-6 rounded-2xl bg-white/95 dark:bg-white/95 backdrop-blur-md border border-slate-200 dark:border-slate-200 shadow-lg dark:shadow-black/40 text-center space-y-3 flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-900">
              Loading Spatial Canvas...
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Preparing your infinite whiteboard
            </p>
          </div>
        </div>

        {/* Toolbar Skeleton */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <div className="w-72 h-12 rounded-2xl bg-white/80 dark:bg-white/80 border border-slate-200 dark:border-slate-200 shadow-md animate-pulse" />
        </div>
      </div>
    </div>
  );
}
