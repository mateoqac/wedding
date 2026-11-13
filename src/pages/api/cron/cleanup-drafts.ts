import { timingSafeEqual } from "node:crypto";
import type { APIRoute } from "astro";
import { cleanupAnonymousDrafts } from "@/invitations/draft-cleanup";
import { getContainer } from "@/server/container";

function authorized(header: string | null, secret: string | undefined) {
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Daily cleanup for serverless deployments (Vercel Cron sends `Authorization: Bearer
 * $CRON_SECRET`): deletes 30-day-inactive anonymous drafts and old rate-limit windows.
 */
export const GET: APIRoute = async ({ request }) => {
  if (!authorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const container = getContainer();
  const deleted = await cleanupAnonymousDrafts(container.db);
  await container.rateLimiter.purgeOldWindows();
  return new Response(JSON.stringify({ deleted }), { headers: { "content-type": "application/json" } });
};
