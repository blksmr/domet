import { act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MockResizeObserver,
  THREE_SECTIONS,
  endScroll,
  renderDomet,
  scrollFrame,
  userScroll,
} from "./helpers";

function followScrollTo(container: HTMLElement): void {
  container.scrollTo = ((options: ScrollToOptions) => {
    container.scrollTop = options.top ?? 0;
    container.dispatchEvent(new Event("scroll"));
  }) as typeof container.scrollTo;
}

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

describe("scrollTo callbacks", () => {
  it("fires onActive as soon as scrollTo changes the active section", () => {
    const onActive = vi.fn();
    const view = renderDomet({ ...THREE_SECTIONS, hook: { onActive } });

    act(() => {
      view.api().scrollTo("b", { behavior: "smooth" });
    });
    expect(view.active()).toBe("b");
    expect(onActive.mock.calls).toEqual([["b", "a"]]);

    act(() => {
      view.api().scrollTo("b", { behavior: "smooth" });
    });
    expect(onActive).toHaveBeenCalledTimes(1);
  });

  it("fires onEnter and onLeave once a locked scroll completes", () => {
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    const view = renderDomet({ ...THREE_SECTIONS, hook: { onEnter, onLeave } });
    followScrollTo(view.container);
    onEnter.mockClear();

    act(() => {
      view.api().scrollTo("c", { behavior: "smooth" });
      vi.advanceTimersByTime(20);
    });
    expect(onEnter).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();

    endScroll(view.container);
    expect(onEnter.mock.calls).toEqual([["c"]]);
    expect(onLeave.mock.calls).toEqual([["a"]]);
    expect(view.active()).toBe("c");
  });
});

describe("scrollTo target", () => {
  const SHORT_SECTIONS = {
    ids: ["a", "b", "c", "d"],
    layout: [
      [0, 200],
      [200, 200],
      [400, 200],
      [600, 200],
    ] as Array<[number, number]>,
    viewport: 400,
    scrollHeight: 800,
  };

  it("stays active after the scroll completes, until the user scrolls", () => {
    const onActive = vi.fn();
    const onEnter = vi.fn();
    const view = renderDomet({ ...SHORT_SECTIONS, hook: { onActive, onEnter } });
    followScrollTo(view.container);
    onEnter.mockClear();

    act(() => {
      view.api().scrollTo("b", { behavior: "smooth", position: "top" });
      vi.advanceTimersByTime(20);
    });
    endScroll(view.container);

    expect(view.container.scrollTop).toBe(200);
    expect(view.active()).toBe("b");
    expect(onActive.mock.calls).toEqual([["b", "a"]]);
    expect(onEnter.mock.calls).toEqual([["c"]]);

    userScroll(view.container, 201);
    expect(view.active()).toBe("c");
  });
});

describe("scrollTo lock", () => {
  it("keeps the active section locked while a smooth scroll runs", () => {
    const view = renderDomet(THREE_SECTIONS);

    act(() => {
      view.api().scrollTo("c", { behavior: "smooth" });
    });
    scrollFrame(view.container, 560);
    expect(view.active()).toBe("c");
  });

  it("releases the lock after an ignored call made during a locked scroll", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = renderDomet(THREE_SECTIONS);

    act(() => {
      view.api().scrollTo("b", { behavior: "smooth" });
    });
    act(() => {
      view.api().scrollTo("unknown");
    });
    expect(warn).toHaveBeenCalledWith('[domet] scrollTo: id "unknown" not found');
    expect(view.scrollToSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    userScroll(view.container, 1090);
    expect(view.active()).toBe("c");
  });

  it("does not lock for instant scrolls", () => {
    const view = renderDomet(THREE_SECTIONS);

    act(() => {
      view.api().scrollTo("b", { behavior: "instant" });
    });
    scrollFrame(view.container, 1090);
    expect(view.active()).toBe("c");
  });

  it("can be disabled with lockActive: false", () => {
    const view = renderDomet(THREE_SECTIONS);

    act(() => {
      view.api().scrollTo("c", { behavior: "smooth", lockActive: false });
    });
    expect(view.active()).toBe("a");
  });
});

describe("scrollTo targets", () => {
  it("aligns an id target to the requested position", () => {
    const view = renderDomet(THREE_SECTIONS);
    const scrollTo = (position: "top" | "center" | "bottom", offset?: number) => {
      act(() => {
        view.api().scrollTo("b", { position, offset, behavior: "instant" });
      });
      return view.scrollToSpy.mock.lastCall?.[0];
    };

    expect(scrollTo("top", 20)).toEqual({ top: 480, behavior: "instant" });
    expect(scrollTo("center")).toEqual({ top: 500, behavior: "instant" });
    expect(scrollTo("bottom")).toEqual({ top: 600, behavior: "instant" });
  });

  it("scrolls to an absolute position without locking the active section", () => {
    const view = renderDomet(THREE_SECTIONS);

    act(() => {
      view.api().scrollTo({ top: 300 }, { offset: 50, behavior: "instant" });
    });
    expect(view.scrollToSpy).toHaveBeenLastCalledWith({ top: 250, behavior: "instant" });
    expect(view.active()).toBe("a");

    act(() => {
      view.api().scrollTo({ top: 99999 }, { behavior: "instant" });
    });
    expect(view.scrollToSpy).toHaveBeenLastCalledWith({ top: 1100, behavior: "instant" });
  });

  it("uses the scrolling defaults from the hook options", () => {
    const view = renderDomet({
      ...THREE_SECTIONS,
      hook: { scrolling: { behavior: "instant", position: "top", offset: 30 } },
    });

    act(() => {
      view.api().link("b").onClick();
    });
    expect(view.scrollToSpy).toHaveBeenLastCalledWith({ top: 470, behavior: "instant" });
  });

  it("ignores an invalid top value with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = renderDomet(THREE_SECTIONS);

    act(() => {
      view.api().scrollTo({ top: Number.NaN });
    });
    expect(view.scrollToSpy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[domet] scrollTo: top "NaN" is not a valid number');
  });
});

describe("link", () => {
  it("marks the active link", () => {
    const view = renderDomet(THREE_SECTIONS);

    expect(view.api().link("a")).toMatchObject({ "aria-current": "page", "data-active": true });
    expect(view.api().link("b")).toMatchObject({ "aria-current": undefined, "data-active": false });
    expect(view.api().index).toBe(0);
  });
});
