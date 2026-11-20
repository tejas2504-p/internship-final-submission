import "../dns-fallback";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma 7 Client singleton for Next.js App Router.
 * Uses @prisma/adapter-pg with native pg.Pool connection pooling to prevent
 * connection exhaustion during fast-refresh cycles in local development.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function getNormalizedConnectionString(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  return url.replace(/sslmode=require\b/g, "sslmode=verify-full");
}

/**
 * Helper to determine if a database query failed due to a recoverable,
 * transient network or socket closure (such as a Neon compute scale-to-zero wakeup).
 */
function isTransientDatabaseError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const err = error as Record<string, unknown>;
  const meta = err.meta as Record<string, unknown> | undefined;
  const cause = err.cause as Record<string, unknown> | undefined;
  const originalError = err.originalError as Record<string, unknown> | undefined;
  const driverAdapterError = meta?.driverAdapterError as Record<string, unknown> | undefined;

  const msg = [
    typeof err.message === "string" ? err.message : "",
    typeof driverAdapterError?.message === "string" ? driverAdapterError.message : "",
    typeof meta?.message === "string" ? meta.message : "",
    typeof cause?.message === "string" ? cause.message : "",
    typeof originalError?.message === "string" ? originalError.message : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const code = String(err.code || cause?.code || "");

  return (
    code === "P1017" ||
    code === "P1001" ||
    code === "P1008" ||
    code === "P1011" ||
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    msg.includes("terminated") ||
    msg.includes("timeout") ||
    msg.includes("closed the connection") ||
    msg.includes("connectionclosed") ||
    msg.includes("connection closed") ||
    msg.includes("socket hang up") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("econnrefused") ||
    msg.includes("cannot_connect_now") ||
    msg.includes("unexpectedly") ||
    msg.includes("broken pipe")
  );
}

function createPrismaClient(): PrismaClient {
  const connectionString = getNormalizedConnectionString();

  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      max: process.env.NODE_ENV === "production" ? 15 : 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

  // Handle background socket closures by Neon to prevent unhandled error crashes
  pool.on("error", (err) => {
    console.warn("[pgPool] Idle connection closed or reset by server:", err.message);
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  const adapter = new PrismaPg(pool);

  const baseClient = new PrismaClient({
    adapter,
    log: process.env.DEBUG_PRISMA ? ["query", "error", "warn"] : ["error", "warn"],
  });

  // Auto-retry transient socket/connection drops (Neon scale-to-zero wakeups or idle timeouts)
  const clientWithRetry = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const MAX_RETRIES = 3;
          let attempt = 0;

          while (true) {
            try {
              return await query(args);
            } catch (error: unknown) {
              attempt++;
              const isTransient = isTransientDatabaseError(error);

              if (isTransient && attempt < MAX_RETRIES) {
                const backoff = attempt * 500; // 500ms, 1000ms
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.warn(
                  `[Prisma] Transient connection error on ${model}.${operation} (attempt ${attempt}/${MAX_RETRIES}): ${errorMsg}. Retrying in ${backoff}ms on a fresh connection...`
                );
                await new Promise((resolve) => setTimeout(resolve, backoff));
                continue;
              }

              throw error;
            }
          }
        },
      },
    },
  });

  return clientWithRetry as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
