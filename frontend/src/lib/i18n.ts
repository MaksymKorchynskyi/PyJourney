import { createLocalStore, useLocalStore } from "./local-store";
import { MESSAGES } from "./messages";
import type { Locale } from "./types";

export const LOCALES: readonly Locale[] = ["uk", "en"];

export const LANGUAGE_NAMES: Record<Locale, string> = { uk: "Українська", en: "English" };

const detected: Locale = navigator.languages.some((language) =>
  language.toLowerCase().startsWith("uk"),
)
  ? "uk"
  : "en";

const store = createLocalStore<Locale | null>("pyjourney.locale", null);

export const getLocale = (): Locale => store.get() ?? detected;

export const setLocale = (locale: Locale) => store.set(locale);

export const messages = () => MESSAGES[getLocale()];

export function useLocale(): Locale {
  return useLocalStore(store) ?? detected;
}

export function useT() {
  return MESSAGES[useLocale()];
}

const syncDocument = () => {
  document.documentElement.lang = getLocale();
};
store.subscribe(syncDocument);
syncDocument();

const formats = new Map<Locale, Intl.RelativeTimeFormat>();

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export function timeAgo(iso: string, locale: Locale) {
  let format = formats.get(locale);
  if (!format) {
    format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    formats.set(locale, format);
  }
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, seconds] of STEPS) {
    if (Math.abs(diff) >= seconds) return format.format(Math.round(diff / seconds), unit);
  }
  return format.format(0, "second");
}
