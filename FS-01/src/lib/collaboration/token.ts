import crypto from "crypto";

export interface CollabTokenPayload {
  userId: string;
  userName: string;
  workspaceId: string;
  pageId: string;
  canEdit: boolean;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Get secret key for collaboration token signing.
 */
export function getCollabSecret(): string {
  const secret =
    process.env.COLLAB_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    process.env.AUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL: COLLAB_SECRET or BETTER_AUTH_SECRET must be configured in production environment."
      );
    }
    return "syncspace-collaboration-internal-secret-key-32-chars";
  }

  return secret;
}

/**
 * Cryptographically sign a collaboration token with HMAC-SHA256.
 * Format: base64url(payload).base64url(signature)
 */
export function signCollabToken(
  payload: Omit<CollabTokenPayload, "iat" | "exp">,
  expiresInSeconds: number = 60 * 60 * 2 // 2 hours default
): string {
  const secret = getCollabSecret();
  const now = Date.now();
  const fullPayload: CollabTokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds * 1000,
  };

  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Verify and decode a collaboration token.
 * Validates HMAC signature with constant-time equality check and verifies expiration.
 */
export function verifyCollabToken(token: string): CollabTokenPayload | null {
  try {
    if (!token || typeof token !== "string") return null;

    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    const secret = getCollabSecret();

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payloadB64)
      .digest("base64url");

    // Timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return null;
    }

    const payload: CollabTokenPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    );

    // Verify token expiration
    if (Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
