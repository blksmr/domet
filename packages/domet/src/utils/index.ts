import {
  useEffect,
  useLayoutEffect,
} from "react";

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

export type ScrollableParent = {
  element: HTMLElement;
  x: boolean;
  y: boolean;
};

export function findScrollableParent(
  element: HTMLElement,
  boundary: HTMLElement | null = null,
): ScrollableParent | null {
  const { body, documentElement } = element.ownerDocument;
  let parent = element.parentElement;
  while (
    parent &&
    parent !== boundary &&
    parent !== body &&
    parent !== documentElement
  ) {
    const style = getComputedStyle(parent);
    const y =
      /(auto|scroll)/.test(style.overflowY || style.overflow) &&
      parent.scrollHeight > parent.clientHeight;
    const x =
      /(auto|scroll)/.test(style.overflowX || style.overflow) &&
      parent.scrollWidth > parent.clientWidth;
    if (x || y) {
      return { element: parent, x, y };
    }
    parent = parent.parentElement;
  }
  return null;
}

export * from "./validation";
export * from "./resolvers";
export * from "./scoring";
