import { createLocalStore, useLocalStore } from "./local-store";

export type Session = { token: string; username: string; expiresAt: number };

const store = createLocalStore<Session | null>("pyjourney.session", null);

function decodeExpiry(token: string) {
  try {
    const payload = token.split(".")[1] ?? "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const { exp } = JSON.parse(json) as { exp?: number };
    return typeof exp === "number" ? exp * 1000 : Number.POSITIVE_INFINITY;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function activeSession() {
  const session = store.get();
  if (session && session.expiresAt <= Date.now()) {
    store.set(null);
    return null;
  }
  return session;
}

export const auth = {
  get session() {
    return activeSession();
  },
  get token() {
    return activeSession()?.token ?? null;
  },
  signIn(token: string, username: string) {
    store.set({ token, username, expiresAt: decodeExpiry(token) });
  },
  signOut() {
    store.set(null);
  },
  subscribe: store.subscribe,
};

export type Auth = typeof auth;

export function useSession() {
  return useLocalStore(store);
}
