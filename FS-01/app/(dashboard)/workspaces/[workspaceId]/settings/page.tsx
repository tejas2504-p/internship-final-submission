import { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-server";
import { getWorkspaceForUser } from "@/lib/services/workspace";
import { WorkspaceSettingsView } from "@/components/workspace/workspace-settings-view";
import { Layers, ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { WorkspaceDetailData } from "@/types/workspace";

interface WorkspaceSettingsPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export const instant = false;

export async function generateMetadata({
  params,
}: WorkspaceSettingsPageProps): Promise<Metadata> {
  const { workspaceId } = await params;
  return {
    title: `Settings | SyncSpace Workspace`,
    description: `Manage settings, roles, members, and permissions for workspace ${workspaceId}`,
  };
}

export default async function WorkspaceSettingsPage({ params }: WorkspaceSettingsPageProps) {
  const [session, { workspaceId }] = await Promise.all([
    requireAuth("/login"),
    params,
  ]);

  const workspace = await getWorkspaceForUser(workspaceId, session.user.id);

  if (!workspace) {
    return (
      <div className="min-h-screen bg-slate-50/50 dark:bg-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-white rounded-2xl p-8 border border-slate-200 dark:border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-900">Access Denied or Not Found</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You do not have permission to access this workspace settings, or it may have been deleted.
            </p>
          </div>
          <Link href="/dashboard" className="inline-block pt-2">
            <Button variant="primary" size="sm">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              <span>Return to Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col transition-colors">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 w-full glassmorphism-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href={`/workspaces/${workspace.id}`} className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-500 p-0.5 shadow-xs flex items-center justify-center">
                  <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center transition-colors">
                    <Layers className="w-5 h-5 text-indigo-600" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg tracking-tight text-slate-900 flex items-center gap-1.5">
                    {workspace.icon || "📁"} {workspace.name}
                  </span>
                  <span className="text-[10px] text-slate-500 -mt-1 font-medium">
                    Workspace Settings
                  </span>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link href={`/workspaces/${workspace.id}`}>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  <span className="hidden sm:inline">Back to Workspace</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </Link>
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Workspace Settings & Administration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage settings, members, role assignments, and pending invitations for {workspace.name}.
          </p>
        </div>

        <WorkspaceSettingsView
          workspace={workspace as unknown as WorkspaceDetailData}
          currentUserId={session.user.id}
        />
      </main>
    </div>
  );
}

