import { describe, test } from "vitest";

import type { CachedSectionPosition } from "../src/types";
import {
  buildSectionStates,
  haveSectionsChanged,
} from "../src/useDomet/store";
import {
  calculateSectionScores,
  determineActiveSection,
  type ScoringContext,
} from "../src/utils";

const SECTION_COUNT = 100;
const SECTION_HEIGHT = 800;
const VIEWPORT_HEIGHT = 800;
const EFFECTIVE_OFFSET = 100;
const VISIBILITY_THRESHOLD = 0.6;
const HYSTERESIS = 150;
const SCROLL_STEPS = 240;

const cache: CachedSectionPosition[] = Array.from(
  { length: SECTION_COUNT },
  (_, i) => ({
    id: `section-${i}`,
    baseTop: i * SECTION_HEIGHT,
    height: SECTION_HEIGHT,
    width: 1200,
    left: 0,
  }),
);

const sectionIds = cache.map((c) => c.id);
const scrollHeight = SECTION_COUNT * SECTION_HEIGHT;
const maxScroll = scrollHeight - VIEWPORT_HEIGHT;

const scrollPositions = Array.from({ length: SCROLL_STEPS }, (_, i) =>
  Math.round((i / (SCROLL_STEPS - 1)) * maxScroll),
);

let cursor = 0;
function nextScrollY(): number {
  const y = scrollPositions[cursor];
  cursor = (cursor + 1) % SCROLL_STEPS;
  return y;
}

function makeContext(scrollY: number): ScoringContext {
  return {
    scrollY,
    viewportHeight: VIEWPORT_HEIGHT,
    scrollHeight,
    effectiveOffset: EFFECTIVE_OFFSET,
    visibilityThreshold: VISIBILITY_THRESHOLD,
  };
}

let activeId: string | null = sectionIds[0];
let sections = {};

describe("hot path: 100 sections", () => {
  test("frame cost", { timeout: 30_000 }, async ({ bench }) => {
    await bench.compare(
      bench("full frame (scores + active)", () => {
        const ctx = makeContext(nextScrollY());
        const scores = calculateSectionScores(cache, ctx);
        activeId = determineActiveSection(
          scores,
          sectionIds,
          activeId,
          HYSTERESIS,
          ctx.scrollY,
          ctx.viewportHeight,
          ctx.scrollHeight,
        );
      }),
      bench("full frame + sections state (when sections is read)", () => {
        const ctx = makeContext(nextScrollY());
        const scores = calculateSectionScores(cache, ctx);
        activeId = determineActiveSection(
          scores,
          sectionIds,
          activeId,
          HYSTERESIS,
          ctx.scrollY,
          ctx.viewportHeight,
          ctx.scrollHeight,
        );
        const source = { scores, cache, scrollY: ctx.scrollY, activeId };
        if (haveSectionsChanged(sections, source)) {
          sections = buildSectionStates(source);
        }
      }),
      bench("stage A: calculateSectionScores (fused)", () => {
        calculateSectionScores(cache, makeContext(nextScrollY()));
      }),
      bench("stage B: + determineActiveSection", () => {
        const ctx = makeContext(nextScrollY());
        const scores = calculateSectionScores(cache, ctx);
        determineActiveSection(
          scores,
          sectionIds,
          activeId,
          HYSTERESIS,
          ctx.scrollY,
          ctx.viewportHeight,
          ctx.scrollHeight,
        );
      }),
      { time: 1000 },
    );
  });
});
