import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const t = useT();

  const share = async () => {
    const url = window.location.href.split("#")[0] ?? window.location.href;
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex cursor-pointer items-center gap-2 text-xl text-orange hover:underline"
    >
      {copied ? <Check className="size-6" /> : <Share2 className="size-6" strokeWidth={1.6} />}
      <span aria-live="polite">{copied ? t.topic.copied : t.topic.share}</span>
    </button>
  );
}
