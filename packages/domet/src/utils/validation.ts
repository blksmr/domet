import type { Offset } from "../types";
import {
  DEFAULT_OFFSET,
  DEFAULT_THRESHOLD,
  DEFAULT_HYSTERESIS,
  PERCENT_REGEX,
} from "../constants";

export const VALIDATION_LIMITS = {
  offset: { min: -10000, max: 10000 },
  offsetPercent: { min: -500, max: 500 },
  threshold: { min: 0, max: 1 },
  hysteresis: { min: 0, max: 1000 },
} as const;

function warn(message: string): void {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[domet] ${message}`);
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function sanitizeOffset(offset: Offset | undefined): Offset {
  if (offset === undefined) {
    return DEFAULT_OFFSET;
  }

  if (typeof offset === "number") {
    if (!isFiniteNumber(offset)) {
      warn(`Invalid offset value: ${offset}. Using default.`);
      return DEFAULT_OFFSET;
    }
    const { min, max } = VALIDATION_LIMITS.offset;
    if (offset < min || offset > max) {
      warn(`Offset ${offset} clamped to [${min}, ${max}].`);
      return clamp(offset, min, max);
    }
    return offset;
  }

  if (typeof offset === "string") {
    const trimmed = offset.trim();
    const match = PERCENT_REGEX.exec(trimmed);
    if (!match) {
      warn(`Invalid offset format: "${offset}". Using default.`);
      return DEFAULT_OFFSET;
    }
    const percent = parseFloat(match[1]);
    if (!isFiniteNumber(percent)) {
      warn(`Invalid percentage value in offset: "${offset}". Using default.`);
      return DEFAULT_OFFSET;
    }
    const { min, max } = VALIDATION_LIMITS.offsetPercent;
    if (percent < min || percent > max) {
      warn(`Offset percentage ${percent}% clamped to [${min}%, ${max}%].`);
      return `${clamp(percent, min, max)}%`;
    }
    return trimmed as `${number}%`;
  }

  warn(`Invalid offset type: ${typeof offset}. Using default.`);
  return DEFAULT_OFFSET;
}

export function sanitizeThreshold(threshold: number | undefined): number {
  if (threshold === undefined) {
    return DEFAULT_THRESHOLD;
  }

  if (!isFiniteNumber(threshold)) {
    warn(`Invalid threshold value: ${threshold}. Using default.`);
    return DEFAULT_THRESHOLD;
  }

  const { min, max } = VALIDATION_LIMITS.threshold;
  if (threshold < min || threshold > max) {
    warn(`Threshold ${threshold} clamped to [${min}, ${max}].`);
    return clamp(threshold, min, max);
  }

  return threshold;
}

export function sanitizeHysteresis(hysteresis: number | undefined): number {
  if (hysteresis === undefined) {
    return DEFAULT_HYSTERESIS;
  }

  if (!isFiniteNumber(hysteresis)) {
    warn(`Invalid hysteresis value: ${hysteresis}. Using default.`);
    return DEFAULT_HYSTERESIS;
  }

  const { min, max } = VALIDATION_LIMITS.hysteresis;
  if (hysteresis < min || hysteresis > max) {
    warn(`Hysteresis ${hysteresis} clamped to [${min}, ${max}].`);
    return clamp(hysteresis, min, max);
  }

  return hysteresis;
}

export function sanitizeIds(ids: string[] | undefined): string[] {
  if (!ids || !Array.isArray(ids)) {
    warn("Invalid ids: expected an array. Using empty array.");
    return [];
  }

  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const id of ids) {
    if (typeof id !== "string") {
      warn(`Invalid id type: ${typeof id}. Skipping.`);
      continue;
    }

    const trimmed = id.trim();
    if (trimmed === "") {
      warn("Empty string id detected. Skipping.");
      continue;
    }

    if (seen.has(trimmed)) {
      warn(`Duplicate id "${trimmed}" detected. Skipping.`);
      continue;
    }

    seen.add(trimmed);
    sanitized.push(trimmed);
  }

  return sanitized;
}

export function sanitizeSelector(selector: string | undefined): string {
  if (selector === undefined) {
    return "";
  }

  if (typeof selector !== "string") {
    warn(`Invalid selector type: ${typeof selector}. Using empty string.`);
    return "";
  }

  const trimmed = selector.trim();
  if (trimmed === "") {
    warn("Empty selector provided.");
  }

  return trimmed;
}
