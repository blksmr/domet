import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveSectionsFromIds } from "../utils/resolvers";
import { buildViewportRect } from "../utils/scoring";
import { MockResizeObserver, THREE_SECTIONS, renderDomet, scrollFrame } from "./helpers";

vi.mock("../utils/scoring", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/scoring")>();
  return { ...actual, buildViewportRect: vi.fn(actual.buildViewportRect) };
});

vi.mock("../utils/resolvers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/resolvers")>();
  return { ...actual, resolveSectionsFromIds: vi.fn(actual.resolveSectionsFromIds) };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  vi.mocked(buildViewportRect).mockClear();
  vi.mocked(resolveSectionsFromIds).mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("per-frame work", () => {
  it("does not build sections state until sections is read", () => {
    const view = renderDomet(THREE_SECTIONS);

    scrollFrame(view.container, 100);
    scrollFrame(view.container, 200);
    scrollFrame(view.container, 300);
    expect(buildViewportRect).not.toHaveBeenCalled();

    expect(Object.keys(view.api().sections)).toEqual(["a", "b", "c"]);
    expect(buildViewportRect).toHaveBeenCalledTimes(3);

    scrollFrame(view.container, 400);
    expect(buildViewportRect).toHaveBeenCalledTimes(6);
  });

  it("builds sections state every frame for a component that renders it", () => {
    const view = renderDomet({
      ...THREE_SECTIONS,
      children: (api) => <output>{Object.keys(api.sections).length}</output>,
    });
    vi.mocked(buildViewportRect).mockClear();

    scrollFrame(view.container, 100);
    scrollFrame(view.container, 200);
    expect(buildViewportRect).toHaveBeenCalledTimes(6);
  });

  it("resolves mounted sections once, not on every frame", () => {
    const view = renderDomet(THREE_SECTIONS);
    const callsAfterMount = vi.mocked(resolveSectionsFromIds).mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);

    scrollFrame(view.container, 100);
    scrollFrame(view.container, 200);
    scrollFrame(view.container, 300);
    expect(resolveSectionsFromIds).toHaveBeenCalledTimes(callsAfterMount);
  });
});
