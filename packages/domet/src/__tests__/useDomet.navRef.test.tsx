import React, { useRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDomet } from "../useDomet";
import type { NavRefOptions } from "../types";
import {
  MockResizeObserver,
  define,
  placeSections,
  rect,
  setScrollMetrics,
  userScroll,
} from "./helpers";

const IDS = ["a", "b", "c"];
const ITEM_SIZE = 60;

type NavSetup = {
  navStyle?: React.CSSProperties;
  navInsideContainer?: boolean;
  horizontal?: boolean;
  options?: NavRefOptions;
};

function setup({
  navStyle = { overflowY: "auto" },
  navInsideContainer = false,
  horizontal = false,
  options,
}: NavSetup = {}) {
  function Component() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const { active, register, link, navRef } = useDomet({ ids: IDS, container: containerRef });
    const nav = (
      <nav data-testid="nav" style={navStyle}>
        {IDS.map((id) => (
          <button key={id} ref={navRef(id, options)} {...link(id)}>
            {id}
          </button>
        ))}
      </nav>
    );
    return (
      <>
        {!navInsideContainer && nav}
        <div ref={containerRef} data-testid="container" style={{ overflowY: "auto" }}>
          <output data-testid="active">{active}</output>
          {navInsideContainer && nav}
          {IDS.map((id) => (
            <div key={id} {...register(id)} />
          ))}
        </div>
      </>
    );
  }

  render(<Component />);
  const container = screen.getByTestId("container");
  const nav = screen.getByTestId("nav");
  setScrollMetrics(container, 400, 1500);
  placeSections(container, [
    [0, 500],
    [500, 500],
    [1000, 500],
  ]);

  const navScrollTo = vi.fn();
  const containerScrollTo = vi.fn();
  define(nav, {
    clientTop: 0,
    clientLeft: 0,
    clientHeight: 100,
    scrollHeight: horizontal ? 100 : IDS.length * ITEM_SIZE,
    clientWidth: 100,
    scrollWidth: horizontal ? IDS.length * ITEM_SIZE : 100,
    scrollTop: 0,
    scrollLeft: 0,
    getBoundingClientRect: () => rect(0, 100, 0, 100),
    scrollTo: navScrollTo,
  });
  define(container, { scrollTo: containerScrollTo });
  nav.querySelectorAll<HTMLElement>("button").forEach((button, i) => {
    define(button, {
      getBoundingClientRect: () =>
        horizontal
          ? rect(0, ITEM_SIZE, i * ITEM_SIZE - nav.scrollLeft, ITEM_SIZE)
          : rect(i * ITEM_SIZE - nav.scrollTop, ITEM_SIZE, 0, 100),
    });
  });
  act(() => {
    vi.runAllTimers();
  });

  return { container, nav, navScrollTo, containerScrollTo };
}

let scrollIntoView: ReturnType<typeof vi.fn>;
let windowScrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  scrollIntoView = vi.fn();
  windowScrollTo = vi.fn();
  define(Element.prototype as unknown as HTMLElement, { scrollIntoView });
  vi.stubGlobal("scrollTo", windowScrollTo);
});

afterEach(() => {
  cleanup();
  delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("navRef", () => {
  it("scrolls only the nav container to reveal the active item", () => {
    const { container, navScrollTo, containerScrollTo } = setup();

    userScroll(container, 1090);
    expect(screen.getByTestId("active").textContent).toBe("c");

    expect(navScrollTo).toHaveBeenCalledTimes(1);
    expect(navScrollTo).toHaveBeenCalledWith({ top: 80, behavior: "smooth" });
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(windowScrollTo).not.toHaveBeenCalled();
    expect(containerScrollTo).not.toHaveBeenCalled();
  });

  it("does not scroll when the active item is already visible", () => {
    const { container, nav, navScrollTo } = setup();
    define(nav, { clientHeight: 150 });

    userScroll(container, 560);
    expect(screen.getByTestId("active").textContent).toBe("b");
    expect(navScrollTo).not.toHaveBeenCalled();
  });

  it("applies the position, offset and behavior options", () => {
    const start = setup({ options: { position: "start", offset: 16, behavior: "instant" } });
    userScroll(start.container, 1090);
    expect(start.navScrollTo).toHaveBeenCalledWith({ top: 104, behavior: "instant" });
    cleanup();

    const center = setup({ options: { position: "center" } });
    userScroll(center.container, 1090);
    expect(center.navScrollTo).toHaveBeenCalledWith({ top: 100, behavior: "smooth" });
    cleanup();

    const end = setup({ options: { position: "end", offset: 10 } });
    userScroll(end.container, 1090);
    expect(end.navScrollTo).toHaveBeenCalledWith({ top: 90, behavior: "smooth" });
  });

  it("scrolls a horizontal nav along its own axis", () => {
    const { container, navScrollTo } = setup({
      navStyle: { overflowX: "auto" },
      horizontal: true,
    });

    userScroll(container, 1090);
    expect(navScrollTo).toHaveBeenCalledWith({ left: 80, behavior: "smooth" });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("never scrolls the page when the nav has no scroll container", () => {
    const { container, navScrollTo, containerScrollTo } = setup({ navStyle: {} });

    userScroll(container, 1090);
    expect(screen.getByTestId("active").textContent).toBe("c");
    expect(navScrollTo).not.toHaveBeenCalled();
    expect(containerScrollTo).not.toHaveBeenCalled();
    expect(windowScrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("never scrolls the tracked container to reveal a nav item", () => {
    const { container, navScrollTo, containerScrollTo } = setup({
      navStyle: {},
      navInsideContainer: true,
    });

    userScroll(container, 1090);
    expect(screen.getByTestId("active").textContent).toBe("c");
    expect(navScrollTo).not.toHaveBeenCalled();
    expect(containerScrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
