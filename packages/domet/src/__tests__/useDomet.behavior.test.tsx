import React, { useRef, useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDomet } from "../useDomet";
import { useElementScroll } from "../useElementScroll";

function rect(top: number, height: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    bottom: top + height,
    left: 0,
    right: 0,
    width: 0,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function setContainerMetrics(
  container: HTMLElement,
  clientHeight: number,
  scrollHeight: number,
): void {
  let scrollTop = 0;
  Object.defineProperty(container, "clientHeight", { value: clientHeight, configurable: true });
  Object.defineProperty(container, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(container, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
  });
  Object.defineProperty(container, "getBoundingClientRect", {
    configurable: true,
    value: () => rect(0, clientHeight),
  });
}

function setSectionTop(section: HTMLElement, getTop: () => number, height: number): void {
  Object.defineProperty(section, "getBoundingClientRect", {
    configurable: true,
    value: () => rect(getTop(), height),
  });
}

let resizeCallbacks: ResizeObserverCallback[] = [];

class MockResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallbacks.push(callback);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.useFakeTimers();
  resizeCallbacks = [];
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useDomet render tracking", () => {
  it("does not re-render when only untracked scroll values change", () => {
    const renders = { activeOnly: 0, scrollY: 0 };

    function ActiveOnly() {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const { active, register } = useDomet({ ids: ["a", "b"], container: containerRef });
      renders.activeOnly++;
      return (
        <div ref={containerRef} data-testid="active-only">
          <span>{active}</span>
          <div {...register("a")} />
          <div {...register("b")} />
        </div>
      );
    }

    function ScrollY() {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const { scroll, register } = useDomet({ ids: ["a", "b"], container: containerRef });
      renders.scrollY++;
      return (
        <div ref={containerRef} data-testid="scroll-y">
          <span data-testid="y">{scroll.y}</span>
          <div {...register("a")} />
          <div {...register("b")} />
        </div>
      );
    }

    render(
      <>
        <ActiveOnly />
        <ScrollY />
      </>,
    );

    for (const testId of ["active-only", "scroll-y"]) {
      const container = screen.getByTestId(testId);
      setContainerMetrics(container, 100, 1000);
      const [a, b] = container.querySelectorAll<HTMLElement>("[data-domet]");
      setSectionTop(a, () => -container.scrollTop, 500);
      setSectionTop(b, () => 500 - container.scrollTop, 500);
    }

    act(() => { vi.runAllTimers(); });
    const before = { ...renders };

    for (const testId of ["active-only", "scroll-y"]) {
      const container = screen.getByTestId(testId);
      act(() => {
        container.scrollTop = 40;
        container.dispatchEvent(new Event("scroll"));
        vi.advanceTimersByTime(20);
      });
    }

    expect(screen.getByTestId("y").textContent).toBe("40");
    expect(renders.scrollY).toBeGreaterThan(before.scrollY);
    expect(renders.activeOnly).toBe(before.activeOnly);
  });
});

describe("useDomet layout changes", () => {
  it("recomputes cached positions when a section is resized", () => {
    let firstHeight = 500;

    function Component() {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const { active, register } = useDomet({ ids: ["a", "b"], container: containerRef });
      return (
        <div ref={containerRef} data-testid="container">
          <span data-testid="active">{active}</span>
          <div {...register("a")} />
          <div {...register("b")} />
        </div>
      );
    }

    render(<Component />);
    const container = screen.getByTestId("container");
    setContainerMetrics(container, 100, 1000);
    const [a, b] = container.querySelectorAll<HTMLElement>("[data-domet]");
    Object.defineProperty(a, "getBoundingClientRect", {
      configurable: true,
      value: () => rect(-container.scrollTop, firstHeight),
    });
    setSectionTop(b, () => firstHeight - container.scrollTop, 1000 - firstHeight);

    act(() => {
      container.scrollTop = 200;
      container.dispatchEvent(new Event("scroll"));
      vi.runAllTimers();
    });
    expect(screen.getByTestId("active").textContent).toBe("a");

    firstHeight = 100;
    act(() => {
      for (const callback of resizeCallbacks) {
        callback([], {} as ResizeObserver);
      }
      vi.runAllTimers();
    });

    expect(screen.getByTestId("active").textContent).toBe("b");
  });
});

describe("useDomet scrollTo edges", () => {
  function setup() {
    const scrollToSpy = vi.fn();
    let api: ReturnType<typeof useDomet> | null = null;

    function Component() {
      const containerRef = useRef<HTMLDivElement | null>(null);
      api = useDomet({ ids: ["a", "b", "c"], container: containerRef });
      return (
        <div ref={containerRef} data-testid="container">
          <div {...api.register("a")} />
          <div {...api.register("b")} />
          <div {...api.register("c")} />
        </div>
      );
    }

    render(<Component />);
    const container = screen.getByTestId("container");
    setContainerMetrics(container, 400, 1000);
    container.scrollTo = scrollToSpy as unknown as typeof container.scrollTo;
    const [a, b, c] = container.querySelectorAll<HTMLElement>("[data-domet]");
    setSectionTop(a, () => 50 - container.scrollTop, 300);
    setSectionTop(b, () => 350 - container.scrollTop, 300);
    setSectionTop(c, () => 800 - container.scrollTop, 200);
    act(() => { vi.runAllTimers(); });

    return { scrollToSpy, getApi: () => api! };
  }

  it("scrolls to the very top for the first section", () => {
    const { scrollToSpy, getApi } = setup();
    act(() => { getApi().scrollTo("a", { behavior: "instant" }); });
    expect(scrollToSpy).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });
  });

  it("scrolls to the very bottom for the last section", () => {
    const { scrollToSpy, getApi } = setup();
    act(() => { getApi().scrollTo("c", { behavior: "instant" }); });
    expect(scrollToSpy).toHaveBeenLastCalledWith({ top: 600, behavior: "instant" });
  });
});

describe("useElementScroll", () => {
  it("retries a resolver until the element is rendered", () => {
    const scrollIntoView = vi.fn();

    function Component() {
      const [visible, setVisible] = useState(false);
      const fieldRef = useRef<HTMLDivElement | null>(null);
      const { scrollTo } = useElementScroll({ behavior: "smooth", position: "top" });

      return (
        <>
          <button data-testid="scroll" onClick={() => scrollTo(() => fieldRef.current)} />
          <button data-testid="show" onClick={() => setVisible(true)} />
          {visible && (
            <div
              ref={(el) => {
                fieldRef.current = el;
                if (el) {
                  el.scrollIntoView = scrollIntoView;
                  el.getClientRects = () => [rect(0, 10)] as unknown as DOMRectList;
                }
              }}
            />
          )}
        </>
      );
    }

    render(<Component />);
    act(() => { screen.getByTestId("scroll").click(); });
    act(() => { vi.advanceTimersByTime(20); });
    expect(scrollIntoView).not.toHaveBeenCalled();

    act(() => { screen.getByTestId("show").click(); });
    act(() => { vi.runAllTimers(); });

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
  });

  it("resolves auto behavior to instant with reduced motion", () => {
    const scrollIntoView = vi.fn();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const element = document.createElement("div");
    document.body.appendChild(element);
    element.scrollIntoView = scrollIntoView;
    element.getClientRects = () => [rect(0, 10)] as unknown as DOMRectList;

    let scrollTo: ReturnType<typeof useElementScroll>["scrollTo"] = () => {};
    function Component() {
      scrollTo = useElementScroll().scrollTo;
      return null;
    }

    render(<Component />);
    act(() => {
      scrollTo(element);
      vi.runAllTimers();
    });

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "instant",
      block: "center",
      inline: "nearest",
    });
    element.remove();
  });
});
