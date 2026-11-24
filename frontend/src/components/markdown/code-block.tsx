import { Check, Copy } from "lucide-react";
import { Suspense, use, useState } from "react";
import { highlight, languageOf } from "./highlighter";

function Highlighted({ code, lang }: { code: string; lang: string }) {
  return use(highlight(code, lang));
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted transition-colors hover:bg-mist hover:text-ink"
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const language = languageOf(lang || "text");
  const label = language === "text" ? "code" : language === "shellscript" ? "shell" : language;

  return (
    <figure className="not-first:mt-6 mb-6 overflow-hidden rounded-2xl bg-white text-ink ring-1 ring-mist">
      <figcaption className="flex items-center justify-between border-mist border-b bg-surface py-2 pr-3 pl-6">
        <span className="font-mono text-sm font-medium text-blue">{label}</span>
        <CopyButton text={code} />
      </figcaption>
      <Suspense
        fallback={
          <pre className="overflow-x-auto px-6 py-5 font-mono text-[0.95rem] leading-7">
            <code>{code}</code>
          </pre>
        }
      >
        <Highlighted code={code} lang={language} />
      </Suspense>
    </figure>
  );
}
