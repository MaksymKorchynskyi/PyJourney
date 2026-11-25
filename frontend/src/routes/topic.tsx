import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useLocation } from "@tanstack/react-router";
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
import { timeAgo, useLocale, useT } from "@/lib/i18n";
import { categoriesQuery, myNotesQuery, topicQuery, topicsQuery, useIsAdmin } from "@/lib/queries";
import { useReadingProgress, useTrackReading } from "@/lib/reading-progress";
import { categoryOf, contentOf, minutesOf, pad, titleOf } from "@/lib/topic";
import type { TopicSummary } from "@/lib/types";

const route = getRouteApi("/app/topics/$topicId");

export function TopicPage() {
  const { topicId } = route.useParams();
  const hash = useLocation({ select: (location) => location.hash });
  const id = Number(topicId);
  const t = useT();
  const locale = useLocale();
  const { data: topic } = useSuspenseQuery(topicQuery(id));
  const { data: topics } = useSuspenseQuery(topicsQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
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

  const index = topics.findIndex((item) => item.id === id);
  const category = categoryOf(topic, new Map(categories.map((item) => [item.id, item])));
  const title = titleOf(topic, locale);
  const content = contentOf(topic, locale);
  const number = pad((index < 0 ? topics.length : index) + 1);

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

      <nav aria-label={t.topic.breadcrumb}>
        <ol className="flex flex-wrap items-center gap-x-2 text-[1.05rem] [&>li+li]:before:mr-2 [&>li+li]:before:text-muted [&>li+li]:before:content-['/']">
          <li>
            <Link to="/topics" className="hover:text-orange">
              {t.nav.topics}
            </Link>
          </li>
          {category && (
            <li>
              <Link to="/topics" search={{ category: category.slug }} className="hover:text-orange">
                {titleOf(category, locale)}
              </Link>
            </li>
          )}
          <li aria-current="page">
            {t.card.topic(number)}. {title}
          </li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/topics"
            aria-label={t.topic.back}
            className="grid size-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-panel"
          >
            <ChevronLeft className="size-7" strokeWidth={1.6} />
          </Link>
          <h1 className="text-[2.6rem] leading-tight font-bold tracking-tight text-balance">
            {title}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Pill icon={<Clock />}>{t.count.minutes(minutesOf(topic, locale))}</Pill>
          <Pill icon={<BookOpenCheck />}>{t.topic.read(Math.round(progress * 100))}</Pill>
          {isAdmin && (
            <Link
              to="/topics/$topicId/edit"
              params={{ topicId }}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-ink px-4 text-base font-medium text-white transition-colors hover:bg-ink/85 [&_svg]:size-5"
            >
              <PenLine />
              {t.topic.edit}
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
            {t.topic.myNotes}
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
            aria-label={title}
            className="rounded-card bg-white px-6 py-8 ring-1 ring-mist sm:px-12 sm:py-12"
          >
            <div className="mb-8 flex flex-wrap items-center gap-3 text-muted">
              <Badge>{t.card.topic(number)}</Badge>
              <span>{t.topic.updated(timeAgo(topic.updated_at, locale))}</span>
            </div>
            {content.trim() ? (
              <Markdown>{content}</Markdown>
            ) : (
              <p className="text-xl text-muted">{t.topic.comingSoon}</p>
            )}
          </article>

          <footer className="flex flex-wrap items-center justify-between gap-4">
            <ShareButton title={title} />
            <TopicPager
              previous={index > 0 ? topics[index - 1] : undefined}
              next={index >= 0 ? topics[index + 1] : undefined}
            />
          </footer>
        </div>

        <aside
          ref={panelRef}
          id="notes-panel"
          aria-label={t.topic.myNotes}
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
              topicId={topic.id}
              topicTitle={title}
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
        aria-label={t.topic.showNotes(notes.length)}
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

function TopicPager({ previous, next }: { previous?: TopicSummary; next?: TopicSummary }) {
  const t = useT();
  const locale = useLocale();
  return (
    <nav aria-label={t.topic.pager} className="flex flex-wrap gap-2.5">
      {previous && (
        <Link
          to="/topics/$topicId"
          params={{ topicId: String(previous.id) }}
          className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-blue/70 px-4 text-lg font-medium text-blue transition-colors hover:bg-blue/5"
        >
          <ArrowLeft className="size-5" />
          <span className="max-w-56 truncate">{titleOf(previous, locale)}</span>
        </Link>
      )}
      {next && (
        <Link
          to="/topics/$topicId"
          params={{ topicId: String(next.id) }}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-blue px-4 text-lg font-medium text-white transition-colors hover:bg-blue-600"
        >
          <span className="max-w-56 truncate">{t.topic.next(titleOf(next, locale))}</span>
          <ArrowRight className="size-5" />
        </Link>
      )}
    </nav>
  );
}
