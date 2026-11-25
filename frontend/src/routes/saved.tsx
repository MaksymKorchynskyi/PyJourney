import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { TopicCard } from "@/features/topics/topic-card";
import { useBookmarks } from "@/lib/bookmarks";
import { useT } from "@/lib/i18n";
import { categoriesQuery, myNotesQuery, topicsQuery } from "@/lib/queries";
import { useReadingProgress } from "@/lib/reading-progress";
import { categoryOf, matchesTopic, toneAt } from "@/lib/topic";

const route = getRouteApi("/app/saved");

export type SavedSearch = { q?: string };

export function SavedPage() {
  const { q = "" } = route.useSearch();
  const t = useT();
  const { data: topics } = useSuspenseQuery(topicsQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const { data: notes } = useSuspenseQuery(myNotesQuery);
  const bookmarks = useBookmarks();
  const progress = useReadingProgress();

  const needle = q.trim().toLowerCase();
  const notesByTopic = Map.groupBy(notes, (note) => note.topic_id);
  const indexById = new Map(topics.map((topic, index) => [topic.id, index]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const saved = bookmarks
    .toReversed()
    .map((id) => {
      const index = indexById.get(id);
      const topic = index === undefined ? undefined : topics[index];
      return topic && index !== undefined
        ? { topic, index, category: categoryOf(topic, categoryById) }
        : undefined;
    })
    .filter((entry) => entry !== undefined);

  const visible = saved.filter(({ topic, category }) => matchesTopic(topic, category, needle));

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2.75rem] leading-none font-medium tracking-tight">
            {t.saved.title}
          </h1>
          <p className="mt-3 text-lg text-muted">
            {saved.length ? t.saved.count(saved.length) : t.saved.none}
          </p>
        </div>
        <Link to="/topics" className="shrink-0 text-xl text-orange hover:underline">
          {t.saved.browse}
        </Link>
      </div>

      {visible.length ? (
        <ul aria-label={t.saved.title} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map(({ topic, index, category }, position) => (
            <li key={topic.id} className="grid">
              <TopicCard
                topic={topic}
                category={category}
                index={index}
                tone={toneAt(position)}
                progress={progress[topic.id] ?? 0}
                notes={notesByTopic.get(topic.id)?.length ?? 0}
                saved
              />
            </li>
          ))}
        </ul>
      ) : saved.length ? (
        <p className="grid min-h-48 place-items-center rounded-card bg-panel p-8 text-center text-xl text-muted">
          {t.saved.noMatches}
        </p>
      ) : (
        <div className="grid min-h-72 place-items-center rounded-card bg-panel p-10 text-center">
          <div className="grid max-w-md justify-items-center gap-4">
            <span className="grid size-16 place-items-center rounded-2xl bg-white text-orange">
              <Bookmark className="size-8" strokeWidth={1.6} />
            </span>
            <h2 className="text-2xl font-medium">{t.saved.emptyTitle}</h2>
            <p className="text-lg text-muted">{t.saved.emptyText}</p>
            <Link
              to="/topics"
              className="mt-2 inline-flex h-14 items-center rounded-2xl bg-orange px-6 text-lg font-medium text-white transition-colors hover:bg-orange-600"
            >
              {t.saved.explore}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
