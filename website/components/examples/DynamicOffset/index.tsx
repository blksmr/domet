"use client";

import { useDomet } from "domet";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Prose, navItem, percent, scrollFadeX } from "../shared";

const SECTIONS = [
  { id: "hero", title: "Hero" },
  { id: "features", title: "Features" },
  { id: "pricing", title: "Pricing" },
  { id: "testimonials", title: "Testimonials" },
  { id: "contact", title: "Contact" },
];

const SECTION_IDS = SECTIONS.map((s) => s.id);
const HEADER_HEIGHT_EXPANDED = 80;
const HEADER_HEIGHT_COLLAPSED = 48;
const COLLAPSE_AFTER = 100;

function snapToTarget(height: number): number {
  const midpoint = (HEADER_HEIGHT_EXPANDED + HEADER_HEIGHT_COLLAPSED) / 2;
  return height > midpoint ? HEADER_HEIGHT_EXPANDED : HEADER_HEIGHT_COLLAPSED;
}

export function DynamicOffset() {
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(HEADER_HEIGHT_EXPANDED);

  const { active, scroll, sections, register, link, navRef } = useDomet({
    ids: SECTION_IDS,
    tracking: { offset: headerHeight },
    debug: true,
  });

  const isCollapsed = scroll.y > COLLAPSE_AFTER;

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const observer = new ResizeObserver(([entry]) => {
      setHeaderHeight(snapToTarget(entry.contentRect.height));
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-dvh">
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-10 border-b border-border bg-background transition-[height] duration-200 ease-out-strong motion-reduce:transition-none"
        style={{
          height: isCollapsed ? HEADER_HEIGHT_COLLAPSED : HEADER_HEIGHT_EXPANDED,
        }}
      >
        <div className="mx-auto flex h-full max-w-screen-md items-center gap-4 px-6">
          <span className="hidden shrink-0 text-sm font-medium sm:block">
            Dynamic Offset
          </span>
          <nav
            aria-label="Sections"
            className={cn(
              "no-scrollbar -mx-6 flex min-w-0 flex-1 gap-1 overflow-x-auto px-6 sm:mx-0 sm:justify-end sm:px-0",
              scrollFadeX,
            )}
          >
            {SECTIONS.map(({ id, title }) => (
              <button
                key={id}
                type="button"
                ref={navRef(id, { offset: 24 })}
                {...link(id, { offset: headerHeight })}
                className={cn(navItem(active === id), "shrink-0")}
              >
                {title}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main
        className="mx-auto max-w-screen-md px-6 pb-24"
        style={{ paddingTop: HEADER_HEIGHT_EXPANDED }}
      >
        {SECTIONS.map(({ id, title }, i) => {
          const state = sections[id];

          return (
            <section
              key={id}
              {...register(id)}
              className="min-h-[80dvh] border-t border-border py-10 first:border-t-0"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-lg">{title}</h2>
                <span className="font-mono text-xs tabular-nums text-subtle">
                  {state?.inView ? "in view" : "out of view"} · visible{" "}
                  {percent(state?.visibility)}
                </span>
              </div>
              <Prose paragraphs={4 + (i % 2)} start={i * 2} className="mt-3" />
            </section>
          );
        })}
      </main>

    </div>
  );
}
