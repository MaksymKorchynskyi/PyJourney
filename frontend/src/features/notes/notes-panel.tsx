import clsx from "clsx";
import { ChevronDown, Plus, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Markdown } from "@/components/markdown/markdown";
import { useDeleteNote } from "@/lib/queries";
import { pad, timeAgo } from "@/lib/topic";
import type { Note, Topic } from "@/lib/types";
import { DeleteButton } from "./delete-button";
import { NoteForm } from "./note-form";

function Collapse({ open, id, children }: { open: boolean; id?: string; children: ReactNode }) {
  return (
    <div
      id={id}
      className={clsx(
        "grid transition-[grid-template-rows,opacity] duration-400 ease-out-soft",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden" inert={!open}>
        {children}
      </div>
    </div>
  );
}

type NotesPanelProps = {
  topic: Topic;
  notes: Note[];
  initialOpen?: number;
  onClose: () => void;
};

export function NotesPanel({ topic, notes, initialOpen, onClose }: NotesPanelProps) {
  const [openId, setOpenId] = useState<number | undefined>(initialOpen ?? notes.at(-1)?.id);
  const [composing, setComposing] = useState(false);
  const deleteNote = useDeleteNote();
  const formOpen = composing || notes.length === 0;

  return (
    <section aria-labelledby="my-notes" className="rounded-card bg-panel">
      <header className="flex items-center justify-between gap-4 px-8 pt-7 pb-5">
        <div className="min-w-0">
          <h2 id="my-notes" className="text-[1.6rem] font-medium tracking-tight">
            My notes
          </h2>
          <p className="line-clamp-1 text-muted">{topic.title}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Hide notes"
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full ring-[1.5px] ring-ink transition-colors hover:bg-white"
        >
          <X className="size-5" strokeWidth={1.8} />
        </button>
      </header>

      {notes.length > 0 && (
        <ol>
          {notes.map((note, index) => {
            const open = note.id === openId;
            const panelId = `note-panel-${note.id}`;
            return (
              <li
                key={note.id}
                id={`note-${note.id}`}
                className="scroll-mt-6 border-white border-t-2 animate-rise"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? undefined : note.id)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="flex w-full cursor-pointer items-center gap-4 px-8 py-5 text-left transition-colors hover:bg-white/50"
                >
                  <span className="flex-1 text-[1.3rem] leading-snug font-medium text-pretty">
                    {pad(index + 1)}. {note.title}
                  </span>
                  <span className="text-base whitespace-nowrap">{timeAgo(note.updated_at)}</span>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full ring-[1.5px] ring-ink">
                    <ChevronDown
                      className={clsx(
                        "size-5 transition-transform duration-300",
                        open && "rotate-180",
                      )}
                      strokeWidth={1.8}
                    />
                  </span>
                </button>
                <Collapse open={open} id={panelId}>
                  <div className="grid gap-4 px-8 pb-6">
                    <Markdown size="md">{note.content}</Markdown>
                    <DeleteButton
                      label={note.title}
                      onConfirm={() => deleteNote.mutate(note)}
                      className="justify-self-end"
                    />
                  </div>
                </Collapse>
              </li>
            );
          })}
        </ol>
      )}

      <div className="border-white border-t-2">
        {notes.length > 0 && (
          <button
            type="button"
            onClick={() => setComposing((value) => !value)}
            aria-expanded={formOpen}
            aria-controls="new-note"
            className="flex w-full cursor-pointer items-center gap-4 px-8 py-5 text-left transition-colors hover:bg-white/50"
          >
            <span className="flex-1 text-[1.3rem] font-medium text-orange">New note</span>
            <span className="grid size-8 place-items-center rounded-full bg-orange text-white">
              <Plus
                className={clsx(
                  "size-5 transition-transform duration-300",
                  formOpen && "rotate-45",
                )}
                strokeWidth={2}
              />
            </span>
          </button>
        )}
        <Collapse open={formOpen} id="new-note">
          <div className={clsx("px-8 pb-8", notes.length === 0 && "pt-6")}>
            {notes.length === 0 && (
              <p className="mb-5 text-lg text-muted">
                No notes for this topic yet. Write down what you learn as you read.
              </p>
            )}
            <NoteForm
              topics={[topic]}
              topicId={topic.id}
              surface="white"
              onCreated={(note) => {
                setComposing(false);
                setOpenId(note.id);
              }}
            />
          </div>
        </Collapse>
      </div>
    </section>
  );
}
