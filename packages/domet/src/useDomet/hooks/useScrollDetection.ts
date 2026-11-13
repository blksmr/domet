import { useCallback, useEffect, useRef } from "react";

import type {
  CachedSectionPosition,
  DometCallbacks,
  Offset,
  ResolvedSection,
  ScrollState,
  SectionState,
} from "../../types";
import { DEFAULT_OFFSET, SCROLL_IDLE_MS } from "../../constants";
import {
  buildSectionCache,
  calculateSectionScores,
  determineActiveSection,
  resolveOffset,
} from "../../utils";
import {
  buildSectionStates,
  haveSectionsChanged,
  type DometStore,
  type SectionsSource,
  type TrackedKey,
} from "../store";

type UseScrollDetectionParams = {
  store: DometStore;
  trackedKeys: Set<TrackedKey>;
  sectionsSourceRef: React.MutableRefObject<SectionsSource | null>;
  containerElement: HTMLElement | null;
  sectionIds: string[];
  tracking: {
    offset: Offset;
    threshold: number;
    hysteresis: number;
  };
  isProgrammaticScrolling: React.MutableRefObject<boolean>;
  heldScrollPosition: React.MutableRefObject<number | null>;
  activeIdRef: React.MutableRefObject<string | null>;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  getCurrentSections: () => ResolvedSection[];
  callbackRefs: React.MutableRefObject<DometCallbacks>;
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

export function useScrollDetection({
  store,
  trackedKeys,
  sectionsSourceRef,
  containerElement,
  sectionIds,
  tracking,
  isProgrammaticScrolling,
  heldScrollPosition,
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
}: UseScrollDetectionParams): void {
  const { offset: trackingOffset, threshold, hysteresis } = tracking;

  const lastScrollY = useRef<number>(0);
  const lastScrollTime = useRef<number>(0);
  const isScrollingRef = useRef<boolean>(false);
  const scrollIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const prevSectionsInViewport = useRef<Set<string>>(new Set());
  const currentSectionsInViewport = useRef<Set<string>>(new Set());
  const sectionCacheRef = useRef<CachedSectionPosition[]>([]);
  const cachedScrollHeightRef = useRef<number>(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const observedElementsRef = useRef<Set<HTMLElement>>(new Set());

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

    if (
      !cacheValidRef.current ||
      sectionCacheRef.current.length !== currentSections.length ||
      cachedScrollHeightRef.current !== scrollHeight
    ) {
      sectionCacheRef.current = buildSectionCache(currentSections, container);
      cachedScrollHeightRef.current = scrollHeight;
      cacheValidRef.current = true;
      const resizeObserver = resizeObserverRef.current;
      if (resizeObserver) {
        const elements = new Set(currentSections.map((s) => s.element));
        if (container) elements.add(container);
        for (const element of observedElementsRef.current) {
          if (!elements.has(element)) resizeObserver.unobserve(element);
        }
        for (const element of elements) {
          if (!observedElementsRef.current.has(element)) {
            resizeObserver.observe(element);
          }
        }
        observedElementsRef.current = elements;
      }
    }

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
    });

    const isProgrammatic = isProgrammaticScrolling.current;

    const heldAt = heldScrollPosition.current;
    const isHeld = heldAt !== null && Math.abs(scrollY - heldAt) < 1;
    if (heldAt !== null && !isHeld) {
      heldScrollPosition.current = null;
    }

    const newActiveId =
      isProgrammatic || isHeld || scores.length === 0
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

    if (!isProgrammatic && scores.length > 0) {
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
    const roundedMaxScroll = Math.round(maxScroll);
    const roundedViewportHeight = Math.round(viewportHeight);
    const roundedTrackingOffset = Math.round(effectiveOffset);
    const currentScrolling = isScrollingRef.current;
    const direction = currentScrolling ? scrollDirection : null;
    const roundedVelocity = currentScrolling ? Math.round(velocity) : 0;

    const prev = store.getState().scroll;
    const scrollChanged =
      prev.y !== roundedY ||
      prev.progress !== clampedProgress ||
      prev.direction !== direction ||
      prev.velocity !== roundedVelocity ||
      prev.scrolling !== currentScrolling ||
      prev.maxScroll !== roundedMaxScroll ||
      prev.viewportHeight !== roundedViewportHeight ||
      prev.trackingOffset !== roundedTrackingOffset ||
      prev.triggerLine !== triggerLine;

    let nextScroll: ScrollState | undefined;
    if (scrollChanged) {
      nextScroll = {
        y: roundedY,
        progress: clampedProgress,
        direction,
        velocity: roundedVelocity,
        scrolling: currentScrolling,
        maxScroll: roundedMaxScroll,
        viewportHeight: roundedViewportHeight,
        trackingOffset: roundedTrackingOffset,
        triggerLine,
      };
    }

    const source: SectionsSource = {
      scores,
      cache: sectionCacheRef.current,
      scrollY,
      activeId: newActiveId,
    };
    let nextSections: Record<string, SectionState> | undefined;
    if (trackedKeys.has("sections")) {
      const prevSections = store.getState().sections;
      if (haveSectionsChanged(prevSections, source)) {
        nextSections = buildSectionStates(source);
      }
      source.built = nextSections ?? prevSections;
    }
    sectionsSourceRef.current = source;

    if (nextScroll || nextSections) {
      store.setState({
        ...(nextScroll && { scroll: nextScroll }),
        ...(nextSections && { sections: nextSections }),
      });
    }
  }, [
    store,
    trackedKeys,
    sectionsSourceRef,
    sectionIds,
    trackingOffset,
    threshold,
    hysteresis,
    containerElement,
    getCurrentSections,
    activeIdRef,
    setActiveId,
    isProgrammaticScrolling,
    heldScrollPosition,
    callbackRefs,
    cacheValidRef,
  ]);

  recalculateRef.current = calculateActiveSection;

  useEffect(() => {
    const container = containerElement;
    const scrollTarget = container || window;
    const scrollEndTarget = container || document;
    const supportsScrollEnd = "onscrollend" in scrollEndTarget;

    const handleScrollEnd = (): void => {
      if (!isScrollingRef.current) return;
      isScrollingRef.current = false;
      store.setState({
        scroll: {
          ...store.getState().scroll,
          scrolling: false,
          direction: null,
          velocity: 0,
        },
      });
      callbackRefs.current.onScrollEnd?.();
    };

    const handleScroll = (): void => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;
        store.setState({
          scroll: { ...store.getState().scroll, scrolling: true },
        });
        callbackRefs.current.onScrollStart?.();
      }

      if (!supportsScrollEnd) {
        if (scrollIdleTimeoutRef.current) {
          clearTimeout(scrollIdleTimeoutRef.current);
        }
        scrollIdleTimeoutRef.current = setTimeout(
          handleScrollEnd,
          SCROLL_IDLE_MS,
        );
      }

      scheduleRecalculate();
    };

    const handleResize = (): void => {
      cacheValidRef.current = false;
      if (selector.useSelector && selector.selectorString) {
        selector.updateSectionsFromSelector(selector.selectorString);
      }
      scheduleRecalculate();
    };

    const handleLayoutChange = (): void => {
      cacheValidRef.current = false;
      scheduleRecalculate();
    };

    cacheValidRef.current = false;
    resizeObserverRef.current =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(handleLayoutChange);

    const deferredRecalcId = setTimeout(() => {
      scheduleRecalculate();
    }, 0);

    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    if (supportsScrollEnd) {
      scrollEndTarget.addEventListener("scrollend", handleScrollEnd, { passive: true });
    }
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      clearTimeout(deferredRecalcId);
      scrollTarget.removeEventListener("scroll", handleScroll);
      scrollEndTarget.removeEventListener("scrollend", handleScrollEnd);
      window.removeEventListener("resize", handleResize);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      observedElementsRef.current = new Set();
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      if (scrollIdleTimeoutRef.current) {
        clearTimeout(scrollIdleTimeoutRef.current);
        scrollIdleTimeoutRef.current = null;
      }
      scrollCleanupRef.current?.(); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: need latest cleanup callback
      isProgrammaticScrolling.current = false;
      isScrollingRef.current = false;
    };
  }, [
    store,
    containerElement,
    selector,
    scheduleRecalculate,
    rafId,
    callbackRefs,
    cacheValidRef,
    scrollCleanupRef,
    isProgrammaticScrolling,
  ]);

}
