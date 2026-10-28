import type { APIRoute } from "astro";
import { requireAdmin, adminUnauthorized } from "@/lib/adminAuth";
import { checkInTicket } from "@/lib/tickets";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

interface CheckinBody {
  code?: string;
}

// POST { code } -> check in a ticket. Admin only.
export const POST: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const db = (ctx.locals as any).runtime.env.DB;

  let body: CheckinBody;
  try {
    body = (await ctx.request.json()) as CheckinBody;
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const code = typeof body.code === "string" ? body.code.trim().slice(0, 40) : "";
  if (!code) return json({ error: "Código requerido" }, 400);

  const result = await checkInTicket(db, code);
  return json(result, 200);
};
