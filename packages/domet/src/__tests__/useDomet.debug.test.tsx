import React, { useRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDomet } from "../useDomet";
import {
  MockResizeObserver,
  THREE_SECTIONS,
  placeSections,
  renderDomet,
  setScrollMetrics,
  userScroll,
} from "./helpers";

async function settle(): Promise<void> {
  await act(async () => {
    await vi.dynamicImportSettled();
    vi.advanceTimersByTime(50);
  });
}

function panel(): ShadowRoot {
  const host = document.querySelector("[data-domet-debug]");
  if (!host?.shadowRoot) throw new Error("Debug panel is not mounted.");
  return host.shadowRoot;
}

function row(label: string): HTMLElement {
  const match = [...panel().querySelectorAll<HTMLElement>(".row")].find(
    (element) => element.querySelector(".label")?.textContent === label,
  );
  if (!match) throw new Error(`Row "${label}" was not found.`);
  return match;
}

function value(label: string): string | null {
  return row(label).querySelector(".value:not(.label)")?.textContent ?? null;
}

function open(): void {
  act(() => {
    panel().querySelector<HTMLElement>(".launcher")?.click();
    vi.advanceTimersByTime(20);
  });
}

function toggle(label: string): void {
  act(() => {
    [...panel().querySelectorAll(`[aria-label="${label}"] button`)]
      .find((button) => button.textContent === "on")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    vi.advanceTimersByTime(20);
  });
}

function cards(): Record<string, string[]> {
  return Object.fromEntries(
    [...panel().querySelectorAll(".card")].map((card) => {
      const [id, ...cells] = [...card.children].map((cell) => cell.textContent ?? "");
      return [id, cells];
    }),
  );
}

function type(label: string, text: string): void {
  const input = row(label).querySelector("input") as HTMLInputElement;
  act(() => {
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    vi.advanceTimersByTime(50);
  });
}

function press(element: HTMLElement, key: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
  act(() => {
    vi.advanceTimersByTime(50);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("debug panel", () => {
  it("is not mounted without the debug option", async () => {
    renderDomet(THREE_SECTIONS);
    await settle();

    expect(document.querySelector("[data-domet-debug]")).toBeNull();
  });

  it("shows a launcher that opens and closes the panel", async () => {
    renderDomet({ ...THREE_SECTIONS, hook: { debug: true } });
    await settle();

    const dock = panel().querySelector<HTMLElement>(".dock");
    const launcher = panel().querySelector<HTMLElement>(".launcher");
    expect(dock?.dataset.open).toBe("false");
    expect(launcher?.getAttribute("aria-label")).toBe("Open Domet debug panel");

    open();
    expect(dock?.dataset.open).toBe("true");
    expect(launcher?.getAttribute("aria-expanded")).toBe("true");

    press(panel().querySelector(".panel") as HTMLElement, "Escape");
    expect(dock?.dataset.open).toBe("false");
  });

  it("reports the live state of the hook", async () => {
    const view = renderDomet({ ...THREE_SECTIONS, hook: { debug: true } });
    await settle();
    open();

    expect(value("Active")).toBe("a");
    expect(value("Threshold")).toBe("0.60");

    userScroll(view.container, 560);

    expect(value("Active")).toBe("b");
    expect(value("Index")).toBe("1");
    expect(value("Scroll Y")).toBe("560 / 1100");
    expect(value("b")).toBe("80%");
    expect(row("b").querySelector<HTMLElement>(".fill")?.style.width).toBe("80%");
    expect(row("b").dataset.active).toBe("true");
    expect(panel().querySelector(".log")?.textContent).toContain("active a → b");
  });

  it("explains on the page why a section is active", async () => {
    const view = renderDomet({
      ids: ["a", "b", "c"],
      layout: [
        [0, 700],
        [700, 600],
        [1300, 1700],
      ],
      viewport: 600,
      scrollHeight: 3000,
      hook: { debug: true },
    });
    await settle();
    expect(panel().querySelector(".card")).toBeNull();

    toggle("Section Scores");
    userScroll(view.container, 460);

    expect(view.active()).toBe("b");
    expect(cards()).toEqual({
      a: [
        "933",
        "visible 34% < 60%",
        "320",
        "trigger line",
        "300",
        "center 225px from line",
        "313",
        "takes over above 1596",
      ],
      b: [
        "1446",
        "visible 60% ≥ 60%",
        "1300",
        "trigger line",
        "0",
        "center 425px from line",
        "146",
        "active · highest score",
      ],
    });
    const boxes = [...panel().querySelectorAll<HTMLElement>(".box")];
    expect(boxes.map((box) => box.dataset.active)).toEqual(["false", "true"]);
    expect(Number(boxes[1].style.getPropertyValue("--score"))).toBeCloseTo(1446 / 2300);

    act(() => {
      view.api().scrollTo("c", { behavior: "smooth" });
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(view.active()).toBe("c");
    expect(cards().c).toEqual(["", "active · scroll target"]);
    expect(cards().a).toHaveLength(7);
  });

  it("applies tracking changes to the hook as they are made", async () => {
    const view = renderDomet({
      ...THREE_SECTIONS,
      hook: { debug: true },
      children: (api) => <output data-testid="offset">{api.scroll.trackingOffset}</output>,
    });
    await settle();
    open();
    expect(screen.getByTestId("offset").textContent).toBe("0");

    type("Offset", "120");
    expect(screen.getByTestId("offset").textContent).toBe("120");
    expect(value("Trigger Line")).toBe("120px");

    type("Offset", "abc");
    expect(row("Offset").dataset.invalid).toBe("true");
    expect(panel().querySelector(".hint[role=status]")?.textContent).toBe(
      "Invalid format. Use a number (e.g. 100) or percentage (e.g. 10%).",
    );
    expect(screen.getByTestId("offset").textContent).toBe("120");

    userScroll(view.container, 350);
    expect(view.active()).toBe("b");
    userScroll(view.container, 0);
    expect(view.active()).toBe("a");

    press(row("Hysteresis"), "End");
    expect(value("Hysteresis")).toBe("1000");
    expect(row("Hysteresis").getAttribute("aria-valuenow")).toBe("1000");
    userScroll(view.container, 350);
    expect(view.active()).toBe("a");

    act(() => {
      [...panel().querySelectorAll<HTMLElement>("button.row")]
        .find((button) => button.textContent === "Reset")
        ?.click();
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByTestId("offset").textContent).toBe("0");
    expect(value("Hysteresis")).toBe("150");
    expect(panel().querySelector(".hint[role=status]")?.textContent).toBe("");
  });

  it("re-evaluates the active section when hysteresis changes", async () => {
    const view = renderDomet({ ...THREE_SECTIONS, hook: { debug: true } });
    await settle();
    open();

    press(row("Hysteresis"), "End");
    userScroll(view.container, 380);
    expect(view.active()).toBe("a");

    press(row("Hysteresis"), "Home");
    expect(value("Hysteresis")).toBe("0");
    expect(view.active()).toBe("b");
  });

  it("applies scrolling changes and scrolls from the section list", async () => {
    const view = renderDomet({ ...THREE_SECTIONS, hook: { debug: true } });
    await settle();
    open();

    const behavior = row("Behavior").querySelector("select") as HTMLSelectElement;
    const position = row("Position").querySelector("select") as HTMLSelectElement;
    act(() => {
      behavior.value = "instant";
      behavior.dispatchEvent(new Event("change", { bubbles: true }));
      position.value = "top";
      position.dispatchEvent(new Event("change", { bubbles: true }));
    });

    act(() => {
      row("b").click();
    });
    expect(view.scrollToSpy).toHaveBeenLastCalledWith({ top: 500, behavior: "instant" });
  });

  it("keeps focus on a section row when the hook renders again", async () => {
    const view = renderDomet({ ...THREE_SECTIONS, hook: { debug: true } });
    await settle();
    open();

    row("b").focus();
    expect(panel().activeElement).toBe(row("b"));

    userScroll(view.container, 560);
    expect(view.active()).toBe("b");
    expect(panel().activeElement).toBe(row("b"));
  });

  it("draws the trigger line and the section outlines on demand", async () => {
    const view = renderDomet({ ...THREE_SECTIONS, hook: { debug: true } });
    await settle();

    const trigger = panel().querySelector<HTMLElement>(".trigger");
    expect(trigger?.style.display).toBe("none");

    toggle("Trigger Line");
    toggle("Section Outlines");
    userScroll(view.container, 560);

    expect(trigger?.style.display).toBe("block");
    expect(trigger?.textContent).toMatch(/^trigger \d+px$/);
    const boxes = [...panel().querySelectorAll<HTMLElement>(".box")];
    expect(boxes.map((box) => box.textContent)).toEqual(["b"]);
    expect(boxes[0].dataset.active).toBe("true");
    expect(panel().querySelector(".card")).toBeNull();
  });

  it("copies the current options", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    renderDomet({
      ...THREE_SECTIONS,
      hook: { debug: true, tracking: { offset: "10%" }, scrolling: { position: "top" } },
    });
    await settle();

    await act(async () => {
      [...panel().querySelectorAll<HTMLElement>("button.row")]
        .find((button) => button.textContent === "Copy Options")
        ?.click();
    });

    expect(writeText).toHaveBeenCalledWith(
      [
        'tracking: { offset: "10%", threshold: 0.6, hysteresis: 150 },',
        'scrolling: { behavior: "auto", position: "top" },',
      ].join("\n"),
    );
  });

  it("reports a failed copy when the clipboard is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    renderDomet({ ...THREE_SECTIONS, hook: { debug: true } });
    await settle();

    const copyButton = [...panel().querySelectorAll<HTMLElement>("button.row")].find(
      (button) => button.textContent === "Copy Options",
    );
    await act(async () => {
      copyButton?.click();
    });

    expect(copyButton?.textContent).toBe("Copy failed. Clipboard access was denied.");
  });

  it("moves into the modal dialog that holds the tracked container", async () => {
    function Component() {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const { register } = useDomet({ ids: ["a"], container: containerRef, debug: true });
      return (
        <dialog data-testid="dialog">
          <div ref={containerRef}>
            <div {...register("a")} />
          </div>
        </dialog>
      );
    }

    render(<Component />);
    await settle();
    const dialog = screen.getByTestId("dialog");
    const host = document.querySelector("[data-domet-debug]") as HTMLElement;
    expect(host.parentElement).toBe(document.body);

    let isModal = true;
    const matches = dialog.matches.bind(dialog);
    dialog.matches = (selector: string) =>
      selector === ":modal" ? isModal : matches(selector);

    await act(async () => {
      dialog.setAttribute("open", "");
      await Promise.resolve();
    });
    expect(host.parentElement).toBe(dialog);

    isModal = false;
    await act(async () => {
      dialog.removeAttribute("open");
      await Promise.resolve();
    });
    expect(host.parentElement).toBe(document.body);
  });

  it("is removed when debug is turned off or the component unmounts", async () => {
    function Component({ debug }: { debug: boolean }) {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const { scroll, register } = useDomet({ ids: ["a"], container: containerRef, debug });
      return (
        <div ref={containerRef} data-testid="container">
          <output data-testid="offset">{scroll.trackingOffset}</output>
          <div {...register("a")} />
        </div>
      );
    }

    const { rerender, unmount } = render(<Component debug />);
    const container = screen.getByTestId("container");
    setScrollMetrics(container, 400, 1000);
    placeSections(container, [[0, 1000]]);
    await settle();
    open();
    type("Offset", "60");
    expect(screen.getByTestId("offset").textContent).toBe("60");

    rerender(<Component debug={false} />);
    await settle();
    expect(document.querySelector("[data-domet-debug]")).toBeNull();
    expect(screen.getByTestId("offset").textContent).toBe("0");

    rerender(<Component debug />);
    await settle();
    expect(document.querySelectorAll("[data-domet-debug]")).toHaveLength(1);

    unmount();
    expect(document.querySelector("[data-domet-debug]")).toBeNull();
  });
});
