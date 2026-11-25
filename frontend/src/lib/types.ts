export type Locale = "en" | "uk";

export type Category = {
  id: number;
  slug: string;
  position: number;
  title_en: string;
  title_uk: string;
};

export type TopicSummary = {
  id: number;
  category_id: number | null;
  slug: string | null;
  position: number;
  title_en: string;
  title_uk: string;
  excerpt_en: string;
  excerpt_uk: string;
  reading_minutes_en: number;
  reading_minutes_uk: number;
  created_at: string;
  updated_at: string;
};

export type Topic = TopicSummary & {
  content_en: string;
  content_uk: string;
};

export type TopicInput = {
  category_id: number;
  title_en: string;
  title_uk: string;
  content_en: string;
  content_uk: string;
};

export type Note = {
  id: number;
  title: string;
  content: string;
  topic_id: number;
  created_at: string;
  updated_at: string;
};

export type NoteInput = Pick<Note, "title" | "content" | "topic_id">;

export type User = {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
};

export type RegisterInput = {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
};

export type Token = {
  access_token: string;
  token_type: string;
};
