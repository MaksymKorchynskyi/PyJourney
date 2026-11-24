import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, notFound, useLocation } from "@tanstack/react-router";
import clsx from "clsx";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  ChevronLeft,
  Clock,
  NotebookPen,
  PenLine,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/markdown/markdown";
import { Badge, Pill } from "@/components/ui/primitives";
import { NotesPanel } from "@/features/notes/notes-panel";
import { ShareButton } from "@/features/topics/share-button";
import { myNotesQuery, topicsQuery, useIsAdmin } from "@/lib/queries";
import { useReadingProgress, useTrackReading } from "@/lib/reading-progress";
import { pad, readingMinutes, timeAgo } from "@/lib/topic";
import type { Topic } from "@/lib/types";

const route = getRouteApi("/app/topics/$topicId");

export function TopicPage() {
  const { topicId } = route.useParams();
  const hash = useLocation({ select: (location) => location.hash });
  const id = Number(topicId);
  const { data: topics } = useSuspenseQuery(topicsQuery);
  const { data: allNotes } = useSuspenseQuery(myNotesQuery);
  const articleRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const live = useTrackReading(id, articleRef);
  const stored = useReadingProgress()[id] ?? 0;
  const isAdmin = useIsAdmin();
  const linkedNote = Number(/^note-(\d+)$/.exec(hash)?.[1]) || undefined;
  const [notesOpen, setNotesOpen] = useState(Boolean(linkedNote));

  useEffect(() => {
    if (!linkedNote) return;
    setNotesOpen(true);
    document.getElementById(`note-${linkedNote}`)?.scrollIntoView({ block: "center" });
  }, [linkedNote]);

  const index = topics.findIndex((topic) => topic.id === id);
  const topic = topics[index];
  if (!topic) throw notFound();

  const notes = allNotes.filter((note) => note.topic_id === id);
  const progress = Math.max(live, stored);
  const toggleNotes = () => {
    const next = !notesOpen;
    setNotesOpen(next);
    if (next) {
      requestAnimationFrame(() =>
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      );
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-40 h-1 origin-left bg-orange transition-transform duration-150"
        style={{ transform: `scaleX(${live})` }}
      />

      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-x-2 text-[1.05rem] [&>li+li]:before:mr-2 [&>li+li]:before:text-muted [&>li+li]:before:content-['/']">
          <li>
            <Link to="/topics" className="hover:text-orange">
              All topics
            </Link>
          </li>
          <li aria-current="page">
            Topic {index + 1}. {topic.title}
          </li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/topics"
            aria-label="Back to all topics"
            className="grid size-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-panel"
          >
            <ChevronLeft className="size-7" strokeWidth={1.6} />
          </Link>
          <h1 className="text-[2.6rem] leading-tight font-bold tracking-tight text-balance">
            {topic.title}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Pill icon={<Clock />}>{readingMinutes(topic.content)} min read</Pill>
          <Pill icon={<BookOpenCheck />}>{Math.round(progress * 100)}% read</Pill>
          {isAdmin && (
            <Link
              to="/topics/$topicId/edit"
              params={{ topicId }}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-ink px-4 text-base font-medium text-white transition-colors hover:bg-ink/85 [&_svg]:size-5"
            >
              <PenLine />
              Edit topic
            </Link>
          )}
          <button
            type="button"
            onClick={toggleNotes}
            aria-expanded={notesOpen}
            aria-controls="notes-panel"
            className={clsx(
              "inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border-2 px-4 text-base font-medium transition-colors [&_svg]:size-5",
              notesOpen
                ? "border-blue bg-blue text-white hover:bg-blue-600"
                : "border-blue/70 text-blue hover:bg-blue/5",
            )}
          >
            <NotebookPen />
            My notes
            <span
              className={clsx(
                "grid min-w-6 place-items-center rounded-full px-1.5 text-sm transition-colors",
                notesOpen ? "bg-white/20" : "bg-blue/10",
              )}
            >
              {notes.length}
            </span>
          </button>
        </div>
      </div>

      <div
        className={clsx(
          "grid grid-cols-1 transition-[grid-template-columns,column-gap] duration-500 ease-out-soft",
          notesOpen
            ? "xl:grid-cols-[minmax(0,1fr)_34rem] xl:gap-x-8"
            : "xl:grid-cols-[minmax(0,1fr)_0rem] xl:gap-x-0",
        )}
      >
        <div className="mx-auto grid w-full max-w-5xl min-w-0 content-start gap-8">
          <article
            ref={articleRef}
            aria-label={topic.title}
            className="rounded-card bg-white px-6 py-8 ring-1 ring-mist sm:px-12 sm:py-12"
          >
            <div className="mb-8 flex flex-wrap items-center gap-3 text-muted">
              <Badge>Topic {pad(index + 1)}</Badge>
              <span>Updated {timeAgo(topic.updated_at)}</span>
            </div>
            {topic.content.trim() ? (
              <Markdown>{topic.content}</Markdown>
            ) : (
              <p className="text-xl text-muted">Material for this topic is coming soon.</p>
            )}
          </article>

          <footer className="flex flex-wrap items-center justify-between gap-4">
            <ShareButton title={topic.title} />
            <TopicPager previous={topics[index - 1]} next={topics[index + 1]} />
          </footer>
        </div>

        <aside
          ref={panelRef}
          id="notes-panel"
          aria-label="My notes"
          inert={!notesOpen}
          className={clsx(
            "grid min-w-0 scroll-mt-6 transition-[grid-template-rows,opacity,translate] duration-500 ease-out-soft max-xl:order-first xl:sticky xl:top-6 xl:self-start xl:overflow-hidden",
            notesOpen
              ? "grid-rows-[1fr] opacity-100 max-xl:mb-6 xl:translate-x-0"
              : "grid-rows-[0fr] opacity-0 xl:translate-x-8",
          )}
        >
          <div className="min-h-0 overflow-hidden xl:max-h-[calc(100dvh-3rem)] xl:w-[34rem] xl:overflow-y-auto xl:overscroll-contain xl:rounded-card">
            <NotesPanel
              key={topic.id}
              topic={topic}
              notes={notes}
              initialOpen={linkedNote}
              onClose={() => setNotesOpen(false)}
            />
          </div>
        </aside>
      </div>

      <button
        type="button"
        onClick={toggleNotes}
        aria-label={`Show my notes (${notes.length})`}
        aria-controls="notes-panel"
        aria-expanded={notesOpen}
        className={clsx(
          "fixed right-5 bottom-24 z-30 grid size-16 cursor-pointer place-items-center rounded-2xl bg-orange text-white shadow-xl shadow-orange/30 transition-[scale,opacity] duration-300 hover:scale-105 active:scale-95 lg:right-10 lg:bottom-10",
          notesOpen && "pointer-events-none scale-75 opacity-0",
        )}
      >
        <NotebookPen className="size-7" strokeWidth={1.8} />
        {notes.length > 0 && (
          <span className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-lime text-sm font-bold text-ink">
            {notes.length}
          </span>
        )}
      </button>
    </div>
  );
}

function TopicPager({ previous, next }: { previous?: Topic; next?: Topic }) {
  return (
    <nav aria-label="Topic navigation" className="flex flex-wrap gap-2.5">
      {previous && (
        <Link
          to="/topics/$topicId"
          params={{ topicId: String(previous.id) }}
          className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-blue/70 px-4 text-lg font-medium text-blue transition-colors hover:bg-blue/5"
        >
          <ArrowLeft className="size-5" />
          <span className="max-w-56 truncate">{previous.title}</span>
        </Link>
      )}
      {next && (
        <Link
          to="/topics/$topicId"
          params={{ topicId: String(next.id) }}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-blue px-4 text-lg font-medium text-white transition-colors hover:bg-blue-600"
        >
          <span className="max-w-56 truncate">Next: {next.title}</span>
          <ArrowRight className="size-5" />
        </Link>
      )}
    </nav>
  );
}
