import { defineMiddleware, sequence } from "astro:middleware";
import { ADMIN_COOKIE, verifyAdminSession } from "./lib/adminAuth";
import { DOOR_PATH, doorHostRoute, isDoorHost, isDoorPath } from "./lib/doorHost";

const SUPPORTED_LANGS = ["es", "en", "fr"] as const;
const DEFAULT_LANG = "es";
const COOKIE_NAME = "preferred-lang";
const PRODUCTION_HOSTS = new Set(["afroin.org", "www.afroin.org"]);

// Cloudflare adds noindex only to workers.dev Previews, not to custom-domain
// Previews (<name>.afroin.org). Any host outside production gets it here;
// static assets get it from public/_headers. Runs outermost so redirects
// returned by handleRequest carry it too.
const noindexOutsideProduction = defineMiddleware(async (context, next) => {
  const response = await next();
  if (!PRODUCTION_HOSTS.has(new URL(context.request.url).hostname)) {
    response.headers.set("X-Robots-Tag", "noindex");
  }
  return response;
});

const handleRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  // Astro routes on the decoded path, so every check below must use it too:
  // otherwise /%61dmin/... renders an admin page without the session check.
  let pathname: string;
  try {
    pathname = decodeURI(url.pathname);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Door host (checkin.afroin.org): only the door and its login. Other admin
  // pages go to the door, other APIs do not exist there. Static files are
  // served before the Worker, so they never reach this.
  if (isDoorHost(url.hostname)) {
    const route = doorHostRoute(pathname);
    if (route === "door") return context.redirect(DOOR_PATH, 302);
    if (route === "not_found") {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 0. Protect /admin routes with a cookie-based session. The login page
  // itself is excluded so unauthenticated users can reach it.
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const env = (context.locals as any).runtime?.env ?? {};
    const cookie = context.cookies.get(ADMIN_COOKIE)?.value;
    const admin = await verifyAdminSession(env, cookie);
    if (!admin) {
      return context.redirect(
        `/admin/login?next=${encodeURIComponent(pathname)}`,
        302
      );
    }
    // Door accounts (D26) see only the door; the APIs refuse them in
    // requireAdmin.
    if (admin.role === "door" && !isDoorPath(pathname)) {
      return context.redirect(DOOR_PATH, 302);
    }
    context.locals.admin = admin;
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

export const onRequest = sequence(noindexOutsideProduction, handleRequest);
