import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Chip } from "@/components/ui/primitives";
import { TopicCard } from "@/features/topics/topic-card";
import { useBookmarks } from "@/lib/bookmarks";
import { myNotesQuery, topicsQuery, useIsAdmin } from "@/lib/queries";
import { useReadingProgress } from "@/lib/reading-progress";
import { FILTERS, plural, statusOf, type TopicFilter, toneAt } from "@/lib/topic";

const route = getRouteApi("/app/topics");

export type TopicsSearch = { q?: string; show?: TopicFilter };

export function TopicsPage() {
  const { q = "", show } = route.useSearch();
  const navigate = route.useNavigate();
  const { data: topics } = useSuspenseQuery(topicsQuery);
  const { data: notes } = useSuspenseQuery(myNotesQuery);
  const bookmarks = useBookmarks();
  const progress = useReadingProgress();
  const isAdmin = useIsAdmin();

  const needle = q.trim().toLowerCase();
  const notesByTopic = Map.groupBy(notes, (note) => note.topic_id);
  const entries = topics.map((topic, index) => {
    const read = progress[topic.id] ?? 0;
    const count = notesByTopic.get(topic.id)?.length ?? 0;
    return { topic, index, read, count, status: statusOf(read, count) };
  });

  const visible = entries.filter(({ topic, status }) => {
    if (show === "saved" && !bookmarks.includes(topic.id)) return false;
    if (show && show !== "saved" && status !== show) return false;
    return (
      !needle ||
      topic.title.toLowerCase().includes(needle) ||
      topic.content.toLowerCase().includes(needle)
    );
  });

  const completed = entries.filter((entry) => entry.status === "completed").length;
  const filters = FILTERS.filter((filter) => filter.id !== "saved" || bookmarks.length > 0);

  const select = (value: TopicFilter | undefined) =>
    navigate({ search: (prev) => ({ ...prev, show: value }), replace: true });

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2.75rem] leading-none font-medium tracking-tight">All topics</h1>
          <p className="mt-3 text-lg text-muted">
            {plural(topics.length, "topic")} · {completed} completed
          </p>
        </div>
        {isAdmin && (
          <Link
            to="/topics/new"
            className="inline-flex h-14 items-center gap-2 rounded-2xl bg-orange px-6 text-lg font-medium text-white transition-colors hover:bg-orange-600 sm:order-last"
          >
            <Plus className="size-5" />
            New topic
          </Link>
        )}
        <div
          role="toolbar"
          aria-label="Filter topics"
          className="scrollbar-none -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          <Chip active={!show} onClick={() => select(undefined)}>
            All topics
          </Chip>
          {filters.map((filter) => (
            <Chip
              key={filter.id}
              active={show === filter.id}
              onClick={() => select(show === filter.id ? undefined : filter.id)}
            >
              {filter.label}
            </Chip>
          ))}
        </div>
      </div>

      {visible.length ? (
        <ul aria-label="Topics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map(({ topic, index, read, count }, position) => (
            <li key={topic.id} className="grid">
              <TopicCard
                topic={topic}
                index={index}
                tone={toneAt(position)}
                progress={read}
                notes={count}
                saved={bookmarks.includes(topic.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="grid min-h-48 place-items-center rounded-card bg-panel p-8 text-center text-xl text-muted">
          {topics.length
            ? "No topics match your filters."
            : "Topics are on their way. Check back soon."}
        </p>
      )}
    </div>
  );
}
