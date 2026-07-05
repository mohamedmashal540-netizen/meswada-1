import { en } from "./messages/en";
import { ar } from "./messages/ar";

export type Locale = "en" | "ar";

export const messages: Record<Locale, Record<string, string>> = { en, ar };

export const localeDir: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
};

export const LOCALE_STORAGE_KEY = "locale";

export function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === "ar" || stored === "en" ? stored : "en";
}
