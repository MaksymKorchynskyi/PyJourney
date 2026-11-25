import { createLocalStore, useLocalStore } from "./local-store";

const EMPTY: number[] = [];
const store = createLocalStore<number[]>("pyjourney.bookmarks", EMPTY);

export function useBookmarks() {
  return useLocalStore(store);
}

export function toggleBookmark(id: number) {
  store.set((ids) => {
    const next = ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
    return next.length ? next : EMPTY;
  });
}
