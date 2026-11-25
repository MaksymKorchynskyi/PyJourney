import { Link } from "@tanstack/react-router";
import { TopicMark } from "@/features/topics/topic-mark";
import { timeAgo, useLocale, useT } from "@/lib/i18n";
import { plainExcerpt, titleOf, toneAt } from "@/lib/topic";
import type { Note, TopicSummary } from "@/lib/types";
import { DeleteButton } from "./delete-button";

type NotesTableProps = {
  notes: Note[];
  topics: TopicSummary[];
  onDelete?: (note: Note) => void;
};

export function NotesTable({ notes, topics, onDelete }: NotesTableProps) {
  const t = useT();
  const locale = useLocale();
  const indexById = new Map(topics.map((topic, index) => [topic.id, index]));

  return (
    <table className="w-full border-collapse text-left">
      <thead className="text-muted">
        <tr>
          <th scope="col" className="px-6 pb-3 font-normal lg:px-7">
            {t.notes.columnNote}
          </th>
          <th scope="col" className="hidden pb-3 font-normal md:table-cell">
            {t.notes.columnTopic}
          </th>
          <th scope="col" className="px-6 pb-3 text-right font-normal lg:px-7">
            {t.notes.columnUpdated}
          </th>
          {onDelete && (
            <th scope="col" className="w-0 pr-6 pb-3">
              <span className="sr-only">{t.notes.columnActions}</span>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {notes.map((note) => {
          const index = indexById.get(note.topic_id);
          const topic = index === undefined ? undefined : topics[index];
          return (
            <tr
              key={note.id}
              className="relative border-white border-t-2 transition-colors first:border-t-0 hover:bg-white/60"
            >
              <td className="px-6 py-5 lg:px-7">
                <Link
                  to="/topics/$topicId"
                  params={{ topicId: String(note.topic_id) }}
                  hash={`note-${note.id}`}
                  className="text-xl font-medium after:absolute after:inset-0 after:content-['']"
                >
                  {note.title}
                </Link>
                <p className="mt-1 line-clamp-1 text-[1.05rem] text-ink/75">
                  {plainExcerpt(note.content)}
                </p>
              </td>
              <td className="hidden md:table-cell">
                <span className="flex items-center gap-4 text-xl">
                  {index !== undefined && <TopicMark index={index} tone={toneAt(index)} />}
                  <span className="line-clamp-1">
                    {topic ? titleOf(topic, locale) : t.notes.unknownTopic(note.topic_id)}
                  </span>
                </span>
              </td>
              <td className="px-6 text-right text-lg whitespace-nowrap lg:px-7">
                {timeAgo(note.updated_at, locale)}
              </td>
              {onDelete && (
                <td className="pr-6">
                  <DeleteButton label={note.title} onConfirm={() => onDelete(note)} />
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
