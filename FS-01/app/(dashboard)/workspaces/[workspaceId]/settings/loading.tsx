export default function WorkspaceSettingsLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-white flex flex-col">
      {/* Top Navbar Skeleton */}
      <header className="sticky top-0 z-30 w-full glassmorphism-nav border-b border-slate-200/80 dark:border-slate-200 bg-white/80 dark:bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-50 animate-pulse" />
              <div className="space-y-1.5">
                <div className="w-28 h-4 bg-slate-200 dark:bg-slate-50 rounded animate-pulse" />
                <div className="w-20 h-2.5 bg-slate-100 dark:bg-slate-50/60 rounded animate-pulse" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-28 h-8 rounded-xl bg-slate-100 dark:bg-slate-50 animate-pulse" />
              <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-50 animate-pulse" />
              <div className="w-16 h-8 rounded-lg bg-slate-200 dark:bg-slate-50 animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Settings Content Skeleton */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="space-y-2">
          <div className="w-64 h-8 bg-slate-200 dark:bg-slate-50 rounded-lg animate-pulse" />
          <div className="w-96 max-w-full h-4 bg-slate-100 dark:bg-slate-50/60 rounded animate-pulse" />
        </div>

        {/* General Settings Card Skeleton */}
        <div className="rounded-2xl bg-white dark:bg-white border border-slate-200 dark:border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="w-40 h-6 bg-slate-200 dark:bg-slate-50 rounded animate-pulse" />
          <div className="space-y-4">
            <div className="w-full h-10 bg-slate-100 dark:bg-slate-50/60 rounded-xl animate-pulse" />
            <div className="w-full h-24 bg-slate-100 dark:bg-slate-50/60 rounded-xl animate-pulse" />
            <div className="w-28 h-9 bg-indigo-200/60 dark:bg-indigo-950/60 rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Members Management Card Skeleton */}
        <div className="rounded-2xl bg-white dark:bg-white border border-slate-200 dark:border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div className="w-36 h-6 bg-slate-200 dark:bg-slate-50 rounded animate-pulse" />
            <div className="w-24 h-4 bg-slate-100 dark:bg-slate-50/60 rounded animate-pulse" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-200 bg-slate-50/50 dark:bg-slate-50/30"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="space-y-1">
                    <div className="w-32 h-4 bg-slate-200 dark:bg-slate-50 rounded animate-pulse" />
                    <div className="w-48 h-3 bg-slate-100 dark:bg-slate-50/60 rounded animate-pulse" />
                  </div>
                </div>
                <div className="w-20 h-7 bg-slate-200 dark:bg-slate-50 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

