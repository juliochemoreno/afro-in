import type { APIRoute } from "astro";
import {
  ENV_ADMIN_ID,
  hashPassword,
  verifyPassword,
  createAdminSessionToken,
  getSessionSecret,
  setAdminSessionCookie,
  timingSafeEqualStrings,
} from "../../lib/adminAuth";

export const prerender = false;

const MAX_PAYLOAD_BYTES = 4096;
// Fixed salt for the dummy hash that equalizes timing when no account matches.
const DUMMY_SALT = "00".repeat(16);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const env = (locals as any).runtime?.env ?? {};
  const db = env.DB;

  // Fail closed: without the signing secret no session can be issued.
  if (!getSessionSecret(env)) {
    console.error("admin login: ADMIN_SESSION_SECRET is not configured");
    return json({ ok: false, error: "not_configured" }, 500);
  }

  const raw = await request.text();
  if (raw.length > MAX_PAYLOAD_BYTES) {
    return json({ ok: false, error: "bad_request" }, 413);
  }
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }
  if (!body || typeof body !== "object") {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  const user = String(body.user ?? "").trim();
  const pass = String(body.password ?? "");

  if (!user || !pass) {
    return json({ ok: false, error: "invalid" }, 400);
  }

  let authenticatedAdmin: {
    id: number;
    email: string;
    role: string;
    credential: string;
  } | null = null;

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
            credential: adminRow.password_hash,
          };
        }
      } else {
        // Same PBKDF2 cost as a real account, so timing does not reveal
        // which emails belong to active admins.
        await hashPassword(pass, DUMMY_SALT);
      }
    } catch (err) {
      console.error("Error querying admins table in D1:", err);
    }
  }

  // 2. Fallback: the break-glass environment account (ADMIN_USER / ADMIN_PASSWORD).
  if (!authenticatedAdmin) {
    const expectedUser = String(env.ADMIN_USER || "admin");
    const expectedPass = env.ADMIN_PASSWORD;

    if (expectedPass) {
      const [userOk, userAtOk, passOk] = await Promise.all([
        timingSafeEqualStrings(user, expectedUser),
        timingSafeEqualStrings(user, `${expectedUser}@afroin.com`),
        timingSafeEqualStrings(pass, String(expectedPass)),
      ]);
      if ((userOk || userAtOk) && passOk) {
        authenticatedAdmin = {
          id: ENV_ADMIN_ID,
          email: expectedUser,
          role: "superadmin",
          credential: String(expectedPass),
        };
      }
    }
  }

  if (!authenticatedAdmin) {
    return json({ ok: false, error: "invalid" }, 401);
  }

  // Create signed session token
  const token = await createAdminSessionToken(authenticatedAdmin, env);
  setAdminSessionCookie(cookies, token, request.url);

  const { credential: _credential, ...sessionUser } = authenticatedAdmin;
  return json({ ok: true, user: sessionUser });
};
