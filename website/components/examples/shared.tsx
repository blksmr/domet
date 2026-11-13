import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const focusRing =
  "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text";

export const scrollFadeX =
  "max-md:[mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]";

export const navItem = (isActive: boolean) =>
  cn(
    "rounded-md px-2 py-1 text-left text-sm transition-colors duration-200 select-none",
    isActive ? "bg-secondary text-text" : "text-subtle hover:text-text",
    focusRing,
  );

export const fieldInput = (isInvalid = false) =>
  cn(
    "w-full rounded-md border bg-background px-3 py-2 text-lg text-text placeholder:text-subtle md:text-sm",
    "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-text",
    isInvalid ? "border-danger" : "border-field",
  );

export const primaryButton = cn(
  "rounded-md bg-text px-3 py-1.5 text-sm text-background select-none hover:bg-hover",
  focusRing,
);

export const secondaryButton = cn(
  "rounded-md border border-field px-3 py-1.5 text-sm text-text select-none hover:bg-secondary disabled:text-muted disabled:hover:bg-transparent",
  focusRing,
);

const PARAGRAPHS = [
  "A scroll spy keeps navigation in sync with what the reader is looking at. The section crossing the trigger line becomes active, and its link is highlighted.",
  "The trigger line starts at the tracking offset and slides toward the bottom of the viewport as the page scrolls, so the first and the last sections can both become active.",
  "Each section gets a score from its visible share and its distance to the trigger line. A candidate has to beat the current section by a margin before it takes over, which stops flicker at boundaries.",
  "Positions are measured once and cached. They are measured again only when a section resizes, the container resizes, or the scrollable height changes.",
  "Scroll state is read on demand. A component that only reads the active section does not render again while the page scrolls.",
  "Programmatic scrolling locks the active section until the scroll settles, so the highlight does not jump through every section on the way.",
  "Sections are registered by id or found with a CSS selector. Either way the hook stays headless: the markup and the styles are yours.",
  "Callbacks report sections entering and leaving the viewport, changes of the active section, and the start and the end of scrolling.",
];

type ProseProps = {
  paragraphs: number;
  start?: number;
  className?: string;
};

export const Prose = memo(function Prose({
  paragraphs,
  start = 0,
  className,
}: ProseProps) {
  return (
    <div className={cn("max-w-[65ch] space-y-3 text-pretty", className)}>
      {Array.from({ length: paragraphs }, (_, i) => (
        <p key={i} className="mt-0">
          {PARAGRAPHS[(start + i) % PARAGRAPHS.length]}
        </p>
      ))}
    </div>
  );
});

type MetricProps = {
  label: string;
  children: ReactNode;
};

export function Metric({ label, children }: MetricProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-xs">
      <span className="text-subtle">{label}</span>
      <span className="font-mono tabular-nums">{children}</span>
    </div>
  );
}

type ProgressLineProps = {
  value: number;
  className?: string;
};

export function ProgressLine({ value, className }: ProgressLineProps) {
  return (
    <div className={cn("h-px bg-border", className)}>
      <div
        className="h-full origin-left bg-text"
        style={{ transform: `scaleX(${Math.max(0, Math.min(1, value))})` }}
      />
    </div>
  );
}

export function percent(value: number | undefined): string {
  return `${Math.round((value ?? 0) * 100)}%`;
}
