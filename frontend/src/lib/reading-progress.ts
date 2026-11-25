import { type RefObject, useEffect, useState } from "react";
import { createLocalStore, useLocalStore } from "./local-store";

type ProgressMap = Record<string, number>;

type VisitMap = Record<string, string>;

const EMPTY: ProgressMap = {};
const store = createLocalStore<ProgressMap>("pyjourney.progress", EMPTY);

const NO_VISITS: VisitMap = {};
const visits = createLocalStore<VisitMap>("pyjourney.visits", NO_VISITS);

export function useReadingProgress() {
  return useLocalStore(store);
}

export function useVisits() {
  return useLocalStore(visits);
}

function markVisited(topicId: number) {
  visits.set((map) => ({ ...map, [topicId]: new Date().toISOString() }));
}

function record(topicId: number, fraction: number) {
  const value = fraction >= 0.97 ? 1 : Math.floor(fraction * 20) / 20;
  if (value <= (store.get()[topicId] ?? 0)) return;
  store.set((map) => ({ ...map, [topicId]: value }));
}

export function useTrackReading(topicId: number, target: RefObject<HTMLElement | null>) {
  const [fraction, setFraction] = useState(0);

  useEffect(() => {
    markVisited(topicId);
    let frame = 0;
    const measure = () => {
      frame = 0;
      const element = target.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const seen = (window.innerHeight - rect.top) / Math.max(rect.height, 1);
      const next = Math.min(1, Math.max(0, seen));
      setFraction(next);
      record(topicId, next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [topicId, target]);

  return fraction;
}
