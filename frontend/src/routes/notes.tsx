import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useRef } from "react";
import { Button, ErrorNote } from "@/components/ui/primitives";
import { NoteForm } from "@/features/notes/note-form";
import { NotesTable } from "@/features/notes/notes-table";
import { useT } from "@/lib/i18n";
import { categoriesQuery, myNotesQuery, topicsQuery, useDeleteNote } from "@/lib/queries";

const route = getRouteApi("/app/notes");

export type NotesSearch = { q?: string };

export function NotesPage() {
  const { q = "" } = route.useSearch();
  const t = useT();
  const { data: topics } = useSuspenseQuery(topicsQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const { data: notes } = useSuspenseQuery(myNotesQuery);
  const deleteNote = useDeleteNote();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const needle = q.trim().toLowerCase();
  const visible = notes
    .filter(
      (note) =>
        !needle ||
        note.title.toLowerCase().includes(needle) ||
        note.content.toLowerCase().includes(needle),
    )
    .toSorted((a, b) => b.updated_at.localeCompare(a.updated_at));

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[2.75rem] leading-none font-medium tracking-tight">{t.notes.title}</h1>
        <Button onClick={() => dialogRef.current?.showModal()} disabled={!topics.length}>
          <Plus className="size-5" />
          {t.notes.newNote}
        </Button>
      </div>

      {deleteNote.error && <ErrorNote>{deleteNote.error.message}</ErrorNote>}

      <section aria-label={t.notes.list} className="rounded-card bg-panel pt-7 pb-3 animate-rise">
        {visible.length ? (
          <NotesTable
            notes={visible}
            topics={topics}
            onDelete={(note) => deleteNote.mutate(note)}
          />
        ) : (
          <p className="px-7 pb-6 text-lg text-muted">
            {notes.length ? t.notes.nothingMatches : t.notes.noneYet}
          </p>
        )}
      </section>

      <dialog
        ref={dialogRef}
        aria-labelledby="new-note-title"
        closedby="any"
        className="m-auto w-[min(40rem,calc(100%-2rem))] rounded-[2rem] bg-white p-8 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-sm open:animate-rise"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 id="new-note-title" className="text-3xl font-medium tracking-tight">
            {t.notes.newNote}
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={t.notes.close}
            className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-panel"
          >
            <X className="size-6" />
          </button>
        </div>
        <NoteForm
          topics={topics}
          categories={categories}
          onCreated={() => dialogRef.current?.close()}
        />
      </dialog>
    </div>
  );
}
