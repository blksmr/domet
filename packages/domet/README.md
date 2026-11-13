# Domet

### Introduction

Domet is a lightweight React hook built for scroll-driven interfaces. Use it for classic scroll-spy, but also for progress indicators, lazy section loading, or any UI that needs reliable section awareness.

Lightweight under the hood: a tight scroll loop and hysteresis for stable, flicker-free section tracking.

For the source code, check out the [GitHub](https://github.com/blksmr/domet).

### Installation
Install the package from your command line. Requires React 18 or 19.

```bash
npm install @afterfivespace/domet
```

### Usage
Basic example of how to use the hook.

```tsx showLineNumbers
import { useDomet } from '@afterfivespace/domet'

const ids = ['intro', 'features', 'api']

function Page() {
  const { active, register, link } = useDomet({
    ids,
  })

  return (
    <>
      <nav>
        {ids.map(id => (
          <button key={id} {...link(id)}>
            {id}
          </button>
        ))}
      </nav>

      <section {...register('intro')}>...</section>
      <section {...register('features')}>...</section>
      <section {...register('api')}>...</section>
    </>
  )
}
```

### API Reference

### Options

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `ids` | `string[]` | — | Array of section IDs to track (mutually exclusive with selector) |
| `selector` | `string` | — | CSS selector to find sections (mutually exclusive with ids). With a container, only sections inside it are matched |
| `container` | `RefObject<HTMLElement \| null>` | `undefined` | React ref to scrollable container (defaults to window). Assumed stable for the lifetime of the hook — remount to change it |
| `tracking` | `TrackingOptions` | `undefined` | Tracking configuration (offset, threshold, hysteresis) |
| `scrolling` | `ScrollingOptions` | `undefined` | Default scroll behavior for link/scrollTo (behavior, offset, position, lockActive) |
| `onActive` | `(id: string \| null, prevId: string \| null) => void` | `undefined` | Called when active section changes |
| `onEnter` | `(id: string) => void` | `undefined` | Called when a section enters the viewport |
| `onLeave` | `(id: string) => void` | `undefined` | Called when a section leaves the viewport |
| `onScrollStart` | `() => void` | `undefined` | Called when scrolling starts |
| `onScrollEnd` | `() => void` | `undefined` | Called when scrolling stops (`scrollend` event, or after 100ms of inactivity where `scrollend` is unsupported) |
| `debug` | `boolean` | `false` | Show a floating debug panel to inspect the state and tune the options live |

`tracking.offset` and `scrolling.offset` serve different purposes:
- **`tracking.offset`**: Defines the trigger line position (where section detection happens). A value of `100` means the line sits 100px from the top of the viewport. Sections crossing this line are candidates for "active".
- **`scrolling.offset`**: Only affects programmatic scrolling (`link`/`scrollTo`). It shifts where the section lands after navigation. Has no effect on detection.

Tracking defaults are `offset: 0`, `threshold: 0.6`, and `hysteresis: 150`. Recalculations run at most once per animation frame. When no section is in view (a tall footer, or a gap between two sections), the closest section above the viewport stays active; before the first section, the closest one below is used. `scrolling.behavior` defaults to `auto`, which resolves to `smooth` unless `prefers-reduced-motion` is enabled (then `instant`).

IDs are sanitized: non-strings, empty values, and duplicates are ignored. Passing both `ids` and `selector` logs a warning in development; `selector` is ignored.

All tracking values are validated at runtime. Out-of-range values are clamped with a development warning. Invalid types (e.g. passing a boolean as offset) fall back to the default value.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `offset (px)` | `-10000 to 10000` | `0` | Pixel offset from the top of the viewport |
| `offset (%)` | `-500% to 500%` | `0` | Percentage of viewport height |
| `threshold` | `0 to 1` | `0.6` | Minimum visibility ratio for high-score detection |
| `hysteresis` | `0 to 1000` | `150` | Score margin required to switch active section |

The same limits are exported as `VALIDATION_LIMITS`, for example to validate a settings form before passing values to the hook:

```ts
import { VALIDATION_LIMITS } from '@afterfivespace/domet'
const { min, max } = VALIDATION_LIMITS.hysteresis // 0 and 1000
```

### Callbacks

| Prop | Type | Description |
|------|------|-------------|
| `onActive` | `(id: string \| null, prevId: string \| null) => void` | Called when active section changes |
| `onEnter` | `(id: string) => void` | Called when a section enters the viewport |
| `onLeave` | `(id: string) => void` | Called when a section leaves the viewport |
| `onScrollStart` | `() => void` | Called when scrolling starts |
| `onScrollEnd` | `() => void` | Called when scrolling stops |

When `lockActive` is enabled during a programmatic scroll, `onActive` fires as soon as the target section becomes active, while `onEnter` and `onLeave` are held until the scroll completes and then fire for the sections that entered or left the viewport. `onScrollStart` and `onScrollEnd` still fire normally.

After a programmatic scroll, the target section stays active until the user scrolls again, even where another section would win at that position.

`onActive` also fires when the active section disappears (its id leaves `ids`, or its element no longer matches `selector`): the first remaining section becomes active, or `null` if none is left. The first active section, set on mount or when the first section is resolved, is not reported. `onScrollEnd` fires on the native `scrollend` event, or after `100` ms of scroll inactivity in browsers without `scrollend`.

### Return Value

| Prop | Type | Description |
|------|------|-------------|
| `active` | `string \| null` | ID of the currently active section |
| `index` | `number` | Index of the active section in ids (-1 if none) |
| `progress` | `number` | Overall scroll progress (0-1), shortcut for scroll.progress |
| `direction` | `'up' \| 'down' \| null` | Scroll direction, shortcut for scroll.direction |
| `ids` | `string[]` | Resolved section IDs (useful with CSS selector) |
| `scroll` | `ScrollState` | Full scroll state object |
| `sections` | `Record<string, SectionState>` | Per-section state indexed by ID |
| `register` | `(id: string) => RegisterProps` | Props to spread on section elements (includes id, ref, data-domet) |
| `link` | `(id: string, options?: ScrollToOptions) => LinkProps` | Nav props (onClick, aria-current, data-active) with optional scroll overrides |
| `navRef` | `(id: string, options?: NavRefOptions) => (el: HTMLElement \| null) => void` | Ref callback for nav items; scrolls the nearest scrollable ancestor of the active item to keep it visible. The page and the tracked container are never scrolled |
| `scrollTo` | `(target: ScrollTarget, options?: ScrollToOptions) => void` | Programmatically scroll to a section or absolute scroll position |

The component re-renders on scroll only when a value it reads changes. A component that reads `active` but not `scroll`, `progress`, `direction`, or `sections` does not re-render on every frame. Spreading the return value reads every field. Values read outside render (event handlers, effects) are always current, and reading a field subscribes the component to it.

Cached section positions are refreshed when a section or the container is resized, or when the scrollable height changes.

### useElementScroll

A standalone hook, independent from section tracking, that scrolls any rendered element into view.

```tsx
const { scrollTo } = useElementScroll({ behavior: 'auto', position: 'center' })
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `behavior` | `'smooth' \| 'instant' \| 'auto'` | `'auto'` | Scroll animation ('auto' respects prefers-reduced-motion) |
| `position` | `'top' \| 'center' \| 'bottom'` | `'center'` | Vertical alignment of the element |

| Prop | Type | Description |
|------|------|-------------|
| `scrollTo` | `(target: ElementScrollTarget, options?: ElementScrollOptions) => void` | Scroll an element or a resolved element into view, with optional per-call overrides |

### Types

### TrackingOptions

Options that control tracking behavior.

```ts showLineNumbers
type TrackingOptions = {
  offset?: number | `${number}%`
  threshold?: number
  hysteresis?: number
}
```

Defaults: `offset: 0`, `threshold: 0.6`, `hysteresis: 150`.

### ScrollingOptions

Defaults for programmatic scrolling (link/scrollTo).

```ts showLineNumbers
type ScrollingOptions = {
  behavior?: 'smooth' | 'instant' | 'auto'
  offset?: number | `${number}%`
  position?: 'top' | 'center' | 'bottom'
  lockActive?: boolean
}
```

If `position` is omitted for ID targets, Domet uses a dynamic alignment that keeps the trigger line within the section and prefers centering sections that fit in the viewport. Prefer this default when sections are shorter than the viewport: with `position: "top"`, a short section can sit at the top while the trigger line is already inside the next one. The first section scrolls to the very top and the last section to the very bottom, as long as the section stays visible there. When `position: "center"` is set, sections that fit in the viewport are centered; sections taller than the viewport align to the top instead (respecting `scrolling.offset`).

### NavRefOptions

Options for customizing nav item auto-scrolling behavior.

```ts showLineNumbers
type NavRefOptions = {
  behavior?: 'smooth' | 'instant' | 'auto'
  offset?: number
  position?: 'nearest' | 'center' | 'start' | 'end'
}
```

- `behavior`: Scroll animation (`'auto'` respects `prefers-reduced-motion`). Default: `'auto'`.
- `offset`: Pixel offset from container edge when scrolling nav items. Default: `0`.
- `position`: Vertical alignment within the scrollable container. Default: `'nearest'`. Horizontal navs always use `'nearest'`.

### ScrollState

Global scroll information updated on every scroll event.

```ts showLineNumbers
type ScrollState = {
  y: number                        // Current scroll position in pixels
  progress: number                 // Overall scroll progress (0-1)
  direction: 'up' | 'down' | null  // Scroll direction (null when idle)
  velocity: number                 // Scroll speed in px/ms, rounded (0 when idle)
  scrolling: boolean               // True while actively scrolling
  maxScroll: number                // Maximum scroll value
  viewportHeight: number           // Viewport height in pixels
  trackingOffset: number           // Effective tracking offset
  triggerLine: number              // Dynamic trigger line position in viewport
}
```

### SectionState

Per-section state available for each tracked section. `visibility` and `progress` are rounded to 2 decimals.

```ts showLineNumbers
type SectionState = {
  bounds: SectionBounds  // Position and dimensions
  visibility: number     // Visibility ratio (0-1)
  progress: number       // Section scroll progress (0-1)
  inView: boolean        // True if any part is visible
  active: boolean        // True if this is the active section
  rect: DOMRect | null   // Full bounding rect
}

type SectionBounds = {
  top: number
  bottom: number
  height: number
}
```

### ScrollTarget

Target input for programmatic scrolling.

```ts showLineNumbers
type ScrollTarget =
  | string
  | { id: string }
  | { top: number }  // Absolute scroll position in px (scrolling.offset is subtracted)
```

### ScrollToOptions

Options for programmatic scrolling. Use `scrolling` in the hook options for defaults, and pass overrides to `link` or `scrollTo`.

```ts showLineNumbers
type ScrollToOptions = {
  offset?: number | `${number}%`            // Override scroll target offset (applies to id/top targets)
  behavior?: 'smooth' | 'instant' | 'auto'  // Override scroll behavior
  position?: 'top' | 'center' | 'bottom'    // Section alignment for ID targets only
  lockActive?: boolean                      // Lock active section during programmatic scroll
}
```

By default, `lockActive` is enabled for id targets and disabled for `{ top }`.

If `scrollTo` is called with an unknown ID or an element that is not yet mounted, a development warning is logged and the call is ignored. Invalid `top` values (non-finite numbers) are also rejected with a warning.

### ElementScrollOptions

Options for `useElementScroll`, as hook defaults or per-call overrides.

```ts showLineNumbers
type ElementScrollOptions = {
  behavior?: 'smooth' | 'instant' | 'auto'
  position?: 'top' | 'center' | 'bottom'
}

type ElementScrollTarget = HTMLElement | (() => HTMLElement | null | undefined)
```

### Examples

### With Callbacks

React to section changes with callbacks for analytics, animations, or state updates:

```tsx showLineNumbers
const { active } = useDomet({
  ids: ['intro', 'features', 'api'],
  onActive: (id, prevId) => {
    console.log(`Changed from ${prevId} to ${id}`)
  },
  onEnter: (id) => {
    console.log(`Entered: ${id}`)
  },
})
```

### Using Scroll State

Build progress indicators and scroll-driven animations using the scroll state:

```tsx showLineNumbers
const { progress, sections, ids } = useDomet({
  ids: ['intro', 'features', 'api'],
})

// Global progress bar
<div style={{ width: `${progress * 100}%` }} />

// Per-section animations
{ids.map(id => (
  <div style={{ opacity: sections[id]?.visibility }} />
))}
```

### Default Scrolling Options

Define default scroll behavior for links and override per click:

```tsx showLineNumbers
const { link } = useDomet({
  ids: ['intro', 'details'],
  scrolling: { position: 'top', behavior: 'smooth' },
})

<button {...link('intro')}>Intro</button>
<button {...link('details', { behavior: 'instant', offset: 100 })}>Details</button>
```

### Custom Container

Track scroll within a specific container instead of the window:

```tsx showLineNumbers
const containerRef = useRef<HTMLDivElement>(null)

const { active, register } = useDomet({
  ids: ['s1', 's2'],
  container: containerRef,
})

return (
  <div ref={containerRef} style={{ height: '100vh', overflow: 'auto' }}>
    <section {...register('s1')}>Section 1</section>
    <section {...register('s2')}>Section 2</section>
  </div>
)
```

### Scrollable Navigation

Keep the active nav item visible in a scrollable navigation container. The `navRef` function accepts optional scroll options for smooth animations and consistent offset:

```tsx showLineNumbers
const { link, navRef } = useDomet({ ids })

return (
  <nav style={{ maxHeight: '200px', overflow: 'auto' }}>
    {ids.map(id => (
      <button
        key={id}
        ref={navRef(id, { behavior: 'smooth', offset: 16 })}
        {...link(id)}
      >
        {id}
      </button>
    ))}
  </nav>
)
```

### Scroll an Arbitrary Element

`useElementScroll` scrolls any rendered element into view, letting the browser move every nested scrollable ancestor as needed:

```tsx showLineNumbers
import { useRef } from 'react'
import { useElementScroll } from '@afterfivespace/domet'

function Form() {
  const fieldRef = useRef<HTMLDivElement>(null)
  const { scrollTo } = useElementScroll({ position: 'center' })

  const showField = () => {
    scrollTo(() => fieldRef.current)
  }

  return <div ref={fieldRef}>...</div>
}
```

The target can be an element or a resolver. Resolver evaluation starts on the next animation frame and briefly retries an unresolved target, which is useful when React renders it in response to the same event. A newer request cancels any pending request.

### Debug Mode

Turn on `debug` while you build to see what the hook is doing and to tune it without editing code:

```tsx showLineNumbers
const { active, register, link } = useDomet({
  ids: ['intro', 'features', 'api'],
  debug: process.env.NODE_ENV !== 'production',
})
```

A round button appears at the bottom right of the page. It opens a panel, which also works on touch screens, with:

- **State**: the active section, progress, direction, velocity and trigger line position, updated as you scroll.
- **Tracking** and **Scrolling**: `offset`, `threshold`, `hysteresis`, `behavior`, `position` and `lockActive`. A change applies at once and overrides the option passed in code for as long as debug is on. Reset returns to your options.
- **Overlays**: drawn on the page. Trigger Line shows the line the hook measures against and Section Outlines frames the tracked sections. Section Scores shows why the active section is the active one: every section in view is tinted by its score and labelled with what that score is made of (visibility, trigger line, distance to the line) and the score it has to beat to take over.
- **Sections**: the tracked sections and how much of each is visible. Select one to scroll to it.
- **Events**: the callbacks as they fire.
- **Copy Options**: copy the current `tracking` and `scrolling` values, ready to paste into the hook.

The panel is loaded on demand, so it adds nothing to your bundle when `debug` is off. When the tracked `container` sits inside a modal `<dialog>`, the panel moves into that dialog so it stays reachable.

### Third-party Components

If a third-party component only accepts a `ref` prop (no spread), extract the ref from `register`:

```tsx
<ThirdPartyComponent ref={register('section-1').ref} />
```

### CSS Selector for Sections

Instead of passing an array of IDs, you can use the `selector` prop to automatically find sections. Elements added to or removed from the DOM are picked up automatically:

```tsx showLineNumbers
const { active, ids } = useDomet({
  selector: '[data-section]',  // CSS selector
})

// ids will contain IDs from:
// 1. element.id
// 2. data-domet attribute
// 3. fallback: section-0, section-1, etc.
```

### Fine-tuning Behavior

Adjust sensitivity and stability of section detection:

```tsx showLineNumbers
useDomet({
  ids: ['intro', 'features'],
  tracking: {
    threshold: 0.8,    // Require 80% visibility
    hysteresis: 200,   // More resistance to switching
  },
})
```

### Why domet?

This library grew out of repetition. As a freelancer, I kept rewriting the same scroll-tracking hooks by hand, project after project. I wanted a scroll-spy solution that was powerful and completely headless, but above all, extremely lightweight. No bloated dependencies, no opinionated styling, just a hook that does one thing well.

Most scroll-spy libraries ship with their own components, their own CSS, their own opinions about your DOM structure. You end up fighting the library instead of building your UI. Override this class, wrap that element, pass a `renderItem` prop just to change a `<div>` into a `<button>`. It's exhausting. Headless means none of that. You get raw data — which section is active, how far you've scrolled, what's in view — and you do whatever you want with it. Your markup, your styles, your framework, zero compromises.

Why a hook instead of a component wrapper? Because hooks give you full control. You decide the markup, the styling, and the behavior. If you want a `<ScrollSpy>` component, you can build one in minutes on top of `useDomet`. The hook stays minimal; you compose what you need.

The name **domet** comes from Bosnian/Serbian/Croatian and means "reach" or "range" — the distance something can cover. Pronounced `/ˈdɔ.met/`: stress on the first syllable, open "o", and a hard "t" at the end.

### Support

For issues or feature requests, open an issue on [GitHub](https://github.com/blksmr/domet).

For LLMs, the full documentation is available at [/llms.txt](./website/public/llms.txt).

You can also reach out to me on [Twitter](https://x.com/blkasmir).
