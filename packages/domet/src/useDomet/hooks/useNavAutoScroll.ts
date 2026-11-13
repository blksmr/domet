import { useCallback, useEffect, useRef } from "react";

import type {
  NavRefOptions,
  NavRefPosition,
  ScrollBehavior,
} from "../../types";
import { findScrollableParent } from "../../utils";

function resolveAxisScroll(
  position: NavRefPosition,
  offset: number,
  itemStart: number,
  itemSize: number,
  viewStart: number,
  viewSize: number,
): number | null {
  const itemEnd = itemStart + itemSize;

  switch (position) {
    case "start":
      return itemStart - offset;
    case "end":
      return itemEnd - viewSize + offset;
    case "center":
      return itemStart - (viewSize - itemSize) / 2;
    case "nearest":
    default: {
      const isBefore = itemStart < viewStart + offset;
      const isAfter = itemEnd > viewStart + viewSize - offset;
      if (!isBefore && !isAfter) return null;
      return isBefore ? itemStart - offset : itemEnd - viewSize + offset;
    }
  }
}

type UseNavAutoScrollParams = {
  activeId: string | null;
  containerElement: HTMLElement | null;
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
  containerElement,
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

    const scrollable = findScrollableParent(navElement, containerElement);
    if (!scrollable) return;
    const scrollableParent = scrollable.element;

    const options = navRefOptions.current[activeId];
    const position = options?.position ?? "nearest";
    const offset = options?.offset ?? 0;

    const parentRect = scrollableParent.getBoundingClientRect();
    const elementRect = navElement.getBoundingClientRect();

    const top = scrollable.y
      ? resolveAxisScroll(
            position,
            offset,
            elementRect.top -
              parentRect.top -
              scrollableParent.clientTop +
              scrollableParent.scrollTop,
            elementRect.height,
            scrollableParent.scrollTop,
            scrollableParent.clientHeight,
          )
      : null;
    const left = scrollable.x
      ? resolveAxisScroll(
            "nearest",
            offset,
            elementRect.left -
              parentRect.left -
              scrollableParent.clientLeft +
              scrollableParent.scrollLeft,
            elementRect.width,
            scrollableParent.scrollLeft,
            scrollableParent.clientWidth,
          )
      : null;
    if (top === null && left === null) return;

    scrollableParent.scrollTo({
      ...(top !== null && { top: Math.max(0, top) }),
      ...(left !== null && { left }),
      behavior: getResolvedBehavior(options?.behavior),
    });
  }, [activeId, containerElement, getResolvedBehavior]);

  return { navRef };
}
