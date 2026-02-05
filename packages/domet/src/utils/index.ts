import {
  useEffect,
  useLayoutEffect,
} from "react";

import type { ScrollState, SectionState } from "../types";

export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function areIdInputsEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

export function areScrollStatesEqual(a: ScrollState, b: ScrollState): boolean {
  return (
    a.y === b.y &&
    a.progress === b.progress &&
    a.direction === b.direction &&
    a.velocity === b.velocity &&
    a.scrolling === b.scrolling &&
    a.maxScroll === b.maxScroll &&
    a.viewportHeight === b.viewportHeight &&
    a.trackingOffset === b.trackingOffset &&
    a.triggerLine === b.triggerLine
  );
}

export function areSectionsEqual(
  a: Record<string, SectionState>,
  b: Record<string, SectionState>,
): boolean {
  let countA = 0;
  for (const key in a) {
    if (!Object.prototype.hasOwnProperty.call(a, key)) continue;
    countA++;
    const sA = a[key];
    const sB = b[key];
    if (!sB) return false;
    if (
      sA.visibility !== sB.visibility ||
      sA.progress !== sB.progress ||
      sA.inView !== sB.inView ||
      sA.active !== sB.active ||
      sA.bounds.top !== sB.bounds.top ||
      sA.bounds.bottom !== sB.bounds.bottom ||
      sA.bounds.height !== sB.bounds.height
    ) {
      return false;
    }
  }
  let countB = 0;
  for (const key in b) {
    if (Object.prototype.hasOwnProperty.call(b, key)) countB++;
  }
  return countA === countB;
}

export function findScrollableParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    const overflow = style.overflow + style.overflowY;
    if (/(auto|scroll)/.test(overflow)) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

export * from "./validation";
export * from "./resolvers";
export * from "./scoring";
