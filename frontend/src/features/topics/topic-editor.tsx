import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import {
  Bold,
  ChevronDown,
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
import { LANGUAGE_NAMES, LOCALES, useLocale, useT } from "@/lib/i18n";
import type { Messages } from "@/lib/messages";
import { useDeleteTopic, useSaveTopic } from "@/lib/queries";
import { pad, readingMinutes, titleOf } from "@/lib/topic";
import type { Category, Locale, Topic } from "@/lib/types";

type SnippetKey = keyof Messages["editor"]["snippets"];

type Snippet = { key: SnippetKey; icon: LucideIcon; before: string; after?: string };

const SNIPPETS: Snippet[] = [
  { key: "heading", icon: Heading2, before: "\n## " },
  { key: "bold", icon: Bold, before: "**", after: "**" },
  { key: "code", icon: Code, before: "`", after: "`" },
  { key: "block", icon: SquareCode, before: "\n```python\n", after: "\n```\n" },
  { key: "list", icon: List, before: "\n- " },
  { key: "tip", icon: MessageSquareQuote, before: "\n> " },
];

const INDENT = "    ";

type Version = { title: string; content: string };
type Draft = Record<Locale, Version>;

const draftOf = (topic?: Topic): Draft => ({
  en: { title: topic?.title_en ?? "", content: topic?.content_en ?? "" },
  uk: { title: topic?.title_uk ?? "", content: topic?.content_uk ?? "" },
});

const filled = (version: Version) => Boolean(version.title.trim() && version.content.trim());

type TopicEditorProps = { topic?: Topic; categories: Category[] };

export function TopicEditor({ topic, categories }: TopicEditorProps) {
  const t = useT();
  const locale = useLocale();
  const navigate = useNavigate();
  const saveTopic = useSaveTopic();
  const deleteTopic = useDeleteTopic();
  const [initial] = useState(() => draftOf(topic));
  const [draft, setDraft] = useState(initial);
  const [categoryId, setCategoryId] = useState(String(topic?.category_id ?? ""));
  const [language, setLanguage] = useState<Locale>(locale);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const leavingRef = useRef(false);
  const current = draft[language];
  const preview = useDeferredValue(current.content);

  const dirty =
    categoryId !== String(topic?.category_id ?? "") ||
    LOCALES.some(
      (code) =>
        draft[code].title !== initial[code].title || draft[code].content !== initial[code].content,
    );
  const complete = LOCALES.every((code) => filled(draft[code]));
  const touched = LOCALES.some((code) => draft[code].title.trim() || draft[code].content.trim());

  useBlocker({
    shouldBlockFn: () => !leavingRef.current && dirty && !window.confirm(t.editor.discard),
    enableBeforeUnload: () => !leavingRef.current && dirty,
  });

  const update = (patch: Partial<Version>) =>
    setDraft((prev) => ({ ...prev, [language]: { ...prev[language], ...patch } }));

  const replaceSelection = (before: string, after = "", sample = "") => {
    const element = textareaRef.current;
    if (!element) return;
    const { selectionStart: start, selectionEnd: end } = element;
    const { content } = current;
    const selected = content.slice(start, end) || sample;
    update({ content: content.slice(0, start) + before + selected + after + content.slice(end) });
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
        input: {
          category_id: Number(categoryId),
          title_en: draft.en.title.trim(),
          title_uk: draft.uk.title.trim(),
          content_en: draft.en.content.trim(),
          content_uk: draft.uk.content.trim(),
        },
      });
      leavingRef.current = true;
      await navigate({ to: "/topics/$topicId", params: { topicId: String(saved.id) } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.editor.saveFailed);
    }
  };

  const onDelete = async () => {
    if (!topic) return;
    try {
      await deleteTopic.mutateAsync(topic);
      leavingRef.current = true;
      await navigate({ to: "/topics" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.editor.deleteFailed);
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
            {topic ? t.editor.editTitle : t.editor.newTitle}
          </h1>
          <p className="mt-3 text-lg text-muted">
            {t.count.minutes(readingMinutes(current.content))} ·{" "}
            {dirty ? t.editor.unsaved : t.editor.allSaved}
          </p>
        </div>
        <div className="flex gap-2.5">
          <Link
            {...cancelTarget}
            className="inline-flex h-14 items-center rounded-2xl px-6 text-lg font-medium ring-1 ring-mist transition-colors hover:bg-panel"
          >
            {t.editor.cancel}
          </Link>
          <Button type="submit" disabled={saveTopic.isPending || !complete || !categoryId}>
            {saveTopic.isPending
              ? t.editor.saving
              : topic
                ? t.editor.saveChanges
                : t.editor.publish}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <label className="relative grid gap-2">
          <span className="text-sm font-medium text-muted">{t.editor.category}</span>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
            className="h-14 cursor-pointer appearance-none rounded-2xl bg-white pr-12 pl-5 text-lg outline-none ring-1 ring-mist transition-shadow focus:ring-2 focus:ring-blue"
          >
            <option value="" disabled>
              {t.editor.chooseCategory}
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {pad(category.position)}. {titleOf(category, locale)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-5 bottom-4.5 size-5 text-muted" />
        </label>

        <div
          role="tablist"
          aria-label={t.editor.languages}
          className="flex h-14 items-center gap-1 rounded-2xl bg-white p-1.5 ring-1 ring-mist"
        >
          {LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              role="tab"
              lang={code}
              aria-selected={language === code}
              onClick={() => setLanguage(code)}
              className={clsx(
                "inline-flex h-full cursor-pointer items-center gap-2 rounded-xl px-5 text-lg font-medium transition-colors",
                language === code ? "bg-blue text-white" : "text-blue hover:bg-blue/5",
              )}
            >
              {LANGUAGE_NAMES[code]}
              {!filled(draft[code]) && (
                <span
                  className={clsx(
                    "size-2 rounded-full",
                    language === code ? "bg-white" : "bg-orange",
                  )}
                >
                  <span className="sr-only">{t.editor.incomplete}</span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-muted">
          {t.editor.title(LANGUAGE_NAMES[language])}
        </span>
        <input
          lang={language}
          value={current.title}
          onChange={(event) => update({ title: event.target.value })}
          maxLength={200}
          placeholder={t.editor.titlePlaceholder}
          className="h-16 rounded-2xl bg-white px-6 text-2xl font-medium outline-none ring-1 ring-mist transition-shadow placeholder:text-muted/60 focus:ring-2 focus:ring-blue"
        />
      </label>

      {touched && !complete && <p className="text-lg text-muted">{t.editor.bothLanguages}</p>}
      {error && <ErrorNote>{error}</ErrorNote>}

      <section
        aria-label={t.editor.material}
        className="overflow-hidden rounded-card bg-white ring-1 ring-mist"
      >
        <div className="flex flex-wrap items-center gap-2 border-mist border-b bg-surface px-4 py-3">
          <div role="tablist" aria-label={t.editor.mode} className="flex gap-1 xl:hidden">
            {(["write", "preview"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={tab === mode}
                onClick={() => setTab(mode)}
                className={clsx(
                  "h-10 cursor-pointer rounded-xl px-4 font-medium transition-colors",
                  tab === mode ? "bg-blue text-white" : "text-blue hover:bg-blue/5",
                )}
              >
                {t.editor[mode]}
              </button>
            ))}
          </div>
          <div
            role="toolbar"
            aria-label={t.editor.formatting}
            className={clsx("flex flex-wrap gap-1", tab === "preview" && "max-xl:hidden")}
          >
            {SNIPPETS.map(({ key, icon: Icon, before, after }) => {
              const { label, sample } = t.editor.snippets[key];
              return (
                <button
                  key={key}
                  type="button"
                  title={label}
                  aria-label={label}
                  onClick={() => replaceSelection(before, after, sample)}
                  className="grid size-10 cursor-pointer place-items-center rounded-xl text-ink transition-colors hover:bg-mist"
                >
                  <Icon className="size-5" strokeWidth={1.8} />
                </button>
              );
            })}
          </div>
          <span className="ml-auto hidden text-sm text-muted sm:block">{t.editor.hint}</span>
        </div>

        <div className="grid xl:grid-cols-2">
          <label className={clsx("grid", tab === "preview" && "max-xl:hidden")}>
            <span className="sr-only">
              {t.editor.markdownLabel} · {LANGUAGE_NAMES[language]}
            </span>
            <textarea
              ref={textareaRef}
              lang={language}
              value={current.content}
              onChange={(event) => update({ content: event.target.value })}
              onKeyDown={onKeyDown}
              spellCheck={false}
              placeholder={t.editor.placeholder}
              className="min-h-[65dvh] resize-y bg-white px-6 py-5 font-mono text-base leading-7 outline-none placeholder:text-muted/60"
            />
          </label>
          <div
            lang={language}
            className={clsx(
              "min-w-0 border-mist px-6 py-6 sm:px-10 xl:max-h-[75dvh] xl:overflow-y-auto xl:border-l",
              tab === "write" && "max-xl:hidden",
            )}
          >
            <p className="mb-6 text-sm font-medium tracking-wide text-muted uppercase">
              {t.editor.preview} · {LANGUAGE_NAMES[language]}
            </p>
            {preview.trim() ? (
              <Markdown>{preview}</Markdown>
            ) : (
              <p className="text-lg text-muted">{t.editor.previewEmpty}</p>
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
              {t.editor.dangerTitle}
            </h2>
            <p className="text-muted">{t.editor.dangerText}</p>
          </div>
          <div className="flex gap-2.5">
            {confirmDelete && (
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                {t.editor.keep}
              </Button>
            )}
            <Button
              variant={confirmDelete ? "primary" : "danger"}
              disabled={deleteTopic.isPending}
              onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
            >
              <Trash2 className="size-5" />
              {deleteTopic.isPending
                ? t.editor.deleting
                : confirmDelete
                  ? t.editor.confirmDelete
                  : t.editor.delete}
            </Button>
          </div>
        </section>
      )}
    </form>
  );
}
