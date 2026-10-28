import { getTranslatedPath, useTranslations } from "@/i18n/utils";
import type { Lang } from "@/lib/programacion";

// Header links shared by the edition pages (programación and artistas).
export function editionNav(lang: Lang) {
  const t = useTranslations(lang);
  return {
    navLinks: [
      { href: getTranslatedPath("/", lang), label: t("nav.home") },
      { href: getTranslatedPath("/tienda", lang), label: t("nav.store") },
      { href: getTranslatedPath("/programacion", lang), label: t("nav.program") },
      { href: getTranslatedPath("/programacion/2027/santa-marta", lang), label: "Santa Marta" },
      { href: getTranslatedPath("/programacion/2027/palenque", lang), label: "Palenque" },
      { href: getTranslatedPath("/artistas", lang), label: t("nav.artists") },
      { href: getTranslatedPath("/#contacto", lang), label: t("nav.contact") },
    ],
    ctaLink: { href: getTranslatedPath("/#unirse", lang), label: t("nav.join") },
  };
}
