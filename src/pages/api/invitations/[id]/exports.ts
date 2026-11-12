import type { APIRoute } from "astro";
import { FORMATS, type Format } from "@/invitations/formats";
import { getContainer } from "@/server/container";
import { accessFor, json } from "@/server/http";

/** Download request: checks ownership here and `paid` in the export service (design §7). */
export const POST: APIRoute = async ({ params, request, cookies, locals }) => {
  const id = params.id as string;
  const container = getContainer();
  const invitation = await container.invitations.load(id, accessFor(cookies, id, locals.user?.id));
  if (!invitation) return json({ status: "not_found" }, 404);
  const body = (await request.json().catch(() => ({}))) as { format?: string };
  if (!FORMATS.includes(body.format as Format)) return json({ status: "invalid_format" }, 400);
  await container.bossReady;
  const result = await container.exports.requestExport({ invitationId: id, format: body.format as Format });
  const status = { ready: 200, queued: 202, not_paid: 402, not_found: 404, rate_limited: 429 }[result.status];
  return json(result, status);
};
