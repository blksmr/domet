import React, { useRef } from "react";
import { act, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { useDomet } from "../useDomet";
import type { DometOptions, UseDometReturn } from "../types";

export function rect(top: number, height: number, left = 0, width = 0): DOMRect {
  return {
    x: left,
    y: top,
    top,
    bottom: top + height,
    left,
    right: left + width,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

export function define(element: HTMLElement, props: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(element, key, { value, configurable: true, writable: true });
  }
}

export function setScrollMetrics(
  element: HTMLElement,
  clientHeight: number,
  scrollHeight: number,
): void {
  define(element, {
    clientHeight,
    scrollHeight,
    scrollTop: 0,
    getBoundingClientRect: () => rect(0, clientHeight),
  });
}

export function placeSections(
  container: HTMLElement,
  layout: Array<[top: number, height: number]>,
): void {
  const sections = container.querySelectorAll<HTMLElement>("[data-domet]");
  sections.forEach((section, i) => {
    const [top, height] = layout[i];
    define(section, {
      getBoundingClientRect: () => rect(top - container.scrollTop, height),
    });
  });
}

export function scrollFrame(container: HTMLElement, y: number): void {
  act(() => {
    container.scrollTop = y;
    container.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(20);
  });
}

export function endScroll(container: HTMLElement): void {
  act(() => {
    container.dispatchEvent(new Event("scrollend"));
    vi.advanceTimersByTime(20);
  });
}

export function userScroll(container: HTMLElement, y: number): void {
  scrollFrame(container, y);
  endScroll(container);
}

export class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

type HarnessOptions = {
  ids: string[];
  layout: Array<[top: number, height: number]>;
  viewport: number;
  scrollHeight: number;
  hook?: Omit<Partial<DometOptions>, "ids" | "selector" | "container">;
  children?: (api: UseDometReturn) => React.ReactNode;
};

export function renderDomet({
  ids,
  layout,
  viewport,
  scrollHeight,
  hook,
  children,
}: HarnessOptions) {
  let latest: UseDometReturn | null = null;
  let renderCount = 0;

  function Harness() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const api = useDomet({ ids, container: containerRef, ...hook });
    latest = api;
    renderCount++;
    return (
      <div ref={containerRef} data-testid="container">
        <output data-testid="active">{String(api.active)}</output>
        {children?.(api)}
        {ids.map((id) => (
          <div key={id} {...api.register(id)} />
        ))}
      </div>
    );
  }

  render(<Harness />);
  const container = screen.getByTestId("container");
  setScrollMetrics(container, viewport, scrollHeight);
  placeSections(container, layout);
  const scrollToSpy = vi.fn();
  container.scrollTo = scrollToSpy as unknown as typeof container.scrollTo;
  act(() => {
    vi.runAllTimers();
  });

  return {
    container,
    scrollToSpy,
    api: () => latest as UseDometReturn,
    renders: () => renderCount,
    active: () => screen.getByTestId("active").textContent,
  };
}

export const THREE_SECTIONS = {
  ids: ["a", "b", "c"],
  layout: [
    [0, 500],
    [500, 500],
    [1000, 500],
  ] as Array<[number, number]>,
  viewport: 400,
  scrollHeight: 1500,
};
