
import { ui, defaultLang } from "./ui";
import { routes } from "./routes";

export function getLangFromUrl(url: URL) {
  const [, lang] = url.pathname.split("/");
  if (lang in ui) return lang as keyof typeof ui;
  return defaultLang;
}

export function useTranslations(lang: keyof typeof ui) {
  return function t(key: keyof (typeof ui)[typeof defaultLang]) {
    return ui[lang][key] || ui[defaultLang][key];
  };
}

export function getRouteFromUrl(url: URL): string | undefined {
  const pathname = new URL(url).pathname;
  const currentLang = getLangFromUrl(url); // e.g., 'es', 'en', 'fr'

  // Remove language prefix if present, to simulate clean logical path
  // If en: /en/program -> /program
  // If es: /programacion -> /programacion (no prefix)
  let pathToCheck = pathname;
  if (currentLang !== defaultLang) {
    pathToCheck = pathname.replace(`/${currentLang}`, "") || "/";
  }

  // Find which key in routes[currentLang] matches this path
  const currentRoutes = routes[currentLang]; // Typed as Record<string, string>

  for (const [key, route] of Object.entries(currentRoutes)) {
    if (pathToCheck === route || (route !== "/" && pathToCheck.startsWith(route + "/"))) {
      return key;
    }
  }

  return undefined;
}

export function getTranslatedPath(path: string, lang: string) {
  // Normalize path
  const cleanPath = path === "/" ? "/" : "/" + path.replace(/^\/+|\/+$/g, "");

  // Extract anchor
  const anchorIndex = cleanPath.indexOf('#');
  const anchor = anchorIndex !== -1 ? cleanPath.slice(anchorIndex) : '';
  const pathWithoutAnchor = anchorIndex !== -1 ? cleanPath.slice(0, anchorIndex) : cleanPath;

  // Find the route key assuming input is always in DEFAULT lang (Spanish) structure
  // This is the convention: we pass "/programacion" regardless of target lang
  let pageKey: keyof typeof routes.es | undefined;
  const esRoutes = routes[defaultLang];

  for (const [key, route] of Object.entries(esRoutes)) {
    if (pathWithoutAnchor === route) {
      pageKey = key as keyof typeof routes.es;
      break;
    }
    // Match subpaths like /programacion/slug, but avoid matching / for everything
    if (route !== "/" && pathWithoutAnchor.startsWith(route + "/")) {
      pageKey = key as keyof typeof routes.es;
      break;
    }
  }

  if (pageKey) {
    const targetLang = lang as keyof typeof routes;
    const targetRoute = routes[targetLang][pageKey];
    const sourceRoute = esRoutes[pageKey];

    // Construct remainder (e.g. /santa-marta)
    const remainder = pathWithoutAnchor.slice(sourceRoute.length);

    // Prefix for non-default lang
    const prefix = lang === defaultLang ? "" : `/${lang}`;

    // Avoid double slash if targetRoute is / and remainder starts with /
    const resultPath = targetRoute === "/" ? remainder : `${targetRoute}${remainder}`;

    return `${prefix}${resultPath}${anchor}`.replace('//', '/');
  }

  // Fallback: If not found in map, just prepend lang (legacy behavior covering assets etc)
  const prefix = lang === defaultLang ? "" : `/${lang}`;
  return `${prefix}${cleanPath}${anchor}`;
}
