import type { ScrollState, SectionState } from "../types";

export const MAX_SCORE = 2300;

const MIN_SCROLL = 10;
const EDGE_TOLERANCE = 5;

export type ScoreParts = {
  id: string;
  inView: boolean;
  top: number;
  bottom: number;
  ratio: number;
  distance: number;
  visibility: number;
  trigger: number;
  proximity: number;
  total: number;
  score: number;
};

export type Reason =
  | "none"
  | "only"
  | "lead"
  | "hysteresis"
  | "top"
  | "bottom"
  | "out-of-view"
  | "held";

export type Explanation = {
  parts: ScoreParts[];
  reason: Reason;
  toBeat: number | null;
};

export const REASONS: Record<Reason, string> = {
  none: "",
  only: "only one in view",
  lead: "highest score",
  hysteresis: "kept by hysteresis",
  top: "scrolled to top",
  bottom: "scrolled to bottom",
  "out-of-view": "closest section",
  held: "scroll target",
};

type Input = {
  ids: string[];
  sections: Record<string, SectionState>;
  scroll: ScrollState;
  threshold: number;
  hysteresis: number;
  active: string | null;
};

export function scoreSections({
  ids,
  sections,
  scroll,
  threshold,
}: Pick<Input, "ids" | "sections" | "scroll" | "threshold">): ScoreParts[] {
  const viewportTop = scroll.y;
  const viewportBottom = scroll.y + scroll.viewportHeight;
  const triggerLine = scroll.y + scroll.triggerLine;

  return ids.flatMap((id) => {
    const bounds = sections[id]?.bounds;
    if (!bounds) return [];
    const { top, bottom, height } = bounds;
    const visible = Math.max(
      0,
      Math.min(bottom, viewportBottom) - Math.max(top, viewportTop),
    );
    const ratio = height > 0 ? visible / height : 0;
    const inView = bottom > viewportTop && top < viewportBottom;
    const visibilityScore =
      ratio >= threshold
        ? 1000 + ratio * 500
        : inView && scroll.viewportHeight > 0
          ? (visible / scroll.viewportHeight) * 800
          : 0;
    const trigger = inView && triggerLine >= top && triggerLine < bottom ? 300 : 0;
    const distance = Math.abs(top + height / 2 - triggerLine);
    const proximityScore = inView
      ? Math.max(0, 1 - distance / scroll.viewportHeight) * 500
      : 0;
    const visibility = Math.round(visibilityScore);
    const proximity = Math.round(proximityScore);

    return [
      {
        id,
        inView,
        top,
        bottom,
        ratio,
        distance,
        visibility,
        trigger,
        proximity,
        total: visibility + trigger + proximity,
        score: visibilityScore + trigger + proximityScore,
      },
    ];
  });
}

function pick(parts: ScoreParts[], input: Input): [string | null, Reason] {
  const { ids, scroll, hysteresis, active } = input;
  if (parts.length === 0) return [null, "none"];

  const find = (id: string | undefined) => parts.find((part) => part.id === id);
  const hasScroll = scroll.maxScroll > MIN_SCROLL;

  if (ids.length >= 2 && hasScroll) {
    const last = find(ids[ids.length - 1]);
    if (
      scroll.y >= scroll.maxScroll - EDGE_TOLERANCE &&
      last &&
      !find(ids[ids.length - 2])?.inView
    ) {
      return [last.id, "bottom"];
    }
    const first = find(ids[0]);
    if (scroll.y <= EDGE_TOLERANCE && first && !find(ids[1])?.inView) {
      return [first.id, "top"];
    }
  }

  const visible = parts.filter((part) => part.inView);
  if (visible.length === 0) {
    const above = parts
      .filter((part) => part.bottom <= scroll.y)
      .sort((a, b) => b.bottom - a.bottom)[0];
    const below = parts
      .filter((part) => part.bottom > scroll.y)
      .sort((a, b) => a.top - b.top)[0];
    return [(above ?? below).id, "out-of-view"];
  }

  const leader = visible.reduce((best, part) =>
    part.score > best.score ? part : best,
  );
  const current = find(active ?? undefined);
  if (!current?.inView || leader.id === current.id) {
    return [leader.id, visible.length === 1 ? "only" : "lead"];
  }
  return leader.score > current.score + hysteresis
    ? [leader.id, "lead"]
    : [current.id, "hysteresis"];
}

export function explain(input: Input): Explanation {
  const parts = scoreSections(input);
  const [expected, expectedReason] = pick(parts, input);
  const current = parts.find((part) => part.id === input.active) ?? null;
  const reason: Reason =
    input.active === null ? "none" : expected === input.active ? expectedReason : "held";

  return {
    parts,
    reason,
    toBeat:
      current?.inView && (reason === "lead" || reason === "hysteresis")
        ? current.total + input.hysteresis
        : null,
  };
}
