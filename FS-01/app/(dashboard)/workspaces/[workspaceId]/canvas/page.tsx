import { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-server";
import { getWorkspaceForUser } from "@/lib/services/workspace";
import { getCanvasForWorkspace } from "@/lib/services/canvas";
import { CanvasView } from "@/components/canvas/canvas-view";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CanvasRouteProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export const instant = false;

export async function generateMetadata({
  params,
}: CanvasRouteProps): Promise<Metadata> {
  const { workspaceId } = await params;
  return {
    title: `Spatial Canvas | SyncSpace`,
    description: `Real-time spatial whiteboard and diagramming canvas for workspace ${workspaceId}`,
  };
}

export default async function WorkspaceCanvasPage({ params }: CanvasRouteProps) {
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
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-900">
              Access Denied or Not Found
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You do not have permission to access the spatial canvas in this workspace, or it may have been deleted.
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

  const savedCanvas = await getCanvasForWorkspace(workspaceId, session.user.id);

  return (
    <CanvasView
      workspace={{
        id: workspace.id,
        name: workspace.name,
        ownerId: workspace.ownerId,
        currentUserRole: workspace.currentUserRole,
        canEdit: workspace.canEdit,
      }}
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      }}
      initialCanvas={savedCanvas ?? undefined}
    />
  );
}
