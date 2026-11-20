"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[DashboardError] Unhandled error in dashboard boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-xs">
          <AlertCircle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Connection Recovering
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            The workspace database is reconnecting or waking from a brief idle state. Your work and data are safe.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            onClick={() => reset()}
            variant="glow"
            size="md"
            className="w-full sm:w-auto px-5 font-semibold"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            <span>Try Again</span>
          </Button>

          <Button
            asChild
            variant="secondary"
            size="md"
            className="w-full sm:w-auto px-5"
          >
            <Link href="/">
              <Home className="w-4 h-4 mr-1.5" />
              <span>Back to Home</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

