import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Retrieve current user session on the server in Next.js 16 (App Router).
 * Includes auto-retry and safe fallback for transient database wakeups.
 */
export async function getServerSession() {
  try {
    const reqHeaders = await headers();
    return await auth.api.getSession({
      headers: reqHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      "[getServerSession] Transient error retrieving session, retrying once:",
      message
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const reqHeaders = await headers();
      return await auth.api.getSession({
        headers: reqHeaders,
      });
    } catch (retryErr: unknown) {
      const retryMessage = retryErr instanceof Error ? retryErr.message : String(retryErr);
      console.error(
        "[getServerSession] Failed to get session after retry:",
        retryMessage
      );
      return null;
    }
  }
}

/**
 * Enforce authentication on a server page/route.
 * If unauthenticated, triggers a server-side redirect to the login page.
 */
export async function requireAuth(redirectTo: string = "/login") {
  const session = await getServerSession();
  if (!session) {
    redirect(redirectTo);
  }
  return session;
}
