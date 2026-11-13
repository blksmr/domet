import { afterEach, describe, expect, it, vi } from "vitest";
import type { Offset } from "../types";
import {
  areIdInputsEqual,
  findScrollableParent,
  resolveContainer,
  resolveOffset,
  resolveSectionsFromIds,
  resolveSectionsFromSelector,
} from "../utils";
import { resolveScrollBehavior, resolveScrollBlock } from "../utils/scrolling";
import { define } from "./helpers";

afterEach(() => {
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("resolveOffset", () => {
  it("resolves pixels and percentages of the viewport height", () => {
    expect(resolveOffset(undefined, 800, 0)).toBe(0);
    expect(resolveOffset(undefined, 800, 40)).toBe(40);
    expect(resolveOffset(100, 800, 0)).toBe(100);
    expect(resolveOffset("10%", 800, 0)).toBe(80);
    expect(resolveOffset("-25%", 800, 0)).toBe(-200);
  });

  it("returns 0 for values it cannot resolve", () => {
    expect(resolveOffset(Number.NaN, 800, 0)).toBe(0);
    expect(resolveOffset("abc" as Offset, 800, 0)).toBe(0);
    expect(resolveOffset("10%", Number.NaN, 0)).toBe(0);
  });
});

describe("resolveContainer", () => {
  it("returns the ref element, or null without a container", () => {
    const element = document.createElement("div");
    expect(resolveContainer(undefined)).toBeNull();
    expect(resolveContainer({ current: null })).toBeNull();
    expect(resolveContainer({ current: element })).toBe(element);
  });
});

describe("resolveSectionsFromIds", () => {
  it("keeps the ids order and skips unmounted sections", () => {
    const a = document.createElement("div");
    const c = document.createElement("div");
    expect(resolveSectionsFromIds(["a", "b", "c"], { a, b: null, c })).toEqual([
      { id: "a", element: a },
      { id: "c", element: c },
    ]);
  });
});

describe("resolveSectionsFromSelector", () => {
  it("names sections by id, data-domet, then index", () => {
    document.body.innerHTML = `
      <div data-s id="intro"></div>
      <div data-s data-domet="features"></div>
      <div data-s></div>
    `;
    expect(resolveSectionsFromSelector("[data-s]").map((s) => s.id)).toEqual([
      "intro",
      "features",
      "section-2",
    ]);
  });

  it("only searches inside the given root", () => {
    document.body.innerHTML = `
      <div data-s id="outside"></div>
      <main><div data-s id="inside"></div></main>
    `;
    const root = document.querySelector("main") as HTMLElement;
    expect(resolveSectionsFromSelector("[data-s]", root).map((s) => s.id)).toEqual([
      "inside",
    ]);
  });

  it("returns an empty list and warns on an invalid selector", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveSectionsFromSelector("[[")).toEqual([]);
    expect(warn).toHaveBeenCalledWith('[domet] Invalid CSS selector: "[["');
  });
});

describe("areIdInputsEqual", () => {
  it("compares id arrays by content", () => {
    const ids = ["a", "b"];
    expect(areIdInputsEqual(ids, ids)).toBe(true);
    expect(areIdInputsEqual(["a", "b"], ["a", "b"])).toBe(true);
    expect(areIdInputsEqual(["a", "b"], ["b", "a"])).toBe(false);
    expect(areIdInputsEqual(["a"], ["a", "b"])).toBe(false);
    expect(areIdInputsEqual(undefined, undefined)).toBe(true);
    expect(areIdInputsEqual(undefined, [])).toBe(false);
  });
});

describe("findScrollableParent", () => {
  function nest(style: string, overflowing: { x?: boolean; y?: boolean }) {
    document.body.innerHTML = `<div id="outer"><div id="scroller" style="${style}"><span id="item"></span></div></div>`;
    const scroller = document.getElementById("scroller") as HTMLElement;
    define(scroller, {
      clientHeight: 100,
      scrollHeight: overflowing.y ? 300 : 100,
      clientWidth: 100,
      scrollWidth: overflowing.x ? 300 : 100,
    });
    return {
      scroller,
      item: document.getElementById("item") as HTMLElement,
      outer: document.getElementById("outer") as HTMLElement,
    };
  }

  it("finds the nearest ancestor that scrolls vertically", () => {
    const { scroller, item } = nest("overflow-y: auto", { y: true });
    expect(findScrollableParent(item)).toEqual({ element: scroller, x: false, y: true });
  });

  it("finds an ancestor that scrolls horizontally", () => {
    const { scroller, item } = nest("overflow-x: scroll", { x: true });
    expect(findScrollableParent(item)).toEqual({ element: scroller, x: true, y: false });
  });

  it("skips ancestors that do not overflow", () => {
    const { item } = nest("overflow: auto", {});
    expect(findScrollableParent(item)).toBeNull();
  });

  it("never returns the document body or root element", () => {
    document.body.innerHTML = `<span id="item"></span>`;
    document.body.style.overflow = "auto";
    define(document.body, { clientHeight: 100, scrollHeight: 300 });
    expect(findScrollableParent(document.getElementById("item") as HTMLElement)).toBeNull();
  });

  it("stops at the boundary element", () => {
    const { scroller, item, outer } = nest("overflow-y: auto", { y: true });
    expect(findScrollableParent(item, scroller)).toBeNull();
    expect(findScrollableParent(item, outer)).toEqual({ element: scroller, x: false, y: true });
  });
});

describe("resolveScrollBehavior", () => {
  it("returns explicit behaviors unchanged", () => {
    expect(resolveScrollBehavior("smooth")).toBe("smooth");
    expect(resolveScrollBehavior("instant")).toBe("instant");
  });

  it("resolves auto from the reduced motion preference", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(resolveScrollBehavior("auto")).toBe("smooth");
    expect(resolveScrollBehavior()).toBe("smooth");
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    expect(resolveScrollBehavior("auto")).toBe("instant");
  });
});

describe("resolveScrollBlock", () => {
  it("maps positions to scrollIntoView blocks", () => {
    expect(resolveScrollBlock("top")).toBe("start");
    expect(resolveScrollBlock("bottom")).toBe("end");
    expect(resolveScrollBlock("center")).toBe("center");
    expect(resolveScrollBlock()).toBe("center");
  });
});
