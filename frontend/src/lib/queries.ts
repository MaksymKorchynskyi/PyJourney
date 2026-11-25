import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "./api";
import type {
  Category,
  Note,
  NoteInput,
  RegisterInput,
  Token,
  Topic,
  TopicInput,
  TopicSummary,
  User,
} from "./types";

export const topicsQuery = queryOptions({
  queryKey: ["topics"],
  queryFn: ({ signal }) => api<TopicSummary[]>("/topics/?limit=500", { signal }),
});

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: ({ signal }) => api<Category[]>("/categories/", { signal }),
  staleTime: 5 * 60_000,
});

export const topicQuery = (id: number) =>
  queryOptions({
    queryKey: ["topic", id],
    queryFn: ({ signal }) => api<Topic>(`/topics/topics/${id}`, { signal }),
  });

export const myNotesQuery = queryOptions({
  queryKey: ["notes", "mine"],
  queryFn: ({ signal }) => api<Note[]>("/notes/?limit=100", { signal }),
});

export type Role = "admin" | "user";

export const meQuery = queryOptions({
  queryKey: ["session", "me"],
  queryFn: async ({ signal }): Promise<User | null> => {
    try {
      return await api<User>("/auth/me", { signal });
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 405)) return null;
      throw error;
    }
  },
  staleTime: 5 * 60_000,
});

export function useMe() {
  return useQuery(meQuery);
}

async function probeRole(signal: AbortSignal): Promise<Role> {
  try {
    await api("/topics/topics/0", { method: "PUT", signal });
    return "admin";
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 403) return "user";
    if (error.status === 422 || error.status === 404) return "admin";
    throw error;
  }
}

export const roleQuery = queryOptions({
  queryKey: ["session", "role"],
  queryFn: async ({ signal, client }): Promise<Role> => {
    const me = await client.ensureQueryData(meQuery);
    if (me) return me.role === "admin" ? "admin" : "user";
    return probeRole(signal);
  },
  staleTime: Number.POSITIVE_INFINITY,
});

export function useIsAdmin() {
  return useQuery(roleQuery).data === "admin";
}

export function login(username: string, password: string) {
  return api<Token>("/auth/token", { method: "POST", form: { username, password } });
}

export function register(input: RegisterInput) {
  return api<unknown>("/auth/", { method: "POST", json: input });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NoteInput) => api<Note>("/notes/notes", { method: "POST", json: input }),
    onSuccess: (note) => {
      queryClient.setQueryData(myNotesQuery.queryKey, (notes) => notes && [...notes, note]);
      return queryClient.invalidateQueries({ queryKey: myNotesQuery.queryKey });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note: Note) => api<void>(`/notes/notes/${note.id}`, { method: "DELETE" }),
    onMutate: async (note) => {
      await queryClient.cancelQueries({ queryKey: myNotesQuery.queryKey });
      const previous = queryClient.getQueryData(myNotesQuery.queryKey);
      queryClient.setQueryData(myNotesQuery.queryKey, (notes) =>
        notes?.filter((item) => item.id !== note.id),
      );
      return { previous };
    },
    onError: (_error, _note, context) => {
      queryClient.setQueryData(myNotesQuery.queryKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: myNotesQuery.queryKey }),
  });
}

export function useSaveTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: TopicInput }) =>
      id
        ? api<Topic>(`/topics/topics/${id}`, { method: "PUT", json: input })
        : api<Topic>("/topics/topics", { method: "POST", json: input }),
    onSuccess: (topic) => {
      queryClient.setQueryData(topicQuery(topic.id).queryKey, topic);
      return queryClient.invalidateQueries({ queryKey: topicsQuery.queryKey });
    },
  });
}

export function useDeleteTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (topic: Pick<TopicSummary, "id">) =>
      api<void>(`/topics/topics/${topic.id}`, { method: "DELETE" }),
    onSuccess: (_data, topic) => {
      queryClient.removeQueries({ queryKey: topicQuery(topic.id).queryKey });
      queryClient.setQueryData(topicsQuery.queryKey, (topics) =>
        topics?.filter((item) => item.id !== topic.id),
      );
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: topicsQuery.queryKey }),
        queryClient.invalidateQueries({ queryKey: myNotesQuery.queryKey }),
      ]);
    },
  });
}
