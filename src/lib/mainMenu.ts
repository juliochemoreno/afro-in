export interface MenuLink {
  href: string;
  label: string;
  children?: MenuLink[];
}

// Festival pass season: pass on sale (2026-11-01) until the pass event day,
// when the site hides it (2027-01-15). Colombia dates, inclusive.
export const PASS_SEASON_START = "2026-11-01";
export const PASS_SEASON_END = "2027-01-15";
export const PASS_SLUG = "pase-afroin-2027-santa-marta";

export function colombiaDate(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

export function isPassSeason(now: Date): boolean {
  const d = colombiaDate(now);
  return d >= PASS_SEASON_START && d <= PASS_SEASON_END;
}

// Palenque has no pass: its pages keep the "join" CTA (es/en/fr paths).
export function isPalenquePath(pathname: string): boolean {
  return /\/palenque(\/|$)/.test(pathname) && /\/(programacion|program|programme)\/2027\//.test(pathname);
}

type T = (key: any) => string;
type PathFn = (path: string, lang: string) => string;

export function buildMainMenu(t: T, path: PathFn, lang: string) {
  const items: MenuLink[] = [
    { href: path("/programacion", lang), label: t("nav.tour") },
    { href: path("/eventos", lang), label: t("nav.events") },
    { href: path("/tienda", lang), label: t("nav.store") },
    {
      href: path("/#sobre", lang),
      label: t("nav.us"),
      children: [
        { href: path("/#sobre", lang), label: t("nav.about") },
        { href: path("/#galeria", lang), label: t("nav.gallery") },
        { href: path("/#aliados", lang), label: t("nav.allies") },
      ],
    },
  ];
  const footerLinks: MenuLink[] = [
    items[0],
    items[1],
    items[2],
    ...(items[3].children as MenuLink[]),
    { href: path("/#contacto", lang), label: t("nav.contact") },
  ];
  return {
    items,
    footerLinks,
    passUrl: path(`/eventos/${PASS_SLUG}`, lang),
    joinUrl: path("/#unirse", lang),
  };
}
