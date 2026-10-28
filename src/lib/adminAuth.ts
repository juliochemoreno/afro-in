// Shared admin-session helpers and credentials handling for Cloudflare D1
// and the break-glass environment account.
//
// Sessions are signed with ADMIN_SESSION_SECRET only. Without it (or with one
// shorter than MIN_SESSION_SECRET_LENGTH) no session is created or accepted:
// the admin area fails closed instead of falling back to a guessable key.

export const ADMIN_COOKIE = "admin_session";

// 8 hours session duration
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

export { MIN_ADMIN_PASSWORD_LENGTH } from "@/lib/adminPolicy";

// Id carried by sessions of the environment account (ADMIN_USER /
// ADMIN_PASSWORD). D1 ids start at 1, so it never matches a D1 admin.
export const ENV_ADMIN_ID = 0;

const MIN_SESSION_SECRET_LENGTH = 32;

// Accept tokens stamped up to this far in the future (clock skew).
const MAX_CLOCK_SKEW_MS = 60 * 1000;

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: "superadmin" | "admin";
  is_active: number;
}

const toHex = (bytes: ArrayBuffer | Uint8Array): string =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

// Derive PBKDF2 hash using Web Crypto API (supported natively in Cloudflare Workers)
export async function hashPassword(
  password: string,
  saltHex?: string
): Promise<{ hash: string; salt: string }> {
  const enc = new TextEncoder();
  const salt = saltHex
    ? new Uint8Array((saltHex.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16)))
    : crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return { hash: toHex(derivedBits), salt: saltHex || toHex(salt) };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  const { hash } = await hashPassword(password, storedSalt);
  if (hash.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) {
    diff |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}

/** Constant-time string comparison (compares SHA-256 digests of both sides). */
export async function timingSafeEqualStrings(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** The session signing secret, or null when it is missing or too short. */
export function getSessionSecret(env: any): string | null {
  const secret = env?.ADMIN_SESSION_SECRET;
  return typeof secret === "string" && secret.length >= MIN_SESSION_SECRET_LENGTH
    ? secret
    : null;
}

function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  );
}

// UTF-8 safe base64 (btoa alone throws on non-Latin-1 characters).
function encodePayload(json: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)));
}

function decodePayload(b64: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

// Keyed fingerprint of the account's current credential (the D1 password hash,
// or ADMIN_PASSWORD for the environment account). Stored in the session so a
// password change or rotation ends existing sessions. Keyed with the session
// secret so the cookie reveals nothing usable about the password.
async function credentialFingerprint(secret: string, credential: string): Promise<string> {
  const key = await hmacKey(secret, "sign");
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`credential:${credential}`)
  );
  return toHex(sig).slice(0, 32);
}

// Generate signed session cookie: payloadBase64.hmacSignatureHex
// `credential` is the D1 password_hash, or ADMIN_PASSWORD for the env account.
// Throws when ADMIN_SESSION_SECRET is not configured.
export async function createAdminSessionToken(
  user: { id: number; email: string; role: string; credential: string },
  env: any
): Promise<string> {
  const secret = getSessionSecret(env);
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");

  const b64Payload = encodePayload(
    JSON.stringify({
      id: user.id,
      email: user.email,
      role: user.role,
      pv: await credentialFingerprint(secret, user.credential),
      ts: Date.now(),
    })
  );
  const key = await hmacKey(secret, "sign");
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(b64Payload));
  return `${b64Payload}.${toHex(sig)}`;
}

/** Set the admin session cookie (shared by login and self password change). */
export function setAdminSessionCookie(
  cookies: { set(name: string, value: string, options: any): void },
  token: string,
  requestUrl: string
): void {
  cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: new URL(requestUrl).protocol === "https:", // http on localhost during dev
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
}

// Verify an admin session cookie. The signature only proves who logged in and
// when; the account itself is re-read from D1 on every call, so deactivating,
// deleting or demoting an admin, or changing their password, takes effect on
// their next request.
export async function verifyAdminSession(
  env: any,
  cookieValue: string | undefined
): Promise<AdminUser | null> {
  const secret = getSessionSecret(env);
  if (!secret || !cookieValue) return null;

  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [b64Payload, hexSig] = parts;
  if (!/^[0-9a-f]{64}$/.test(hexSig)) return null;

  try {
    const sigBytes = Uint8Array.from(hexSig.match(/.{2}/g)!, (h) => parseInt(h, 16));
    const key = await hmacKey(secret, "verify");
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(b64Payload)
    );
    if (!valid) return null;

    const payload = JSON.parse(decodePayload(b64Payload));
    const ts = Number(payload?.ts);
    const age = Date.now() - ts;
    if (!Number.isFinite(ts) || age < -MAX_CLOCK_SKEW_MS || age > ADMIN_SESSION_MAX_AGE * 1000) {
      return null;
    }

    const id = Number(payload?.id);
    if (!Number.isInteger(id) || id < 0) return null;
    const pv = typeof payload?.pv === "string" ? payload.pv : "";
    const sameCredential = async (credential: string) =>
      timingSafeEqualStrings(pv, await credentialFingerprint(secret, credential));

    if (id === ENV_ADMIN_ID) {
      // The environment account is valid only while it is configured, and
      // only with the password it logged in with.
      if (!env?.ADMIN_PASSWORD) return null;
      if (!(await sameCredential(String(env.ADMIN_PASSWORD)))) return null;
      return {
        id: ENV_ADMIN_ID,
        email: String(env.ADMIN_USER || "admin"),
        name: "Administrador (Env)",
        role: "superadmin",
        is_active: 1,
      };
    }

    const db = env?.DB;
    if (!db) return null;
    const row = await db
      .prepare(
        "SELECT id, email, name, role, is_active, password_hash FROM admins WHERE id = ?"
      )
      .bind(id)
      .first();
    if (!row || Number(row.is_active) !== 1) return null;
    if (!(await sameCredential(String(row.password_hash)))) return null;
    return {
      id: Number(row.id),
      email: String(row.email),
      name: String(row.name),
      role: row.role === "superadmin" ? "superadmin" : "admin",
      is_active: 1,
    };
  } catch {
    // Bad base64/JSON, or D1 unavailable: fail closed.
    return null;
  }
}

// Backward-compatible boolean checker
export async function isValidAdminSession(
  env: any,
  cookieValue: string | undefined
): Promise<boolean> {
  const session = await verifyAdminSession(env, cookieValue);
  return session !== null;
}

// Guard for /api/admin/* endpoints
export async function requireAdmin(context: {
  locals: any;
  cookies: { get(name: string): { value: string } | undefined };
}): Promise<AdminUser | null> {
  const env = (context.locals as any).runtime?.env ?? {};
  const cookie = context.cookies.get(ADMIN_COOKIE)?.value;
  return verifyAdminSession(env, cookie);
}

export function adminUnauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
