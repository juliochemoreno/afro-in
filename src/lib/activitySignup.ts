// Sign-up button of activities flagged `signup: afroBatalla`: it links to the
// registration event (SALES.afroBatalla.url) and stays hidden, leaving the
// activity's own note ("registration soon"), until that link is set.
import { getTranslatedPath } from "@/i18n/utils";
import { SALES, formatCop, type Lang } from "@/lib/programacion";

export function resolveSignup(
  activity: { signup?: "afroBatalla" },
  lang: Lang,
  t: (key: string) => string
): { signupUrl?: string; signupLabel?: string; note?: undefined } {
  const url = SALES.afroBatalla.url;
  if (activity.signup !== "afroBatalla" || !url) return {};
  return {
    signupUrl: getTranslatedPath(url, lang),
    signupLabel: t("edition.batallaSignup").replace("{price}", `${formatCop(SALES.afroBatalla.price, lang)} COP`),
    note: undefined,
  };
}
