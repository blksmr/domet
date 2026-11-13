"use client";

import { ChevronRightIcon } from "@radix-ui/react-icons";
import { useDomet } from "@afterfivespace/domet";
import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Metric,
  ProgressLine,
  Prose,
  focusRing,
  navItem,
  percent,
  secondaryButton,
} from "../shared";

type TreeItem = {
  id: string;
  title: string;
  children?: TreeItem[];
};

const DOCUMENTATION_TREE: TreeItem[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    children: [
      { id: "installation", title: "Installation" },
      { id: "quick-start", title: "Quick Start" },
      { id: "project-structure", title: "Project Structure" },
      { id: "typescript-setup", title: "TypeScript Setup" },
    ],
  },
  {
    id: "core-concepts",
    title: "Core Concepts",
    children: [
      { id: "scroll-tracking", title: "Scroll Tracking" },
      { id: "active-section", title: "Active Section Detection" },
      { id: "visibility-scoring", title: "Visibility Scoring" },
      { id: "hysteresis", title: "Hysteresis Algorithm" },
      { id: "trigger-line", title: "Trigger Line Mechanism" },
    ],
  },
  {
    id: "api-reference",
    title: "API Reference",
    children: [
      { id: "useDomet-hook", title: "useDomet Hook" },
      { id: "options", title: "Configuration Options" },
      { id: "return-values", title: "Return Values" },
      { id: "register-function", title: "register() Function" },
      { id: "link-function", title: "link() Function" },
      { id: "scrollTo-function", title: "scrollTo() Function" },
    ],
  },
  {
    id: "advanced-usage",
    title: "Advanced Usage",
    children: [
      { id: "custom-containers", title: "Custom Scroll Containers" },
      { id: "dynamic-sections", title: "Dynamic Sections" },
      { id: "css-selectors", title: "CSS Selector Mode" },
      { id: "callbacks", title: "Event Callbacks" },
      { id: "performance", title: "Performance Optimization" },
    ],
  },
  {
    id: "recipes",
    title: "Recipes",
    children: [
      { id: "table-of-contents", title: "Table of Contents" },
      { id: "progress-indicator", title: "Progress Indicator" },
      { id: "section-navigation", title: "Section Navigation" },
      { id: "reveal-animations", title: "Reveal Animations" },
      { id: "sticky-headers", title: "Sticky Headers" },
      { id: "parallax-effects", title: "Parallax Effects" },
    ],
  },
  {
    id: "integration",
    title: "Framework Integration",
    children: [
      { id: "nextjs", title: "Next.js" },
      { id: "remix", title: "Remix" },
      { id: "gatsby", title: "Gatsby" },
      { id: "astro", title: "Astro" },
      { id: "vite", title: "Vite" },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    children: [
      { id: "common-issues", title: "Common Issues" },
      { id: "debugging", title: "Debugging Tips" },
      { id: "ssr-issues", title: "SSR Issues" },
      { id: "hydration", title: "Hydration Errors" },
    ],
  },
  {
    id: "migration",
    title: "Migration Guide",
    children: [
      { id: "from-v0", title: "From v0.x" },
      { id: "from-intersection-observer", title: "From Intersection Observer" },
      { id: "from-other-libraries", title: "From Other Libraries" },
    ],
  },
];

type FlatSection = {
  id: string;
  title: string;
  depth: number;
  parentId?: string;
};

const FLAT_SECTIONS: FlatSection[] = DOCUMENTATION_TREE.flatMap((group) => [
  { id: group.id, title: group.title, depth: 0 },
  ...(group.children ?? []).map((child) => ({
    id: child.id,
    title: child.title,
    depth: 1,
    parentId: group.id,
  })),
]);

const SECTION_IDS = FLAT_SECTIONS.map((s) => s.id);
const GROUP_IDS = DOCUMENTATION_TREE.map((group) => group.id);

const CODE_EXAMPLES: Record<string, string> = {
  installation: `npm install @afterfivespace/domet
# or
yarn add @afterfivespace/domet
# or
pnpm add @afterfivespace/domet`,
  "quick-start": `import { useDomet } from '@afterfivespace/domet';

function App() {
  const { active, register, link } = useDomet({
    ids: ['intro', 'features', 'docs'],
  });

  return (
    <div>
      <nav>
        <button {...link('intro')}>Intro</button>
        <button {...link('features')}>Features</button>
        <button {...link('docs')}>Docs</button>
      </nav>
      <section {...register('intro')}>Introduction</section>
      <section {...register('features')}>Features</section>
      <section {...register('docs')}>Documentation</section>
    </div>
  );
}`,
  "useDomet-hook": `const {
  active,     // Current active section ID
  index,      // Index of active section
  progress,   // Overall scroll progress (0-1)
  direction,  // 'up' | 'down' | null
  scroll,     // Detailed scroll state
  sections,   // Per-section state
  ids,        // Array of section IDs
  scrollTo,   // Navigate to section
  register,   // Register section element
  link,       // Create navigation button props
  navRef,     // Keep the active nav item in view
} = useDomet(options);`,
  options: `useDomet({
  ids: ['section-1', 'section-2'],
  // or
  selector: '[data-section]',

  container: containerRef,    // Custom scroll container

  tracking: {
    offset: 100,              // Trigger line offset (px or %)
    threshold: 0.6,           // Visibility threshold
    hysteresis: 150,          // Score margin to resist switching
  },

  scrolling: {
    behavior: 'smooth',       // Scroll behavior
  },

  onActive: (id, prevId) => {},
  onEnter: (id) => {},
  onLeave: (id) => {},
  onScrollStart: () => {},
  onScrollEnd: () => {},
});`,
  "custom-containers": `const containerRef = useRef<HTMLDivElement>(null);

const { active, register, link } = useDomet({
  ids: ['s1', 's2', 's3'],
  container: containerRef,
});

return (
  <div ref={containerRef} style={{ height: '400px', overflow: 'auto' }}>
    <section {...register('s1')}>Section 1</section>
    <section {...register('s2')}>Section 2</section>
    <section {...register('s3')}>Section 3</section>
  </div>
);`,
  callbacks: `useDomet({
  ids: sectionIds,
  onActive: (id, prevId) => {
    console.log(\`Active changed: \${prevId} → \${id}\`);
    analytics.track('section_view', { section: id });
  },
  onEnter: (id) => {
    console.log(\`Section entered: \${id}\`);
  },
  onLeave: (id) => {
    console.log(\`Section left: \${id}\`);
  },
  onScrollStart: () => {
    console.log('Scroll started');
  },
  onScrollEnd: () => {
    console.log('Scroll ended');
  },
});`,
  "table-of-contents": `function TableOfContents() {
  const { active, link, sections } = useDomet({
    ids: ['intro', 'features', 'api', 'examples'],
  });

  return (
    <nav className="toc">
      {['intro', 'features', 'api', 'examples'].map((id) => (
        <button
          key={id}
          {...link(id)}
          className={active === id ? 'active' : ''}
          style={{ opacity: 0.5 + (sections[id]?.visibility ?? 0) * 0.5 }}
        >
          {id}
        </button>
      ))}
    </nav>
  );
}`,
  "progress-indicator": `function ProgressIndicator() {
  const { progress, direction, scroll } = useDomet({
    ids: sectionIds,
  });

  return (
    <div className="progress-bar">
      <div
        className="progress-fill"
        style={{ width: \`\${progress * 100}%\` }}
      />
      <span>{direction === 'down' ? '↓' : direction === 'up' ? '↑' : '—'}</span>
      <span>{Math.round(progress * 100)}%</span>
    </div>
  );
}`,
  nextjs: `// app/section-nav.tsx
'use client';

import { useDomet } from '@afterfivespace/domet';

export function SectionNav() {
  const { ids, link } = useDomet({ selector: '[data-section]' });

  return (
    <nav>
      {ids.map((id) => (
        <button key={id} {...link(id)}>
          {id}
        </button>
      ))}
    </nav>
  );
}`,
  "css-selectors": `// Instead of passing IDs manually:
const { active, sections } = useDomet({
  selector: '[data-section]',
});

// All elements with data-section will be tracked
<section data-section id="intro">...</section>
<section data-section id="features">...</section>
<section data-section id="pricing">...</section>`,
};

type SectionBodyProps = {
  id: string;
  index: number;
  topics: number;
};

const SectionBody = memo(function SectionBody({
  id,
  index,
  topics,
}: SectionBodyProps) {
  const code = CODE_EXAMPLES[id];

  return (
    <>
      <Prose
        paragraphs={topics > 0 ? 1 : 2 + (index % 2)}
        start={index}
        className="mt-3"
      />
      {topics > 0 && (
        <p className="mt-3 text-sm text-subtle">
          {topics} topics in this chapter.
        </p>
      )}
      {code && (
        <pre className="no-scrollbar mt-4 overflow-x-auto rounded-lg border border-border bg-secondary px-4 py-3">
          <code>{code}</code>
        </pre>
      )}
    </>
  );
});

export function TreeView() {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(GROUP_IDS),
  );

  const { active, progress, direction, register, link, scrollTo, sections, navRef } =
    useDomet({
      ids: SECTION_IDS,
      tracking: { offset: "10%", hysteresis: 100 },
      scrolling: { offset: 16 },
      debug: true,
    });

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const activeSection = FLAT_SECTIONS.find((s) => s.id === active);

  const renderLink = (id: string, title: string, isParentActive = false) => {
    const isActive = active === id;
    const visibility = sections[id]?.visibility ?? 0;

    return (
      <button
        key={id}
        type="button"
        ref={navRef(id, { offset: 24 })}
        {...link(id)}
        className={cn(
          navItem(isActive),
          "flex min-w-0 flex-1 items-center justify-between gap-2",
          isParentActive && !isActive && "text-text",
        )}
      >
        <span className="truncate">{title}</span>
        <span
          aria-hidden
          className="size-1 shrink-0 rounded-full bg-text"
          style={{ opacity: visibility }}
        />
      </button>
    );
  };

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border md:flex">
        <div className="px-4 pb-3 pt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Domet Docs</span>
            <span className="font-mono text-xs tabular-nums text-subtle">
              {percent(progress)}{" "}
              {direction === "down" ? "↓" : direction === "up" ? "↑" : "·"}
            </span>
          </div>
        </div>
        <ProgressLine value={progress} />

        <nav
          aria-label="Documentation"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3"
        >
          {DOCUMENTATION_TREE.map((group) => {
            const isExpanded = expandedGroups.has(group.id);

            return (
              <div key={group.id}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${group.title}`}
                    onClick={() => toggleGroup(group.id)}
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md text-subtle hover:text-text",
                      focusRing,
                    )}
                  >
                    <ChevronRightIcon
                      aria-hidden
                      className={cn(
                        "transition-transform duration-200 ease-out-strong motion-reduce:transition-none",
                        isExpanded && "rotate-90",
                      )}
                    />
                  </button>
                  {renderLink(
                    group.id,
                    group.title,
                    activeSection?.parentId === group.id,
                  )}
                </div>
                {isExpanded && (
                  <div className="ml-3 flex flex-col border-l border-border pl-4">
                    {group.children?.map((child) =>
                      renderLink(child.id, child.title),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-border p-4">
          <Metric label="active">{active ?? "none"}</Metric>
          <Metric label="sections">{SECTION_IDS.length}</Metric>
        </div>
      </aside>

      <header className="sticky top-0 z-10 bg-background md:hidden">
        <div className="flex items-baseline justify-between gap-4 px-6 py-3 text-sm">
          <span className="truncate">{activeSection?.title ?? "Domet Docs"}</span>
          <span className="font-mono text-xs tabular-nums text-subtle">
            {percent(progress)}
          </span>
        </div>
        <ProgressLine value={progress} />
      </header>

      <main className="md:ml-64">
        <div className="mx-auto max-w-screen-md px-6 pb-24 pt-12">
          <header>
            <h1 className="text-lg">Domet Documentation</h1>
            <p className="mt-1 max-w-[65ch] text-subtle">
              A long page with nested sections. The tree follows the active
              section and keeps it in view inside the sidebar.
            </p>
          </header>

          {FLAT_SECTIONS.map(({ id, title, depth }, i) => {
            const state = sections[id];
            const Heading = depth === 0 ? "h2" : "h3";
            const group = DOCUMENTATION_TREE.find((g) => g.id === id);

            return (
              <section
                key={id}
                {...register(id)}
                className={
                  depth === 0 ? "mt-10 border-t border-border pt-10" : "mt-8"
                }
              >
                <div className="flex items-baseline justify-between gap-4">
                  <Heading className={depth === 0 ? "text-lg" : "text-base"}>
                    {depth === 0 && (
                      <span className="mr-3 font-mono text-xs tabular-nums text-subtle">
                        {String(GROUP_IDS.indexOf(id) + 1).padStart(2, "0")}
                      </span>
                    )}
                    {title}
                  </Heading>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-subtle">
                    {state?.active ? "active · " : ""}visible{" "}
                    {percent(state?.visibility)}
                  </span>
                </div>
                <SectionBody
                  id={id}
                  index={i}
                  topics={group?.children?.length ?? 0}
                />
              </section>
            );
          })}

          <footer className="mt-16 flex items-center justify-between border-t border-border pt-6 text-sm text-subtle">
            <span>{SECTION_IDS.length} sections</span>
            <button
              type="button"
              onClick={() => scrollTo(SECTION_IDS[0], { position: "top" })}
              className={secondaryButton}
            >
              Back to Top
            </button>
          </footer>
        </div>
      </main>
    </div>
  );
}
