import type { APIRoute } from "astro";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  getAdminSessionToken,
} from "../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const env = (locals as any).runtime?.env ?? {};
  const expectedUser = env.ADMIN_USER || "admin";
  const expectedPass = env.ADMIN_PASSWORD;

  // Fail closed if the admin password isn't configured.
  if (!expectedPass) return json({ ok: false, error: "not_configured" }, 500);

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  const user = String(body.user ?? "").trim();
  const pass = String(body.password ?? "");

  if (user !== expectedUser || pass !== expectedPass) {
    return json({ ok: false, error: "invalid" }, 401);
  }

  const token = await getAdminSessionToken(env);
  const isHttps = new URL(request.url).protocol === "https:";
  cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: isHttps, // allow the cookie over http on localhost during dev
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });

  return json({ ok: true });
};
