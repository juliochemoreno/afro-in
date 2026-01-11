import { ui, defaultLang } from "./ui";

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
  const parts = pathname?.split("/");
  const path = parts.pop() || parts.pop();

  if (path === undefined) {
    return undefined;
  }

  const currentLang = getLangFromUrl(url);

  if (defaultLang === currentLang) {
    const route = parts.join("/");
    return route !== "" ? route : undefined;
  }

  const getKeyByValue = (obj: any, value: any) =>
    Object.keys(obj).find((key) => obj[key] === value);

  const reversedKey = getKeyByValue(ui[currentLang], path);

  if (reversedKey !== undefined) {
    return reversedKey;
  }

  return undefined;
}

export function getTranslatedPath(path: string, lang: string) {
  const segments = path.split('/').filter(Boolean);
  const currentLang = ["en", "fr"].includes(segments[0]) ? segments.shift() : "es";

  const cleanPath = "/" + segments.join("/");

  if (lang === "es") {
    return cleanPath || "/";
  } else {
    return `/${lang}${cleanPath === "/" ? "" : cleanPath}`;
  }
}
