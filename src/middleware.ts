import { defineMiddleware } from "astro:middleware";

const SUPPORTED_LANGS = ["es", "en", "fr"] as const;
const DEFAULT_LANG = "es";
const COOKIE_NAME = "preferred-lang";

function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="AFRO IN Admin", charset="UTF-8"',
    },
  });
}

export const onRequest = defineMiddleware((context, next) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  // 0. Protect /admin routes with HTTP Basic Auth
  if (pathname.startsWith("/admin")) {
    const env = (context.locals as any).runtime?.env ?? {};
    const expectedUser = env.ADMIN_USER || "admin";
    const expectedPass = env.ADMIN_PASSWORD;

    // Fail closed: if no password is configured, deny access
    if (!expectedPass) return unauthorized();

    const header = context.request.headers.get("authorization") || "";
    if (!header.startsWith("Basic ")) return unauthorized();

    let user = "";
    let pass = "";
    try {
      const decoded = atob(header.slice(6));
      const idx = decoded.indexOf(":");
      user = decoded.slice(0, idx);
      pass = decoded.slice(idx + 1);
    } catch {
      return unauthorized();
    }

    if (user !== expectedUser || pass !== expectedPass) return unauthorized();
  }

  // 1. Redirect www to non-www
  if (url.hostname.startsWith("www.")) {
    const newHostname = url.hostname.replace("www.", "");
    const newUrl = new URL(context.request.url);
    newUrl.hostname = newHostname;
    newUrl.protocol = "https:";
    return context.redirect(newUrl.toString(), 301);
  }

  // 2. Force HTTPS (skip localhost)
  if (
    url.protocol === "http:" &&
    !url.hostname.includes("localhost") &&
    !url.hostname.includes("127.0.0.1")
  ) {
    const newUrl = new URL(context.request.url);
    newUrl.protocol = "https:";
    return context.redirect(newUrl.toString(), 301);
  }

  // 3. Language detection - only on root path "/"
  if (pathname === "/") {
    const cookies = context.request.headers.get("cookie") || "";
    const preferredLangMatch = cookies.match(
      new RegExp(`${COOKIE_NAME}=([^;]+)`)
    );
    const preferredLang = preferredLangMatch?.[1];

    // If user has a preference cookie, respect it
    if (preferredLang && SUPPORTED_LANGS.includes(preferredLang as any)) {
      if (preferredLang !== DEFAULT_LANG) {
        return context.redirect(`/${preferredLang}/`, 302);
      }
      // Preferred is Spanish (default), continue to /
      return next();
    }

    // No cookie - detect from Accept-Language header
    const acceptLanguage = context.request.headers.get("accept-language") || "";
    const browserLangs = acceptLanguage
      .split(",")
      .map((lang) => {
        const [code] = lang.trim().split(";");
        return code.split("-")[0].toLowerCase();
      })
      .filter((lang) => SUPPORTED_LANGS.includes(lang as any));

    const detectedLang = browserLangs[0] || DEFAULT_LANG;

    // Redirect if detected language is not the default
    if (detectedLang !== DEFAULT_LANG) {
      return context.redirect(`/${detectedLang}/`, 302);
    }
  }

  return next();
});
