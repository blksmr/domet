# Changelog

All notable changes to this project will be documented in this file.

## [1.1.5] - 2025-01-18

### Added

- `navRef` scroll options: `behavior`, `offset`, and `position` for fine-grained control over navigation auto-scroll

## [1.1.4] - 2025-01-16

### Added

- Section position caching for improved scroll detection performance
- `clean` script for build management

### Fixed

- Remove unused parameters in scoring functions

## [1.1.3] - 2025-01-14

### Added

- `navRef` callback for automatic navigation element scrolling when active section changes
- `startTransition` for smoother state updates during scroll

### Fixed

- Scroll direction now resets to `null` when scrolling stops

## [1.1.2] - 2025-01-12

### Added

- `navRef` for improved navigation tracking
- Equality checks for scroll states and sections to reduce unnecessary re-renders

## [1.1.1] - 2025-01-11

_Patch release with internal fixes._

## [1.1.0] - 2025-01-10

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

## [1.0.0] - 2025-01-01

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
