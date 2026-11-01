import type { APIRoute } from "astro";
import { getEventBySlug } from "@/lib/tickets";
import { publicSale } from "@/lib/ticketStages";
import { SALES } from "@/lib/programacion";

export const prerender = false;

// Which price stage of the 2027 pass is in force, for the prerendered
// programacion pages. Public: only the stage (id, price) and the sale state,
// never counts. The pass is fixed (no query parameter), so the response can be
// cached for everyone.
const CACHE_SECONDS = 60;
const slug = SALES.tickets.url.split("/").filter(Boolean).pop() ?? "";

const json = (body: unknown, status: number, cache: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": cache },
  });

export const GET: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime?.env?.DB;
  if (!db || !slug) return json({ error: "unavailable" }, 503, "no-store");

  // Workers Cache API: keeps D1 from being read on every visit. Best effort.
  const cache = (globalThis as any).caches?.default as Cache | undefined;
  const key = new Request(new URL("/api/tickets/stages", request.url).toString());
  try {
    const hit = await cache?.match(key);
    if (hit) return hit;
  } catch {}

  try {
    const event = await getEventBySlug(db, slug);
    // No stages (single-price event) or event over: the page keeps its date-based tiers.
    if (!event?.sale) return json({ error: "not_found" }, 404, `public, max-age=${CACHE_SECONDS}`);
    // The event quota can run out before a stage quota does.
    const sale = event.soldOut ? { state: "ended" as const, current: null } : publicSale(event.sale);
    const res = json(sale, 200, `public, max-age=${CACHE_SECONDS}`);
    try {
      await cache?.put(key, res.clone());
    } catch {}
    return res;
  } catch (error) {
    console.error("Error reading ticket stages:", error);
    return json({ error: "server_error" }, 500, "no-store");
  }
};
