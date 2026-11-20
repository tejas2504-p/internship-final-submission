import { requireAuth } from "@/lib/auth-server";
import { getUserWorkspaces } from "@/lib/services/workspace";
import { prisma } from "@/src/lib/db/prisma";
import { WorkspaceList } from "@/components/workspace/workspace-list";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { PendingInvitationsBanner } from "@/components/workspace/pending-invitations-banner";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import Link from "next/link";
import {
  Layers,
  Sparkles,
  FileText,
  Clock,
  ArrowRight,
  LayoutGrid,
  FolderKanban,
  FilePlus,
  Palette,
  FolderPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";

export const instant = false;

function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const now = Date.now();
  const past = new Date(date).getTime();
  const diffInSeconds = Math.max(0, Math.floor((now - past) / 1000));

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function DashboardPage() {
  // Server-side session verification: unauthenticated users are redirected to /login immediately
  const session = await requireAuth("/login");

  const [workspaces, pendingInvitations] = await Promise.all([
    getUserWorkspaces(session.user.id),
    prisma.workspaceInvitation.findMany({
      where: {
        email: session.user.email,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            icon: true,
            description: true,
          },
        },
        inviter: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const workspaceIds = workspaces.map((w) => w.id);

  // Fetch real, database-backed documents and boards across the user's workspaces
  const [
    recentPages,
    recentCanvases,
    recentSketchboards,
    totalCanvasesCount,
    totalSketchboardsCount,
  ] = workspaceIds.length > 0
    ? await Promise.all([
        prisma.page.findMany({
          where: { workspaceId: { in: workspaceIds } },
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                icon: true,
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
        }),
        prisma.canvas.findMany({
          where: { workspaceId: { in: workspaceIds } },
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                icon: true,
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 4,
        }),
        prisma.sketchboard.findMany({
          where: { workspaceId: { in: workspaceIds } },
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                icon: true,
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 4,
        }),
        prisma.canvas.count({
          where: { workspaceId: { in: workspaceIds } },
        }),
        prisma.sketchboard.count({
          where: { workspaceId: { in: workspaceIds } },
        }),
      ])
    : [[], [], [], 0, 0];

  const totalDocuments = workspaces.reduce((acc, ws) => acc + ws.pagesCount, 0);
  const totalBoards = totalCanvasesCount + totalSketchboardsCount;
  const totalWorkspaces = workspaces.length;
  const primaryWorkspace = workspaces[0];

  const initials = session.user.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  interface RecentActivityItem {
    id: string;
    type: "document" | "canvas" | "sketchboard";
    title: string;
    href: string;
    workspaceName: string;
    workspaceIcon: string;
    updatedAt: Date;
  }

  const recentItems: RecentActivityItem[] = [
    ...recentPages.map((p) => ({
      id: `doc-${p.id}`,
      type: "document" as const,
      title: p.title || "Untitled Document",
      href: `/workspaces/${p.workspaceId}/pages/${p.id}`,
      workspaceName: p.workspace.name,
      workspaceIcon: p.workspace.icon || "📁",
      updatedAt: p.updatedAt,
    })),
    ...recentCanvases.map((c) => ({
      id: `canvas-${c.id}`,
      type: "canvas" as const,
      title: c.name || "Spatial Whiteboard",
      href: `/workspaces/${c.workspaceId}/canvas`,
      workspaceName: c.workspace.name,
      workspaceIcon: c.workspace.icon || "📁",
      updatedAt: c.updatedAt,
    })),
    ...recentSketchboards.map((s) => ({
      id: `sketch-${s.id}`,
      type: "sketchboard" as const,
      title: s.name || "Vector Sketchboard",
      href: `/workspaces/${s.workspaceId}/sketchboard/${s.id}`,
      workspaceName: s.workspace.name,
      workspaceIcon: s.workspace.icon || "📁",
      updatedAt: s.updatedAt,
    })),
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col transition-colors duration-200">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Workspace Switcher */}
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-400 via-sky-500 to-blue-600 p-0.5 shadow-xs group-hover:scale-105 transition-transform flex items-center justify-center">
                  <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                    <Layers className="w-5 h-5 text-sky-600" />
                  </div>
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="font-black text-lg tracking-tight text-slate-900 flex items-center gap-1.5">
                    SyncSpace
                    <Badge variant="brand" size="sm" className="font-mono text-[10px] py-0 px-1.5">
                      Dashboard
                    </Badge>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 -mt-1">
                    Collaborative Workspace
                  </span>
                </div>
              </Link>

              {/* Workspace Switcher */}
              <WorkspaceSwitcher
                workspaces={workspaces.map((w) => ({
                  id: w.id,
                  name: w.name,
                  icon: w.icon,
                  userRole: w.userRole,
                }))}
              />
            </div>

            {/* User Profile & Actions */}
            <div className="flex items-center gap-3">
              <ThemeToggle />

              <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
                <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 font-bold text-xs flex items-center justify-center">
                  {initials}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-900 leading-tight">
                    {session.user.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 leading-tight">
                    {session.user.email}
                  </span>
                </div>
              </div>

              <LogoutButton variant="secondary" size="sm" className="bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-white text-slate-900 p-6 sm:p-8 shadow-sm border border-slate-200/90">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-sky-100/50 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Active Workspace</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Welcome back, {session.user.name}!
              </h1>
              <p className="text-slate-600 text-sm max-w-xl leading-relaxed">
                Organize documents, collaborate in real time on spatial whiteboards, and manage workspace permissions effortlessly.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <Link href="/">
                <Button variant="outline" size="sm" className="bg-white text-slate-700 border-slate-300 hover:bg-slate-50 text-xs shadow-xs">
                  Landing Page
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Pending Workspace Invitations Banner */}
        {pendingInvitations.length > 0 && (
          <PendingInvitationsBanner
            invitations={pendingInvitations.map((inv) => ({
              id: inv.id,
              token: inv.token,
              role: inv.role,
              createdAt: inv.createdAt.toISOString(),
              workspace: inv.workspace,
              inviter: inv.inviter,
            }))}
          />
        )}

        {/* Workspace Overview Container */}
        <div className="rounded-3xl p-6 sm:p-8 bg-white border border-slate-200/90 shadow-sm space-y-6">
          {/* Section Header */}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Your workspace
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Everything your team needs to create and collaborate.
            </p>
          </div>

          {/* Metric Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Documents Card */}
            <div className="p-5 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-sky-300 hover:shadow-xs transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Documents</p>
                <p className="text-3xl font-black text-slate-900 tracking-tight mt-1">
                  {totalDocuments}
                </p>
              </div>
            </div>

            {/* Boards Card */}
            <div className="p-5 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-sky-300 hover:shadow-xs transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Boards</p>
                <p className="text-3xl font-black text-slate-900 tracking-tight mt-1">
                  {totalBoards}
                </p>
              </div>
            </div>

            {/* Workspaces Card */}
            <div className="p-5 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-sky-300 hover:shadow-xs transition-all space-y-3 sm:col-span-2 lg:col-span-1">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center">
                <FolderKanban className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Workspaces</p>
                <p className="text-3xl font-black text-slate-900 tracking-tight mt-1">
                  {totalWorkspaces}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700 tracking-wide uppercase font-mono">
                Quick Actions
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Link
                href={primaryWorkspace ? `/workspaces/${primaryWorkspace.id}` : "#workspaces-section"}
                className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-sky-300 hover:shadow-xs transition-all flex flex-col gap-2 group"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FilePlus className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-900 group-hover:text-sky-600 transition-colors block">
                    Create Document
                  </span>
                  <span className="text-[11px] text-slate-500">Rich-text block doc</span>
                </div>
              </Link>

              <Link
                href={primaryWorkspace ? `/workspaces/${primaryWorkspace.id}/canvas` : "#workspaces-section"}
                className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-amber-300 hover:shadow-xs transition-all flex flex-col gap-2 group"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-900 group-hover:text-amber-600 transition-colors block">
                    Open Canvas
                  </span>
                  <span className="text-[11px] text-slate-500">Spatial whiteboard</span>
                </div>
              </Link>

              <Link
                href={primaryWorkspace ? `/workspaces/${primaryWorkspace.id}?tab=sketchboards` : "#workspaces-section"}
                className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-purple-300 hover:shadow-xs transition-all flex flex-col gap-2 group"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-900 group-hover:text-purple-600 transition-colors block">
                    Create Sketchboard
                  </span>
                  <span className="text-[11px] text-slate-500">Vector whiteboard</span>
                </div>
              </Link>

              <a
                href="#workspaces-section"
                className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-emerald-300 hover:shadow-xs transition-all flex flex-col gap-2 group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors block">
                    Create Workspace
                  </span>
                  <span className="text-[11px] text-slate-500">Add team space</span>
                </div>
              </a>
            </div>
          </div>

          {/* Recent Activity Section */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-900">Recent activity</h3>
              </div>
              {recentItems.length > 0 && (
                <span className="text-xs text-slate-500 font-medium">
                  {recentItems.length} recent {recentItems.length === 1 ? "item" : "items"}
                </span>
              )}
            </div>

            {recentItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/50 p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center mx-auto">
                  <Clock className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-800">No recent activity yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Your recent documents and boards will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {recentItems.slice(0, 6).map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-sky-300 hover:shadow-xs transition-all flex items-center justify-between group shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shrink-0">
                        {item.type === "document" && <FileText className="w-4 h-4" />}
                        {item.type === "canvas" && <Sparkles className="w-4 h-4" />}
                        {item.type === "sketchboard" && <Palette className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-slate-900 truncate group-hover:text-sky-600 transition-colors">
                          {item.title}
                        </h4>
                        <div className="text-[11px] text-slate-500 truncate flex items-center gap-2 mt-0.5">
                          <span className="font-mono flex items-center gap-1">
                            <span>{item.workspaceIcon}</span>
                            <span>{item.workspaceName}</span>
                          </span>
                          <span className="text-slate-300">•</span>
                          <span>{formatRelativeTime(item.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Real Workspaces Section */}
        <div className="rounded-3xl p-6 sm:p-8 border border-slate-200/90 bg-white shadow-sm">
          <WorkspaceList initialWorkspaces={workspaces} userId={session.user.id} />
        </div>
      </main>
    </div>
  );
}
