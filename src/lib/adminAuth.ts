// Shared admin-session helpers and credentials handling for Cloudflare D1
// and fallback environment variables.

export const ADMIN_COOKIE = "admin_session";

// 8 hours session duration
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: "superadmin" | "admin";
  is_active: number;
}

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

  const finalSaltHex =
    saltHex || [...salt].map((b) => b.toString(16).padStart(2, "0")).join("");
  const finalHashHex = [...new Uint8Array(derivedBits)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { hash: finalHashHex, salt: finalSaltHex };
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

function getHmacSecret(env: any): string {
  return String(env?.ADMIN_PASSWORD || env?.BOLD_SECRET_KEY || "afroin-secret-auth-seed");
}

// Generate signed session cookie: payloadBase64.hmacSignature
export async function createAdminSessionToken(
  user: { id?: number; email: string; role?: string },
  env: any
): Promise<string> {
  const secret = getHmacSecret(env);
  const payload = JSON.stringify({
    id: user.id || 0,
    email: user.email,
    role: user.role || "admin",
    ts: Date.now(),
  });
  const enc = new TextEncoder();
  const b64Payload = btoa(payload);

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(b64Payload));
  const hexSig = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${b64Payload}.${hexSig}`;
}

// Legacy token derived strictly from env.ADMIN_PASSWORD
export async function getAdminSessionToken(env: any): Promise<string> {
  const secret = String(env?.ADMIN_PASSWORD ?? "");
  const user = String(env?.ADMIN_USER ?? "admin");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`afroin-admin-session:${user}`)
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Verify admin session cookie (supports both new signed JWT-like cookies and legacy tokens)
export async function verifyAdminSession(
  env: any,
  cookieValue: string | undefined
): Promise<AdminUser | null> {
  if (!cookieValue) return null;

  // 1. Check if it is a signed new token (payload.signature)
  if (cookieValue.includes(".")) {
    const parts = cookieValue.split(".");
    if (parts.length === 2) {
      const [b64Payload, hexSig] = parts;
      try {
        const secret = getHmacSecret(env);
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          enc.encode(secret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );
        const sig = await crypto.subtle.sign("HMAC", key, enc.encode(b64Payload));
        const expectedSig = [...new Uint8Array(sig)]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        if (hexSig === expectedSig) {
          const payload = JSON.parse(atob(b64Payload));
          // If max age expired, invalidate
          if (Date.now() - (payload.ts || 0) > ADMIN_SESSION_MAX_AGE * 1000) {
            return null;
          }
          return {
            id: payload.id || 0,
            email: payload.email || "admin",
            name: payload.email || "Administrador",
            role: payload.role || "admin",
            is_active: 1,
          };
        }
      } catch {
        // invalid base64 or format
      }
    }
  }

  // 2. Fallback to legacy HMAC comparison with env.ADMIN_PASSWORD
  if (env?.ADMIN_PASSWORD) {
    const expected = await getAdminSessionToken(env);
    if (cookieValue.length === expected.length) {
      let diff = 0;
      for (let i = 0; i < expected.length; i++) {
        diff |= cookieValue.charCodeAt(i) ^ expected.charCodeAt(i);
      }
      if (diff === 0) {
        return {
          id: 1,
          email: String(env.ADMIN_USER || "admin"),
          name: "Administrador (Env)",
          role: "superadmin",
          is_active: 1,
        };
      }
    }
  }

  return null;
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
