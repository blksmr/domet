import { useCallback, useEffect, useRef } from "react";

import type {
  ElementScrollOptions,
  ElementScrollTarget,
  UseElementScrollReturn,
} from "../types";
import { resolveScrollBehavior, resolveScrollBlock } from "../utils/scrolling";

const TARGET_RESOLUTION_ATTEMPTS = 3;

export function useElementScroll(
  defaults: ElementScrollOptions = {},
): UseElementScrollReturn {
  const frameRef = useRef<number | null>(null);

  const cancelPendingScroll = useCallback((): void => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const scrollTo = useCallback(
    (target: ElementScrollTarget, options: ElementScrollOptions = {}): void => {
      if (typeof window === "undefined") return;

      cancelPendingScroll();
      const targetResolver = typeof target === "function" ? target : () => target;

      const scheduleTargetResolution = (attemptsRemaining: number): void => {
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = null;

          const element = targetResolver();
          if (!element?.isConnected) {
            if (typeof target === "function" && attemptsRemaining > 1) {
              scheduleTargetResolution(attemptsRemaining - 1);
            }
            return;
          }
          if (element.getClientRects().length === 0) return;

          element.scrollIntoView({
            behavior: resolveScrollBehavior(options.behavior ?? defaults.behavior),
            block: resolveScrollBlock(options.position ?? defaults.position),
            inline: "nearest",
          });
        });
      };

      scheduleTargetResolution(TARGET_RESOLUTION_ATTEMPTS);
    },
    [cancelPendingScroll, defaults.behavior, defaults.position],
  );

  useEffect(() => cancelPendingScroll, [cancelPendingScroll]);

  return { scrollTo };
}
