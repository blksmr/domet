import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  CachedSectionPosition,
  DometOptions,
  LinkProps,
  NavRefOptions,
  RegisterProps,
  ResolvedSection,
  ScrollBehavior,
  ScrollState,
  ScrollTarget,
  ScrollToOptions,
  ScrollToPosition,
  SectionState,
  UseDometReturn,
} from "../types";

import {
  DEFAULT_OFFSET,
  SCROLL_IDLE_MS,
} from "../constants";

import {
  resolveContainer,
  resolveSectionsFromIds,
  resolveSectionsFromSelector,
  resolveOffset,
  buildSectionCache,
  getSectionBoundsFromCache,
  calculateSectionScores,
  determineActiveSection,
  sanitizeOffset,
  sanitizeThreshold,
  sanitizeHysteresis,
  sanitizeThrottle,
  sanitizeIds,
  sanitizeSelector,
  useIsomorphicLayoutEffect,
  areIdInputsEqual,
  findScrollableParent,
} from "../utils";


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
        offset: undefined,
        position: undefined,
        lockActive: undefined,
      };
    }

    return {
      behavior: scrolling.behavior ?? "auto",
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

  const [containerElement, setContainerElement] = useState<HTMLElement | null>(null);
  const [resolvedSections, setResolvedSections] = useState<ResolvedSection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialActiveId);
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

  const refs = useRef<Record<string, HTMLElement | null>>({});
  const refCallbacks = useRef<Record<string, (el: HTMLElement | null) => void>>({});
  const registerPropsCache = useRef<Record<string, RegisterProps>>({});
  const navRefs = useRef<Record<string, HTMLElement | null>>({});
  const navRefCallbacks = useRef<Record<string, (el: HTMLElement | null) => void>>({});
  const navRefOptions = useRef<Record<string, NavRefOptions | undefined>>({});
  const activeIdRef = useRef<string | null>(initialActiveId);
  const lastScrollY = useRef<number>(0);
  const lastScrollTime = useRef<number>(Date.now());
  const rafId = useRef<number | null>(null);
  const isThrottled = useRef<boolean>(false);
  const throttleTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPendingScroll = useRef<boolean>(false);
  const isProgrammaticScrolling = useRef<boolean>(false);
  const isScrollingRef = useRef<boolean>(false);
  const scrollIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSectionsInViewport = useRef<Set<string>>(new Set());
  const currentSectionsInViewport = useRef<Set<string>>(new Set());
  const prevScrollStateRef = useRef<ScrollState | null>(null);
  const prevSectionsStateRef = useRef<Record<string, SectionState> | null>(null);
  const sectionCacheRef = useRef<CachedSectionPosition[]>([]);
  const cacheValidRef = useRef<boolean>(false);
  const recalculateRef = useRef<() => void>(() => {});
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
  const scrollCleanupRef = useRef<(() => void) | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const mutationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef({ trackingOffset, scrolling: scrollingDefaults });
  const callbackRefs = useRef({
    onActive,
    onEnter,
    onLeave,
    onScrollStart,
    onScrollEnd,
  });

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

  const sectionIds = useMemo(() => {
    if (!useSelector && idsArray) return idsArray;
    return resolvedSections.map((s) => s.id);
  }, [useSelector, idsArray, resolvedSections]);

  const sectionIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < sectionIds.length; i++) {
      map.set(sectionIds[i], i);
    }
    return map;
  }, [sectionIds]);

  const containerRefCurrent = containerInput?.current ?? null;

  useIsomorphicLayoutEffect(() => {
    const resolved = resolveContainer(containerInput);
    if (resolved !== containerElement) {
      setContainerElement(resolved);
    }
  }, [containerInput, containerRefCurrent]);

  const updateSectionsFromSelector = useCallback((selector: string) => {
    cacheValidRef.current = false;
    const resolved = resolveSectionsFromSelector(selector);
    setResolvedSections(resolved);
    if (resolved.length > 0) {
      const currentStillExists = resolved.some((s) => s.id === activeIdRef.current);
      if (!activeIdRef.current || !currentStillExists) {
        activeIdRef.current = resolved[0].id;
        setActiveId(resolved[0].id);
      }
    } else if (activeIdRef.current !== null) {
      activeIdRef.current = null;
      setActiveId(null);
    }
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (useSelector && selectorString) {
      updateSectionsFromSelector(selectorString);
    }
  }, [selectorString, useSelector, updateSectionsFromSelector]);

  useEffect(() => {
    if (
      !useSelector ||
      !selectorString ||
      typeof window === "undefined" ||
      typeof MutationObserver === "undefined"
    ) {
      return;
    }

    const handleMutation = () => {
      if (mutationDebounceRef.current) {
        clearTimeout(mutationDebounceRef.current);
      }
      mutationDebounceRef.current = setTimeout(() => {
        updateSectionsFromSelector(selectorString);
      }, 50);
    };

    const observeTarget = containerElement ?? document.body;

    mutationObserverRef.current = new MutationObserver(handleMutation);
    mutationObserverRef.current.observe(observeTarget, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["id", "data-domet"],
    });

    return () => {
      if (mutationDebounceRef.current) {
        clearTimeout(mutationDebounceRef.current);
        mutationDebounceRef.current = null;
      }
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
        mutationObserverRef.current = null;
      }
    };
  }, [useSelector, selectorString, updateSectionsFromSelector, containerElement]);

  useEffect(() => {
    if (!useSelector && idsArray) {
      const idsSet = new Set(idsArray);

      for (const id of Object.keys(refs.current)) {
        if (!idsSet.has(id)) {
          delete refs.current[id];
        }
      }

      for (const id of Object.keys(refCallbacks.current)) {
        if (!idsSet.has(id)) {
          delete refCallbacks.current[id];
        }
      }

      const currentActive = activeIdRef.current;
      const nextActive =
        currentActive && idsSet.has(currentActive)
          ? currentActive
          : (idsArray[0] ?? null);

      if (nextActive !== currentActive) {
        activeIdRef.current = nextActive;
        setActiveId(nextActive);
      }
    }
  }, [idsArray, useSelector]);

  const registerRef = useCallback((id: string) => {
    const existing = refCallbacks.current[id];
    if (existing) return existing;

    const callback = (el: HTMLElement | null) => {
      if (el) {
        refs.current[id] = el;
      } else {
        delete refs.current[id];
      }
      cacheValidRef.current = false;
      scheduleRecalculate();
    };

    refCallbacks.current[id] = callback;
    return callback;
  }, [scheduleRecalculate]);

  const navRef = useCallback((id: string, options?: NavRefOptions) => {
    navRefOptions.current[id] = options;

    const existing = navRefCallbacks.current[id];
    if (existing) return existing;

    const callback = (el: HTMLElement | null) => {
      if (el) {
        navRefs.current[id] = el;
      } else {
        delete navRefs.current[id];
        delete navRefOptions.current[id];
      }
    };

    navRefCallbacks.current[id] = callback;
    return callback;
  }, []);

  const getResolvedBehavior = useCallback((behaviorOverride?: ScrollBehavior): ScrollBehavior => {
    const b = behaviorOverride ?? optionsRef.current.scrolling.behavior;
    if (b === "auto") {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return "smooth";
      }
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      return prefersReducedMotion ? "instant" : "smooth";
    }
    return b;
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const navElement = navRefs.current[activeId];
    if (!navElement) return;

    const options = navRefOptions.current[activeId];
    const behavior = getResolvedBehavior(options?.behavior);
    const position = options?.position ?? "nearest";
    const offset = options?.offset ?? 0;

    if (offset === 0) {
      if (typeof navElement.scrollIntoView !== "function") return;
      navElement.scrollIntoView({
        block: position,
        behavior,
      });
      return;
    }

    const scrollableParent = findScrollableParent(navElement);
    if (!scrollableParent) return;

    const parentRect = scrollableParent.getBoundingClientRect();
    const elementRect = navElement.getBoundingClientRect();
    const currentScroll = scrollableParent.scrollTop;

    let targetScroll: number;
    const elementTop = elementRect.top - parentRect.top + currentScroll;
    const elementBottom = elementTop + elementRect.height;
    const visibleTop = currentScroll;
    const visibleBottom = currentScroll + parentRect.height;

    switch (position) {
      case "start":
        targetScroll = elementTop - offset;
        break;
      case "end":
        targetScroll = elementBottom - parentRect.height + offset;
        break;
      case "center":
        targetScroll = elementTop - (parentRect.height - elementRect.height) / 2;
        break;
      case "nearest":
      default: {
        const isAbove = elementTop < visibleTop + offset;
        const isBelow = elementBottom > visibleBottom - offset;
        if (!isAbove && !isBelow) return;
        targetScroll = isAbove
          ? elementTop - offset
          : elementBottom - parentRect.height + offset;
        break;
      }
    }

    scrollableParent.scrollTo({
      top: Math.max(0, targetScroll),
      behavior,
    });
  }, [activeId, getResolvedBehavior]);

  const getCurrentSections = useCallback((): ResolvedSection[] => {
    if (!useSelector && idsArray) {
      return resolveSectionsFromIds(idsArray, refs.current);
    }
    return resolvedSections;
  }, [useSelector, idsArray, resolvedSections]);

  const scrollTo = useCallback(
    (target: ScrollTarget, scrollOptions?: ScrollToOptions): void => {
      const resolvedTarget = typeof target === "string"
        ? { type: "id" as const, id: target }
        : "id" in target
          ? { type: "id" as const, id: target.id }
          : { type: "top" as const, top: target.top };

      const defaultScroll = optionsRef.current.scrolling;
      const lockActive = scrollOptions?.lockActive
        ?? defaultScroll.lockActive
        ?? resolvedTarget.type === "id";
      const container = containerElement;
      const scrollTarget = container || window;
      const viewportHeight = container ? container.clientHeight : window.innerHeight;
      const scrollHeight = container
        ? container.scrollHeight
        : document.documentElement.scrollHeight;
      const maxScroll = Math.max(0, scrollHeight - viewportHeight);
      const scrollBehavior = getResolvedBehavior(
        scrollOptions?.behavior ?? defaultScroll.behavior,
      );
      const offsetCandidate = scrollOptions?.offset
        ?? defaultScroll.offset;
      const offsetValue = sanitizeOffset(offsetCandidate);
      const effectiveOffset = resolveOffset(offsetValue, viewportHeight, DEFAULT_OFFSET);

      const stopProgrammaticScroll = () => {
        if (scrollCleanupRef.current) {
          scrollCleanupRef.current();
          scrollCleanupRef.current = null;
        }
        isProgrammaticScrolling.current = false;
      };

      if (!lockActive) {
        stopProgrammaticScroll();
      } else if (scrollCleanupRef.current) {
        scrollCleanupRef.current();
      }

      const setupLock = () => {
        const unlockScroll = () => {
          isProgrammaticScrolling.current = false;
        };

        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        let isUnlocked = false;

        const cleanup = () => {
          if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
          }
          scrollTarget.removeEventListener("scroll", handleScrollActivity);
          if ("onscrollend" in scrollTarget) {
            scrollTarget.removeEventListener("scrollend", handleScrollEnd);
          }
          scrollCleanupRef.current = null;
        };

        const doUnlock = () => {
          if (isUnlocked) return;
          isUnlocked = true;
          cleanup();
          unlockScroll();
        };

        const resetDebounce = () => {
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
          debounceTimer = setTimeout(doUnlock, SCROLL_IDLE_MS);
        };

        const handleScrollActivity = () => {
          resetDebounce();
        };

        const handleScrollEnd = () => {
          doUnlock();
        };

        scrollTarget.addEventListener("scroll", handleScrollActivity, {
          passive: true,
        });

        if ("onscrollend" in scrollTarget) {
          scrollTarget.addEventListener("scrollend", handleScrollEnd, {
            once: true,
          });
        }

        scrollCleanupRef.current = cleanup;

        return { doUnlock, resetDebounce };
      };

      const clampValue = (value: number, min: number, max: number): number =>
        Math.max(min, Math.min(max, value));

      let targetScroll: number | null = null;
      let activeTargetId: string | null = null;

      if (resolvedTarget.type === "id") {
        const id = resolvedTarget.id;
        if (!sectionIndexMap.has(id)) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[domet] scrollTo: id "${id}" not found`);
          }
          return;
        }

        const currentSections = getCurrentSections();
        const section = currentSections.find((s) => s.id === id);
        if (!section) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[domet] scrollTo: element for id "${id}" not yet mounted`);
          }
          return;
        }

        const elementRect = section.element.getBoundingClientRect();

        const position: ScrollToPosition | undefined =
          scrollOptions?.position ?? defaultScroll.position;

        const sectionTop = container
          ? elementRect.top - container.getBoundingClientRect().top + container.scrollTop
          : elementRect.top + window.scrollY;
        const sectionHeight = elementRect.height;

        const calculateTargetScroll = (): number => {
          if (maxScroll <= 0) return 0;

          const topTarget = sectionTop - effectiveOffset;
          const centerTarget = sectionTop - (viewportHeight - sectionHeight) / 2;
          const bottomTarget = sectionTop + sectionHeight - viewportHeight;

          if (position === "top") {
            return clampValue(topTarget, 0, maxScroll);
          }

          if (position === "center") {
            const fits = sectionHeight <= viewportHeight;
            if (fits) {
              return clampValue(centerTarget, 0, maxScroll);
            }
            return clampValue(topTarget, 0, maxScroll);
          }

          if (position === "bottom") {
            return clampValue(bottomTarget, 0, maxScroll);
          }

          const fits = sectionHeight <= viewportHeight;

          const dynamicRange = viewportHeight - effectiveOffset;
          const denominator = dynamicRange !== 0 ? 1 + dynamicRange / maxScroll : 1;

          const triggerMin = (sectionTop - effectiveOffset) / denominator;
          const triggerMax = (sectionTop + sectionHeight - effectiveOffset) / denominator;

          if (fits) {
            if (centerTarget >= triggerMin && centerTarget <= triggerMax) {
              return clampValue(centerTarget, 0, maxScroll);
            }

            if (centerTarget < triggerMin) {
              return clampValue(triggerMin, 0, maxScroll);
            }

            return clampValue(triggerMax, 0, maxScroll);
          }

          return clampValue(topTarget, 0, maxScroll);
        };

        targetScroll = calculateTargetScroll();
        activeTargetId = id;
      } else {
        const top = resolvedTarget.top;
        if (!Number.isFinite(top)) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[domet] scrollTo: top "${top}" is not a valid number`);
          }
          return;
        }
        targetScroll = clampValue(top - effectiveOffset, 0, maxScroll);
      }

      if (targetScroll === null) return;

      if (lockActive) {
        isProgrammaticScrolling.current = true;
        if (activeTargetId) {
          activeIdRef.current = activeTargetId;
          setActiveId(activeTargetId);
        }
      }

      const lockControls = lockActive ? setupLock() : null;

      if (container) {
        container.scrollTo({
          top: targetScroll,
          behavior: scrollBehavior,
        });
      } else {
        window.scrollTo({
          top: targetScroll,
          behavior: scrollBehavior,
        });
      }

      if (lockControls) {
        if (scrollBehavior === "instant") {
          lockControls.doUnlock();
        } else {
          lockControls.resetDebounce();
        }
      }
    },
    [sectionIndexMap, containerElement, getResolvedBehavior, getCurrentSections],
  );

  const register = useCallback(
    (id: string): RegisterProps => {
      const cached = registerPropsCache.current[id];
      if (cached) return cached;

      const props: RegisterProps = {
        id,
        ref: registerRef(id),
        "data-domet": id,
      };
      registerPropsCache.current[id] = props;
      return props;
    },
    [registerRef],
  );

  const link = useCallback(
    (id: string, options?: ScrollToOptions): LinkProps => ({
      onClick: () => scrollTo(id, options),
      "aria-current": activeId === id ? "page" : undefined,
      "data-active": activeId === id,
    }),
    [activeId, scrollTo],
  );

  const calculateActiveSection = useCallback(() => {
    const container = containerElement;
    const currentActiveId = activeIdRef.current;
    const now = Date.now();
    const scrollY = container ? container.scrollTop : window.scrollY;
    const viewportHeight = container ? container.clientHeight : window.innerHeight;
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

    if (!cacheValidRef.current || sectionCacheRef.current.length !== currentSections.length) {
      sectionCacheRef.current = buildSectionCache(currentSections, container);
      cacheValidRef.current = true;
    }

    const sectionBounds = getSectionBoundsFromCache(
      sectionCacheRef.current,
      scrollY,
    );
    if (sectionBounds.length === 0) return;

    const effectiveOffset = resolveOffset(trackingOffset, viewportHeight, DEFAULT_OFFSET);

    const scores = calculateSectionScores(sectionBounds, currentSections, {
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
      effectiveOffset + scrollProgress * (viewportHeight - effectiveOffset)
    );

    const roundedY = Math.round(scrollY);
    const clampedProgress = Math.max(0, Math.min(1, scrollProgress));
    const roundedVelocity = Math.round(velocity);
    const roundedMaxScroll = Math.round(maxScroll);
    const roundedViewportHeight = Math.round(viewportHeight);
    const roundedTrackingOffset = Math.round(effectiveOffset);
    const currentScrolling = isScrollingRef.current;

    const prev = prevScrollStateRef.current;
    const scrollChanged = !prev ||
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
        if (Object.prototype.hasOwnProperty.call(prevSections, key)) countPrev++;
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
          const roundedVisibility = Math.round(s.visibilityRatio * 100) / 100;
          const roundedProgress = Math.round(s.progress * 100) / 100;
          const isActive = s.id === (isProgrammatic ? currentActiveId : newActiveId);
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
      for (const s of scores) {
        newSections[s.id] = {
          bounds: {
            top: Math.round(s.bounds.top),
            bottom: Math.round(s.bounds.bottom),
            height: Math.round(s.bounds.height),
          },
          visibility: Math.round(s.visibilityRatio * 100) / 100,
          progress: Math.round(s.progress * 100) / 100,
          inView: s.inView,
          active: s.id === (isProgrammatic ? currentActiveId : newActiveId),
          rect: s.rect,
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
      scrollIdleTimeoutRef.current = setTimeout(handleScrollEnd, SCROLL_IDLE_MS);

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
      if (useSelector && selectorString) {
        updateSectionsFromSelector(selectorString);
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
      scrollCleanupRef.current?.();
      isThrottled.current = false;
      hasPendingScroll.current = false;
      isProgrammaticScrolling.current = false;
      isScrollingRef.current = false;
    };
  }, [throttle, containerElement, useSelector, selectorString, updateSectionsFromSelector, scheduleRecalculate]);

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
