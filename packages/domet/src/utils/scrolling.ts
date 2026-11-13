import type { ScrollBehavior, ScrollToPosition } from "../types";

export function resolveScrollBehavior(
  behavior: ScrollBehavior = "auto",
): Exclude<ScrollBehavior, "auto"> {
  if (behavior !== "auto") return behavior;
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return "smooth";
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "instant"
    : "smooth";
}

export function resolveScrollBlock(
  position: ScrollToPosition = "center",
): ScrollLogicalPosition {
  if (position === "top") return "start";
  if (position === "bottom") return "end";
  return "center";
}
