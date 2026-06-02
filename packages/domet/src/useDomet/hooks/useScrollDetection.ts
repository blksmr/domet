import { startTransition, useCallback, useEffect, useRef, useState } from "react";

import type {
  CachedSectionPosition,
  Offset,
  ResolvedSection,
  ScrollState,
  SectionState,
} from "../../types";
import { DEFAULT_OFFSET, SCROLL_IDLE_MS } from "../../constants";
import {
  buildSectionCache,
  buildViewportRect,
  calculateSectionScores,
  determineActiveSection,
  resolveOffset,
} from "../../utils";

type CallbackRefs = {
  onActive?: (id: string | null, prevId: string | null) => void;
  onEnter?: (id: string) => void;
  onLeave?: (id: string) => void;
  onScrollStart?: () => void;
  onScrollEnd?: () => void;
};

type UseScrollDetectionParams = {
  containerElement: HTMLElement | null;
  sectionIds: string[];
  sectionIndexMap: Map<string, number>;
  tracking: {
    offset: Offset;
    threshold: number;
    hysteresis: number;
    throttle: number;
  };
  isProgrammaticScrolling: React.MutableRefObject<boolean>;
  activeIdRef: React.MutableRefObject<string | null>;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  getCurrentSections: () => ResolvedSection[];
  callbackRefs: React.MutableRefObject<CallbackRefs>;
  cacheValidRef: React.MutableRefObject<boolean>;
  recalculateRef: React.MutableRefObject<() => void>;
  scrollCleanupRef: React.MutableRefObject<(() => void) | null>;
  rafId: React.MutableRefObject<number | null>;
  scheduleRecalculate: () => void;
  selector: {
    useSelector: boolean;
    selectorString?: string;
    updateSectionsFromSelector: (s: string) => void;
  };
};

type UseScrollDetectionReturn = {
  scroll: ScrollState;
  sections: Record<string, SectionState>;
};

export function useScrollDetection({
  containerElement,
  sectionIds,
  sectionIndexMap,
  tracking,
  isProgrammaticScrolling,
  activeIdRef,
  setActiveId,
  getCurrentSections,
  callbackRefs,
  cacheValidRef,
  recalculateRef,
  scrollCleanupRef,
  rafId,
  scheduleRecalculate,
  selector,
}: UseScrollDetectionParams): UseScrollDetectionReturn {
  const { offset: trackingOffset, threshold, hysteresis, throttle } = tracking;

  const [scroll, setScroll] = useState<ScrollState>({
    y: 0,
    progress: 0,
    direction: null,
    velocity: 0,
    scrolling: false,
    maxScroll: 0,
    viewportHeight: 0,
    trackingOffset: 0,
    triggerLine: 0,
  });
  const [sections, setSections] = useState<Record<string, SectionState>>({});

  const lastScrollY = useRef<number>(0);
  const lastScrollTime = useRef<number>(Date.now());
  const isThrottled = useRef<boolean>(false);
  const throttleTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPendingScroll = useRef<boolean>(false);
  const isScrollingRef = useRef<boolean>(false);
  const scrollIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const prevSectionsInViewport = useRef<Set<string>>(new Set());
  const currentSectionsInViewport = useRef<Set<string>>(new Set());
  const prevScrollStateRef = useRef<ScrollState | null>(null);
  const prevSectionsStateRef = useRef<Record<string, SectionState> | null>(
    null,
  );
  const sectionCacheRef = useRef<CachedSectionPosition[]>([]);

  const calculateActiveSection = useCallback(() => {
    const container = containerElement;
    const currentActiveId = activeIdRef.current;
    const now = Date.now();
    const scrollY = container ? container.scrollTop : window.scrollY;
    const viewportHeight = container
      ? container.clientHeight
      : window.innerHeight;
    const scrollHeight = container
      ? container.scrollHeight
      : document.documentElement.scrollHeight;
    const maxScroll = Math.max(1, scrollHeight - viewportHeight);
    const scrollProgress = Math.min(1, Math.max(0, scrollY / maxScroll));
    const scrollDirection: "up" | "down" | null =
      scrollY === lastScrollY.current
        ? null
        : scrollY > lastScrollY.current
          ? "down"
          : "up";
    const deltaTime = now - lastScrollTime.current;
    const deltaY = scrollY - lastScrollY.current;
    const velocity = deltaTime > 0 ? Math.abs(deltaY) / deltaTime : 0;

    lastScrollY.current = scrollY;
    lastScrollTime.current = now;

    const currentSections = getCurrentSections();
    if (currentSections.length === 0) return;

    if (
      !cacheValidRef.current ||
      sectionCacheRef.current.length !== currentSections.length
    ) {
      sectionCacheRef.current = buildSectionCache(currentSections, container);
      cacheValidRef.current = true;
    }

    if (sectionCacheRef.current.length === 0) return;

    const effectiveOffset = resolveOffset(
      trackingOffset,
      viewportHeight,
      DEFAULT_OFFSET,
    );

    const scores = calculateSectionScores(sectionCacheRef.current, {
      scrollY,
      viewportHeight,
      scrollHeight,
      effectiveOffset,
      visibilityThreshold: threshold,
      scrollDirection,
      sectionIndexMap,
    });

    const isProgrammatic = isProgrammaticScrolling.current;

    const newActiveId = isProgrammatic
      ? currentActiveId
      : determineActiveSection(
          scores,
          sectionIds,
          currentActiveId,
          hysteresis,
          scrollY,
          viewportHeight,
          scrollHeight,
        );

    if (!isProgrammatic && newActiveId !== currentActiveId) {
      activeIdRef.current = newActiveId;
      setActiveId(newActiveId);
      callbackRefs.current.onActive?.(newActiveId, currentActiveId);
    }

    if (!isProgrammatic) {
      const currentInViewport = currentSectionsInViewport.current;
      currentInViewport.clear();
      for (const s of scores) {
        if (s.inView) currentInViewport.add(s.id);
      }
      const prevInViewport = prevSectionsInViewport.current;

      for (const id of currentInViewport) {
        if (!prevInViewport.has(id)) {
          callbackRefs.current.onEnter?.(id);
        }
      }
      for (const id of prevInViewport) {
        if (!currentInViewport.has(id)) {
          callbackRefs.current.onLeave?.(id);
        }
      }
      const temp = prevSectionsInViewport.current;
      prevSectionsInViewport.current = currentSectionsInViewport.current;
      currentSectionsInViewport.current = temp;
    }

    const triggerLine = Math.round(
      effectiveOffset + scrollProgress * (viewportHeight - effectiveOffset),
    );

    const roundedY = Math.round(scrollY);
    const clampedProgress = Math.max(0, Math.min(1, scrollProgress));
    const roundedVelocity = Math.round(velocity);
    const roundedMaxScroll = Math.round(maxScroll);
    const roundedViewportHeight = Math.round(viewportHeight);
    const roundedTrackingOffset = Math.round(effectiveOffset);
    const currentScrolling = isScrollingRef.current;

    const prev = prevScrollStateRef.current;
    const scrollChanged =
      !prev ||
      prev.y !== roundedY ||
      prev.progress !== clampedProgress ||
      prev.direction !== scrollDirection ||
      prev.velocity !== roundedVelocity ||
      prev.scrolling !== currentScrolling ||
      prev.maxScroll !== roundedMaxScroll ||
      prev.viewportHeight !== roundedViewportHeight ||
      prev.trackingOffset !== roundedTrackingOffset ||
      prev.triggerLine !== triggerLine;

    if (scrollChanged) {
      const newScrollState: ScrollState = {
        y: roundedY,
        progress: clampedProgress,
        direction: scrollDirection,
        velocity: roundedVelocity,
        scrolling: currentScrolling,
        maxScroll: roundedMaxScroll,
        viewportHeight: roundedViewportHeight,
        trackingOffset: roundedTrackingOffset,
        triggerLine,
      };
      prevScrollStateRef.current = newScrollState;
      startTransition(() => {
        setScroll(newScrollState);
      });
    }

    const prevSections = prevSectionsStateRef.current;
    let sectionsChanged = !prevSections;

    if (!sectionsChanged && prevSections) {
      let countPrev = 0;
      for (const key in prevSections) {
        if (Object.prototype.hasOwnProperty.call(prevSections, key))
          countPrev++;
      }
      if (countPrev !== scores.length) {
        sectionsChanged = true;
      } else {
        for (const s of scores) {
          const ps = prevSections[s.id];
          if (!ps) {
            sectionsChanged = true;
            break;
          }
          const roundedVisibility =
            Math.round(s.visibilityRatio * 100) / 100;
          const roundedProgress = Math.round(s.progress * 100) / 100;
          const isActive =
            s.id === (isProgrammatic ? currentActiveId : newActiveId);
          const roundedTop = Math.round(s.bounds.top);
          const roundedBottom = Math.round(s.bounds.bottom);
          const roundedHeight = Math.round(s.bounds.height);
          if (
            ps.visibility !== roundedVisibility ||
            ps.progress !== roundedProgress ||
            ps.inView !== s.inView ||
            ps.active !== isActive ||
            ps.bounds.top !== roundedTop ||
            ps.bounds.bottom !== roundedBottom ||
            ps.bounds.height !== roundedHeight
          ) {
            sectionsChanged = true;
            break;
          }
        }
      }
    }

    if (sectionsChanged) {
      const newSections: Record<string, SectionState> = {};
      const cache = sectionCacheRef.current;
      for (let i = 0; i < scores.length; i++) {
        const s = scores[i];
        newSections[s.id] = {
          bounds: {
            top: Math.round(s.bounds.top),
            bottom: Math.round(s.bounds.bottom),
            height: Math.round(s.bounds.height),
          },
          visibility: Math.round(s.visibilityRatio * 100) / 100,
          progress: Math.round(s.progress * 100) / 100,
          inView: s.inView,
          active:
            s.id === (isProgrammatic ? currentActiveId : newActiveId),
          rect: buildViewportRect(cache[i], scrollY),
        };
      }
      prevSectionsStateRef.current = newSections;
      startTransition(() => {
        setSections(newSections);
      });
    }
  }, [
    sectionIds,
    sectionIndexMap,
    trackingOffset,
    threshold,
    hysteresis,
    containerElement,
    getCurrentSections,
    activeIdRef,
    setActiveId,
    isProgrammaticScrolling,
    callbackRefs,
    cacheValidRef,
  ]);

  recalculateRef.current = calculateActiveSection;

  useEffect(() => {
    const container = containerElement;
    const scrollTarget = container || window;

    const handleScrollEnd = (): void => {
      isScrollingRef.current = false;
      setScroll((prev) => ({ ...prev, scrolling: false, direction: null }));
      callbackRefs.current.onScrollEnd?.();
    };

    const handleScroll = (): void => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;
        setScroll((prev) => ({ ...prev, scrolling: true }));
        callbackRefs.current.onScrollStart?.();
      }

      if (scrollIdleTimeoutRef.current) {
        clearTimeout(scrollIdleTimeoutRef.current);
      }
      scrollIdleTimeoutRef.current = setTimeout(
        handleScrollEnd,
        SCROLL_IDLE_MS,
      );

      if (isThrottled.current) {
        hasPendingScroll.current = true;
        return;
      }

      isThrottled.current = true;
      hasPendingScroll.current = false;

      if (throttleTimeoutId.current) {
        clearTimeout(throttleTimeoutId.current);
      }

      scheduleRecalculate();

      throttleTimeoutId.current = setTimeout(() => {
        isThrottled.current = false;
        throttleTimeoutId.current = null;

        if (hasPendingScroll.current) {
          hasPendingScroll.current = false;
          handleScroll();
        }
      }, throttle);
    };

    const handleResize = (): void => {
      cacheValidRef.current = false;
      if (selector.useSelector && selector.selectorString) {
        selector.updateSectionsFromSelector(selector.selectorString);
      }
      scheduleRecalculate();
    };

    const deferredRecalcId = setTimeout(() => {
      scheduleRecalculate();
    }, 0);

    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      clearTimeout(deferredRecalcId);
      scrollTarget.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      if (throttleTimeoutId.current) {
        clearTimeout(throttleTimeoutId.current);
        throttleTimeoutId.current = null;
      }
      if (scrollIdleTimeoutRef.current) {
        clearTimeout(scrollIdleTimeoutRef.current);
        scrollIdleTimeoutRef.current = null;
      }
      scrollCleanupRef.current?.(); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: need latest cleanup callback
      isThrottled.current = false;
      hasPendingScroll.current = false;
      isProgrammaticScrolling.current = false;
      isScrollingRef.current = false;
    };
  }, [
    throttle,
    containerElement,
    selector,
    scheduleRecalculate,
    rafId,
    callbackRefs,
    cacheValidRef,
    scrollCleanupRef,
    isProgrammaticScrolling,
  ]);

  return { scroll, sections };
}
