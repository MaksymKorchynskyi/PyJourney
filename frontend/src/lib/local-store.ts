import { useSyncExternalStore } from "react";

export type LocalStore<T> = {
  get: () => T;
  fallback: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createLocalStore<T>(key: string, initial: T): LocalStore<T> {
  const listeners = new Set<() => void>();
  let cache: T = read();

  function read(): T {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  }

  function set(next: T | ((prev: T) => T)) {
    cache = typeof next === "function" ? (next as (prev: T) => T)(cache) : next;
    try {
      if (cache === initial) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(cache));
    } catch {}
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      cache = read();
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  return { get: () => cache, fallback: () => initial, set, subscribe };
}

export function useLocalStore<T>(store: LocalStore<T>) {
  return useSyncExternalStore(store.subscribe, store.get, store.fallback);
}
