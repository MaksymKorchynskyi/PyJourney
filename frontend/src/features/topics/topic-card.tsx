import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { Bookmark, NotebookPen } from "lucide-react";
import { Badge, ProgressBar } from "@/components/ui/primitives";
import { toggleBookmark } from "@/lib/bookmarks";
import { timeAgo, useLocale, useT } from "@/lib/i18n";
import { type CardTone, minutesOf, pad, titleOf } from "@/lib/topic";
import type { Category, TopicSummary } from "@/lib/types";

const TONES: Record<CardTone, { card: string; track: string; badge: "ink" | "glass" }> = {
  blue: { card: "bg-blue", track: "bg-white/25", badge: "ink" },
  orange: { card: "bg-orange", track: "bg-white/25", badge: "ink" },
  ink: { card: "bg-ink", track: "bg-white/20", badge: "glass" },
};

type TopicCardProps = {
  topic: TopicSummary;
  category?: Category;
  index: number;
  tone: CardTone;
  progress: number;
  notes: number;
  saved: boolean;
  lastActivity?: string;
};

export function TopicCard({
  topic,
  category,
  index,
  tone,
  progress,
  notes,
  saved,
  lastActivity,
}: TopicCardProps) {
  const t = useT();
  const locale = useLocale();
  const styles = TONES[tone];
  const titleId = `topic-${topic.id}`;
  const action =
    progress >= 1 ? t.card.review : progress > 0 || notes > 0 ? t.card.continue : t.card.start;

  return (
    <article
      aria-labelledby={titleId}
      className={clsx(
        "flex min-h-86 snap-start flex-col rounded-card p-7 text-white animate-rise",
        styles.card,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <Badge tone={styles.badge}>{t.card.topic(pad(index + 1))}</Badge>
        <button
          type="button"
          onClick={() => toggleBookmark(topic.id)}
          aria-pressed={saved}
          aria-label={saved ? t.card.unsave : t.card.save}
          className="-m-1 cursor-pointer rounded-lg p-1 transition-transform hover:scale-110"
        >
          <Bookmark className="size-9" strokeWidth={1.6} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>

      {category && (
        <p className="mt-5 line-clamp-1 text-[1.05rem] text-white/75">
          {titleOf(category, locale)}
        </p>
      )}
      <h3
        id={titleId}
        className={clsx(
          "line-clamp-2 text-[1.75rem] leading-tight font-medium",
          category ? "mt-1" : "mt-5",
        )}
      >
        {titleOf(topic, locale)}
      </h3>
      {lastActivity && (
        <p className="mt-2 text-[1.05rem] text-white/75">
          {t.card.lastStudied(timeAgo(lastActivity, locale))}
        </p>
      )}

      <div className="mt-auto pt-6">
        <div className="mb-3 flex justify-between gap-3 text-[1.05rem] text-white/90">
          <span>{t.card.progress}</span>
          <span>
            {Math.round(progress * 100)}% · {t.count.minutes(minutesOf(topic, locale))}
          </span>
        </div>
        <ProgressBar value={progress} track={styles.track} />

        <div className="mt-7 flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-lg text-white/90">
            <NotebookPen className="size-5" strokeWidth={1.8} />
            {notes ? t.count.notes(notes) : t.card.noNotes}
          </span>
          <Link
            to="/topics/$topicId"
            params={{ topicId: String(topic.id) }}
            className="inline-flex h-12 items-center rounded-xl bg-lime px-5 text-xl font-medium text-ink transition-colors hover:bg-lime-600"
          >
            {action}
          </Link>
        </div>
      </div>
    </article>
  );
}
