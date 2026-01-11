
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
  const currentLang = getLangFromUrl(url);

  let pathToCheck = pathname;
  if (currentLang !== defaultLang) {
    pathToCheck = pathname.replace(`/${currentLang}`, "") || "/";
  }

  const currentRoutes = routes[currentLang];

  for (const [key, route] of Object.entries(currentRoutes)) {
    if (pathToCheck === route || (route !== "/" && pathToCheck.startsWith(route + "/"))) {
      return key;
    }
  }

  return undefined;
}

export function getTranslatedPath(path: string, lang: string) {
  const cleanPath = path === "/" ? "/" : "/" + path.replace(/^\/+|\/+$/g, "");

  const anchorIndex = cleanPath.indexOf('#');
  const anchor = anchorIndex !== -1 ? cleanPath.slice(anchorIndex) : '';
  const pathWithoutAnchor = anchorIndex !== -1 ? cleanPath.slice(0, anchorIndex) : cleanPath;

  // 1. Detect source language
  const segments = pathWithoutAnchor.split('/').filter(Boolean);
  let sourceLang = defaultLang;
  let logicalPath = pathWithoutAnchor;

  if (segments.length > 0 && segments[0] in ui && segments[0] !== defaultLang) {
    sourceLang = segments[0];
    logicalPath = "/" + segments.slice(1).join("/") || "/";
  }

  // 2. Find route key
  let pageKey: string | undefined;
  const sourceRoutes = routes[sourceLang as keyof typeof routes];

  for (const [key, route] of Object.entries(sourceRoutes)) {
    if (logicalPath === route) {
      pageKey = key;
      break;
    }
    if (route !== "/" && logicalPath.startsWith(route + "/")) {
      pageKey = key;
      break;
    }
  }

  // 3. Reconstruct
  if (pageKey) {
    const targetRoutes = routes[lang as keyof typeof routes];
    const targetRouteBase = targetRoutes[pageKey as keyof typeof targetRoutes];
    const sourceRouteBase = sourceRoutes[pageKey as keyof typeof sourceRoutes];

    const suffix = logicalPath.slice(sourceRouteBase.length);

    const prefix = lang === defaultLang ? "" : `/${lang}`;
    const finalPath = (prefix + targetRouteBase + suffix).replace("//", "/");

    return finalPath + anchor;
  }

  const prefix = lang === defaultLang ? "" : `/${lang}`;
  return `${prefix}${cleanPath}`;
}
