"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  FileText,
  Users,
  Trash2,
  AlertCircle,
  Clock,
  Sparkles,
  Search,
  Activity,
  Settings,
  Layout,
  PenTool,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { WorkspaceDetailData } from "@/types/workspace";
import { SketchboardSummary } from "@/types/sketchboard";

const WorkspaceSearchDialog = dynamic(
  () => import("./workspace-search-dialog").then((m) => m.WorkspaceSearchDialog),
  { ssr: false }
);

const WorkspaceActivityView = dynamic(
  () => import("./workspace-activity-view").then((m) => m.WorkspaceActivityView),
  {
    loading: () => (
      <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500 animate-pulse">
        Loading activity feed...
      </div>
    ),
  }
);

const WorkspaceSettingsView = dynamic(
  () => import("./workspace-settings-view").then((m) => m.WorkspaceSettingsView),
  {
    loading: () => (
      <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500 animate-pulse">
        Loading workspace settings...
      </div>
    ),
  }
);

interface WorkspaceDetailViewProps {
  workspace: WorkspaceDetailData;
  currentUserId: string;
}

export function WorkspaceDetailView({
  workspace: initialWorkspace,
  currentUserId,
}: WorkspaceDetailViewProps) {
  const router = useRouter();
  const [workspace, setWorkspace] = React.useState<WorkspaceDetailData>(initialWorkspace);
  const [activeTab, setActiveTab] = React.useState<"pages" | "sketchboards" | "members" | "activity" | "settings">("pages");
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  // New page state
  const [isCreatingPage, setIsCreatingPage] = React.useState(false);
  const [newPageTitle, setNewPageTitle] = React.useState("");
  const [pageError, setPageError] = React.useState<string | null>(null);

  // Sketchboards state
  const [sketchboards, setSketchboards] = React.useState<SketchboardSummary[]>(
    ((workspace.sketchboards as unknown) as SketchboardSummary[]) || []
  );
  const [isLoadingBoards, setIsLoadingBoards] = React.useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = React.useState(false);
  const [newBoardName, setNewBoardName] = React.useState("");
  const [boardError, setBoardError] = React.useState<string | null>(null);
  const [deletingBoardId, setDeletingBoardId] = React.useState<string | null>(null);

  const loadSketchboards = React.useCallback(async () => {
    try {
      setIsLoadingBoards(true);
      const res = await fetch(`/api/workspaces/${workspace.id}/sketchboards`);
      if (res.ok) {
        const data = await res.json();
        setSketchboards(data.boards || []);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingBoards(false);
    }
  }, [workspace.id]);

  React.useEffect(() => {
    if (activeTab === "sketchboards") {
      queueMicrotask(() => {
        void loadSketchboards();
      });
    }
  }, [activeTab, loadSketchboards]);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newBoardName.trim() || "Untitled Whiteboard";
    setBoardError(null);
    setIsCreatingBoard(true);

    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/sketchboards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: title }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create sketchboard");
      }

      const data = await res.json();
      setNewBoardName("");
      await loadSketchboards();
      router.push(`/workspaces/${workspace.id}/sketchboard/${data.sketchboard.id}`);
    } catch (err: unknown) {
      setBoardError(err instanceof Error ? err.message : "Failed to create sketchboard");
    } finally {
      setIsCreatingBoard(false);
    }
  };

  const handleDeleteBoard = async (boardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Are you sure you want to delete this Sketchboard? This action cannot be undone.")) {
      return;
    }
    setDeletingBoardId(boardId);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/sketchboards/${boardId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete sketchboard");
      }
      setSketchboards((prev) => prev.filter((b) => b.id !== boardId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete sketchboard");
    } finally {
      setDeletingBoardId(null);
    }
  };

  // Keyboard shortcut Ctrl+K / Cmd+K for search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newPageTitle.trim() || "Untitled";
    setPageError(null);
    setIsCreatingPage(true);

    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create page.");

      router.push(`/workspaces/${workspace.id}/pages/${data.page.id}`);
      router.refresh();
    } catch (err: unknown) {
      setPageError(err instanceof Error ? err.message : "Failed to create page.");
      setIsCreatingPage(false);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!confirm("Are you sure you want to delete this page?")) return;

    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/pages/${pageId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete page.");

      setWorkspace((prev) => ({
        ...prev,
        pages: prev.pages.filter((p) => p.id !== pageId),
      }));
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete page.");
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "OWNER":
        return "brand";
      case "ADMIN":
        return "warning";
      case "MEMBER":
      case "EDITOR":
        return "cyan";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Modal */}
      <WorkspaceSearchDialog
        workspaceId={workspace.id}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* Top Breadcrumb & Return to Dashboard */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-200">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors py-1 focus-ring rounded-lg px-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 dark:text-slate-500">Your Role:</span>
          <Badge variant={getRoleBadgeVariant(workspace.currentUserRole)} size="sm">
            {workspace.currentUserRole}
          </Badge>
        </div>
      </div>

      {/* Workspace Header Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200/80 flex items-center justify-center font-bold text-2xl shrink-0 shadow-xs">
            {workspace.icon || "📁"}
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {workspace.name}
            </h1>

            {workspace.description && (
              <p className="text-xs text-slate-600 line-clamp-2 max-w-xl">
                {workspace.description}
              </p>
            )}

            <p className="text-xs text-slate-500">
              Owned by <strong className="text-slate-700">{workspace.owner.name}</strong> •{" "}
              {workspace.members.length} {workspace.members.length === 1 ? "member" : "members"} •{" "}
              {workspace.pages.length} {workspace.pages.length === 1 ? "page" : "pages"}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSearchOpen(true)}
            className="shadow-2xs bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          >
            <Search className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
            <span>Search</span>
            <kbd className="hidden sm:inline-block ml-1.5 px-1.5 py-0.2 text-[10px] font-mono text-slate-400 bg-slate-100 rounded">
              ⌘K
            </kbd>
          </Button>

          <Link href={`/workspaces/${workspace.id}/sketchboard`}>
            <Button
              variant="outline"
              size="sm"
              className="shadow-2xs bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            >
              <PenTool className="w-3.5 h-3.5 mr-1.5 text-sky-500" />
              <span>Sketchboard</span>
            </Button>
          </Link>

          <Link href={`/workspaces/${workspace.id}/canvas`}>
            <Button variant="glow" size="sm" className="shadow-xs">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              <span>Spatial Canvas</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 space-x-6 sm:space-x-8 text-sm font-medium overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("pages")}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors shrink-0 focus-ring ${
            activeTab === "pages"
              ? "border-sky-600 text-sky-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Pages & Documents</span>
          <Badge variant="outline" size="sm" className="font-mono text-[10px] py-0 px-1.5">
            {workspace.pages.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sketchboards")}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors shrink-0 focus-ring ${
            activeTab === "sketchboards"
              ? "border-sky-600 text-sky-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <PenTool className="w-4 h-4 text-sky-500" />
          <span>Sketchboards</span>
          <Badge variant="outline" size="sm" className="font-mono text-[10px] py-0 px-1.5">
            {sketchboards.length}
          </Badge>
        </button>

        <Link
          href={`/workspaces/${workspace.id}/canvas`}
          className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-sky-600 flex items-center gap-2 transition-colors group shrink-0 focus-ring"
        >
          <Layout className="w-4 h-4 text-sky-500 group-hover:scale-110 transition-transform" />
          <span>Spatial Canvas</span>
          <Badge variant="brand" size="sm" className="font-mono text-[10px] py-0 px-1.5">
            Live
          </Badge>
        </Link>

        <button
          type="button"
          onClick={() => setActiveTab("members")}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors shrink-0 focus-ring ${
            activeTab === "members"
              ? "border-sky-600 text-sky-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Members</span>
          <Badge variant="outline" size="sm" className="font-mono text-[10px] py-0 px-1.5">
            {workspace.members.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("activity")}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors shrink-0 focus-ring ${
            activeTab === "activity"
              ? "border-sky-600 text-sky-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Activity Feed</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors shrink-0 focus-ring ${
            activeTab === "settings"
              ? "border-sky-600 text-sky-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>

      {/* TAB CONTENT: PAGES */}
      {activeTab === "pages" && (
        <div className="space-y-6">
          {/* Quick Create Page Bar */}
          {workspace.canCreatePage && (
            <form
              onSubmit={handleCreatePage}
              className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center gap-3"
            >
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  placeholder="New page title (e.g. Sprint Backlog, System Architecture)..."
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 font-sans"
                />
              </div>
              <Button
                type="submit"
                variant="glow"
                size="sm"
                isLoading={isCreatingPage}
                className="w-full sm:w-auto shrink-0"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Create Page</span>
              </Button>
            </form>
          )}

          {pageError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{pageError}</span>
            </div>
          )}

          {/* Canvas Card Spotlight */}
          <div className="relative overflow-hidden p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-sky-500/[0.08] via-blue-500/[0.04] to-cyan-500/[0.08] border border-sky-200/90 shadow-sm hover:shadow-md hover:border-sky-300 transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
            {/* Ambient light glow in top right */}
            <div className="absolute -top-12 -right-12 w-44 h-44 bg-gradient-to-br from-sky-400/25 to-blue-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />

            <div className="relative z-10 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-400 via-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0 group-hover:scale-105 transition-transform duration-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h4 className="text-sm sm:text-base font-bold text-slate-900">
                    Spatial Whiteboard Canvas
                  </h4>
                  <Badge variant="brand" size="sm" className="font-mono text-[10px]">
                    Multiplayer
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Infinite collaborative diagramming, sticky notes, rectangles, and live cursor awareness.
                </p>
              </div>
            </div>

            <div className="relative z-10">
              <Link href={`/workspaces/${workspace.id}/canvas`}>
                <Button variant="glow" size="sm" className="w-full sm:w-auto font-medium">
                  <span>Launch Canvas</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Pages Grid */}
          {workspace.pages.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-3 shadow-2xs">
              <FileText className="w-8 h-8 mx-auto text-slate-300" />
              <div className="text-sm font-semibold text-slate-700">No pages created yet</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {workspace.canCreatePage
                  ? "Get started by typing a title above and creating your first documentation page."
                  : "No pages have been created in this workspace yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspace.pages.map((page) => {
                const canDeleteThisPage =
                  workspace.currentUserRole === "OWNER" ||
                  workspace.currentUserRole === "ADMIN" ||
                  page.createdById === currentUserId;

                return (
                  <Card
                    key={page.id}
                    className="hover:shadow-md hover:border-sky-300 transition-all group bg-white border border-slate-200/90 rounded-2xl"
                  >
                    <CardContent className="p-5 flex flex-col justify-between h-40">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/workspaces/${workspace.id}/pages/${page.id}`}
                          className="flex items-start gap-3 min-w-0 flex-1 group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-sky-50 group-hover:bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 transition-colors">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-slate-900 group-hover:text-sky-600 transition-colors truncate">
                              {page.title}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate font-mono">
                              By {page.creator.name}
                            </p>
                          </div>
                        </Link>

                        {canDeleteThisPage && (
                          <button
                            type="button"
                            onClick={() => handleDeletePage(page.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Delete page"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          {new Date(page.updatedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <Link
                          href={`/workspaces/${workspace.id}/pages/${page.id}`}
                          className="text-sky-600 hover:text-sky-700 font-medium hover:underline flex items-center gap-0.5"
                        >
                          <span>Open</span>
                          <span>→</span>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: SKETCHBOARDS */}
      {activeTab === "sketchboards" && (
        <div className="space-y-6">
          {/* Quick Create Sketchboard Bar */}
          {workspace.canEdit && (
            <form
              onSubmit={handleCreateBoard}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Create new whiteboard (e.g., Sprint Planning, Architecture, Wireframes)..."
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  disabled={isCreatingBoard}
                  className="w-full pl-3 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus-ring bg-slate-50/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isCreatingBoard}
                  className="shrink-0"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  <span>{isCreatingBoard ? "Creating..." : "Create Board"}</span>
                </Button>
                <Link href={`/workspaces/${workspace.id}/sketchboard`}>
                  <Button type="button" variant="outline" size="sm" className="shrink-0">
                    <PenTool className="w-3.5 h-3.5 mr-1.5 text-sky-600" />
                    <span>Open Primary Board</span>
                  </Button>
                </Link>
              </div>
            </form>
          )}

          {boardError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{boardError}</span>
            </div>
          )}

          {/* Sketchboards Grid */}
          {isLoadingBoards ? (
            <div className="p-12 text-center text-sm text-slate-400 animate-pulse">
              Loading workspace whiteboards...
            </div>
          ) : sketchboards.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200">
              <CardContent className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
                  <PenTool className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-slate-800">
                    No Sketchboards Yet
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Create infinite digital whiteboards to sketch diagrams, mindmaps, wireframes, and collaborate with your team in real time.
                  </p>
                </div>
                <Link href={`/workspaces/${workspace.id}/sketchboard`}>
                  <Button variant="primary" size="sm" className="mt-2">
                    <Plus className="w-4 h-4 mr-1.5" />
                    <span>Launch Primary Sketchboard</span>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sketchboards.map((b) => {
                const canDeleteThisBoard =
                  workspace.currentUserRole === "OWNER" ||
                  workspace.currentUserRole === "ADMIN" ||
                  b.createdById === currentUserId;

                return (
                  <Card
                    key={b.id}
                    className="hover:border-sky-300 hover:shadow-md transition-all group relative bg-white"
                  >
                    <CardContent className="p-5 flex flex-col justify-between h-44">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                              <PenTool className="w-4 h-4" />
                            </div>
                            <Link
                              href={`/workspaces/${workspace.id}/sketchboard/${b.id}`}
                              className="font-semibold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-1"
                            >
                              {b.name}
                            </Link>
                          </div>
                          {canDeleteThisBoard && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteBoard(b.id, e)}
                              disabled={deletingBoardId === b.id}
                              title="Delete sketchboard"
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {b.description || "Infinite collaborative whiteboard canvas."}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Badge variant="outline" size="sm" className="text-[10px] py-0 px-1.5">
                            {b.elementsCount} objects
                          </Badge>
                          <span className="flex items-center gap-1 text-[11px]">
                            <Clock className="w-3 h-3" />
                            <span>
                              {new Date(b.updatedAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </span>
                        </div>
                        <Link
                          href={`/workspaces/${workspace.id}/sketchboard/${b.id}`}
                          className="text-sky-600 hover:text-sky-700 font-medium hover:underline flex items-center gap-0.5"
                        >
                          <span>Open</span>
                          <span>→</span>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: MEMBERS */}
      {activeTab === "members" && (
        <div className="space-y-6">
          <WorkspaceSettingsView
            workspace={workspace}
            currentUserId={currentUserId}
            onWorkspaceUpdated={(updated) => setWorkspace((prev) => ({ ...prev, ...updated }))}
          />
        </div>
      )}

      {/* TAB CONTENT: ACTIVITY FEED */}
      {activeTab === "activity" && (
        <WorkspaceActivityView workspaceId={workspace.id} />
      )}

      {/* TAB CONTENT: SETTINGS */}
      {activeTab === "settings" && (
        <WorkspaceSettingsView
          workspace={workspace}
          currentUserId={currentUserId}
          onWorkspaceUpdated={(updated) => setWorkspace((prev) => ({ ...prev, ...updated }))}
        />
      )}
    </div>
  );
}
