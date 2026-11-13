import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type {
  DebugEventType,
  DebugHandle,
  DebugOverrides,
  DebugView,
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
  sanitizeIds,
  sanitizeSelector,
  useIsomorphicLayoutEffect,
  areIdInputsEqual,
  VALIDATION_LIMITS,
} from "../utils";
import { PERCENT_REGEX } from "../constants";
import { resolveScrollBehavior } from "../utils/scrolling";

import { useSectionResolver } from "./hooks/useSectionResolver";
import { useScrollDetection } from "./hooks/useScrollDetection";
import { useNavAutoScroll } from "./hooks/useNavAutoScroll";
import { useProgrammaticScroll } from "./hooks/useProgrammaticScroll";
import {
  createDometStore,
  createTrackedScroll,
  hasTrackedChange,
  readSections,
  type SectionsSource,
  type TrackedKey,
} from "./store";

export function useDomet(options: DometOptions): UseDometReturn {
  const {
    container: containerInput,
    onActive,
    onEnter,
    onLeave,
    onScrollStart,
    onScrollEnd,
    debug = false,
  } = options;

  const [debugOverrides, setDebugOverrides] = useState<DebugOverrides | null>(
    null,
  );
  const debugHandleRef = useRef<DebugHandle | null>(null);
  const debugViewRef = useRef<DebugView | null>(null);
  const tracking = debugOverrides
    ? { ...options.tracking, ...debugOverrides.tracking }
    : options.tracking;
  const inputScrolling = options.scrolling;
  const scrolling = useMemo(
    () =>
      debugOverrides
        ? { ...inputScrolling, ...debugOverrides.scrolling }
        : inputScrolling,
    [inputScrolling, debugOverrides],
  );

  const trackingOffset = sanitizeOffset(tracking?.offset);
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

  if (process.env.NODE_ENV !== "production" && rawIds && rawSelector) {
    console.warn("[domet] Both `ids` and `selector` were provided. Only one should be used. `selector` will be ignored.");
  }

  const [stableRawIds, setStableRawIds] = useState(rawIds);
  if (!areIdInputsEqual(rawIds, stableRawIds)) {
    setStableRawIds(rawIds);
  }

  const idsArray = useMemo(
    () => (stableRawIds === undefined ? undefined : sanitizeIds(stableRawIds)),
    [stableRawIds],
  );

  const selectorString = useMemo(() => {
    if (rawSelector === undefined) return undefined;
    return sanitizeSelector(rawSelector);
  }, [rawSelector]);
  const useSelector =
    idsArray === undefined &&
    selectorString !== undefined &&
    selectorString !== "";

  const initialActiveId = idsArray && idsArray.length > 0 ? idsArray[0] : null;

  // Shared refs
  const isProgrammaticScrolling = useRef<boolean>(false);
  const heldScrollPosition = useRef<number | null>(null);
  const cacheValidRef = useRef<boolean>(false);
  const recalculateRef = useRef<() => void>(() => {});
  const rafId = useRef<number | null>(null);
  const scrollCleanupRef = useRef<(() => void) | null>(null);
  const optionsRef = useRef({ trackingOffset, scrolling: scrollingDefaults });
  const [store] = useState(createDometStore);
  const [trackedKeys] = useState(() => new Set<TrackedKey>());
  const sectionsSourceRef = useRef<SectionsSource | null>(null);

  const subscribeToTrackedChanges = useCallback(
    (onStoreChange: () => void) =>
      store.subscribe((prev, next) => {
        if (hasTrackedChange(trackedKeys, prev, next)) onStoreChange();
      }),
    [store, trackedKeys],
  );
  const snapshot = useSyncExternalStore(
    subscribeToTrackedChanges,
    store.getState,
    store.getState,
  );
  const trackedScroll = useMemo(
    () => createTrackedScroll(snapshot.scroll, trackedKeys, store.getState),
    [snapshot.scroll, trackedKeys, store],
  );
  const callbackRefs = useRef({
    onActive,
    onEnter,
    onLeave,
    onScrollStart,
    onScrollEnd,
  });

  const scheduleRecalculate = useCallback(() => {
    if (typeof window === "undefined" || rafId.current !== null) return;
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
  }, [trackingOffset, threshold, hysteresis, scheduleRecalculate]);

  useIsomorphicLayoutEffect(() => {
    const tap =
      <A extends unknown[]>(type: DebugEventType, callback?: (...args: A) => void) =>
      (...args: A) => {
        debugHandleRef.current?.event(type, args);
        callback?.(...args);
      };
    callbackRefs.current = debug
      ? {
          onActive: tap("active", onActive),
          onEnter: tap("enter", onEnter),
          onLeave: tap("leave", onLeave),
          onScrollStart: tap("scrollStart", onScrollStart),
          onScrollEnd: tap("scrollEnd", onScrollEnd),
        }
      : { onActive, onEnter, onLeave, onScrollStart, onScrollEnd };
  }, [debug, onActive, onEnter, onLeave, onScrollStart, onScrollEnd]);

  useEffect(() => {
    if (!debug) return;
    let cancelled = false;
    import("../debug").then(({ mountDebug }) => {
      if (cancelled) return;
      debugHandleRef.current = mountDebug({
        limits: VALIDATION_LIMITS,
        percentPattern: PERCENT_REGEX,
        getView: () => debugViewRef.current as DebugView,
        getScroll: () => store.getState().scroll,
        getSections: () => readSections(store, sectionsSourceRef.current),
        subscribe: (listener) => store.subscribe(listener),
        setOverrides: setDebugOverrides,
      });
    });
    return () => {
      cancelled = true;
      debugHandleRef.current?.destroy();
      debugHandleRef.current = null;
      setDebugOverrides(null);
    };
  }, [debug, store]);

  const getResolvedBehavior = useCallback(
    (behaviorOverride?: ScrollBehavior): ScrollBehavior =>
      resolveScrollBehavior(
        behaviorOverride ?? optionsRef.current.scrolling.behavior,
      ),
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
    callbackRefs,
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

  useScrollDetection({
    store,
    trackedKeys,
    sectionsSourceRef,
    containerElement,
    sectionIds,
    tracking: {
      offset: trackingOffset,
      threshold,
      hysteresis,
    },
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
    heldScrollPosition,
    scrollCleanupRef,
    optionsRef,
    getResolvedBehavior,
    callbackRefs,
    scheduleRecalculate,
  });

  // Hook D: Nav auto-scroll
  const { navRef } = useNavAutoScroll({
    activeId,
    containerElement,
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

  useEffect(() => {
    if (!debug) return;
    debugViewRef.current = {
      active: activeId,
      index,
      ids: sectionIds,
      container: containerElement,
      tracking: { offset: trackingOffset, threshold, hysteresis },
      scrolling: scrollingDefaults,
      scrollTo,
    };
    debugHandleRef.current?.update();
  });

  return {
    active: activeId,
    index,
    get progress() {
      return trackedScroll.progress;
    },
    get direction() {
      return trackedScroll.direction;
    },
    scroll: trackedScroll,
    get sections() {
      trackedKeys.add("sections");
      return readSections(store, sectionsSourceRef.current);
    },
    ids: sectionIds,
    scrollTo,
    register,
    link,
    navRef,
  };
}

export default useDomet;
