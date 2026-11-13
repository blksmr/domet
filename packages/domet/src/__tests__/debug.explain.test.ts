import { describe, expect, it } from "vitest";
import type { CachedSectionPosition, ScrollState } from "../types";
import { MAX_SCORE, explain, scoreSections } from "../debug/explain";
import { buildSectionStates } from "../useDomet/store";
import { calculateSectionScores, determineActiveSection } from "../utils/scoring";

type Layout = Array<[id: string, top: number, height: number]>;

const VIEWPORT = 600;
const THRESHOLD = 0.6;
const HYSTERESIS = 150;

function frame(
  layout: Layout,
  scrollHeight: number,
  scrollY: number,
  offset = 0,
  hysteresis = HYSTERESIS,
) {
  const cache: CachedSectionPosition[] = layout.map(([id, baseTop, height]) => ({
    id,
    baseTop,
    height,
    width: 800,
    left: 0,
  }));
  const ids = layout.map(([id]) => id);
  const maxScroll = Math.max(1, scrollHeight - VIEWPORT);
  const progress = Math.min(1, Math.max(0, scrollY / maxScroll));
  const core = calculateSectionScores(cache, {
    scrollY,
    viewportHeight: VIEWPORT,
    scrollHeight,
    effectiveOffset: offset,
    visibilityThreshold: THRESHOLD,
  });
  const scroll: ScrollState = {
    y: scrollY,
    progress,
    direction: null,
    velocity: 0,
    scrolling: false,
    maxScroll,
    viewportHeight: VIEWPORT,
    trackingOffset: offset,
    triggerLine: Math.round(offset + progress * (VIEWPORT - offset)),
  };
  const pickCore = (current: string | null) =>
    determineActiveSection(core, ids, current, hysteresis, scrollY, VIEWPORT, scrollHeight);
  const explainFor = (active: string | null) =>
    explain({
      ids,
      sections: buildSectionStates({ scores: core, cache, scrollY, activeId: active }),
      scroll,
      threshold: THRESHOLD,
      hysteresis,
      active,
    });

  return { cache, ids, core, scroll, pickCore, explainFor };
}

const STACKED: Layout = [
  ["a", 0, 800],
  ["b", 800, 800],
  ["c", 1600, 800],
];
const SPACED: Layout = [
  ["a", 200, 300],
  ["b", 500, 300],
  ["c", 2600, 300],
];
const TALL_VIEWPORT: Layout = [
  ["a", 0, 700],
  ["b", 700, 600],
  ["c", 1300, 1700],
];

describe("score breakdown", () => {
  it("adds up to the scores the hook computes", () => {
    for (const [layout, scrollHeight] of [
      [STACKED, 2400],
      [SPACED, 4000],
    ] as Array<[Layout, number]>) {
      for (let y = 0; y <= scrollHeight - VIEWPORT; y += 37) {
        const { core, ids, scroll, cache } = frame(layout, scrollHeight, y, 48);
        const parts = scoreSections({
          ids,
          sections: buildSectionStates({ scores: core, cache, scrollY: y, activeId: null }),
          scroll,
          threshold: THRESHOLD,
        });

        expect(parts.map((part) => part.id)).toEqual(ids);
        parts.forEach((part, i) => {
          expect(part.inView).toBe(core[i].inView);
          expect(Math.abs(part.score - core[i].score)).toBeLessThan(3);
          expect(part.total).toBe(part.visibility + part.trigger + part.proximity);
          expect(Math.abs(part.total - part.score)).toBeLessThanOrEqual(1);
          expect(part.total).toBeLessThanOrEqual(MAX_SCORE);
        });
      }
    }
  });

  it("agrees with the hook on which section is active", () => {
    for (const [layout, scrollHeight] of [
      [STACKED, 2400],
      [SPACED, 4000],
    ] as Array<[Layout, number]>) {
      let current: string | null = layout[0][0];
      for (let y = 0; y <= scrollHeight - VIEWPORT; y += 23) {
        const { pickCore, explainFor } = frame(layout, scrollHeight, y);
        current = pickCore(current);
        expect(explainFor(current).reason).not.toBe("held");
      }
    }
  });
});

describe("explanation", () => {
  it("names the lead when the active section wins on score", () => {
    const { explainFor } = frame(TALL_VIEWPORT, 3000, 460);
    const explanation = explainFor("b");

    expect(explanation.reason).toBe("lead");
    const a = explanation.parts[0];
    const b = explanation.parts[1];
    expect(a.trigger).toBe(300);
    expect(b.trigger).toBe(0);
    expect(b.visibility).toBeGreaterThan(a.visibility + 300);
    expect(b.total).toBeGreaterThan(a.total + HYSTERESIS);
    expect(explanation.toBeat).toBe(b.total + HYSTERESIS);
  });

  it("reports when hysteresis keeps the current section", () => {
    const held = Array.from({ length: 1800 }, (_, y) =>
      frame(STACKED, 2400, y, 0, 700),
    ).find(
      ({ core, pickCore }) => core[1].score > core[0].score && pickCore("a") === "a",
    );
    if (!held) throw new Error("No frame where hysteresis holds the first section.");
    const { core, explainFor } = held;

    const explanation = explainFor("a");
    expect(explanation.reason).toBe("hysteresis");
    expect(explanation.parts[1].total).toBeGreaterThan(explanation.parts[0].total);
    expect(Math.abs((explanation.toBeat ?? 0) - (core[0].score + 700))).toBeLessThan(3);
  });

  it("explains the edge rules and the out-of-view fallback", () => {
    expect(frame(STACKED, 2400, 0).explainFor("a").reason).toBe("top");
    expect(frame(STACKED, 2400, 1800).explainFor("c").reason).toBe("bottom");
    expect(frame(SPACED, 4000, 1500).explainFor("b").reason).toBe("out-of-view");
    expect(frame([["a", 0, 2000]], 2000, 300).explainFor("a").reason).toBe("only");
    expect(frame(STACKED, 2400, 500).explainFor(null).reason).toBe("none");
  });

  it("recognises a target held after a programmatic scroll", () => {
    const explanation = frame(STACKED, 2400, 900).explainFor("a");

    expect(explanation.reason).toBe("held");
    expect(explanation.toBeat).toBeNull();
  });
});
