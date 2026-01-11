import es from "./locales/es.json";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

export const languages = {
  es: "Español",
  en: "English",
  fr: "Français",
};

export const defaultLang = "es";

export const ui = {
  es,
  en,
  fr,
} as const;
