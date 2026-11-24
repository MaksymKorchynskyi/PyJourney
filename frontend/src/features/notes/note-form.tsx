import clsx from "clsx";
import { type SubmitEvent, useState, useTransition } from "react";
import { Button, ErrorNote, Field, inputClass } from "@/components/ui/primitives";
import { useCreateNote } from "@/lib/queries";
import type { Note, Topic } from "@/lib/types";

type NoteFormProps = {
  topics: Topic[];
  topicId?: number;
  surface?: "panel" | "white";
  onCreated?: (note: Note) => void;
};

export function NoteForm({ topics, topicId, surface = "panel", onCreated }: NoteFormProps) {
  const createNote = useCreateNote();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      try {
        const note = await createNote.mutateAsync({
          title: String(data.get("title")).trim(),
          content: String(data.get("content")).trim(),
          topic_id: topicId ?? Number(data.get("topic_id")),
        });
        setError(null);
        form.reset();
        onCreated?.(note);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Something went wrong");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field
        label="Title"
        name="title"
        required
        maxLength={200}
        autoComplete="off"
        surface={surface}
      />
      {topicId === undefined && (
        <label className="grid gap-2">
          <span className="text-sm font-medium text-muted">Topic</span>
          <select
            name="topic_id"
            required
            defaultValue=""
            className={clsx("h-14", inputClass(surface))}
          >
            <option value="" disabled>
              Choose a topic
            </option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="grid gap-2">
        <span className="flex justify-between text-sm font-medium text-muted">
          Note
          <span className="font-normal">Markdown supported</span>
        </span>
        <textarea
          name="content"
          required
          rows={5}
          spellCheck
          placeholder="What did you learn? Paste a snippet to remember it."
          className={clsx(
            "field-sizing-content min-h-36 resize-y py-4 font-[inherit]",
            inputClass(surface),
          )}
        />
      </label>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Saving…" : "Save note"}
      </Button>
    </form>
  );
}
