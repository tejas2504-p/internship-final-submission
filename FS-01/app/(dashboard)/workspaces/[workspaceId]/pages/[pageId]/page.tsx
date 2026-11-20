import { requireAuth } from "@/lib/auth-server";
import { getPageForUser } from "@/lib/services/workspace";
import { PageEditorView } from "@/components/workspace/page-editor-view";
import { signCollabToken } from "@/src/lib/collaboration/token";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import Link from "next/link";
import { Layers, ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/auth/logout-button";

interface PageRouteProps {
  params: Promise<{
    workspaceId: string;
    pageId: string;
  }>;
}

export const instant = false;

export default async function WorkspacePageDetail({ params }: PageRouteProps) {
  const [session, { workspaceId, pageId }] = await Promise.all([
    requireAuth("/login"),
    params,
  ]);

  const page = await getPageForUser(workspaceId, pageId, session.user.id);

  if (!page) {
    return (
      <div className="min-h-screen bg-slate-50/50 dark:bg-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-white rounded-2xl p-8 border border-slate-200 dark:border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-900">Page Not Found or Access Denied</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You do not have permission to view this document, or it has been removed.
            </p>
          </div>
          <Link href={`/workspaces/${workspaceId}`} className="inline-block pt-2">
            <Button variant="primary" size="sm">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              <span>Back to Workspace</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const initials = session.user.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const collabToken = signCollabToken({
    userId: session.user.id,
    userName: session.user.name || "Anonymous",
    workspaceId,
    pageId,
    canEdit: page.canEdit,
    role: page.currentUserRole,
  });

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-white text-slate-900 dark:text-slate-900 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 w-full glassmorphism-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-500 p-0.5 shadow-xs flex items-center justify-center">
                  <div className="w-full h-full bg-white dark:bg-white rounded-[10px] flex items-center justify-center">
                    <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-slate-900 flex items-center gap-1.5">
                    SyncSpace
                    <Badge variant="brand" size="sm" className="font-mono text-[10px] py-0 px-1.5">
                      Docs
                    </Badge>
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 -mt-1 font-medium truncate max-w-[150px]">
                    {page.workspace.name}
                  </span>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />

              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-white border border-slate-200/80 dark:border-slate-200 shadow-2xs">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold text-xs flex items-center justify-center">
                  {initials}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-900 leading-tight">
                    {session.user.name}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                    {session.user.email}
                  </span>
                </div>
              </div>

              <LogoutButton variant="secondary" size="sm" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageEditorView
          key={page.id}
          page={page}
          initialCollabToken={collabToken}
          initialCommentCount={page.commentsCount}
        />
      </main>
    </div>
  );
}
