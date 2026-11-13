"use client";

import { useDomet } from "@afterfivespace/domet";
import { Prose } from "../shared";

const SECTIONS = [
  { id: "hero", title: "Hero" },
  { id: "features", title: "Features" },
  { id: "testimonials", title: "Testimonials" },
  { id: "pricing", title: "Pricing" },
  { id: "cta", title: "Call to Action" },
];

const SECTION_IDS = SECTIONS.map((s) => s.id);
const FULLY_REVEALED_AT = 0.6;
const TRAVEL = 32;

export function Reveal() {
  const { sections, register } = useDomet({
    ids: SECTION_IDS,
    tracking: { threshold: 0.3 },
    debug: true,
  });

  return (
    <main className="mx-auto max-w-screen-md px-6">
      {SECTIONS.map(({ id, title }, i) => {
        const state = sections[id];
        const visibility = state?.visibility ?? 0;
        const reveal = Math.min(1, visibility / FULLY_REVEALED_AT);

        return (
          <section
            key={id}
            {...register(id)}
            className="flex min-h-dvh items-center py-16"
          >
            <div
              className="w-full motion-reduce:!transform-none"
              style={{
                opacity: reveal,
                transform: `translateY(${(1 - reveal) * TRAVEL}px)`,
              }}
            >
              <div className="font-mono text-xs tabular-nums text-subtle">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="mt-2">
                <h2 className="text-lg">{title}</h2>
              </div>
              <Prose paragraphs={2} start={i} className="mt-3" />
              <div className="mt-6 flex gap-6 border-t border-border pt-3 font-mono text-xs tabular-nums text-subtle">
                <span>visibility {visibility.toFixed(2)}</span>
                <span>{state?.inView ? "in view" : "out of view"}</span>
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
