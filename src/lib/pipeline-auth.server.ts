import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Checks the `Authorization: Bearer <token>` header against the expected pipeline token.
 * Returns null when the caller is allowed, otherwise the Response to send back.
 */
export function checkPipelineAuth(authorization: string | null, expected: string | undefined): Response | null {
  if (!expected) return Response.json({ error: "Pipeline token is not configured" }, { status: 500 });
  const match = /^Bearer ([^\s,]+)$/.exec(authorization ?? "");
  const token = match?.[1];
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  if (!timingSafeEqual(digest(token), digest(expected))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
