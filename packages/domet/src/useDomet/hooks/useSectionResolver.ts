import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  RegisterProps,
  ResolvedSection,
  ScrollContainer,
} from "../../types";
import {
  resolveContainer,
  resolveSectionsFromIds,
  resolveSectionsFromSelector,
  useIsomorphicLayoutEffect,
} from "../../utils";

type UseSectionResolverParams = {
  containerInput: ScrollContainer | undefined;
  idsArray: string[] | undefined;
  selectorString: string | undefined;
  useSelector: boolean;
  initialActiveId: string | null;
  cacheValidRef: React.MutableRefObject<boolean>;
  scheduleRecalculate: () => void;
};

type UseSectionResolverReturn = {
  containerElement: HTMLElement | null;
  sectionIds: string[];
  sectionIndexMap: Map<string, number>;
  activeId: string | null;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  activeIdRef: React.MutableRefObject<string | null>;
  getCurrentSections: () => ResolvedSection[];
  updateSectionsFromSelector: (selector: string) => void;
  register: (id: string) => RegisterProps;
};

export function useSectionResolver({
  containerInput,
  idsArray,
  selectorString,
  useSelector,
  initialActiveId,
  cacheValidRef,
  scheduleRecalculate,
}: UseSectionResolverParams): UseSectionResolverReturn {
  const [containerElement, setContainerElement] = useState<HTMLElement | null>(
    null,
  );
  const [resolvedSections, setResolvedSections] = useState<ResolvedSection[]>(
    [],
  );
  const [activeId, setActiveId] = useState<string | null>(initialActiveId);

  const refs = useRef<Record<string, HTMLElement | null>>({});
  const refCallbacks = useRef<
    Record<string, (el: HTMLElement | null) => void>
  >({});
  const registerPropsCache = useRef<Record<string, RegisterProps>>({});
  const activeIdRef = useRef<string | null>(initialActiveId);
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const mutationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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
      const currentStillExists = resolved.some(
        (s) => s.id === activeIdRef.current,
      );
      if (!activeIdRef.current || !currentStillExists) {
        activeIdRef.current = resolved[0].id;
        setActiveId(resolved[0].id);
      }
    } else if (activeIdRef.current !== null) {
      activeIdRef.current = null;
      setActiveId(null);
    }
  }, [cacheValidRef]);

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
  }, [
    useSelector,
    selectorString,
    updateSectionsFromSelector,
    containerElement,
  ]);

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

  const registerRef = useCallback(
    (id: string) => {
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
    },
    [cacheValidRef, scheduleRecalculate],
  );

  const getCurrentSections = useCallback((): ResolvedSection[] => {
    if (!useSelector && idsArray) {
      return resolveSectionsFromIds(idsArray, refs.current);
    }
    return resolvedSections;
  }, [useSelector, idsArray, resolvedSections]);

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

  return {
    containerElement,
    sectionIds,
    sectionIndexMap,
    activeId,
    setActiveId,
    activeIdRef,
    getCurrentSections,
    updateSectionsFromSelector,
    register,
  };
}
