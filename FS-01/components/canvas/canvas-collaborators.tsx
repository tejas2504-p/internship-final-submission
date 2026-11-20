"use client";

import * as React from "react";
import { CanvasCollaborator, CanvasViewport } from "@/types/canvas";
import { worldToScreen } from "@/lib/canvas/utils";
import { Users, Eye, Edit3 } from "lucide-react";

interface CanvasCollaboratorsProps {
  collaborators: CanvasCollaborator[];
  viewport: CanvasViewport;
}

export function CanvasCollaborators({
  collaborators,
  viewport,
}: CanvasCollaboratorsProps) {
  if (collaborators.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {collaborators.map((c) => {
        if (!c.cursor) return null;
        const screenPos = worldToScreen(c.cursor, viewport);

        return (
          <div
            key={c.clientId}
            className="absolute transition-transform duration-75 ease-out"
            style={{
              transform: `translate3d(${screenPos.x}px, ${screenPos.y}px, 0)`,
            }}
          >
            {/* SVG Mouse Pointer */}
            <svg
              className="h-5 w-5 drop-shadow-md"
              viewBox="0 0 24 24"
              fill={c.color || "#6366f1"}
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="3 3 10.07 19.97 12.58 12.58 19.97 10.07 3 3" />
            </svg>

            {/* Name Tag Pill */}
            <div
              className="mt-1 ml-3 select-none rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white shadow-sm flex items-center gap-1"
              style={{ backgroundColor: c.color || "#6366f1" }}
            >
              <span>{c.userName}</span>
              {c.role === "VIEWER" && (
                <span className="text-[10px] opacity-80 font-normal">(Viewer)</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface CollaboratorAvatarsProps {
  collaborators: CanvasCollaborator[];
  currentUserName?: string;
  currentUserRole?: string;
}

export function CollaboratorAvatars({
  collaborators,
  currentUserName,
  currentUserRole,
}: CollaboratorAvatarsProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (collaborators.length === 0 && !currentUserName) return null;

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Presence Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center -space-x-1.5 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group focus-ring"
        title="View active canvas collaborators"
      >
        {collaborators.slice(0, 4).map((c) => (
          <div
            key={c.clientId}
            title={`${c.userName} (${c.role.toLowerCase()})`}
            className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 text-xs font-bold text-white shadow-xs group-hover:scale-105 transition-transform"
            style={{ backgroundColor: c.color || "#6366f1" }}
          >
            {c.userName.charAt(0).toUpperCase()}
          </div>
        ))}

        {collaborators.length > 4 && (
          <div className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 bg-slate-800 text-xs font-semibold text-slate-200">
            +{collaborators.length - 4}
          </div>
        )}

        <span className="ml-2 hidden sm:inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">
          <Users className="w-3.5 h-3.5" />
          <span>{collaborators.length + 1}</span>
        </span>
      </button>

      {/* Active Collaborators Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-200 dark:border-slate-200 bg-white dark:bg-white p-3 shadow-xl dark:shadow-black/50 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-200 pb-2 mb-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-800">
              Active Collaborators ({collaborators.length + 1})
            </span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {/* Current Local User */}
            {currentUserName && (
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-slate-50/70 border border-slate-100 dark:border-slate-200/60">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                    {currentUserName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-900 truncate">
                      {currentUserName}{" "}
                      <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                        (You)
                      </span>
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded-sm">
                  {currentUserRole || "MEMBER"}
                </span>
              </div>
            )}

            {/* Remote Collaborators */}
            {collaborators.map((c) => (
              <div
                key={c.clientId}
                className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-6 h-6 rounded-full text-white flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{ backgroundColor: c.color || "#6366f1" }}
                  >
                    {c.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-800 truncate">
                      {c.userName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {c.canEdit ? (
                    <span
                      title="Can edit"
                      className="text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-50 px-1.5 py-0.5 rounded-sm flex items-center gap-0.5"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                      {c.role}
                    </span>
                  ) : (
                    <span
                      title="Viewer (read-only)"
                      className="text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-sm flex items-center gap-0.5"
                    >
                      <Eye className="w-2.5 h-2.5" />
                      VIEWER
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
