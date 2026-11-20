"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderPlus,
  ArrowRight,
  Users,
  FileText,
  Edit2,
  AlertCircle,
  Layers,
  X,
  Sparkles,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

export interface WorkspaceItem {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  ownerId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  userRole: "OWNER" | "ADMIN" | "EDITOR" | "MEMBER" | "VIEWER";
  membersCount: number;
  pagesCount: number;
}

interface WorkspaceListProps {
  initialWorkspaces: WorkspaceItem[];
  userId?: string;
}

const EMOJI_OPTIONS = ["🚀", "📁", "🎨", "💡", "⚡", "🏢", "🎯", "🛠️", "💻", "📊", "📝", "🌟"];

export function WorkspaceList({ initialWorkspaces }: WorkspaceListProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [workspaces, setWorkspaces] = React.useState<WorkspaceItem[]>(initialWorkspaces);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = React.useState("");
  const [newWorkspaceDesc, setNewWorkspaceDesc] = React.useState("");
  const [newWorkspaceIcon, setNewWorkspaceIcon] = React.useState("🚀");
  const [isCreating, setIsCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  // Rename state
  const [editingWorkspace, setEditingWorkspace] = React.useState<WorkspaceItem | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [renameError, setRenameError] = React.useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const trimmed = newWorkspaceName.trim();
    if (!trimmed || trimmed.length < 2) {
      setCreateError("Workspace name must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 50) {
      setCreateError("Workspace name cannot exceed 50 characters.");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: newWorkspaceDesc.trim() || undefined,
          icon: newWorkspaceIcon,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create workspace.");
      }

      success("Workspace Created", `"${trimmed}" is ready.`);
      setNewWorkspaceName("");
      setNewWorkspaceDesc("");
      setNewWorkspaceIcon("🚀");
      setIsCreateModalOpen(false);

      if (data.workspace) {
        const created: WorkspaceItem = {
          ...data.workspace,
          owner: data.workspace.owner || { id: "", name: "", email: "" },
          userRole: "OWNER",
          membersCount: 1,
          pagesCount: 0,
        };
        setWorkspaces((prev) => [created, ...prev]);
        router.push(`/workspaces/${data.workspace.id}`);
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create workspace.";
      setCreateError(message);
      toastError("Creation Failed", message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkspace) return;
    setRenameError(null);

    const trimmed = renameValue.trim();
    if (!trimmed || trimmed.length < 2) {
      setRenameError("Workspace name must be at least 2 characters.");
      return;
    }

    setIsRenaming(true);
    try {
      const res = await fetch(`/api/workspaces/${editingWorkspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to rename workspace.");
      }

      setWorkspaces((prev) =>
        prev.map((ws) => (ws.id === editingWorkspace.id ? { ...ws, name: trimmed } : ws))
      );
      success("Workspace Renamed", `Updated to "${trimmed}".`);
      setEditingWorkspace(null);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to rename workspace.";
      setRenameError(message);
      toastError("Rename Failed", message);
    } finally {
      setIsRenaming(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "OWNER":
        return "brand";
      case "ADMIN":
        return "warning";
      case "EDITOR":
      case "MEMBER":
        return "cyan";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6" id="workspaces-section">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Your Workspaces
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Collaborative environments you own or participate in
          </p>
        </div>

        <Button
          variant="glow"
          size="sm"
          onClick={() => {
            setCreateError(null);
            setNewWorkspaceName("");
            setNewWorkspaceDesc("");
            setNewWorkspaceIcon("🚀");
            setIsCreateModalOpen(true);
          }}
          className="shadow-sm"
        >
          <FolderPlus className="w-4 h-4 mr-1.5" />
          <span>New Workspace</span>
        </Button>
      </div>

      {/* Workspaces Grid */}
      {workspaces.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shadow-xs">
            <Layers className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <h3 className="text-base font-semibold text-slate-900">
              No workspaces found
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              You haven&apos;t created or joined any workspaces yet. Create your first workspace to start organizing documents and collaborating.
            </p>
          </div>
          <Button
            variant="glow"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-2"
          >
            <FolderPlus className="w-3.5 h-3.5 mr-1.5" />
            <span>Create Workspace</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {workspaces.map((ws) => (
            <Card
              key={ws.id}
              className="group relative flex flex-col justify-between hover:border-sky-400/60 hover:shadow-md transition-all duration-200 bg-white border-slate-200 shadow-xs"
            >
              <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                {/* Card Top: Name & Role Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform text-lg shadow-2xs">
                      {ws.icon || "📁"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-900 truncate group-hover:text-sky-600 transition-colors">
                        {ws.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate font-mono">
                        Owner: {ws.owner.name || ws.owner.email}
                      </p>
                    </div>
                  </div>

                  <Badge variant={getRoleBadgeVariant(ws.userRole)} size="sm" className="font-mono text-[10px]">
                    {ws.userRole}
                  </Badge>
                </div>

                {/* Optional description */}
                {ws.description && (
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {ws.description}
                  </p>
                )}

                {/* Card Stats */}
                <div className="grid grid-cols-2 gap-2 py-3 px-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      <strong>{ws.membersCount}</strong> {ws.membersCount === 1 ? "member" : "members"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      <strong>{ws.pagesCount}</strong> {ws.pagesCount === 1 ? "page" : "pages"}
                    </span>
                  </div>
                </div>

                {/* Card Footer: Action & Quick Links */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Link href={`/workspaces/${ws.id}/canvas`}>
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition-colors text-xs flex items-center gap-1 font-mono"
                        title="Open spatial canvas"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                        <span className="hidden sm:inline">Canvas</span>
                      </button>
                    </Link>

                    {(ws.userRole === "OWNER" || ws.userRole === "ADMIN") && (
                      <Link href={`/workspaces/${ws.id}/settings`}>
                        <button
                          type="button"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-xs"
                          title="Workspace settings"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                    )}

                    {(ws.userRole === "OWNER" || ws.userRole === "ADMIN") && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWorkspace(ws);
                          setRenameValue(ws.name);
                          setRenameError(null);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-xs"
                        title="Rename workspace"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <Link href={`/workspaces/${ws.id}`}>
                    <Button variant="secondary" size="sm" className="bg-white text-slate-700 border-slate-200 hover:border-sky-400/50 hover:text-sky-600 text-xs shadow-xs">
                      <span>Open</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Workspace Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => !isCreating && setIsCreateModalOpen(false)}
          />

          <div className="relative z-50 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Create New Workspace
                  </h3>
                  <p className="text-xs text-slate-500">
                    A collaborative space for documents and canvas
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isCreating}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Icon Selector */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-700 mb-2">
                  Workspace Icon
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewWorkspaceIcon(emoji)}
                      className={`w-8 h-8 rounded-xl text-base flex items-center justify-center transition-all cursor-pointer ${
                        newWorkspaceIcon === emoji
                          ? "bg-sky-100 border-2 border-sky-500 text-sky-900 shadow-xs scale-105"
                          : "bg-slate-50 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="workspace-name"
                  className="block text-xs font-mono uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Workspace Name
                </label>
                <input
                  id="workspace-name"
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Design Systems, Platform Engineering"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 placeholder:text-slate-400 font-sans"
                />
              </div>

              <div>
                <label
                  htmlFor="workspace-desc"
                  className="block text-xs font-mono uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Description (Optional)
                </label>
                <textarea
                  id="workspace-desc"
                  rows={2}
                  placeholder="Team projects, notes, and spatial diagrams..."
                  value={newWorkspaceDesc}
                  onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 placeholder:text-slate-400 resize-none font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isCreating}
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="glow"
                  size="sm"
                  isLoading={isCreating}
                >
                  Create Workspace
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Workspace Modal */}
      {editingWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => !isRenaming && setEditingWorkspace(null)}
          />

          <div className="relative z-50 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Rename Workspace
                  </h3>
                  <p className="text-xs text-slate-500">
                    Update the display name of this workspace
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingWorkspace(null)}
                disabled={isRenaming}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {renameError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{renameError}</span>
              </div>
            )}

            <form onSubmit={handleRename} className="space-y-4">
              <div>
                <label
                  htmlFor="rename-input"
                  className="block text-xs font-mono uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  New Workspace Name
                </label>
                <input
                  id="rename-input"
                  type="text"
                  autoFocus
                  required
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isRenaming}
                  onClick={() => setEditingWorkspace(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="glow"
                  size="sm"
                  isLoading={isRenaming}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
