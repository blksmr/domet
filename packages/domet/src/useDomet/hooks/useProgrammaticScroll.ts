import { useCallback } from "react";

import type {
  Offset,
  ResolvedSection,
  ScrollBehavior,
  ScrollTarget,
  ScrollToOptions,
  ScrollToPosition,
  ScrollingOptions,
} from "../../types";
import { DEFAULT_OFFSET, SCROLL_IDLE_MS } from "../../constants";
import { resolveOffset, sanitizeOffset } from "../../utils";

type UseProgrammaticScrollParams = {
  containerElement: HTMLElement | null;
  sectionIndexMap: Map<string, number>;
  getCurrentSections: () => ResolvedSection[];
  activeIdRef: React.MutableRefObject<string | null>;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  isProgrammaticScrolling: React.MutableRefObject<boolean>;
  scrollCleanupRef: React.MutableRefObject<(() => void) | null>;
  optionsRef: React.MutableRefObject<{
    trackingOffset: Offset;
    scrolling: ScrollingOptions & { lockActive?: boolean };
  }>;
  getResolvedBehavior: (override?: ScrollBehavior) => ScrollBehavior;
};

type UseProgrammaticScrollReturn = {
  scrollTo: (target: ScrollTarget, options?: ScrollToOptions) => void;
};

export function useProgrammaticScroll({
  containerElement,
  sectionIndexMap,
  getCurrentSections,
  activeIdRef,
  setActiveId,
  isProgrammaticScrolling,
  scrollCleanupRef,
  optionsRef,
  getResolvedBehavior,
}: UseProgrammaticScrollParams): UseProgrammaticScrollReturn {
  const scrollTo = useCallback(
    (target: ScrollTarget, scrollOptions?: ScrollToOptions): void => {
      const resolvedTarget =
        typeof target === "string"
          ? { type: "id" as const, id: target }
          : "id" in target
            ? { type: "id" as const, id: target.id }
            : { type: "top" as const, top: target.top };

      const defaultScroll = optionsRef.current.scrolling;
      const lockActive =
        scrollOptions?.lockActive ??
        defaultScroll.lockActive ??
        resolvedTarget.type === "id";
      const container = containerElement;
      const scrollTarget = container || window;
      const viewportHeight = container
        ? container.clientHeight
        : window.innerHeight;
      const scrollHeight = container
        ? container.scrollHeight
        : document.documentElement.scrollHeight;
      const maxScroll = Math.max(0, scrollHeight - viewportHeight);
      const scrollBehavior = getResolvedBehavior(
        scrollOptions?.behavior ?? defaultScroll.behavior,
      );
      const offsetCandidate = scrollOptions?.offset ?? defaultScroll.offset;
      const offsetValue = sanitizeOffset(offsetCandidate);
      const effectiveOffset = resolveOffset(
        offsetValue,
        viewportHeight,
        DEFAULT_OFFSET,
      );

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
            console.warn(
              `[domet] scrollTo: element for id "${id}" not yet mounted`,
            );
          }
          return;
        }

        const elementRect = section.element.getBoundingClientRect();

        const position: ScrollToPosition | undefined =
          scrollOptions?.position ?? defaultScroll.position;

        const sectionTop = container
          ? elementRect.top -
            container.getBoundingClientRect().top +
            container.scrollTop
          : elementRect.top + window.scrollY;
        const sectionHeight = elementRect.height;

        const calculateTargetScroll = (): number => {
          if (maxScroll <= 0) return 0;

          const topTarget = sectionTop - effectiveOffset;
          const centerTarget =
            sectionTop - (viewportHeight - sectionHeight) / 2;
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
          const denominator =
            dynamicRange !== 0 ? 1 + dynamicRange / maxScroll : 1;

          const triggerMin =
            (sectionTop - effectiveOffset) / denominator;
          const triggerMax =
            (sectionTop + sectionHeight - effectiveOffset) / denominator;

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
            console.warn(
              `[domet] scrollTo: top "${top}" is not a valid number`,
            );
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
    [
      sectionIndexMap,
      containerElement,
      getResolvedBehavior,
      getCurrentSections,
      optionsRef,
      scrollCleanupRef,
      isProgrammaticScrolling,
      activeIdRef,
      setActiveId,
    ],
  );

  return { scrollTo };
}
