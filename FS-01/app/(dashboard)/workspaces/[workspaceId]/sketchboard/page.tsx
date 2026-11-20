import { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-server";
import { getWorkspaceForUser } from "@/lib/services/workspace";
import { getSketchboardForWorkspace } from "@/lib/services/sketchboard";
import { SketchboardView } from "@/components/sketchboard/sketchboard-view";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SketchboardRouteProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export const instant = false;

export async function generateMetadata({
  params,
}: SketchboardRouteProps): Promise<Metadata> {
  const { workspaceId } = await params;
  return {
    title: `Sketchboard | SyncSpace`,
    description: `Infinite digital whiteboard, wireframing, and brainstorming canvas for workspace ${workspaceId}`,
  };
}

export default async function WorkspaceSketchboardPage({
  params,
}: SketchboardRouteProps) {
  const [session, { workspaceId }] = await Promise.all([
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
              You do not have permission to access the Sketchboard in this workspace, or it may have been deleted.
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

  const savedSketchboard = await getSketchboardForWorkspace(workspaceId, session.user.id);

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
      initialSketchboard={savedSketchboard ?? undefined}
    />
  );
}

