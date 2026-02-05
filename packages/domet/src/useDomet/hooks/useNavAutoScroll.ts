import { useCallback, useEffect, useRef } from "react";

import type { NavRefOptions, ScrollBehavior } from "../../types";
import { findScrollableParent } from "../../utils";

type UseNavAutoScrollParams = {
  activeId: string | null;
  getResolvedBehavior: (override?: ScrollBehavior) => ScrollBehavior;
};

type UseNavAutoScrollReturn = {
  navRef: (
    id: string,
    options?: NavRefOptions,
  ) => (el: HTMLElement | null) => void;
};

export function useNavAutoScroll({
  activeId,
  getResolvedBehavior,
}: UseNavAutoScrollParams): UseNavAutoScrollReturn {
  const navRefs = useRef<Record<string, HTMLElement | null>>({});
  const navRefCallbacks = useRef<
    Record<string, (el: HTMLElement | null) => void>
  >({});
  const navRefOptions = useRef<Record<string, NavRefOptions | undefined>>({});

  const navRef = useCallback(
    (id: string, options?: NavRefOptions) => {
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
    },
    [],
  );

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
        targetScroll =
          elementTop - (parentRect.height - elementRect.height) / 2;
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

  return { navRef };
}
