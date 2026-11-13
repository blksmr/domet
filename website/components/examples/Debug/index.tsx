"use client";

import { useDomet } from "@afterfivespace/domet";
import { cn } from "@/lib/utils";
import { navItem, scrollFadeX } from "../shared";

const SECTIONS = [
  {
    id: "panel",
    title: "Panel",
    paragraphs: [
      "This page runs useDomet with debug: true. The round button at the bottom right opens the debug panel, and the close button in its header puts it away again.",
      "The panel is only loaded when the option is on, so it adds nothing to a page that does not use it.",
    ],
  },
  {
    id: "state",
    title: "State",
    paragraphs: [
      "The State group shows what the hook returns as you scroll: the active section, the progress, the direction, the velocity and the position of the trigger line.",
      "Open Sections to see how much of each section is visible. Select a row to scroll to that section.",
    ],
  },
  {
    id: "tracking",
    title: "Tracking",
    paragraphs: [
      "Offset, Threshold and Hysteresis change how the active section is chosen. Every change applies at once, on top of the options passed in code.",
      "Raise Hysteresis and scroll slowly across a boundary: the current section holds on for longer before the next one takes over.",
    ],
  },
  {
    id: "overlays",
    title: "Overlays",
    paragraphs: [
      "Turn on Trigger Line to draw the line the hook uses to pick the active section, and Section Outlines to frame every tracked section that is in view. Change Offset and watch the line move.",
      "Section Scores shows why a section is active. Each section in view is tinted by its score and labelled with what that score is made of: how much of the section is visible, whether the trigger line is inside it, and how far its center is from the line. A mostly visible section can win while the trigger line is still in the previous one.",
    ],
  },
  {
    id: "scrolling",
    title: "Scrolling",
    paragraphs: [
      "Behavior, Position and Lock Active set how link and scrollTo move the page. Change one, then use the navigation above.",
      "Events lists the callbacks as they fire. Copy Options puts the current values on the clipboard, ready to paste into the hook.",
    ],
  },
];

const SECTION_IDS = SECTIONS.map((s) => s.id);
const HEADER_HEIGHT = 48;

export function Debug() {
  const { active, register, link, navRef } = useDomet({
    ids: SECTION_IDS,
    tracking: { offset: HEADER_HEIGHT },
    scrolling: { offset: HEADER_HEIGHT },
    debug: true,
  });

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="mx-auto flex h-12 max-w-screen-md items-center gap-4 px-6">
          <span className="hidden shrink-0 text-sm font-medium sm:block">
            Debug
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
                {...link(id)}
                className={cn(navItem(active === id), "shrink-0")}
              >
                {title}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-screen-md px-6 pb-24">
        {SECTIONS.map(({ id, title, paragraphs }) => (
          <section
            key={id}
            {...register(id)}
            className="min-h-[70dvh] border-t border-border py-10 first:border-t-0"
          >
            <h2 className="text-lg">{title}</h2>
            <div className="mt-3 max-w-[65ch] space-y-3 text-pretty">
              {paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-0">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
