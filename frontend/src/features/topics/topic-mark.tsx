import clsx from "clsx";
import { type CardTone, pad } from "@/lib/topic";

const TONES: Record<CardTone, string> = {
  blue: "bg-blue text-white",
  orange: "bg-orange text-white",
  ink: "bg-ink text-lime",
};

export function TopicMark({ index, tone }: { index: number; tone: CardTone }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "grid size-12 shrink-0 place-items-center rounded-2xl font-mono text-base font-medium",
        TONES[tone],
      )}
    >
      {pad(index + 1)}
    </span>
  );
}
