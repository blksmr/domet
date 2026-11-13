import React, { useRef, useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDomet } from "../useDomet";
import type { SectionState, UseDometReturn } from "../types";
import {
  MockResizeObserver,
  THREE_SECTIONS,
  endScroll,
  placeSections,
  renderDomet,
  scrollFrame,
  setScrollMetrics,
  userScroll,
} from "./helpers";

function removeScrollEndSupport(): () => void {
  let owner: object | null = HTMLElement.prototype;
  while (owner && !Object.prototype.hasOwnProperty.call(owner, "onscrollend")) {
    owner = Object.getPrototypeOf(owner);
  }
  if (!owner) return () => {};
  const target = owner;
  const descriptor = Object.getOwnPropertyDescriptor(target, "onscrollend") as PropertyDescriptor;
  delete (target as Record<string, unknown>).onscrollend;
  return () => {
    Object.defineProperty(target, "onscrollend", descriptor);
  };
}

function scrollText(api: UseDometReturn): React.ReactNode {
  return (
    <output data-testid="scroll">
      {`${api.scroll.y}|${api.scroll.direction}|${api.scroll.velocity}|${api.scroll.scrolling}`}
    </output>
  );
}

const TALL_SECTIONS = {
  ids: ["a", "b"],
  layout: [
    [0, 2000],
    [2000, 2000],
  ] as Array<[number, number]>,
  viewport: 400,
  scrollHeight: 4000,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("active section tracking", () => {
  it("fires onActive, onEnter and onLeave as the user scrolls", () => {
    const onActive = vi.fn();
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    const view = renderDomet({ ...THREE_SECTIONS, hook: { onActive, onEnter, onLeave } });

    expect(view.active()).toBe("a");
    expect(onEnter.mock.calls).toEqual([["a"]]);
    expect(onActive).not.toHaveBeenCalled();

    userScroll(view.container, 560);

    expect(view.active()).toBe("b");
    expect(onActive.mock.calls).toEqual([["b", "a"]]);
    expect(onEnter.mock.calls).toEqual([["a"], ["b"]]);
    expect(onLeave.mock.calls).toEqual([["a"]]);
  });

  it("keeps the closest section above when no section is in view", () => {
    const onActive = vi.fn();
    const view = renderDomet({
      ids: ["a", "b"],
      layout: [
        [0, 300],
        [300, 300],
      ],
      viewport: 400,
      scrollHeight: 3000,
      hook: { onActive },
    });

    userScroll(view.container, 350);
    expect(view.active()).toBe("b");

    userScroll(view.container, 1500);
    expect(view.active()).toBe("b");
    expect(onActive.mock.calls).toEqual([["b", "a"]]);
  });

  it("reports the active section when its id is removed", () => {
    const onActive = vi.fn();

    function Component({ ids }: { ids: string[] }) {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const { active, register } = useDomet({ ids, container: containerRef, onActive });
      return (
        <div ref={containerRef} data-testid="container">
          <output data-testid="active">{String(active)}</output>
          {ids.map((id) => (
            <div key={id} {...register(id)} />
          ))}
        </div>
      );
    }

    const { rerender } = render(<Component ids={["a", "b"]} />);
    const container = screen.getByTestId("container");
    setScrollMetrics(container, 400, 1000);
    placeSections(container, [
      [0, 500],
      [500, 500],
    ]);
    act(() => {
      vi.runAllTimers();
    });
    userScroll(container, 560);
    expect(onActive.mock.calls).toEqual([["b", "a"]]);

    rerender(<Component ids={["a"]} />);
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByTestId("active").textContent).toBe("a");
    expect(onActive.mock.calls).toEqual([
      ["b", "a"],
      ["a", "b"],
    ]);

    rerender(<Component ids={[]} />);
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByTestId("active").textContent).toBe("null");
    expect(onActive.mock.calls).toEqual([
      ["b", "a"],
      ["a", "b"],
      [null, "a"],
    ]);

    rerender(<Component ids={["b"]} />);
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByTestId("active").textContent).toBe("b");
    expect(onActive).toHaveBeenLastCalledWith("b", null);
  });

  it("does not report the first active section when ids arrive after mount", () => {
    const onActive = vi.fn();

    function Component({ ids }: { ids: string[] }) {
      const { active, register } = useDomet({ ids, onActive });
      return (
        <>
          <output data-testid="active">{String(active)}</output>
          {ids.map((id) => (
            <div key={id} {...register(id)} />
          ))}
        </>
      );
    }

    const { rerender } = render(<Component ids={[]} />);
    rerender(<Component ids={["a", "b"]} />);
    act(() => {
      vi.runAllTimers();
    });

    expect(screen.getByTestId("active").textContent).toBe("a");
    expect(onActive).not.toHaveBeenCalled();
  });

  it("tracks a section whose id is removed then added back while it stays mounted", () => {
    let api: UseDometReturn | null = null;
    let setIds: (ids: string[]) => void = () => {};

    function Component() {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const [ids, updateIds] = useState(["a", "b"]);
      setIds = updateIds;
      api = useDomet({ ids, container: containerRef });
      return (
        <div ref={containerRef} data-testid="container">
          <output data-testid="active">{api.active}</output>
          <div {...api.register("a")} />
          <div {...api.register("b")} />
        </div>
      );
    }

    render(<Component />);
    const container = screen.getByTestId("container");
    setScrollMetrics(container, 400, 1000);
    placeSections(container, [
      [0, 500],
      [500, 500],
    ]);
    act(() => {
      vi.runAllTimers();
    });

    act(() => {
      setIds(["a"]);
    });
    act(() => {
      vi.runAllTimers();
    });
    act(() => {
      setIds(["a", "b"]);
    });
    act(() => {
      vi.runAllTimers();
    });

    userScroll(container, 560);
    expect(screen.getByTestId("active").textContent).toBe("b");
    expect(Object.keys((api as unknown as UseDometReturn).sections)).toEqual(["a", "b"]);
  });
});

describe("scroll state", () => {
  it("reports direction and velocity while scrolling and resets them at rest", () => {
    const view = renderDomet({ ...TALL_SECTIONS, children: scrollText });

    act(() => {
      vi.advanceTimersByTime(16);
    });
    scrollFrame(view.container, 1000);
    const [y, direction, velocity, scrolling] = (
      screen.getByTestId("scroll").textContent as string
    ).split("|");
    expect(y).toBe("1000");
    expect(direction).toBe("down");
    expect(Number(velocity)).toBeGreaterThan(0);
    expect(scrolling).toBe("true");

    endScroll(view.container);
    expect(screen.getByTestId("scroll").textContent).toBe("1000|null|0|false");
  });

  it("stays at rest when scroll and scrollend land in the same frame", () => {
    const onScrollStart = vi.fn();
    const onScrollEnd = vi.fn();
    const view = renderDomet({
      ...TALL_SECTIONS,
      hook: { onScrollStart, onScrollEnd },
      children: scrollText,
    });

    act(() => {
      vi.advanceTimersByTime(16);
      view.container.scrollTop = 1500;
      view.container.dispatchEvent(new Event("scroll"));
      view.container.dispatchEvent(new Event("scrollend"));
      vi.advanceTimersByTime(20);
    });

    expect(screen.getByTestId("scroll").textContent).toBe("1500|null|0|false");
    expect(onScrollStart).toHaveBeenCalledTimes(1);
    expect(onScrollEnd).toHaveBeenCalledTimes(1);
  });

  it("falls back to an idle timeout when scrollend is unsupported", () => {
    const restore = removeScrollEndSupport();
    try {
      const onScrollEnd = vi.fn();
      const view = renderDomet({
        ...TALL_SECTIONS,
        hook: { onScrollEnd },
        children: scrollText,
      });
      expect("onscrollend" in view.container).toBe(false);

      scrollFrame(view.container, 700);
      expect(onScrollEnd).not.toHaveBeenCalled();
      expect(screen.getByTestId("scroll").textContent).toContain("|down|");

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(onScrollEnd).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("scroll").textContent).toBe("700|null|0|false");
    } finally {
      restore();
    }
  });

  it("updates when no section is resolved", () => {
    const view = renderDomet({
      ids: [],
      layout: [],
      viewport: 400,
      scrollHeight: 4000,
      children: (api) => <output data-testid="y">{api.scroll.y}</output>,
    });

    userScroll(view.container, 250);
    expect(screen.getByTestId("y").textContent).toBe("250");
    expect(view.active()).toBe("null");
  });

  it("returns current values when read outside render", () => {
    let seenY: number | null = null;
    let seenSections: Record<string, SectionState> = {};
    const view = renderDomet({
      ...THREE_SECTIONS,
      children: (api) => (
        <button
          data-testid="read"
          onClick={() => {
            seenY = api.scroll.y;
            seenSections = api.sections;
          }}
        />
      ),
    });
    const rendersBefore = view.renders();

    scrollFrame(view.container, 160);
    expect(view.active()).toBe("a");
    expect(view.renders()).toBe(rendersBefore);

    act(() => {
      screen.getByTestId("read").click();
    });

    expect(seenY).toBe(160);
    expect(seenSections.a.active).toBe(true);
    expect(seenSections.a.visibility).toBe(0.68);
    expect(seenSections.a.rect?.top).toBe(-160);
    expect(seenSections.b.inView).toBe(true);
    expect(seenSections.b.bounds).toEqual({ top: 500, bottom: 1000, height: 500 });
  });
});

describe("sections state", () => {
  it("is built on demand and stays stable within a frame", () => {
    const view = renderDomet(THREE_SECTIONS);

    scrollFrame(view.container, 560);
    const first = view.api().sections;
    expect(view.api().sections).toBe(first);
    expect(first.b.visibility).toBe(0.8);

    scrollFrame(view.container, 700);
    const second = view.api().sections;
    expect(second).not.toBe(first);
    expect(second.b.rect?.top).toBe(-200);
  });

  it("is cleared when every section unmounts", () => {
    function Component({ ids }: { ids: string[] }) {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const { sections, register } = useDomet({ ids, container: containerRef });
      return (
        <div ref={containerRef} data-testid="container">
          <output data-testid="count">{Object.keys(sections).length}</output>
          {ids.map((id) => (
            <div key={id} {...register(id)} />
          ))}
        </div>
      );
    }

    const { rerender } = render(<Component ids={["a", "b"]} />);
    const container = screen.getByTestId("container");
    setScrollMetrics(container, 400, 1000);
    placeSections(container, [
      [0, 500],
      [500, 500],
    ]);
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByTestId("count").textContent).toBe("2");

    rerender(<Component ids={[]} />);
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});
