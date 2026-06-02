import type {
  InternalSectionBounds,
  SectionScore,
  ResolvedSection,
  CachedSectionPosition,
} from "../types";
import { MIN_SCROLL_THRESHOLD, EDGE_TOLERANCE } from "../constants";

export type ScoringContext = {
  scrollY: number;
  viewportHeight: number;
  scrollHeight: number;
  effectiveOffset: number;
  visibilityThreshold: number;
  scrollDirection: "up" | "down" | null;
  sectionIndexMap: Map<string, number>;
};

export function getSectionBounds(
  sections: ResolvedSection[],
  container: HTMLElement | null,
): InternalSectionBounds[] {
  const scrollTop = container ? container.scrollTop : window.scrollY;
  const containerTop = container ? container.getBoundingClientRect().top : 0;

  return sections.map(({ id, element }) => {
    const rect = element.getBoundingClientRect();
    const relativeTop = container
      ? rect.top - containerTop + scrollTop
      : rect.top + window.scrollY;
    return {
      id,
      top: relativeTop,
      bottom: relativeTop + rect.height,
      height: rect.height,
      rect,
    };
  });
}

export function buildSectionCache(
  sections: ResolvedSection[],
  container: HTMLElement | null,
): CachedSectionPosition[] {
  const scrollTop = container ? container.scrollTop : window.scrollY;
  const containerTop = container ? container.getBoundingClientRect().top : 0;

  return sections.map(({ id, element }) => {
    const rect = element.getBoundingClientRect();
    const baseTop = container
      ? rect.top - containerTop + scrollTop
      : rect.top + scrollTop;
    return {
      id,
      baseTop,
      height: rect.height,
      width: rect.width,
      left: rect.left,
    };
  });
}

function rectToJSON(this: DOMRect) {
  return {
    x: this.x,
    y: this.y,
    width: this.width,
    height: this.height,
    top: this.top,
    bottom: this.bottom,
    left: this.left,
    right: this.right,
  };
}

export function buildViewportRect(
  cached: CachedSectionPosition,
  scrollY: number,
): DOMRect {
  const top = cached.baseTop - scrollY;
  return {
    x: cached.left,
    y: top,
    width: cached.width,
    height: cached.height,
    top,
    bottom: top + cached.height,
    left: cached.left,
    right: cached.left + cached.width,
    toJSON: rectToJSON,
  } as DOMRect;
}

export function calculateSectionScores(
  cache: CachedSectionPosition[],
  ctx: ScoringContext,
): SectionScore[] {
  const { scrollY, viewportHeight, effectiveOffset, visibilityThreshold } = ctx;

  const viewportTop = scrollY;
  const viewportBottom = scrollY + viewportHeight;

  const maxScroll = Math.max(1, ctx.scrollHeight - viewportHeight);
  const scrollProgress = Math.min(1, Math.max(0, scrollY / maxScroll));
  const dynamicOffset =
    effectiveOffset + scrollProgress * (viewportHeight - effectiveOffset);
  const triggerLine = scrollY + dynamicOffset;

  const result: SectionScore[] = new Array(cache.length);

  for (let i = 0; i < cache.length; i++) {
    const cached = cache[i];
    const top = cached.baseTop;
    const height = cached.height;
    const bottom = top + height;

    const visibleTop = Math.max(top, viewportTop);
    const visibleBottom = Math.min(bottom, viewportBottom);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const visibilityRatio = height > 0 ? visibleHeight / height : 0;
    const visibleInViewportRatio =
      viewportHeight > 0 ? visibleHeight / viewportHeight : 0;
    const isInView = bottom > viewportTop && top < viewportBottom;

    let sectionProgress = 0;
    if (height > 0) {
      const totalTravel = viewportHeight + height;
      const traveled = viewportBottom - top;
      sectionProgress = Math.max(0, Math.min(1, traveled / totalTravel));
    }

    let score = 0;

    if (visibilityRatio >= visibilityThreshold) {
      score += 1000 + visibilityRatio * 500;
    } else if (isInView) {
      score += visibleInViewportRatio * 800;
    }

    if (isInView) {
      if (triggerLine >= top && triggerLine < bottom) {
        score += 300;
      }

      const sectionCenter = top + height / 2;
      const distanceFromTrigger = Math.abs(sectionCenter - triggerLine);
      const proximityScore =
        Math.max(0, 1 - distanceFromTrigger / viewportHeight) * 500;
      score += proximityScore;
    }

    result[i] = {
      id: cached.id,
      score,
      visibilityRatio,
      inView: isInView,
      bounds: { top, bottom, height },
      progress: sectionProgress,
    };
  }

  return result;
}

function findScoreById(
  scores: SectionScore[],
  id: string,
): SectionScore | undefined {
  for (let i = 0; i < scores.length; i++) {
    if (scores[i].id === id) return scores[i];
  }
  return undefined;
}

export function determineActiveSection(
  scores: SectionScore[],
  sectionIds: string[],
  currentActiveId: string | null,
  hysteresisMargin: number,
  scrollY: number,
  viewportHeight: number,
  scrollHeight: number,
): string | null {
  if (scores.length === 0 || sectionIds.length === 0) return null;

  const maxScroll = Math.max(0, scrollHeight - viewportHeight);
  const hasScroll = maxScroll > MIN_SCROLL_THRESHOLD;
  const isAtBottom = hasScroll && scrollY + viewportHeight >= scrollHeight - EDGE_TOLERANCE;
  const isAtTop = hasScroll && scrollY <= EDGE_TOLERANCE;

  if (isAtBottom && sectionIds.length >= 2) {
    const lastId = sectionIds[sectionIds.length - 1];
    const secondLastId = sectionIds[sectionIds.length - 2];
    const secondLastScore = findScoreById(scores, secondLastId);
    const secondLastNotVisible = !secondLastScore || !secondLastScore.inView;
    if (findScoreById(scores, lastId) && secondLastNotVisible) {
      return lastId;
    }
  }

  if (isAtTop && sectionIds.length >= 2) {
    const firstId = sectionIds[0];
    const secondId = sectionIds[1];
    const secondScore = findScoreById(scores, secondId);
    const secondNotVisible = !secondScore || !secondScore.inView;
    if (findScoreById(scores, firstId) && secondNotVisible) {
      return firstId;
    }
  }

  let bestCandidate: SectionScore | null = null;
  let hasVisibleCandidate = false;
  let currentScore: SectionScore | undefined;

  for (const s of scores) {
    if (currentActiveId !== null && s.id === currentActiveId) {
      currentScore = s;
    }

    const isVisible = s.inView;
    if (hasVisibleCandidate && !isVisible) continue;
    if (!hasVisibleCandidate && isVisible) {
      hasVisibleCandidate = true;
      bestCandidate = s;
      continue;
    }
    if (!bestCandidate || s.score > bestCandidate.score) {
      bestCandidate = s;
    }
  }

  if (!bestCandidate) return null;

  const shouldSwitch =
    !currentScore ||
    !currentScore.inView ||
    bestCandidate.score > currentScore.score + hysteresisMargin ||
    bestCandidate.id === currentActiveId;

  return shouldSwitch ? bestCandidate.id : currentActiveId;
}
