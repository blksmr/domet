import { useCallback, useEffect, useMemo, useRef } from "react";

import type {
  DometOptions,
  LinkProps,
  Offset,
  ScrollBehavior,
  ScrollToOptions,
  UseDometReturn,
} from "../types";

import {
  sanitizeOffset,
  sanitizeThreshold,
  sanitizeHysteresis,
  sanitizeThrottle,
  sanitizeIds,
  sanitizeSelector,
  useIsomorphicLayoutEffect,
  areIdInputsEqual,
} from "../utils";

import { useSectionResolver } from "./hooks/useSectionResolver";
import { useScrollDetection } from "./hooks/useScrollDetection";
import { useNavAutoScroll } from "./hooks/useNavAutoScroll";
import { useProgrammaticScroll } from "./hooks/useProgrammaticScroll";

export function useDomet(options: DometOptions): UseDometReturn {
  const {
    container: containerInput,
    tracking,
    scrolling,
    onActive,
    onEnter,
    onLeave,
    onScrollStart,
    onScrollEnd,
  } = options;

  const trackingOffset = sanitizeOffset(tracking?.offset);
  const throttle = sanitizeThrottle(tracking?.throttle);
  const threshold = sanitizeThreshold(tracking?.threshold);
  const hysteresis = sanitizeHysteresis(tracking?.hysteresis);
  const scrollingDefaults = useMemo(() => {
    if (!scrolling) {
      return {
        behavior: "auto" as ScrollBehavior,
        offset: undefined as Offset | undefined,
        position: undefined,
        lockActive: undefined,
      };
    }

    return {
      behavior: scrolling.behavior ?? ("auto" as ScrollBehavior),
      offset: scrolling.offset !== undefined
        ? sanitizeOffset(scrolling.offset)
        : undefined,
      position: scrolling.position,
      lockActive: scrolling.lockActive,
    };
  }, [scrolling]);

  const rawIds = "ids" in options ? options.ids : undefined;
  const rawSelector = "selector" in options ? options.selector : undefined;

  const idsCacheRef = useRef<{
    raw: unknown;
    sanitized: string[] | undefined;
  }>({ raw: undefined, sanitized: undefined });

  const idsArray = useMemo(() => {
    if (rawIds === undefined) {
      idsCacheRef.current = { raw: undefined, sanitized: undefined };
      return undefined;
    }

    if (areIdInputsEqual(rawIds, idsCacheRef.current.raw)) {
      idsCacheRef.current.raw = rawIds;
      return idsCacheRef.current.sanitized;
    }

    const sanitized = sanitizeIds(rawIds);
    idsCacheRef.current = { raw: rawIds, sanitized };
    return sanitized;
  }, [rawIds]);

  const selectorString = useMemo(() => {
    if (rawSelector === undefined) return undefined;
    return sanitizeSelector(rawSelector);
  }, [rawSelector]);
  const useSelector = selectorString !== undefined && selectorString !== "";

  const initialActiveId = idsArray && idsArray.length > 0 ? idsArray[0] : null;

  // Shared refs
  const isProgrammaticScrolling = useRef<boolean>(false);
  const cacheValidRef = useRef<boolean>(false);
  const recalculateRef = useRef<() => void>(() => {});
  const rafId = useRef<number | null>(null);
  const scrollCleanupRef = useRef<(() => void) | null>(null);
  const optionsRef = useRef({ trackingOffset, scrolling: scrollingDefaults });
  const callbackRefs = useRef({
    onActive,
    onEnter,
    onLeave,
    onScrollStart,
    onScrollEnd,
  });

  const scheduleRecalculate = useCallback(() => {
    if (typeof window === "undefined") return;
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
    }
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      recalculateRef.current();
    });
  }, []);

  // Ref sync effects
  useIsomorphicLayoutEffect(() => {
    optionsRef.current = { trackingOffset, scrolling: scrollingDefaults };
  }, [trackingOffset, scrollingDefaults]);

  useEffect(() => {
    scheduleRecalculate();
  }, [trackingOffset, scheduleRecalculate]);

  useIsomorphicLayoutEffect(() => {
    callbackRefs.current = {
      onActive,
      onEnter,
      onLeave,
      onScrollStart,
      onScrollEnd,
    };
  }, [onActive, onEnter, onLeave, onScrollStart, onScrollEnd]);

  const getResolvedBehavior = useCallback(
    (behaviorOverride?: ScrollBehavior): ScrollBehavior => {
      const b = behaviorOverride ?? optionsRef.current.scrolling.behavior;
      if (b === "auto") {
        if (
          typeof window === "undefined" ||
          typeof window.matchMedia !== "function"
        ) {
          return "smooth";
        }
        const prefersReducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        return prefersReducedMotion ? "instant" : "smooth";
      }
      return b;
    },
    [],
  );

  // Hook A: Section resolution
  const {
    containerElement,
    sectionIds,
    sectionIndexMap,
    activeId,
    setActiveId,
    activeIdRef,
    getCurrentSections,
    updateSectionsFromSelector,
    register,
  } = useSectionResolver({
    containerInput,
    idsArray,
    selectorString,
    useSelector,
    initialActiveId,
    cacheValidRef,
    scheduleRecalculate,
  });

  // Hook B: Scroll detection
  const selectorParam = useMemo(
    () => ({
      useSelector,
      selectorString,
      updateSectionsFromSelector,
    }),
    [useSelector, selectorString, updateSectionsFromSelector],
  );

  const { scroll, sections } = useScrollDetection({
    containerElement,
    sectionIds,
    sectionIndexMap,
    tracking: {
      offset: trackingOffset,
      threshold,
      hysteresis,
      throttle,
    },
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
    selector: selectorParam,
  });

  // Hook C: Programmatic scrolling
  const { scrollTo } = useProgrammaticScroll({
    containerElement,
    sectionIndexMap,
    getCurrentSections,
    activeIdRef,
    setActiveId,
    isProgrammaticScrolling,
    scrollCleanupRef,
    optionsRef,
    getResolvedBehavior,
  });

  // Hook D: Nav auto-scroll
  const { navRef } = useNavAutoScroll({
    activeId,
    getResolvedBehavior,
  });

  // Link callback
  const link = useCallback(
    (id: string, linkOptions?: ScrollToOptions): LinkProps => ({
      onClick: () => scrollTo(id, linkOptions),
      "aria-current": activeId === id ? "page" : undefined,
      "data-active": activeId === id,
    }),
    [activeId, scrollTo],
  );

  const index = useMemo(() => {
    if (!activeId) return -1;
    return sectionIndexMap.get(activeId) ?? -1;
  }, [activeId, sectionIndexMap]);

  return {
    active: activeId,
    index,
    progress: scroll.progress,
    direction: scroll.direction,
    scroll,
    sections,
    ids: sectionIds,
    scrollTo,
    register,
    link,
    navRef,
  };
}

export default useDomet;
