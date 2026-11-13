import type { ScrollState, SectionState } from "@afterfivespace/domet";
import { useMemo } from "react";

type ProgressMap = Record<string, number>;

type IndicatorStyle = {
  width: string;
  opacity: number;
};

const MIN_WIDTH = 14;
const MAX_WIDTH = 24;
const MIN_OPACITY = 0.15;
const MAX_OPACITY = 1;

export function useNavProgress(
  sectionIds: string[],
  scroll: ScrollState,
  sections: Record<string, SectionState>,
) {
  const sectionProgress = useMemo((): ProgressMap => {
    const progress: ProgressMap = {};
    sectionIds.forEach((id) => {
      progress[id] = 0;
    });

    const sectionEntries = sectionIds
      .map((id) => ({ id, ...sections[id] }))
      .filter((s) => s.bounds);
    if (!sectionEntries.length) {
      progress[sectionIds[0]] = 1;
      return progress;
    }

    const { y: scrollY, viewportHeight } = scroll;
    const lastSection = sectionEntries[sectionEntries.length - 1];
    const scrollHeight = lastSection.bounds.bottom;
    const maxScroll = Math.max(1, scrollHeight - viewportHeight);

    const scrollProgress = Math.max(0, Math.min(1, scrollY / maxScroll));
    const sectionIndex = scrollProgress * (sectionEntries.length - 1);

    const lowerIndex = Math.floor(sectionIndex);
    const upperIndex = Math.min(
      sectionEntries.length - 1,
      Math.ceil(sectionIndex),
    );
    const ratio = sectionIndex - lowerIndex;

    progress[sectionEntries[lowerIndex].id] = 1 - ratio;
    if (upperIndex !== lowerIndex) {
      progress[sectionEntries[upperIndex].id] = ratio;
    }

    return progress;
  }, [scroll, sections, sectionIds]);

  const getIndicatorStyle = (id: string): IndicatorStyle => {
    const progress = sectionProgress[id] ?? 0;
    const amplified = progress ** 0.6;
    const width = MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * amplified;
    const opacity = MIN_OPACITY + (MAX_OPACITY - MIN_OPACITY) * amplified;
    return { width: `${width}px`, opacity };
  };

  return { sectionProgress, getIndicatorStyle };
}
