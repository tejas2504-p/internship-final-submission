/**
 * Lightweight, memory-efficient sliding-window rate limiter for sensitive endpoints.
 * Automatically cleans up stale IP/user buckets to prevent memory accumulation.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodic sweep every 5 minutes to prune completely idle buckets
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 3600000);
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, 300000).unref?.();
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

/**
 * Check and record a rate-limited request.
 *
 * @param key Unique identifier (e.g. client IP, user ID, or composite `action:ip`)
 * @param limit Maximum allowed requests in the time window
 * @param windowMs Time window in milliseconds (default: 60,000ms = 1 minute)
 */
export function checkRateLimit(
  key: string,
  limit: number = 30,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  let record = rateLimitStore.get(key);

  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Remove timestamps outside the sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0] || now;
    const resetMs = Math.max(0, windowMs - (now - oldest));
    return {
      success: false,
      limit,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);
  return {
    success: true,
    limit,
    remaining: limit - record.timestamps.length,
    resetMs: windowMs,
  };
}

/**
 * Helper to get client IP from Next.js request headers.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

