import type { Offset } from "./types";

export const DEFAULT_THRESHOLD = 0.6;
export const DEFAULT_HYSTERESIS = 150;
export const DEFAULT_OFFSET: Offset = 0;
export const SCROLL_IDLE_MS = 100;
export const PERCENT_REGEX = /^(-?\d+(?:\.\d+)?)%$/;

export const MIN_SCROLL_THRESHOLD = 10;
export const EDGE_TOLERANCE = 5;
