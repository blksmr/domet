import { describe, expect, it } from "vitest";
import type { CachedSectionPosition, SectionScore } from "../types";
import {
  buildViewportRect,
  calculateSectionScores,
  determineActiveSection,
} from "../utils";

function cached(id: string, baseTop: number, height: number): CachedSectionPosition {
  return { id, baseTop, height, width: 800, left: 10 };
}

function scored(
  id: string,
  top: number,
  height: number,
  score: number,
  inView: boolean,
): SectionScore {
  return {
    id,
    score,
    visibilityRatio: inView ? 1 : 0,
    inView,
    bounds: { top, bottom: top + height, height },
    progress: 0,
  };
}

const IDS = ["a", "b", "c"];
const VIEWPORT = 400;
const SCROLL_HEIGHT = 3000;

function active(
  scores: SectionScore[],
  current: string | null,
  scrollY: number,
  hysteresis = 150,
  scrollHeight = SCROLL_HEIGHT,
): string | null {
  return determineActiveSection(
    scores,
    IDS,
    current,
    hysteresis,
    scrollY,
    VIEWPORT,
    scrollHeight,
  );
}

describe("calculateSectionScores", () => {
  const cache = [cached("a", 0, 500), cached("b", 500, 500)];
  const ctx = {
    scrollY: 0,
    viewportHeight: 400,
    scrollHeight: 1000,
    effectiveOffset: 0,
    visibilityThreshold: 0.6,
  };

  it("computes visibility, bounds and progress per section", () => {
    const [a, b] = calculateSectionScores(cache, ctx);

    expect(a.id).toBe("a");
    expect(a.inView).toBe(true);
    expect(a.visibilityRatio).toBeCloseTo(0.8);
    expect(a.bounds).toEqual({ top: 0, bottom: 500, height: 500 });
    expect(a.progress).toBeCloseTo(400 / 900);

    expect(b.inView).toBe(false);
    expect(b.visibilityRatio).toBe(0);
    expect(b.progress).toBe(0);
    expect(b.score).toBe(0);
  });

  it("adds the visibility, trigger line and proximity scores", () => {
    const [a] = calculateSectionScores(cache, ctx);
    expect(a.score).toBeCloseTo(1000 + 0.8 * 500 + 300 + (1 - 250 / 400) * 500);
  });

  it("scores a partially visible section below the threshold by viewport share", () => {
    const [a, b] = calculateSectionScores(cache, { ...ctx, scrollY: 300 });
    expect(a.visibilityRatio).toBeCloseTo(0.4);
    expect(b.visibilityRatio).toBeCloseTo(0.4);
    expect(a.inView).toBe(true);
    expect(b.inView).toBe(true);
    expect(a.score).toBeLessThan(1000);
  });

  it("moves the trigger line toward the viewport bottom as progress grows", () => {
    const atEnd = calculateSectionScores(cache, { ...ctx, scrollY: 600 });
    expect(atEnd[1].score).toBeGreaterThan(atEnd[0].score);
  });

  it("returns an empty array without sections", () => {
    expect(calculateSectionScores([], ctx)).toEqual([]);
  });

  it("gives a zero-height section no visibility", () => {
    const [empty] = calculateSectionScores([cached("x", 100, 0)], ctx);
    expect(empty.visibilityRatio).toBe(0);
    expect(empty.progress).toBe(0);
  });
});

describe("determineActiveSection", () => {
  it("returns null without scores or ids", () => {
    expect(active([], "a", 0)).toBeNull();
    expect(
      determineActiveSection([scored("a", 0, 100, 1, true)], [], null, 150, 0, 400, 3000),
    ).toBeNull();
  });

  it("picks the highest scoring visible section", () => {
    const scores = [
      scored("a", 500, 300, 100, true),
      scored("b", 800, 300, 500, true),
      scored("c", 2000, 300, 0, false),
    ];
    expect(active(scores, null, 600)).toBe("b");
  });

  it("keeps the current section until a candidate beats it by the hysteresis margin", () => {
    const close = [scored("a", 500, 300, 400, true), scored("b", 800, 300, 500, true)];
    const clear = [scored("a", 500, 300, 400, true), scored("b", 800, 300, 600, true)];

    expect(active(close, "a", 600)).toBe("a");
    expect(active(clear, "a", 600)).toBe("b");
    expect(active(close, "a", 600, 0)).toBe("b");
  });

  it("leaves a current section that is no longer in view", () => {
    const scores = [scored("a", 0, 300, 0, false), scored("b", 800, 300, 10, true)];
    expect(active(scores, "a", 600)).toBe("b");
  });

  it("forces the first section at the top when the second is not visible", () => {
    const scores = [
      scored("a", 0, 100, 0, true),
      scored("b", 900, 300, 0, false),
      scored("c", 150, 200, 999, true),
    ];
    expect(active(scores, "c", 0)).toBe("a");
  });

  it("forces the last section at the bottom when the previous one is not visible", () => {
    const scores = [
      scored("a", 2650, 200, 999, true),
      scored("b", 0, 300, 0, false),
      scored("c", 2900, 100, 0, true),
    ];
    expect(active(scores, "a", SCROLL_HEIGHT - VIEWPORT)).toBe("c");
  });

  it("skips the edge rules when the page barely scrolls", () => {
    const scores = [scored("a", 0, 100, 0, true), scored("b", 100, 300, 999, true)];
    expect(active(scores, null, 0, 150, VIEWPORT + 5)).toBe("b");
  });

  it("keeps the closest section above when no section is visible", () => {
    const scores = [
      scored("a", 0, 300, 0, false),
      scored("b", 300, 300, 0, false),
      scored("c", 2500, 300, 0, false),
    ];
    expect(active(scores, "b", 1200)).toBe("b");
    expect(active(scores, "a", 1200)).toBe("b");
    expect(active(scores, null, 1200)).toBe("b");
  });

  it("uses positions, not array order, when no section is visible", () => {
    const scores = [
      scored("c", 2500, 300, 0, false),
      scored("b", 300, 300, 0, false),
      scored("a", 0, 300, 0, false),
    ];
    expect(active(scores, null, 1200)).toBe("b");
  });

  it("falls back to the closest section below when none is above", () => {
    const scores = [
      scored("a", 1200, 300, 0, false),
      scored("b", 900, 300, 0, false),
      scored("c", 2500, 300, 0, false),
    ];
    expect(active(scores, null, 200)).toBe("b");
  });
});

describe("buildViewportRect", () => {
  it("derives a viewport rect from the cached position", () => {
    const viewportRect = buildViewportRect(cached("a", 500, 300), 120);
    expect(viewportRect.top).toBe(380);
    expect(viewportRect.bottom).toBe(680);
    expect(viewportRect.left).toBe(10);
    expect(viewportRect.right).toBe(810);
    expect(viewportRect.toJSON()).toEqual({
      x: 10,
      y: 380,
      width: 800,
      height: 300,
      top: 380,
      bottom: 680,
      left: 10,
      right: 810,
    });
  });
});
