# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-11-13

### Breaking

- Removed `tracking.throttle`. The active section is recalculated at most once per animation frame.
- `onActive` fires as soon as `scrollTo` or `link` changes the active section. `onEnter` and `onLeave` fire when the locked scroll ends.
- When no section is in view, the closest section above the viewport stays active (the closest below if there is none). The first section used to take over.
- `navRef` only scrolls the scrollable ancestor of the navigation, never the page or the tracked container. `position` applies to the vertical axis.
- `selector` only matches elements inside `container` when a container is set.

### Added

- `useElementScroll`, a standalone hook that scrolls any element into view, with the `ElementScrollOptions`, `ElementScrollTarget` and `UseElementScrollReturn` types.
- `debug` option: a floating panel, loaded on demand, that shows the live state, applies `tracking` and `scrolling` changes as you make them, and draws the trigger line, the section outlines and the section scores on the page.
- `onActive` also fires when the active section disappears (its id leaves `ids`, or its element stops matching `selector`).

### Changed

- Scroll state lives in an external store: a component re-renders only when a value it reads changes, and `sections` is built on demand.
- Section positions are measured again when a section or the container is resized, or when the page height changes.
- `onScrollEnd` uses the native `scrollend` event, with the 100 ms idle delay as a fallback.
- After a locked `scrollTo` or `link`, the target stays active until the scroll position changes.
- Changing `tracking.threshold` or `tracking.hysteresis` re-evaluates the active section on the next frame, without waiting for a scroll.
- `scrollTo` without a `position` scrolls the first section to the very top and the last one to the very bottom.
- In `selector` mode, a section added after mount is tracked without waiting for a scroll, and a section removed from the DOM is dropped at once.
- Bundle size budget: 7 kB for the core, 8 kB for the debug panel chunk.

### Fixed

- A `scrollTo` that is ignored (unknown id, element not mounted) no longer blocks tracking.
- `scroll.direction` and `scroll.velocity` reset when scrolling stops.
- `scroll` stays up to date when no section is resolved, and values read outside render are current.
- An id removed from `ids` and added back while its element stays mounted is tracked again.
- `selector` mode no longer re-renders when the DOM changes without changing the matched sections.
- `selector` is ignored when `ids` is also provided, as the warning says. It used to take over.

### Internal

- Tests are versioned (127 tests, including real server rendering, plus a React 19 run in CI). Playwright removed.
- CI workflow: lint, build, typecheck, tests and size check.
- `npm run publish` replaced by `npm run release`, which no longer bumps the version.

## [1.2.1] - 2026-06-03

### Performance

- Eliminate per-frame allocations in the scroll hot path: removed the per-frame `Map` in `determineActiveSection`, fused `getSectionBoundsFromCache` into `calculateSectionScores` (single pass over the position cache), and deferred `DOMRect` construction to the sections-state path. Steady-state frames now allocate zero rects. ~3-4x throughput on a 100-section frame with lower mean and GC-tail latency. No behavior change.

## [1.2.0] - 2026-02-05

### Added

- React 19 support (`react@^18.0.0 || ^19.0.0`)
- Dev-only runtime warning when both `ids` and `selector` are provided
- Bundle size tracking with size-limit (5.32 kB / 7 kB budget)
- Robustness tests for cleanup, SSR, StrictMode, and dynamic DOM (76 total tests)

### Changed

- Decomposed monolithic `useDomet` hook into 4 focused internal hooks (`useSectionResolver`, `useScrollDetection`, `useProgrammaticScroll`, `useNavAutoScroll`). No public API changes.
- Replaced `rm -rf` clean script with cross-platform `rimraf`

### Removed

- Unused `tracking.ts` utility module

## [1.1.5] - 2026-02-05

### Added

- `navRef` scroll options: `behavior`, `offset`, and `position` for fine-grained control over navigation auto-scroll

## [1.1.4] - 2026-01-19

### Added

- Section position caching for improved scroll detection performance
- `clean` script for build management

### Fixed

- Remove unused parameters in scoring functions

## [1.1.3] - 2026-01-18

### Added

- `navRef` callback for automatic navigation element scrolling when active section changes
- `startTransition` for smoother state updates during scroll

### Fixed

- Scroll direction now resets to `null` when scrolling stops

## [1.1.2] - 2026-01-17

### Added

- `navRef` for improved navigation tracking
- Equality checks for scroll states and sections to reduce unnecessary re-renders

## [1.1.1] - 2026-01-11

_Patch release with internal fixes._

## [1.1.0] - 2026-01-07

### Added

- Separate `tracking` and `scrolling` option groups (replaces flat config)
- `register()` helper for section ref binding
- `link()` helper for navigation links with `aria-current` and `data-active`
- CSS selector mode (`selector` option) as alternative to `ids`
- Utility functions for scroll container and section resolution
- TickIndicator and TreeView demo components

### Changed

- Renamed `offset` to `tracking.offset` for clarity
- Restructured API options into `TrackingOptions` and `ScrollingOptions`

## [1.0.0] - 2026-01-05

### Added

- Initial stable release
- `useDomet` hook for scroll-spy tracking
- Scoring system with visibility threshold, trigger line proximity, and hysteresis
- Smooth scroll navigation with `scrollTo()`
- Configurable offset, threshold, hysteresis, and throttle
- Container scroll support via `container` ref
- Callbacks: `onActive`, `onEnter`, `onLeave`, `onScrollStart`, `onScrollEnd`
- Full TypeScript support
- `"use client"` directive for Next.js compatibility
