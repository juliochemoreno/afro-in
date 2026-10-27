import type { APIRoute } from "astro";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  verifyPassword,
  createAdminSessionToken,
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
  const db = env.DB;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  const user = String(body.user ?? "").trim();
  const pass = String(body.password ?? "");

  if (!user || !pass) {
    return json({ ok: false, error: "invalid" }, 400);
  }

  let authenticatedAdmin: { id?: number; email: string; role?: string } | null = null;

  // 1. Check D1 admins table if database is available
  if (db) {
    try {
      const adminRow = await db
        .prepare(
          "SELECT id, email, name, password_hash, salt, role, is_active FROM admins WHERE LOWER(email) = LOWER(?) OR LOWER(email) = LOWER(?)"
        )
        .bind(user, user.includes("@") ? user : `${user}@afroin.com`)
        .first();

      if (adminRow && adminRow.is_active === 1) {
        const valid = await verifyPassword(pass, adminRow.password_hash, adminRow.salt);
        if (valid) {
          authenticatedAdmin = {
            id: adminRow.id,
            email: adminRow.email,
            role: adminRow.role,
          };
        }
      }
    } catch (err) {
      console.error("Error querying admins table in D1:", err);
    }
  }

  // 2. Fallback check with environment variables (ADMIN_USER / ADMIN_PASSWORD)
  if (!authenticatedAdmin) {
    const expectedUser = env.ADMIN_USER || "admin";
    const expectedPass = env.ADMIN_PASSWORD;

    if (expectedPass && (user === expectedUser || user === `${expectedUser}@afroin.com`) && pass === expectedPass) {
      authenticatedAdmin = {
        id: 1,
        email: expectedUser,
        role: "superadmin",
      };
    }
  }

  if (!authenticatedAdmin) {
    return json({ ok: false, error: "invalid" }, 401);
  }

  // Create signed session token
  const token = await createAdminSessionToken(authenticatedAdmin, env);
  const isHttps = new URL(request.url).protocol === "https:";

  cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: isHttps, // allow the cookie over http on localhost during dev
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });

  return json({ ok: true, user: authenticatedAdmin });
};
