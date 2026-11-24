import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { pad, plainExcerpt, readingMinutes } from "@/lib/topic";
import type { Topic } from "@/lib/types";

const buttonClass =
  "mt-auto inline-flex h-16 items-center justify-center rounded-2xl bg-orange text-xl font-medium text-white transition-colors hover:bg-orange-600";

export function UpNextCard({ topic, index }: { topic: Topic | undefined; index: number }) {
  return (
    <aside
      aria-labelledby="up-next-title"
      className="flex flex-col rounded-card bg-lime p-8 text-ink animate-rise lg:p-10"
    >
      <p className="text-xl">Up next on your journey</p>
      {topic ? (
        <>
          <div className="mt-8">
            <Badge>Topic {pad(index + 1)}</Badge>
          </div>
          <h2
            id="up-next-title"
            className="mt-6 text-4xl leading-[1.15] font-medium tracking-tight text-balance xl:text-[2.75rem]"
          >
            {topic.title}
          </h2>
          <p className="mt-4 line-clamp-3 text-lg text-ink/75">{plainExcerpt(topic.content)}</p>
          <p className="mt-6 mb-10 inline-flex items-center gap-2 text-lg">
            <Clock className="size-5" />
            {readingMinutes(topic.content)} min read
          </p>
          <Link
            to="/topics/$topicId"
            params={{ topicId: String(topic.id) }}
            className={buttonClass}
          >
            Start reading
          </Link>
        </>
      ) : (
        <>
          <h2
            id="up-next-title"
            className="mt-8 mb-10 text-4xl leading-[1.15] font-medium tracking-tight text-balance"
          >
            You've read every topic. Time to revisit your notes!
          </h2>
          <Link to="/notes" className={buttonClass}>
            Open my notes
          </Link>
        </>
      )}
    </aside>
  );
}
