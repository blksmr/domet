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

export type TrackingOptions = {
  offset?: Offset;
  threshold?: number;
  hysteresis?: number;
  throttle?: number;
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

export type ResolvedSection = {
  id: string;
  element: HTMLElement;
};

export type InternalSectionBounds = SectionBounds & { id: string; rect: DOMRect };

export type SectionScore = {
  id: string;
  score: number;
  visibilityRatio: number;
  inView: boolean;
  bounds: InternalSectionBounds;
  progress: number;
  rect: DOMRect | null;
};

export type CachedSectionPosition = {
  id: string;
  baseTop: number;
  height: number;
  width: number;
  left: number;
};
