// Shared admin-session helpers used by the middleware guard and the
// login/logout API routes. We avoid storing the password in the cookie:
// the cookie holds an HMAC-SHA256 token derived from ADMIN_USER/PASSWORD, so
// it cannot be forged without the secret and invalidates if the password
// changes.

export const ADMIN_COOKIE = "admin_session";

// 8 hours
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

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

// Constant-time-ish comparison of the cookie against the expected token.
export async function isValidAdminSession(
  env: any,
  cookieValue: string | undefined
): Promise<boolean> {
  if (!cookieValue || !env?.ADMIN_PASSWORD) return false;
  const expected = await getAdminSessionToken(env);
  if (cookieValue.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= cookieValue.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
