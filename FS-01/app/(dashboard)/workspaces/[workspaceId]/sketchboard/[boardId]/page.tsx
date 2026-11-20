import { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-server";
import { getWorkspaceForUser } from "@/lib/services/workspace";
import { getSketchboardById } from "@/lib/services/sketchboard";
import { SketchboardView } from "@/components/sketchboard/sketchboard-view";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SketchboardBoardRouteProps {
  params: Promise<{
    workspaceId: string;
    boardId: string;
  }>;
}

export const instant = false;

export async function generateMetadata({
  params,
}: SketchboardBoardRouteProps): Promise<Metadata> {
  const { workspaceId, boardId } = await params;
  return {
    title: `Sketchboard | SyncSpace`,
    description: `Infinite digital whiteboard for board ${boardId} in workspace ${workspaceId}`,
  };
}

export default async function WorkspaceSketchboardDetailPage({
  params,
}: SketchboardBoardRouteProps) {
  const [session, { workspaceId, boardId }] = await Promise.all([
    requireAuth("/login"),
    params,
  ]);

  const workspace = await getWorkspaceForUser(workspaceId, session.user.id);
  if (!workspace) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-slate-900">
              Access Denied or Not Found
            </h1>
            <p className="text-xs text-slate-500">
              You do not have permission to access this workspace.
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

  const savedSketchboard = await getSketchboardById(boardId, session.user.id);
  if (!savedSketchboard || savedSketchboard.workspaceId !== workspaceId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-slate-900">
              Sketchboard Not Found
            </h1>
            <p className="text-xs text-slate-500">
              This sketchboard could not be found or you do not have permission to access it.
            </p>
          </div>
          <Link href={`/workspaces/${workspaceId}/sketchboard`} className="inline-block pt-2">
            <Button variant="primary" size="sm">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              <span>Open Primary Sketchboard</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <SketchboardView
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
      initialSketchboard={savedSketchboard}
    />
  );
}

