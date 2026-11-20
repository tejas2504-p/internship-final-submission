export default function DocumentLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-white flex flex-col">
      {/* Top Navbar Skeleton */}
      <header className="sticky top-0 z-30 w-full glassmorphism-nav border-b border-slate-200/80 dark:border-slate-200 bg-white/80 dark:bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-50 animate-pulse" />
              <div className="space-y-1.5">
                <div className="w-24 h-4 bg-slate-200 dark:bg-slate-50 rounded animate-pulse" />
                <div className="w-16 h-2.5 bg-slate-100 dark:bg-slate-50/60 rounded animate-pulse" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32 h-8 rounded-xl bg-slate-100 dark:bg-slate-50 animate-pulse hidden sm:block" />
              <div className="w-20 h-8 rounded-lg bg-slate-200 dark:bg-slate-50 animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Document Content Skeleton */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Editor Canvas Card Skeleton */}
        <div className="rounded-2xl bg-white dark:bg-white border border-slate-200 dark:border-slate-200 p-6 sm:p-10 shadow-xs space-y-8 min-h-[500px]">
          {/* Header Action Bar Skeleton */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-16 h-6 rounded-full bg-slate-100 dark:bg-slate-50 animate-pulse" />
              <div className="w-20 h-6 rounded-full bg-slate-100 dark:bg-slate-50 animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-50 animate-pulse" />
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-50 animate-pulse" />
            </div>
          </div>

          {/* Document Title Skeleton */}
          <div className="space-y-2 border-b border-slate-100 dark:border-slate-200 pb-5">
            <div className="w-2/3 sm:w-1/2 h-9 bg-slate-200 dark:bg-slate-50 rounded-lg animate-pulse" />
          </div>

          {/* Editor Formatting Toolbar Skeleton */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-50 border border-slate-200/80 dark:border-slate-200">
            <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
            <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
            <div className="w-20 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
          </div>

          {/* Document Text Paragraphs Skeleton */}
          <div className="space-y-4 pt-2">
            <div className="w-full h-4 bg-slate-100 dark:bg-slate-50/60 rounded animate-pulse" />
            <div className="w-11/12 h-4 bg-slate-100 dark:bg-slate-50/60 rounded animate-pulse" />
            <div className="w-4/5 h-4 bg-slate-100 dark:bg-slate-50/60 rounded animate-pulse" />
            <div className="w-full h-4 bg-slate-100 dark:bg-slate-50/60 rounded animate-pulse" />
            <div className="w-3/4 h-4 bg-slate-100 dark:bg-slate-50/60 rounded animate-pulse" />
            <div className="w-2/3 h-4 bg-slate-100 dark:bg-slate-50/60 rounded animate-pulse" />
          </div>
        </div>
      </main>
    </div>
  );
}
