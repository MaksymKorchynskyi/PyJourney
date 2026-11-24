import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import {
  Bold,
  Code,
  Heading2,
  List,
  type LucideIcon,
  MessageSquareQuote,
  SquareCode,
  Trash2,
} from "lucide-react";
import { type KeyboardEvent, type SubmitEvent, useDeferredValue, useRef, useState } from "react";
import { Markdown } from "@/components/markdown/markdown";
import { Button, ErrorNote } from "@/components/ui/primitives";
import { useDeleteTopic, useSaveTopic } from "@/lib/queries";
import { readingMinutes } from "@/lib/topic";
import type { Topic } from "@/lib/types";

type Snippet = { label: string; icon: LucideIcon; before: string; after?: string; sample: string };

const SNIPPETS: Snippet[] = [
  { label: "Heading", icon: Heading2, before: "\n## ", sample: "Heading" },
  { label: "Bold", icon: Bold, before: "**", after: "**", sample: "bold text" },
  { label: "Inline code", icon: Code, before: "`", after: "`", sample: "code" },
  {
    label: "Python code block",
    icon: SquareCode,
    before: "\n```python\n",
    after: "\n```\n",
    sample: 'print("Hello, PyJourney!")',
  },
  { label: "List", icon: List, before: "\n- ", sample: "item" },
  { label: "Tip", icon: MessageSquareQuote, before: "\n> ", sample: "Tip" },
];

const INDENT = "    ";

export function TopicEditor({ topic }: { topic?: Topic }) {
  const navigate = useNavigate();
  const saveTopic = useSaveTopic();
  const deleteTopic = useDeleteTopic();
  const [title, setTitle] = useState(topic?.title ?? "");
  const [content, setContent] = useState(topic?.content ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const leavingRef = useRef(false);
  const preview = useDeferredValue(content);

  const dirty = title !== (topic?.title ?? "") || content !== (topic?.content ?? "");

  useBlocker({
    shouldBlockFn: () =>
      !leavingRef.current && dirty && !window.confirm("Discard your unsaved changes?"),
    enableBeforeUnload: () => !leavingRef.current && dirty,
  });

  const replaceSelection = (before: string, after = "", sample = "") => {
    const element = textareaRef.current;
    if (!element) return;
    const { selectionStart: start, selectionEnd: end } = element;
    const selected = content.slice(start, end) || sample;
    setContent(content.slice(0, start) + before + selected + after + content.slice(end));
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Tab" || event.shiftKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    replaceSelection(INDENT);
  };

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const saved = await saveTopic.mutateAsync({
        id: topic?.id,
        input: { title: title.trim(), content: content.trim() },
      });
      leavingRef.current = true;
      await navigate({ to: "/topics/$topicId", params: { topicId: String(saved.id) } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the topic.");
    }
  };

  const onDelete = async () => {
    if (!topic) return;
    try {
      await deleteTopic.mutateAsync(topic);
      leavingRef.current = true;
      await navigate({ to: "/topics" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the topic.");
    }
  };

  const cancelTarget = topic
    ? ({ to: "/topics/$topicId", params: { topicId: String(topic.id) } } as const)
    : ({ to: "/topics" } as const);

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[2.75rem] leading-none font-medium tracking-tight">
            {topic ? "Edit topic" : "New topic"}
          </h1>
          <p className="mt-3 text-lg text-muted">
            {readingMinutes(content)} min read · {dirty ? "Unsaved changes" : "All changes saved"}
          </p>
        </div>
        <div className="flex gap-2.5">
          <Link
            {...cancelTarget}
            className="inline-flex h-14 items-center rounded-2xl px-6 text-lg font-medium ring-1 ring-mist transition-colors hover:bg-panel"
          >
            Cancel
          </Link>
          <Button type="submit" disabled={saveTopic.isPending || !title.trim() || !content.trim()}>
            {saveTopic.isPending ? "Saving…" : topic ? "Save changes" : "Publish topic"}
          </Button>
        </div>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-muted">Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={200}
          placeholder="e.g. Context managers"
          className="h-16 rounded-2xl bg-white px-6 text-2xl font-medium outline-none ring-1 ring-mist transition-shadow placeholder:text-muted/60 focus:ring-2 focus:ring-blue"
        />
      </label>

      {error && <ErrorNote>{error}</ErrorNote>}

      <section
        aria-label="Material"
        className="overflow-hidden rounded-card bg-white ring-1 ring-mist"
      >
        <div className="flex flex-wrap items-center gap-2 border-mist border-b bg-surface px-4 py-3">
          <div role="tablist" aria-label="Editor mode" className="flex gap-1 xl:hidden">
            {(["write", "preview"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={tab === mode}
                onClick={() => setTab(mode)}
                className={clsx(
                  "h-10 cursor-pointer rounded-xl px-4 font-medium capitalize transition-colors",
                  tab === mode ? "bg-blue text-white" : "text-blue hover:bg-blue/5",
                )}
              >
                {mode}
              </button>
            ))}
          </div>
          <div
            role="toolbar"
            aria-label="Formatting"
            className={clsx("flex flex-wrap gap-1", tab === "preview" && "max-xl:hidden")}
          >
            {SNIPPETS.map(({ label, icon: Icon, before, after, sample }) => (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => replaceSelection(before, after, sample)}
                className="grid size-10 cursor-pointer place-items-center rounded-xl text-ink transition-colors hover:bg-mist"
              >
                <Icon className="size-5" strokeWidth={1.8} />
              </button>
            ))}
          </div>
          <span className="ml-auto hidden text-sm text-muted sm:block">
            Markdown · Tab inserts 4 spaces
          </span>
        </div>

        <div className="grid xl:grid-cols-2">
          <label className={clsx("grid", tab === "preview" && "max-xl:hidden")}>
            <span className="sr-only">Material in Markdown</span>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={onKeyDown}
              required
              spellCheck={false}
              placeholder={"Explain the topic here.\n\n```python\n# and show some code\n```"}
              className="min-h-[65dvh] resize-y bg-white px-6 py-5 font-mono text-base leading-7 outline-none placeholder:text-muted/60"
            />
          </label>
          <div
            className={clsx(
              "min-w-0 border-mist px-6 py-6 sm:px-10 xl:max-h-[75dvh] xl:overflow-y-auto xl:border-l",
              tab === "write" && "max-xl:hidden",
            )}
          >
            <p className="mb-6 text-sm font-medium tracking-wide text-muted uppercase">Preview</p>
            {preview.trim() ? (
              <Markdown>{preview}</Markdown>
            ) : (
              <p className="text-lg text-muted">Start writing to see how the topic will look.</p>
            )}
          </div>
        </div>
      </section>

      {topic && (
        <section
          aria-labelledby="danger-zone"
          className="flex flex-wrap items-center justify-between gap-4 rounded-card bg-orange/5 px-8 py-6 ring-1 ring-orange/20"
        >
          <div>
            <h2 id="danger-zone" className="text-xl font-medium">
              Delete this topic
            </h2>
            <p className="text-muted">
              The topic and every note written for it will be removed for all users.
            </p>
          </div>
          <div className="flex gap-2.5">
            {confirmDelete && (
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep it
              </Button>
            )}
            <Button
              variant={confirmDelete ? "primary" : "danger"}
              disabled={deleteTopic.isPending}
              onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
            >
              <Trash2 className="size-5" />
              {deleteTopic.isPending
                ? "Deleting…"
                : confirmDelete
                  ? "Yes, delete topic"
                  : "Delete topic"}
            </Button>
          </div>
        </section>
      )}
    </form>
  );
}
