import type { RefObject } from "react";

export type ScrollContainer = RefObject<HTMLElement | null>;

export type Offset = number | `${number}%`;

export type SectionBounds = {
  top: number;
  bottom: number;
  height: number;
};

export type ScrollState = {
  y: number;
  progress: number;
  direction: "up" | "down" | null;
  velocity: number;
  scrolling: boolean;
  maxScroll: number;
  viewportHeight: number;
  trackingOffset: number;
  triggerLine: number;
};

export type SectionState = {
  bounds: SectionBounds;
  visibility: number;
  progress: number;
  inView: boolean;
  active: boolean;
  rect: DOMRect | null;
};

export type ScrollBehavior = "smooth" | "instant" | "auto";

export type ScrollToPosition = "top" | "center" | "bottom";

export type NavRefPosition = "nearest" | "center" | "start" | "end";

export type NavRefOptions = {
  behavior?: ScrollBehavior;
  offset?: number;
  position?: NavRefPosition;
};

export type ScrollTarget =
  | string
  | { id: string }
  | { top: number };

export type ScrollToOptions = {
  offset?: Offset;
  behavior?: ScrollBehavior;
  position?: ScrollToPosition;
  lockActive?: boolean;
};

export type ElementScrollOptions = Pick<ScrollToOptions, "behavior" | "position">;

export type ElementScrollTarget = HTMLElement | (() => HTMLElement | null | undefined);

export type UseElementScrollReturn = {
  scrollTo: (target: ElementScrollTarget, options?: ElementScrollOptions) => void;
};

export type TrackingOptions = {
  offset?: Offset;
  threshold?: number;
  hysteresis?: number;
};

export type ScrollingOptions = ScrollToOptions;

export type DometOptions = {
  ids: string[];
  selector?: never;
  container?: ScrollContainer;
  tracking?: TrackingOptions;
  scrolling?: ScrollingOptions;
  onActive?: (id: string | null, prevId: string | null) => void;
  onEnter?: (id: string) => void;
  onLeave?: (id: string) => void;
  onScrollStart?: () => void;
  onScrollEnd?: () => void;
  debug?: boolean;
} | {
  ids?: never;
  selector: string;
  container?: ScrollContainer;
  tracking?: TrackingOptions;
  scrolling?: ScrollingOptions;
  onActive?: (id: string | null, prevId: string | null) => void;
  onEnter?: (id: string) => void;
  onLeave?: (id: string) => void;
  onScrollStart?: () => void;
  onScrollEnd?: () => void;
  debug?: boolean;
};

export type RegisterProps = {
  id: string;
  ref: (el: HTMLElement | null) => void;
  "data-domet": string;
};

export type LinkProps = {
  onClick: () => void;
  "aria-current": "page" | undefined;
  "data-active": boolean;
};

export type UseDometReturn = {
  active: string | null;
  index: number;
  progress: number;
  direction: "up" | "down" | null;
  scroll: ScrollState;
  sections: Record<string, SectionState>;
  ids: string[];
  scrollTo: (target: ScrollTarget, options?: ScrollToOptions) => void;
  register: (id: string) => RegisterProps;
  link: (id: string, options?: ScrollToOptions) => LinkProps;
  navRef: (id: string, options?: NavRefOptions) => (el: HTMLElement | null) => void;
};

export type DometCallbacks = Pick<
  DometOptions,
  "onActive" | "onEnter" | "onLeave" | "onScrollStart" | "onScrollEnd"
>;

export type DebugOverrides = {
  tracking?: TrackingOptions;
  scrolling?: ScrollingOptions;
};

export type DebugView = {
  active: string | null;
  index: number;
  ids: string[];
  container: HTMLElement | null;
  tracking: Required<TrackingOptions>;
  scrolling: ScrollingOptions;
  scrollTo: (id: string) => void;
};

export type DebugEventType =
  | "active"
  | "enter"
  | "leave"
  | "scrollStart"
  | "scrollEnd";

export type DebugLimits = Record<
  "offset" | "offsetPercent" | "threshold" | "hysteresis",
  { min: number; max: number }
>;

export type DebugController = {
  limits: DebugLimits;
  percentPattern: RegExp;
  getView: () => DebugView;
  getScroll: () => ScrollState;
  getSections: () => Record<string, SectionState>;
  subscribe: (listener: () => void) => () => void;
  setOverrides: (overrides: DebugOverrides | null) => void;
};

export type DebugHandle = {
  update: () => void;
  event: (type: DebugEventType, args: unknown[]) => void;
  destroy: () => void;
};

export type ResolvedSection = {
  id: string;
  element: HTMLElement;
};

export type SectionScore = {
  id: string;
  score: number;
  visibilityRatio: number;
  inView: boolean;
  bounds: SectionBounds;
  progress: number;
};

export type CachedSectionPosition = {
  id: string;
  baseTop: number;
  height: number;
  width: number;
  left: number;
};
