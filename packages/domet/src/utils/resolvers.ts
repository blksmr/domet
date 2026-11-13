import type { ScrollContainer, ResolvedSection, Offset } from "../types";
import { PERCENT_REGEX } from "../constants";

export function resolveContainer(input: ScrollContainer | undefined): HTMLElement | null {
  if (typeof window === "undefined") return null;
  if (input === undefined) return null;
  return input.current;
}

export function resolveSectionsFromIds(
  ids: string[],
  refs: Record<string, HTMLElement | null>,
): ResolvedSection[] {
  return ids
    .map((id) => ({ id, element: refs[id] }))
    .filter((s): s is ResolvedSection => s.element != null);
}

export function resolveSectionsFromSelector(
  selector: string,
  root?: ParentNode,
): ResolvedSection[] {
  if (typeof window === "undefined") return [];

  try {
    const elements = (root ?? document).querySelectorAll<HTMLElement>(selector);
    const result: ResolvedSection[] = [];
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      result.push({
        id: el.id || el.dataset.domet || `section-${i}`,
        element: el,
      });
    }
    return result;
  } catch {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[domet] Invalid CSS selector: "${selector}"`);
    }
    return [];
  }
}

export function resolveOffset(
  offset: Offset | undefined,
  viewportHeight: number,
  defaultOffset: Offset,
): number {
  const value = offset ?? defaultOffset;
  const safeViewportHeight = Number.isFinite(viewportHeight) ? viewportHeight : 0;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const match = PERCENT_REGEX.exec(value);
  if (match) {
    const percent = parseFloat(match[1]);
    if (!Number.isFinite(percent)) return 0;
    return (percent / 100) * safeViewportHeight;
  }

  return 0;
}
