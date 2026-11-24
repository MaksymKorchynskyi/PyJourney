import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { Bookmark, NotebookPen } from "lucide-react";
import { Badge, ProgressBar } from "@/components/ui/primitives";
import { toggleBookmark } from "@/lib/bookmarks";
import { type CardTone, pad, plural, readingMinutes, timeAgo } from "@/lib/topic";
import type { Topic } from "@/lib/types";

const TONES: Record<CardTone, { card: string; track: string; badge: "ink" | "glass" }> = {
  blue: { card: "bg-blue", track: "bg-white/25", badge: "ink" },
  orange: { card: "bg-orange", track: "bg-white/25", badge: "ink" },
  ink: { card: "bg-ink", track: "bg-white/20", badge: "glass" },
};

type TopicCardProps = {
  topic: Topic;
  index: number;
  tone: CardTone;
  progress: number;
  notes: number;
  saved: boolean;
  lastActivity?: string;
};

export function TopicCard({
  topic,
  index,
  tone,
  progress,
  notes,
  saved,
  lastActivity,
}: TopicCardProps) {
  const styles = TONES[tone];
  const titleId = `topic-${topic.id}`;
  const action = progress >= 1 ? "Review" : progress > 0 || notes > 0 ? "Continue" : "Start";

  return (
    <article
      aria-labelledby={titleId}
      className={clsx(
        "flex min-h-86 snap-start flex-col rounded-card p-7 text-white animate-rise",
        styles.card,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <Badge tone={styles.badge}>Topic {pad(index + 1)}</Badge>
        <button
          type="button"
          onClick={() => toggleBookmark(topic.id)}
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved" : "Save topic"}
          className="-m-1 cursor-pointer rounded-lg p-1 transition-transform hover:scale-110"
        >
          <Bookmark className="size-9" strokeWidth={1.6} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>

      <h3 id={titleId} className="mt-5 line-clamp-2 text-[1.75rem] leading-tight font-medium">
        {topic.title}
      </h3>
      {lastActivity && (
        <p className="mt-2 text-[1.05rem] text-white/75">Last studied {timeAgo(lastActivity)}</p>
      )}

      <div className="mt-auto pt-6">
        <div className="mb-3 flex justify-between text-[1.05rem] text-white/90">
          <span>Progress</span>
          <span>
            {Math.round(progress * 100)}% · {readingMinutes(topic.content)} min read
          </span>
        </div>
        <ProgressBar value={progress} track={styles.track} />

        <div className="mt-7 flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-lg text-white/90">
            <NotebookPen className="size-5" strokeWidth={1.8} />
            {notes ? plural(notes, "note") : "No notes yet"}
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
