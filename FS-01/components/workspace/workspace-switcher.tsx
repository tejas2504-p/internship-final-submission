"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronsUpDown,
  Check,
  Folder,
  Sparkles,
  Layers,
} from "lucide-react";
import { WorkspaceRole } from "@prisma/client";

export interface WorkspaceSummary {
  id: string;
  name: string;
  icon?: string | null;
  userRole?: WorkspaceRole | string;
}

interface WorkspaceSwitcherProps {
  currentWorkspaceId?: string;
  workspaces: WorkspaceSummary[];
  className?: string;
}

export function WorkspaceSwitcher({
  currentWorkspaceId,
  workspaces,
  className,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);

  // Close dropdown on outside click or Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-xs text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 cursor-pointer"
      >
        <div className="w-6 h-6 rounded-lg bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center text-xs shrink-0 font-medium">
          {currentWorkspace?.icon || (
            <Layers className="w-3.5 h-3.5 text-sky-600" />
          )}
        </div>
        <div className="flex flex-col min-w-0 max-w-[120px] sm:max-w-[160px]">
          <span className="text-xs font-semibold text-slate-900 truncate leading-tight">
            {currentWorkspace?.name || "All Workspaces"}
          </span>
          <span className="text-[10px] text-slate-500 truncate leading-tight font-mono">
            {currentWorkspace ? `Role: ${currentWorkspace.userRole || "MEMBER"}` : "Switch workspace"}
          </span>
        </div>
        <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
      </button>

      {/* Switcher Dropdown Popover */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 mt-2 z-50 w-64 rounded-2xl border border-slate-200 bg-white shadow-2xl p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2.5 py-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-500">
            Workspaces ({workspaces.length})
          </div>

          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
            {workspaces.map((ws) => {
              const isSelected = ws.id === currentWorkspaceId;
              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    router.push(`/workspaces/${ws.id}`);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors text-left cursor-pointer ${
                    isSelected
                      ? "bg-sky-50 text-sky-700 font-semibold border border-sky-200"
                      : "text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{ws.icon || "📁"}</span>
                    <span className="truncate">{ws.name}</span>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-1.5 mt-1 border-t border-slate-100 space-y-0.5">
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <Folder className="w-3.5 h-3.5 text-slate-500" />
              <span>All Workspaces Dashboard</span>
            </Link>

            {currentWorkspace && (
              <Link
                href={`/workspaces/${currentWorkspace.id}/canvas`}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-sky-600 hover:bg-sky-50 transition-colors font-medium"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>Open Spatial Whiteboard</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
