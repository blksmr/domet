"use client";

import { useDomet } from "@afterfivespace/domet";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { focusRing } from "../shared";
import { useNavProgress } from "./useNavProgress";

const SECTIONS = [
  {
    id: "desert",
    label: "Desert",
    caption: "desert_dunes_offroad_tracks_wide_sky_16x9.jpg",
    color: "#c6bdac",
  },
  {
    id: "mountains",
    label: "Mountains",
    caption: "mountain_peak_moody_clouds_dark_tones.jpg",
    color: "#9ba3ac",
  },
  {
    id: "forest",
    label: "Forest",
    caption: "dense_conifer_forest_pattern_aerial_view.jpg",
    color: "#7e8239",
  },
  {
    id: "coast",
    label: "Coast",
    caption: "ocean_waves_golden_hour_sunset_reflections.jpg",
    color: "#dba769",
  },
];

const SECTION_IDS = SECTIONS.map((s) => s.id);

export function Basic() {
  const { register, link, scroll, sections } = useDomet({
    ids: SECTION_IDS,
    debug: true,
  });

  const { getIndicatorStyle } = useNavProgress(SECTION_IDS, scroll, sections);

  return (
    <div className="relative min-h-svh bg-background">
      <nav
        aria-label="Sections"
        className="fixed right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-end"
      >
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            {...link(id)}
            aria-label={`Go to ${label}`}
            className={cn(
              "flex h-6 w-10 items-center justify-end rounded-md hover:opacity-60",
              focusRing,
            )}
          >
            <span
              className="block h-0.5 rounded-full bg-text"
              style={getIndicatorStyle(id)}
            />
          </button>
        ))}
      </nav>

      <main>
        {SECTIONS.map(({ id, label, caption, color }, index) => (
          <section
            key={id}
            {...register(id)}
            className="relative flex min-h-svh flex-col items-center justify-center gap-3 p-12"
          >
            <div
              className="pointer-events-none relative aspect-[3/2] w-full max-w-[500px] select-none overflow-hidden rounded-lg outline outline-1 -outline-offset-1 outline-black/10"
              style={{ backgroundColor: color }}
            >
              <Image
                src={`/images/${id}.jpg`}
                alt={label}
                fill
                sizes="(max-width: 500px) 100vw, 500px"
                priority={index === 0}
                onLoad={(e) => e.currentTarget.classList.remove("opacity-0")}
                className="object-cover opacity-0 transition-opacity duration-300 ease-out-strong"
              />
            </div>
            <span className="max-w-full text-center font-mono text-xs text-subtle [overflow-wrap:anywhere]">
              {caption}
            </span>
          </section>
        ))}
      </main>
    </div>
  );
}
