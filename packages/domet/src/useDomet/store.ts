import type {
  CachedSectionPosition,
  ScrollState,
  SectionScore,
  SectionState,
} from "../types";
import { buildViewportRect } from "../utils";

export type DometSnapshot = {
  scroll: ScrollState;
  sections: Record<string, SectionState>;
};

export type TrackedKey = keyof ScrollState | "sections";

type Listener = (prev: DometSnapshot, next: DometSnapshot) => void;

export type DometStore = {
  getState: () => DometSnapshot;
  setState: (partial: Partial<DometSnapshot>) => void;
  subscribe: (listener: Listener) => () => void;
};

export const INITIAL_SCROLL_STATE: ScrollState = {
  y: 0,
  progress: 0,
  direction: null,
  velocity: 0,
  scrolling: false,
  maxScroll: 0,
  viewportHeight: 0,
  trackingOffset: 0,
  triggerLine: 0,
};

export function createDometStore(): DometStore {
  let state: DometSnapshot = { scroll: INITIAL_SCROLL_STATE, sections: {} };
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    setState: (partial) => {
      const prev = state;
      state = { ...state, ...partial };
      for (const listener of listeners) listener(prev, state);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function hasTrackedChange(
  tracked: Set<TrackedKey>,
  prev: DometSnapshot,
  next: DometSnapshot,
): boolean {
  for (const key of tracked) {
    if (key === "sections") {
      if (prev.sections !== next.sections) return true;
    } else if (prev.scroll[key] !== next.scroll[key]) {
      return true;
    }
  }
  return false;
}

export function createTrackedScroll(
  scroll: ScrollState,
  tracked: Set<TrackedKey>,
  getState: () => DometSnapshot,
): ScrollState {
  const trackedScroll = {} as ScrollState;
  for (const key of Object.keys(scroll) as (keyof ScrollState)[]) {
    Object.defineProperty(trackedScroll, key, {
      enumerable: true,
      get: () => {
        tracked.add(key);
        return getState().scroll[key];
      },
    });
  }
  return trackedScroll;
}

export type SectionsSource = {
  scores: SectionScore[];
  cache: CachedSectionPosition[];
  scrollY: number;
  activeId: string | null;
  built?: Record<string, SectionState>;
};

function roundRatio(value: number): number {
  return Math.round(value * 100) / 100;
}

export function haveSectionsChanged(
  prev: Record<string, SectionState>,
  source: SectionsSource,
): boolean {
  const { scores, cache, scrollY, activeId } = source;

  let countPrev = 0;
  for (const key in prev) {
    if (Object.prototype.hasOwnProperty.call(prev, key)) countPrev++;
  }
  if (countPrev !== scores.length) return true;

  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    const ps = prev[s.id];
    if (!ps) return true;
    if (
      ps.visibility !== roundRatio(s.visibilityRatio) ||
      ps.progress !== roundRatio(s.progress) ||
      ps.inView !== s.inView ||
      ps.active !== (s.id === activeId) ||
      ps.bounds.top !== Math.round(s.bounds.top) ||
      ps.bounds.bottom !== Math.round(s.bounds.bottom) ||
      ps.bounds.height !== Math.round(s.bounds.height) ||
      ps.rect?.top !== cache[i].baseTop - scrollY ||
      ps.rect?.left !== cache[i].left ||
      ps.rect?.width !== cache[i].width ||
      ps.rect?.height !== cache[i].height
    ) {
      return true;
    }
  }
  return false;
}

export function buildSectionStates(
  source: SectionsSource,
): Record<string, SectionState> {
  const { scores, cache, scrollY, activeId } = source;
  const sections: Record<string, SectionState> = {};
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    sections[s.id] = {
      bounds: {
        top: Math.round(s.bounds.top),
        bottom: Math.round(s.bounds.bottom),
        height: Math.round(s.bounds.height),
      },
      visibility: roundRatio(s.visibilityRatio),
      progress: roundRatio(s.progress),
      inView: s.inView,
      active: s.id === activeId,
      rect: buildViewportRect(cache[i], scrollY),
    };
  }
  return sections;
}

export function readSections(
  store: DometStore,
  source: SectionsSource | null,
): Record<string, SectionState> {
  if (!source) return store.getState().sections;
  if (!source.built) source.built = buildSectionStates(source);
  return source.built;
}
