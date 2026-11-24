import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";
import { NotesTable } from "@/features/notes/notes-table";
import { TopicCard } from "@/features/topics/topic-card";
import { UpNextCard } from "@/features/topics/up-next-card";
import { useBookmarks } from "@/lib/bookmarks";
import { myNotesQuery, topicsQuery } from "@/lib/queries";
import { useReadingProgress, useVisits } from "@/lib/reading-progress";
import { statusOf, toneAt } from "@/lib/topic";

const route = getRouteApi("/app/");

export type HomeSearch = { q?: string };

const SHELF_SIZE = 6;
const MIN_SHELF = 3;

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffled<T>(items: T[], seed: number) {
  const random = seededRandom(seed);
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap] as T, result[index] as T];
  }
  return result;
}

const latest = (...dates: (string | undefined)[]) =>
  dates
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);

export function HomePage() {
  const { q = "" } = route.useSearch();
  const { data: topics } = useSuspenseQuery(topicsQuery);
  const { data: notes } = useSuspenseQuery(myNotesQuery);
  const bookmarks = useBookmarks();
  const progress = useReadingProgress();
  const visits = useVisits();
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 32));

  const needle = q.trim().toLowerCase();
  const matches = (text: string) => !needle || text.toLowerCase().includes(needle);

  const notesByTopic = Map.groupBy(notes, (note) => note.topic_id);
  const entries = topics.map((topic, index) => {
    const read = progress[topic.id] ?? 0;
    const topicNotes = notesByTopic.get(topic.id) ?? [];
    const lastNote = latest(...topicNotes.map((note) => note.updated_at));
    return {
      topic,
      index,
      read,
      count: topicNotes.length,
      status: statusOf(read, topicNotes.length),
      lastActivity: latest(visits[topic.id], lastNote),
    };
  });

  const studied = entries
    .filter((entry) => entry.lastActivity)
    .toSorted((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));
  const current = studied[0];

  const upNext =
    entries.find(
      (entry) =>
        current && entry.index > current.index && entry.status !== "completed" && entry !== current,
    ) ??
    entries.find((entry) => entry.status === "not-started" && entry !== current) ??
    entries.find((entry) => entry.status !== "completed" && entry !== current);

  const searched = (entry: (typeof entries)[number]) =>
    matches(entry.topic.title) || matches(entry.topic.content);
  const recent = studied.filter(searched).slice(0, SHELF_SIZE);
  const suggestions = shuffled(
    entries.filter((entry) => !entry.lastActivity && entry !== upNext && searched(entry)),
    seed,
  );
  const shelf = [...recent, ...suggestions.slice(0, Math.max(0, MIN_SHELF - recent.length))];

  const recentNotes = notes
    .filter((note) => matches(note.title))
    .toSorted((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[2.75rem] leading-none font-medium tracking-tight">Python topics</h1>
        <Link to="/topics" className="shrink-0 text-xl text-orange hover:underline">
          View all topics
        </Link>
      </div>

      <section aria-label="Recent and suggested topics">
        {shelf.length ? (
          <div className="scrollbar-none -mx-4 grid snap-x snap-mandatory auto-cols-[minmax(19rem,1fr)] grid-flow-col gap-3 overflow-x-auto scroll-px-4 px-4 sm:mx-0 sm:scroll-px-0 sm:px-0 md:auto-cols-[calc((100%-0.75rem)/2)] xl:auto-cols-[calc((100%-1.5rem)/3)]">
            {shelf.map(({ topic, index, read, count, lastActivity }, position) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                index={index}
                tone={toneAt(position)}
                progress={read}
                notes={count}
                saved={bookmarks.includes(topic.id)}
                lastActivity={lastActivity}
              />
            ))}
          </div>
        ) : (
          <p className="grid min-h-48 place-items-center rounded-card bg-panel p-8 text-center text-xl text-muted">
            {topics.length
              ? "Nothing matches your search."
              : "Topics are on their way. Check back soon."}
          </p>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <section
          aria-labelledby="recent-notes"
          className="rounded-card bg-panel pt-7 pb-3 animate-rise"
        >
          <div className="mb-6 flex items-center justify-between gap-4 px-6 lg:px-7">
            <h2 id="recent-notes" className="text-2xl font-medium tracking-tight sm:text-[1.85rem]">
              My recent notes
            </h2>
            <Link to="/notes" className="shrink-0 text-lg text-orange hover:underline sm:text-xl">
              View all notes
            </Link>
          </div>
          {recentNotes.length ? (
            <NotesTable notes={recentNotes} topics={topics} />
          ) : (
            <p className="px-7 pb-6 text-lg text-muted">
              No notes yet. Open a topic and write down what you learn.
            </p>
          )}
        </section>
        <UpNextCard topic={upNext?.topic} index={upNext?.index ?? 0} />
      </div>
    </div>
  );
}
