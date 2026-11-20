"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[GlobalError] Unhandled error in application boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-xs">
          <AlertCircle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Something went wrong
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            A temporary issue occurred while rendering this page. You can reload or return to the home page.
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
            <span>Reload Page</span>
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

