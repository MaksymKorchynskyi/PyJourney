import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ChevronDown, Plus } from "lucide-react";
import { Chip } from "@/components/ui/primitives";
import { TopicCard } from "@/features/topics/topic-card";
import { useBookmarks } from "@/lib/bookmarks";
import { useLocale, useT } from "@/lib/i18n";
import { categoriesQuery, myNotesQuery, topicsQuery, useIsAdmin } from "@/lib/queries";
import { useReadingProgress } from "@/lib/reading-progress";
import {
  categoryOf,
  FILTERS,
  matchesTopic,
  pad,
  statusOf,
  type TopicFilter,
  titleOf,
  toneAt,
} from "@/lib/topic";

const route = getRouteApi("/app/topics");

export type TopicsSearch = { q?: string; show?: TopicFilter; category?: string };

export function TopicsPage() {
  const { q = "", show, category: categorySlug } = route.useSearch();
  const navigate = route.useNavigate();
  const t = useT();
  const locale = useLocale();
  const { data: topics } = useSuspenseQuery(topicsQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const { data: notes } = useSuspenseQuery(myNotesQuery);
  const bookmarks = useBookmarks();
  const progress = useReadingProgress();
  const isAdmin = useIsAdmin();

  const needle = q.trim().toLowerCase();
  const notesByTopic = Map.groupBy(notes, (note) => note.topic_id);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const selected = categories.find((category) => category.slug === categorySlug);

  const entries = topics.map((topic, index) => {
    const read = progress[topic.id] ?? 0;
    const count = notesByTopic.get(topic.id)?.length ?? 0;
    return {
      topic,
      index,
      read,
      count,
      status: statusOf(read, count),
      category: categoryOf(topic, categoryById),
    };
  });

  const visible = entries.filter(({ topic, status, category }) => {
    if (selected && category !== selected) return false;
    if (show === "saved" && !bookmarks.includes(topic.id)) return false;
    if (show && show !== "saved" && status !== show) return false;
    return matchesTopic(topic, category, needle);
  });

  const sections = Map.groupBy(visible, (entry) => entry.topic.category_id);
  const totals = Map.groupBy(entries, (entry) => entry.topic.category_id);
  const completed = entries.filter((entry) => entry.status === "completed").length;
  const filters = FILTERS.filter((filter) => filter !== "saved" || bookmarks.length > 0);

  const select = (value: TopicFilter | undefined) =>
    navigate({ search: (prev) => ({ ...prev, show: value }), replace: true });

  const selectCategory = (slug: string) =>
    navigate({ search: (prev) => ({ ...prev, category: slug || undefined }), replace: true });

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2.75rem] leading-none font-medium tracking-tight">
            {t.topics.title}
          </h1>
          <p className="mt-3 text-lg text-muted">
            {t.count.topics(topics.length)} · {t.count.categories(categories.length)} ·{" "}
            {t.count.completed(completed)}
          </p>
        </div>
        {isAdmin && (
          <Link
            to="/topics/new"
            className="inline-flex h-14 items-center gap-2 rounded-2xl bg-orange px-6 text-lg font-medium text-white transition-colors hover:bg-orange-600 sm:order-last"
          >
            <Plus className="size-5" />
            {t.topics.newTopic}
          </Link>
        )}
        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
          <div
            role="toolbar"
            aria-label={t.filters.label}
            className="scrollbar-none -mx-4 flex max-w-[calc(100%+2rem)] gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:flex-wrap sm:px-0"
          >
            <Chip active={!show} onClick={() => select(undefined)}>
              {t.filters.all}
            </Chip>
            {filters.map((filter) => (
              <Chip
                key={filter}
                active={show === filter}
                onClick={() => select(show === filter ? undefined : filter)}
              >
                {t.filters[filter]}
              </Chip>
            ))}
          </div>
          <label className="relative w-full sm:w-auto">
            <span className="sr-only">{t.topics.category}</span>
            <select
              value={selected?.slug ?? ""}
              onChange={(event) => selectCategory(event.target.value)}
              className="h-12 w-full cursor-pointer appearance-none rounded-xl border-2 border-blue/70 bg-transparent pr-11 pl-4 text-lg font-medium text-blue outline-none transition-colors hover:border-blue hover:bg-blue/5 focus-visible:border-blue sm:w-80"
            >
              <option value="">{t.topics.allCategories}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {pad(category.position)}. {titleOf(category, locale)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-blue" />
          </label>
        </div>
      </div>

      {visible.length ? (
        <div className="grid gap-12">
          {[...sections].map(([categoryId, items]) => {
            const category = categoryId === null ? undefined : categoryById.get(categoryId);
            const all = totals.get(categoryId) ?? items;
            const done = all.filter((entry) => entry.status === "completed").length;
            const headingId = `category-${categoryId ?? "none"}`;
            return (
              <section key={headingId} aria-labelledby={headingId} className="grid gap-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2
                    id={headingId}
                    className="flex items-baseline gap-3 text-2xl font-medium tracking-tight sm:text-[2rem]"
                  >
                    {category && (
                      <span className="font-mono text-xl text-orange sm:text-2xl">
                        {pad(category.position)}
                      </span>
                    )}
                    {category ? titleOf(category, locale) : t.topics.uncategorized}
                  </h2>
                  <p className="text-lg text-muted">
                    {t.count.topics(all.length)} · {t.topics.sectionProgress(done, all.length)}
                  </p>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map(({ topic, index, read, count }, position) => (
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
              </section>
            );
          })}
        </div>
      ) : (
        <p className="grid min-h-48 place-items-center rounded-card bg-panel p-8 text-center text-xl text-muted">
          {topics.length ? t.topics.noMatches : t.home.comingSoon}
        </p>
      )}
    </div>
  );
}
