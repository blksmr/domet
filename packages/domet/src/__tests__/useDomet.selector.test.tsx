import React, { useRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDomet } from "../useDomet";
import { MockResizeObserver, define, rect, setScrollMetrics } from "./helpers";

async function flushMutations(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    vi.advanceTimersByTime(60);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("selector mode with removed sections", () => {
  function renderStack(onActive: (id: string | null, prevId: string | null) => void) {
    function Component() {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const { active } = useDomet({ selector: "[data-s]", container: containerRef, onActive });
      return (
        <>
          <output data-testid="active">{String(active)}</output>
          <div ref={containerRef} data-testid="container" />
        </>
      );
    }

    render(<Component />);
    const container = screen.getByTestId("container");
    setScrollMetrics(container, 400, 3000);
    for (const id of ["s1", "s2", "s3"]) {
      const section = document.createElement("div");
      section.setAttribute("data-s", "");
      section.id = id;
      define(section, {
        getBoundingClientRect: () => {
          if (!section.isConnected) return rect(0, 0);
          const index = [...container.querySelectorAll("[data-s]")].indexOf(section);
          return rect(index * 1000 - container.scrollTop, 1000);
        },
      });
      container.appendChild(section);
    }
    return container;
  }

  async function scrollTo(container: HTMLElement, y: number): Promise<void> {
    await act(async () => {
      container.scrollTop = y;
      container.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(20);
      container.dispatchEvent(new Event("scrollend"));
      vi.advanceTimersByTime(20);
    });
  }

  it("clears the active section once when every section is removed", async () => {
    const onActive = vi.fn();
    const container = renderStack(onActive);
    await flushMutations();
    await scrollTo(container, 2100);
    expect(screen.getByTestId("active").textContent).toBe("s3");
    onActive.mockClear();

    await act(async () => {
      for (const section of [...container.querySelectorAll("[data-s]")]) section.remove();
      await Promise.resolve();
      define(container, { scrollHeight: 400, scrollTop: 0 });
      container.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(20);
    });
    await flushMutations();

    expect(screen.getByTestId("active").textContent).toBe("null");
    expect(onActive.mock.calls).toEqual([[null, "s3"]]);
  });
});

describe("selector mode", () => {
  function renderSelector() {
    const state = { renders: 0, ids: [] as string[] };

    function Component() {
      const { ids, active } = useDomet({ selector: "[data-s]" });
      state.ids = ids;
      state.renders++;
      return (
        <main data-testid="main">
          <output data-testid="active">{String(active)}</output>
          <div data-s id="s1" />
          <div data-s data-domet="s2" />
          <div data-s />
        </main>
      );
    }

    render(<Component />);
    return state;
  }

  it("resolves ids from id, data-domet, then index", async () => {
    const state = renderSelector();
    await flushMutations();

    expect(state.ids).toEqual(["s1", "s2", "section-2"]);
    expect(screen.getByTestId("active").textContent).toBe("s1");
  });

  it("does not re-render on unrelated DOM mutations", async () => {
    const state = renderSelector();
    await flushMutations();
    const rendersBefore = state.renders;
    const idsBefore = state.ids;

    document.body.appendChild(document.createElement("aside"));
    await flushMutations();

    expect(state.renders).toBe(rendersBefore);
    expect(state.ids).toBe(idsBefore);
  });

  it("does not re-render on window resize when sections are unchanged", async () => {
    const state = renderSelector();
    await flushMutations();
    const rendersBefore = state.renders;

    act(() => {
      window.dispatchEvent(new Event("resize"));
      vi.advanceTimersByTime(20);
    });

    expect(state.renders).toBe(rendersBefore);
  });

  it("picks up sections added after mount", async () => {
    const state = renderSelector();
    await flushMutations();

    const added = document.createElement("div");
    added.setAttribute("data-s", "");
    added.id = "late";
    screen.getByTestId("main").appendChild(added);
    await flushMutations();

    expect(state.ids).toEqual(["s1", "s2", "section-2", "late"]);
  });

  it("adds a late section to the sections state without waiting for a scroll", async () => {
    function Component() {
      const { sections } = useDomet({ selector: "[data-s]" });
      return (
        <main data-testid="main">
          <output data-testid="sections">{Object.keys(sections).join(",")}</output>
          <div data-s id="s1" />
        </main>
      );
    }

    render(<Component />);
    await flushMutations();
    expect(screen.getByTestId("sections").textContent).toBe("s1");

    const added = document.createElement("div");
    added.setAttribute("data-s", "");
    added.id = "late";
    screen.getByTestId("main").appendChild(added);
    await flushMutations();
    await flushMutations();

    expect(screen.getByTestId("sections").textContent).toBe("s1,late");
  });

  it("reports the active section when it is replaced, cleared or resolved again", async () => {
    const onActive = vi.fn();

    function Component() {
      const { active } = useDomet({ selector: "[data-late]", onActive });
      return <output data-testid="active">{String(active)}</output>;
    }

    document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-late id="s1"></div><div data-late id="s2"></div>',
    );
    render(<Component />);
    await flushMutations();
    expect(screen.getByTestId("active").textContent).toBe("s1");
    expect(onActive).not.toHaveBeenCalled();

    document.getElementById("s1")?.remove();
    await flushMutations();
    expect(screen.getByTestId("active").textContent).toBe("s2");
    expect(onActive.mock.calls).toEqual([["s2", "s1"]]);

    document.getElementById("s2")?.remove();
    await flushMutations();
    expect(screen.getByTestId("active").textContent).toBe("null");
    expect(onActive.mock.calls).toEqual([
      ["s2", "s1"],
      [null, "s2"],
    ]);

    document.body.insertAdjacentHTML("beforeend", '<div data-late id="s3"></div>');
    await flushMutations();
    expect(screen.getByTestId("active").textContent).toBe("s3");
    expect(onActive.mock.calls).toEqual([
      ["s2", "s1"],
      [null, "s2"],
      ["s3", null],
    ]);
  });

  it("does not report the first active section when it is resolved after mount", async () => {
    const onActive = vi.fn();

    function Component() {
      const { active } = useDomet({ selector: "[data-late]", onActive });
      return <output data-testid="active">{String(active)}</output>;
    }

    render(<Component />);
    await flushMutations();
    expect(screen.getByTestId("active").textContent).toBe("null");

    document.body.insertAdjacentHTML("beforeend", '<div data-late id="s1"></div>');
    await flushMutations();

    expect(screen.getByTestId("active").textContent).toBe("s1");
    expect(onActive).not.toHaveBeenCalled();
  });

  it("only tracks sections inside the container", async () => {
    let ids: string[] = [];

    function Component() {
      const containerRef = useRef<HTMLDivElement | null>(null);
      ids = useDomet({ selector: "[data-s]", container: containerRef }).ids;
      return (
        <>
          <div data-s id="outside" />
          <div ref={containerRef}>
            <div data-s id="inside" />
          </div>
        </>
      );
    }

    render(<Component />);
    await flushMutations();

    expect(ids).toEqual(["inside"]);
  });
});
