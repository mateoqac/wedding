import type { APIRoute } from "astro";
import { isLocalStorage } from "@/exports/local-storage";
import { getContainer } from "@/server/container";

const TYPES: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg" };

/** Serves locally stored exports behind signed, short-lived URLs (dev stand-in for R2). */
export const GET: APIRoute = async ({ params, url }) => {
  const storage = getContainer().storage;
  if (!isLocalStorage(storage)) return new Response(null, { status: 404 });
  const objectPath = params.path ?? "";
  const body = await storage.read(
    objectPath,
    url.searchParams.get("expires") ?? "",
    url.searchParams.get("signature") ?? "",
  );
  if (!body) return new Response("Enlace vencido o inválido", { status: 403 });
  const extension = objectPath.split(".").pop() ?? "";
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": TYPES[extension] ?? "application/octet-stream",
      "content-disposition": `attachment; filename="parte.${extension}"`,
    },
  });
};
