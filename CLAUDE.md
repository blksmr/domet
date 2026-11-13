# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

domet is a React scroll-spy hook library. The monorepo contains:
- `packages/domet`: The npm package, published as `@afterfivespace/domet` (`useDomet` for scroll tracking, `useElementScroll` to scroll any element into view)
- `website`: Next.js documentation site using Fumadocs, with live examples under `/examples/*`

## Commands

### Root (Turborepo)
```bash
npm run dev          # Run all dev servers
npm run build        # Build all packages
npm run lint         # Lint all packages
npm run typecheck    # Typecheck all packages
npm run test         # Run all tests
npm run release      # Lint, typecheck, test, build, check size, then publish domet
```

### Package: domet
```bash
cd packages/domet
npm run build        # Compile TypeScript
npm run dev          # Watch mode
npm test             # Run Vitest tests
npm test -- --watch  # Watch mode
npm test -- scoring.test.ts  # Single test file
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint check (lint:fix to apply fixes)
```

### Website
```bash
cd website
npm run dev          # Next.js dev with Turbopack
npm run build        # Production build
npm run typecheck    # tsc --noEmit
```

The website imports `@afterfivespace/domet` from `packages/domet/dist`: rebuild the package (`npm run build -w packages/domet`) to see library changes in the examples.

CI (`.github/workflows/ci.yml`) runs lint, build, typecheck, tests and the size check, plus the tests against React 19.

## Architecture

### Source Layout (`packages/domet/src`)

- `useDomet/index.ts`: public hook, wires the four internal hooks and the store
- `useDomet/hooks/useSectionResolver.ts`: resolves sections from `ids` (refs) or `selector` (MutationObserver)
- `useDomet/hooks/useScrollDetection.ts`: scroll, resize and `scrollend` listeners, active section, callbacks
- `useDomet/hooks/useProgrammaticScroll.ts`: `scrollTo`, active lock during programmatic scrolls
- `useDomet/hooks/useNavAutoScroll.ts`: `navRef`, scrolls the nav container only
- `useDomet/store.ts`: external store, per-field render tracking, on-demand `sections`
- `useElementScroll/index.ts`: standalone hook
- `debug/`: the panel behind the `debug` option. Plain DOM in a shadow root, no React, loaded with a dynamic `import()` so it stays out of the core bundle. It must not import runtime code from the rest of `src` (types only): a shared import would make the bundler split the entry file. `debug/explain.ts` therefore mirrors the scoring rules of `utils/scoring.ts`; `__tests__/debug.explain.test.ts` fails when the two drift apart, so update both together
- `utils/`: scoring, resolvers, validation (pure functions)

### Hook Algorithm (`src/useDomet/`, `src/utils/scoring.ts`)

The hook uses a **scoring system** to determine the active section:
1. **Visibility score**: Sections with >60% visibility get bonus points
2. **Trigger line proximity**: Sections crossing the trigger line (offset from top) get priority
3. **Hysteresis**: A 150-point margin prevents rapid switching between sections
4. **Edge cases**: Top/bottom of page forces first/last section active
5. **No section in view**: The closest section above the viewport stays active (the closest below if none)
6. **After a programmatic scroll**: The target stays active until the scroll position changes again

Key constants (`constants.ts`):
- `DEFAULT_THRESHOLD = 0.6` (60% visibility required for high score)
- `DEFAULT_HYSTERESIS = 150` (score difference needed to switch sections)

### Performance

- `requestAnimationFrame` for smooth 60fps updates
- At most one recalculation per animation frame
- Scroll state lives in an external store (`useSyncExternalStore`); a component re-renders only for the fields it reads, and `sections` is built on demand
- Refs stored in `useRef` to avoid re-renders
- `useMemo` for stable section ID arrays
- The container ref is assumed stable for the lifetime of the hook; remount the hook to change it

### Bundle Size

`npm run size -w packages/domet` checks two budgets: the core (`dist/es/index.mjs`, 7 kB) and the debug panel chunk (8 kB). The core is close to its limit: keep debug-related code in `src/debug/`, not in the hooks.

## Package Exports

```typescript
import { useDomet, useElementScroll, VALIDATION_LIMITS } from '@afterfivespace/domet';
import type { DometOptions, UseDometReturn } from '@afterfivespace/domet';
```

## Testing

Tests use Vitest with jsdom. Mock `ResizeObserver` and `getBoundingClientRect` for scroll simulation (helpers in `src/__tests__/helpers.tsx`). jsdom declares `onscrollend` but never fires it: dispatch `scrollend` manually.

## Code Style Rules

### Error and Warning Messages

All user-facing messages (console warnings, error messages, UI feedback) must follow these rules:

1. **Language**: Always in English
2. **Format**: Simple, clear, and consistent
3. **Structure**: `[context] Description.` or just `Description.`
4. **Examples**:
   - Console: `[domet] Invalid offset value: ${value}. Using default.`
   - UI: `Invalid format. Use a number (e.g. 100) or percentage (e.g. 10%).`
   - UI: `Value clamped to ±${max}px.`

**Do NOT**:
- Use French or other languages
- Use jargon or overly technical terms
- Write long sentences

## Documentation Rules

In `website/content/documentation.mdx`:

1. **API changes require documentation**: ALWAYS update docs when adding/removing/modifying API (options, return values, types, callbacks). No API change ships without doc update.

2. **Examples need descriptions**: In section `## Examples`, when adding an example with a title, always include a brief description. Never just a title alone.

3. **Line numbers in code blocks**:
   - 2 lines or less: no `showLineNumbers`
   - More than 2 lines: add `showLineNumbers`

**Example (description rule):**
```markdown
### CSS Selector for Sections
Instead of passing an array of IDs, you can use a CSS selector to automatically find sections:
```

**Example (line numbers rule):**
```markdown
≤2 lines → ```tsx
>2 lines → ```tsx showLineNumbers
```

## Website Examples

Examples live in `website/components/examples/<Name>/index.tsx`, each with a page in `website/app/examples/<name>/page.tsx` and an entry in `EXAMPLES` (`website/components/HeaderMenu.tsx`). Only `Basic` is embedded in the documentation. Each example shows one capability; do not add an example that an existing one already covers.

- `Basic`: `register`, `link`, scroll state
- `Debug`: the `debug` option and its panel
- `DynamicOffset`: `tracking.offset` following a resizing header
- `ElementScroll`: `useElementScroll`
- `ModalForm`: `container` inside a dialog
- `Reveal`: `sections[id].visibility` driving a reveal
- `TreeView`: long nested navigation with `navRef`

Rules for examples:

1. **Same look as the site**: use the theme tokens only (`text`, `subtle`, `muted`, `border`, `field`, `danger`, `secondary`, `background`) and the type scale (`text-xs` to `text-lg`). No other colors, no emoji icons.
2. **Shared pieces**: reuse `website/components/examples/shared.tsx` (focus ring, nav item, inputs, buttons, `Prose`, `Metric`, `ProgressLine`).
3. **No `transition-delay`**: no `transitionDelay`, no `delay-*` class, no staggered reveal.
4. **No transition on values that change every frame** (progress, visibility): set them directly.
5. **A redesign changes the look, not the behavior**: keep what the example computes and how it reacts.
6. **Headings**: `styles/main.css` adds a top margin to any heading that is neither first nor last child. Keep headings first in their wrapper.
7. Check every example at 320, 375, 768, 1024 and 1440 px wide.
8. Every example that calls `useDomet` sets `debug: true`. Keep the bottom right corner free: the debug button sits there, 16 px from both edges.

## Auto-Generated Files (DO NOT EDIT)

The following files are auto-generated by `scripts/documentation.ts` from `website/content/documentation.mdx`:

- `README.md`
- `website/public/llms.txt`
- `packages/domet/README.md`
- `website/config/site.ts` (only `APP_NAME` and `APP_DESCRIPTION` from frontmatter)

**NEVER modify these files directly.** Edit `website/content/documentation.mdx` instead, then run the sync script.
