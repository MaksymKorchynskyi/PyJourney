import type { Category, Locale, Topic, TopicSummary } from "./types";

export const CARD_TONES = ["blue", "orange", "ink"] as const;
export type CardTone = (typeof CARD_TONES)[number];

export const toneAt = (index: number): CardTone => CARD_TONES[index % CARD_TONES.length] ?? "blue";

export const FILTERS = ["in-progress", "not-started", "completed", "saved"] as const;

export type TopicFilter = (typeof FILTERS)[number];
export type TopicStatus = Exclude<TopicFilter, "saved">;

export function statusOf(progress: number, notes: number): TopicStatus {
  if (progress >= 1) return "completed";
  if (progress > 0 || notes > 0) return "in-progress";
  return "not-started";
}

const WORDS_PER_MINUTE = 180;

export function readingMinutes(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function plainExcerpt(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const pad = (value: number) => String(value).padStart(2, "0");

type Titled = { title_en: string; title_uk: string };

export const titleOf = (item: Titled, locale: Locale) =>
  locale === "uk" ? item.title_uk : item.title_en;

export const excerptOf = (topic: TopicSummary, locale: Locale) =>
  locale === "uk" ? topic.excerpt_uk : topic.excerpt_en;

export const minutesOf = (topic: TopicSummary, locale: Locale) =>
  locale === "uk" ? topic.reading_minutes_uk : topic.reading_minutes_en;

export const contentOf = (topic: Topic, locale: Locale) =>
  locale === "uk" ? topic.content_uk : topic.content_en;

export const categoryOf = (topic: TopicSummary, categories: Map<number, Category>) =>
  topic.category_id === null ? undefined : categories.get(topic.category_id);

export function matchesTopic(topic: TopicSummary, category: Category | undefined, needle: string) {
  if (!needle) return true;
  return [
    topic.title_en,
    topic.title_uk,
    topic.excerpt_en,
    topic.excerpt_uk,
    category?.title_en ?? "",
    category?.title_uk ?? "",
  ].some((text) => text.toLowerCase().includes(needle));
}
