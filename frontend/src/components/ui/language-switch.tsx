import clsx from "clsx";
import { LANGUAGE_NAMES, LOCALES, setLocale, useLocale, useT } from "@/lib/i18n";

const SHORT = { uk: "UA", en: "EN" } as const;

export function LanguageSwitch({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useT();

  return (
    <fieldset className={clsx("flex h-12 items-center gap-1 rounded-full bg-panel p-1", className)}>
      <legend className="sr-only">{t.language.label}</legend>
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          title={LANGUAGE_NAMES[code]}
          aria-label={LANGUAGE_NAMES[code]}
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
          className={clsx(
            "h-10 min-w-12 cursor-pointer rounded-full px-3 text-sm font-bold tracking-wide transition-colors",
            locale === code ? "bg-ink text-white" : "text-muted hover:bg-mist hover:text-ink",
          )}
        >
          {SHORT[code]}
        </button>
      ))}
    </fieldset>
  );
}
