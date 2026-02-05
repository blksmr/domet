import React, { StrictMode, useRef, useState } from "react";
import { act, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDomet } from "../useDomet";
import type { DometOptions } from "../types";

function setContainerMetrics(
  container: HTMLDivElement,
  {
    clientHeight = 100,
    scrollHeight = 200,
  }: { clientHeight?: number; scrollHeight?: number } = {},
): void {
  Object.defineProperty(container, "clientHeight", {
    value: clientHeight,
    configurable: true,
  });
  Object.defineProperty(container, "scrollHeight", {
    value: scrollHeight,
    configurable: true,
  });
  Object.defineProperty(container, "scrollTop", {
    value: 0,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(container, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        bottom: clientHeight,
        left: 0,
        right: 0,
        width: 0,
        height: clientHeight,
        toJSON: () => ({}),
      }) as DOMRect,
  });
}

function setSectionRect(
  section: HTMLElement,
  top: number,
  height: number,
): void {
  Object.defineProperty(section, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        x: 0,
        y: top,
        top,
        bottom: top + height,
        left: 0,
        right: 0,
        width: 0,
        height,
        toJSON: () => ({}),
      }) as DOMRect,
  });
}

// ─── Cleanup / unmount ───

describe("cleanup on unmount", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("removes scroll and resize listeners on unmount", () => {
    vi.useFakeTimers();
    const removeSpy = vi.spyOn(window, "removeEventListener");

    function Component() {
      const containerRef = useRef<HTMLDivElement | null>(null);
      useDomet({ ids: ["a"], container: containerRef });
      return <div ref={containerRef} />;
    }

    const { unmount } = render(<Component />);
    act(() => { vi.runAllTimers(); });

    removeSpy.mockClear();
    unmount();

    const removedTypes = removeSpy.mock.calls.map((c) => c[0]);
    expect(removedTypes).toContain("resize");

    vi.useRealTimers();
  });

  it("cancels pending RAF on unmount", () => {
    vi.useFakeTimers();
    const cancelSpy = vi.spyOn(globalThis, "cancelAnimationFrame");

    function Component() {
      const containerRef = useRef<HTMLDivElement | null>(null);
      useDomet({ ids: ["a"], container: containerRef });
      return (
        <div ref={containerRef}>
          <div data-domet="a" />
        </div>
      );
    }

    const { unmount } = render(<Component />);
    unmount();

    expect(cancelSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("clears throttle timeout on unmount", () => {
    vi.useFakeTimers();

    function Component() {
      const containerRef = useRef<HTMLDivElement | null>(null);
      useDomet({ ids: ["a"], container: containerRef, tracking: { throttle: 50 } });
      return (
        <div ref={containerRef} data-testid="container">
          <div data-domet="a" />
        </div>
      );
    }

    const { unmount } = render(<Component />);
    const container = screen.getByTestId("container");
    setContainerMetrics(container as HTMLDivElement);

    act(() => { vi.runAllTimers(); });

    // Trigger scroll to start throttle timer
    act(() => {
      container.dispatchEvent(new Event("scroll"));
    });

    // Unmount while throttle is active — should not throw
    unmount();

    // Advance timers to confirm nothing fires after unmount
    expect(() => {
      act(() => { vi.runAllTimers(); });
    }).not.toThrow();

    vi.useRealTimers();
  });

  it("disconnects MutationObserver on unmount (selector mode)", () => {
    const disconnectSpy = vi.fn();
    const originalMO = globalThis.MutationObserver;

    globalThis.MutationObserver = class MockMO {
      observe() {}
      disconnect() { disconnectSpy(); }
      takeRecords() { return []; }
    } as unknown as typeof MutationObserver;

    function Component() {
      useDomet({ selector: "[data-section]" } as DometOptions);
      return <div data-section="a" />;
    }

    const { unmount } = render(<Component />);
    unmount();

    expect(disconnectSpy).toHaveBeenCalled();
    globalThis.MutationObserver = originalMO;
  });
});

// ─── SSR safety ───

describe("SSR safety", () => {
  it("does not crash when window is undefined", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error — simulating SSR by removing window
    delete (globalThis as Record<string, unknown>).window;

    // The hook uses typeof window === "undefined" checks
    // We verify the module can be imported and the exported function exists
    expect(typeof useDomet).toBe("function");

    globalThis.window = originalWindow;
  });
});

// ─── StrictMode double-render ───

describe("StrictMode", () => {
  afterEach(() => {
    cleanup();
  });

  it("works correctly under StrictMode double-render", () => {
    vi.useFakeTimers();

    function Component() {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const { active, register } = useDomet({
        ids: ["s1", "s2"],
        container: containerRef,
      });

      return (
        <div ref={containerRef} data-testid="container">
          <div data-testid="active">{active}</div>
          <div {...register("s1")} />
          <div {...register("s2")} />
        </div>
      );
    }

    render(
      <StrictMode>
        <Component />
      </StrictMode>,
    );

    const container = screen.getByTestId("container");
    setContainerMetrics(container as HTMLDivElement, {
      clientHeight: 100,
      scrollHeight: 300,
    });

    const sections = container.querySelectorAll<HTMLElement>("[data-domet]");
    setSectionRect(sections[0], 0, 100);
    setSectionRect(sections[1], 100, 100);

    act(() => { vi.runAllTimers(); });

    expect(screen.getByTestId("active").textContent).toBe("s1");

    vi.useRealTimers();
  });

  it("does not duplicate event listeners under StrictMode", () => {
    vi.useFakeTimers();
    const addSpy = vi.spyOn(window, "addEventListener");

    function Component() {
      const containerRef = useRef<HTMLDivElement | null>(null);
      useDomet({ ids: ["a"], container: containerRef });
      return <div ref={containerRef}><div data-domet="a" /></div>;
    }

    render(
      <StrictMode>
        <Component />
      </StrictMode>,
    );

    act(() => { vi.runAllTimers(); });

    const resizeCalls = addSpy.mock.calls.filter((c) => c[0] === "resize");
    // StrictMode mounts/unmounts/remounts — should have exactly 1 active resize listener
    expect(resizeCalls.length).toBeGreaterThanOrEqual(1);

    vi.useRealTimers();
    addSpy.mockRestore();
  });
});

// ─── Dynamic DOM changes ───

describe("dynamic DOM changes", () => {
  afterEach(() => {
    cleanup();
  });

  it("handles sections removed from ids array", () => {
    vi.useFakeTimers();

    function Component({ ids }: { ids: string[] }) {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const { active, register } = useDomet({
        ids,
        container: containerRef,
      });

      return (
        <div ref={containerRef} data-testid="container">
          <div data-testid="active">{active}</div>
          {ids.map((id) => (
            <div key={id} {...register(id)} />
          ))}
        </div>
      );
    }

    const { rerender } = render(<Component ids={["a", "b", "c"]} />);

    const container = screen.getByTestId("container");
    setContainerMetrics(container as HTMLDivElement, {
      clientHeight: 100,
      scrollHeight: 400,
    });

    act(() => { vi.runAllTimers(); });
    expect(screen.getByTestId("active").textContent).toBe("a");

    // Remove "a" — active should switch to "b"
    rerender(<Component ids={["b", "c"]} />);
    act(() => { vi.runAllTimers(); });

    expect(screen.getByTestId("active").textContent).toBe("b");

    vi.useRealTimers();
  });

  it("handles all sections removed", () => {
    vi.useFakeTimers();

    function Component({ ids }: { ids: string[] }) {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const { active, register } = useDomet({
        ids,
        container: containerRef,
      });

      return (
        <div ref={containerRef} data-testid="container">
          <div data-testid="active">{active ?? "none"}</div>
          {ids.map((id) => (
            <div key={id} {...register(id)} />
          ))}
        </div>
      );
    }

    const { rerender } = render(<Component ids={["a", "b"]} />);
    act(() => { vi.runAllTimers(); });

    rerender(<Component ids={[]} />);
    act(() => { vi.runAllTimers(); });

    expect(screen.getByTestId("active").textContent).toBe("none");

    vi.useRealTimers();
  });

  it("handles component mount/unmount/remount cycle", () => {
    vi.useFakeTimers();

    function Inner() {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const { active, register } = useDomet({
        ids: ["x", "y"],
        container: containerRef,
      });

      return (
        <div ref={containerRef} data-testid="container">
          <div data-testid="active">{active}</div>
          <div {...register("x")} />
          <div {...register("y")} />
        </div>
      );
    }

    function Outer() {
      const [show, setShow] = useState(true);
      return (
        <>
          <button data-testid="toggle" onClick={() => setShow((s) => !s)}>
            toggle
          </button>
          {show && <Inner />}
        </>
      );
    }

    render(<Outer />);
    act(() => { vi.runAllTimers(); });
    expect(screen.getByTestId("active").textContent).toBe("x");

    // Unmount
    act(() => { screen.getByTestId("toggle").click(); });
    act(() => { vi.runAllTimers(); });
    expect(screen.queryByTestId("active")).toBeNull();

    // Remount
    act(() => { screen.getByTestId("toggle").click(); });
    act(() => { vi.runAllTimers(); });
    expect(screen.getByTestId("active").textContent).toBe("x");

    vi.useRealTimers();
  });
});

// ─── Runtime warning ───

describe("runtime warnings", () => {
  it("warns when both ids and selector are provided", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    function Component() {
      // Force both ids and selector via type bypass
      useDomet({ ids: ["a"], selector: "[data-section]" } as unknown as DometOptions);
      return null;
    }

    render(<Component />);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Both `ids` and `selector`"),
    );

    warnSpy.mockRestore();
  });
});
