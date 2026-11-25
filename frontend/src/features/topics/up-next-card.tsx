import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { useLocale, useT } from "@/lib/i18n";
import { excerptOf, minutesOf, pad, titleOf } from "@/lib/topic";
import type { Category, TopicSummary } from "@/lib/types";

const buttonClass =
  "mt-auto inline-flex h-16 items-center justify-center rounded-2xl bg-orange text-xl font-medium text-white transition-colors hover:bg-orange-600";

type UpNextCardProps = { topic: TopicSummary | undefined; category?: Category; index: number };

export function UpNextCard({ topic, category, index }: UpNextCardProps) {
  const t = useT();
  const locale = useLocale();

  return (
    <aside
      aria-labelledby="up-next-title"
      className="flex flex-col rounded-card bg-lime p-8 text-ink animate-rise lg:p-10"
    >
      <p className="text-xl">{t.upNext.title}</p>
      {topic ? (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Badge>{t.card.topic(pad(index + 1))}</Badge>
            {category && <span className="text-lg text-ink/70">{titleOf(category, locale)}</span>}
          </div>
          <h2
            id="up-next-title"
            className="mt-6 text-4xl leading-[1.15] font-medium tracking-tight text-balance xl:text-[2.75rem]"
          >
            {titleOf(topic, locale)}
          </h2>
          <p className="mt-4 line-clamp-3 text-lg text-ink/75">{excerptOf(topic, locale)}</p>
          <p className="mt-6 mb-10 inline-flex items-center gap-2 text-lg">
            <Clock className="size-5" />
            {t.count.minutes(minutesOf(topic, locale))}
          </p>
          <Link
            to="/topics/$topicId"
            params={{ topicId: String(topic.id) }}
            className={buttonClass}
          >
            {t.upNext.start}
          </Link>
        </>
      ) : (
        <>
          <h2
            id="up-next-title"
            className="mt-8 mb-10 text-4xl leading-[1.15] font-medium tracking-tight text-balance"
          >
            {t.upNext.allRead}
          </h2>
          <Link to="/notes" className={buttonClass}>
            {t.upNext.openNotes}
          </Link>
        </>
      )}
    </aside>
  );
}
