"use client";

import * as React from "react";
import {
  Clock,
  Sparkles,
  FileText,
  UserPlus,
  Users,
  Shield,
  Layout,
  Trash2,
  RefreshCw,
  Loader2,
  Activity as ActivityIcon,
} from "lucide-react";
import { WorkspaceActivity } from "@/types/workspace";

interface WorkspaceActivityViewProps {
  workspaceId: string;
}

function getActivityIcon(action: string) {
  switch (action) {
    case "WORKSPACE_CREATED":
    case "WORKSPACE_UPDATED":
      return <Sparkles className="w-4 h-4 text-amber-600" />;
    case "MEMBER_INVITED":
      return <UserPlus className="w-4 h-4 text-indigo-600" />;
    case "MEMBER_JOINED":
      return <Users className="w-4 h-4 text-emerald-600" />;
    case "MEMBER_ROLE_UPDATED":
      return <Shield className="w-4 h-4 text-purple-600" />;
    case "MEMBER_REMOVED":
      return <Trash2 className="w-4 h-4 text-rose-600" />;
    case "PAGE_CREATED":
      return <FileText className="w-4 h-4 text-blue-600" />;
    case "PAGE_UPDATED":
      return <FileText className="w-4 h-4 text-sky-600" />;
    case "PAGE_DELETED":
      return <Trash2 className="w-4 h-4 text-slate-500" />;
    case "CANVAS_UPDATED":
      return <Layout className="w-4 h-4 text-pink-600" />;
    default:
      return <ActivityIcon className="w-4 h-4 text-slate-500" />;
  }
}

function formatActionTitle(action: string, metadata?: Record<string, unknown> | null): string {
  const meta = metadata as Record<string, string | number | undefined> | null;
  switch (action) {
    case "WORKSPACE_CREATED":
      return "Workspace created";
    case "WORKSPACE_UPDATED":
      return "Workspace settings updated";
    case "MEMBER_INVITED":
      return `Invited ${meta?.email || "team member"} as ${meta?.role || "MEMBER"}`;
    case "MEMBER_JOINED":
      return `Joined workspace as ${meta?.role || "MEMBER"}`;
    case "MEMBER_ROLE_UPDATED":
      return `Role updated for ${meta?.targetName || meta?.targetEmail || "member"} to ${meta?.newRole}`;
    case "MEMBER_REMOVED":
      return `Removed ${meta?.targetName || meta?.targetEmail || "member"}`;
    case "PAGE_CREATED":
      return `Created page "${meta?.title || "Untitled"}"`;
    case "PAGE_UPDATED":
      return `Updated page "${meta?.title || "Untitled"}"`;
    case "PAGE_DELETED":
      return `Deleted page "${meta?.title || "Untitled"}"`;
    case "CANVAS_UPDATED":
      return `Updated spatial canvas (${meta?.nodeCount ?? 0} objects)`;
    default:
      return action.replace(/_/g, " ").toLowerCase();
  }
}

export function WorkspaceActivityView({ workspaceId }: WorkspaceActivityViewProps) {
  const [activities, setActivities] = React.useState<WorkspaceActivity[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const fetchActivities = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/activity?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities);
      }
    } catch (err) {
      console.error("Failed to fetch activity:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [workspaceId]);

  React.useEffect(() => {
    let isMounted = true;
    fetch(`/api/workspaces/${workspaceId}/activity?limit=50`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          setActivities(data.activities);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch activity:", err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchActivities();
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
        <span>Loading workspace activity...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-900">Activity Timeline</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time audit log of changes, document edits, canvas updates, and invitations
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-50 border border-slate-200 dark:border-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-colors shadow-2xs focus-ring"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Activity Feed */}
      {activities.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-white rounded-2xl border border-slate-200 dark:border-slate-200 text-slate-400 dark:text-slate-500 text-xs">
          No activity recorded yet for this workspace.
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-white border border-slate-200 dark:border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100 dark:divide-slate-800">
          {activities.map((act) => {
            const initials = act.actor?.name
              ? act.actor.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "U";

            return (
              <div
                key={act.id}
                className="p-4 flex items-start gap-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors"
              >
                {/* Icon indicator */}
                <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-50 border border-slate-200/80 dark:border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                  {getActivityIcon(act.action)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="text-sm text-slate-900 dark:text-slate-900 font-medium leading-snug">
                      <span className="font-semibold">{act.actor?.name || "System"}</span>{" "}
                      <span className="text-slate-600 dark:text-slate-400 font-normal">
                        {formatActionTitle(act.action, act.metadata)}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {new Date(act.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Actor tag */}
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3.5 h-3.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[8px] flex items-center justify-center">
                        {initials}
                      </span>
                      <span>{act.actor?.email}</span>
                    </span>
                    <span>•</span>
                    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 uppercase">
                      {act.entityType}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

