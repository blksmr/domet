import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Offset } from "../types";
import {
  VALIDATION_LIMITS,
  sanitizeHysteresis,
  sanitizeIds,
  sanitizeOffset,
  sanitizeSelector,
  sanitizeThreshold,
} from "../utils";

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sanitizeOffset", () => {
  it("returns the default for undefined", () => {
    expect(sanitizeOffset(undefined)).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps valid pixel and percentage values", () => {
    expect(sanitizeOffset(100)).toBe(100);
    expect(sanitizeOffset(-50)).toBe(-50);
    expect(sanitizeOffset("10%")).toBe("10%");
    expect(sanitizeOffset(" 12.5% " as Offset)).toBe("12.5%");
    expect(warn).not.toHaveBeenCalled();
  });

  it("clamps out-of-range values with a warning", () => {
    expect(sanitizeOffset(20000)).toBe(VALIDATION_LIMITS.offset.max);
    expect(sanitizeOffset(-20000)).toBe(VALIDATION_LIMITS.offset.min);
    expect(sanitizeOffset("900%")).toBe("500%");
    expect(sanitizeOffset("-900%")).toBe("-500%");
    expect(warn).toHaveBeenCalledWith("[domet] Offset 20000 clamped to [-10000, 10000].");
    expect(warn).toHaveBeenCalledTimes(4);
  });

  it("falls back to the default for invalid values", () => {
    expect(sanitizeOffset(Number.NaN)).toBe(0);
    expect(sanitizeOffset(Number.POSITIVE_INFINITY)).toBe(0);
    expect(sanitizeOffset("abc" as Offset)).toBe(0);
    expect(sanitizeOffset("10px" as Offset)).toBe(0);
    expect(sanitizeOffset(true as unknown as Offset)).toBe(0);
    expect(warn).toHaveBeenCalledTimes(5);
  });
});

describe("sanitizeThreshold", () => {
  it("returns the default for undefined or invalid values", () => {
    expect(sanitizeThreshold(undefined)).toBe(0.6);
    expect(sanitizeThreshold(Number.NaN)).toBe(0.6);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("clamps to the 0-1 range", () => {
    expect(sanitizeThreshold(0.8)).toBe(0.8);
    expect(sanitizeThreshold(2)).toBe(1);
    expect(sanitizeThreshold(-1)).toBe(0);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe("sanitizeHysteresis", () => {
  it("returns the default for undefined or invalid values", () => {
    expect(sanitizeHysteresis(undefined)).toBe(150);
    expect(sanitizeHysteresis(Number.NaN)).toBe(150);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("clamps to the 0-1000 range", () => {
    expect(sanitizeHysteresis(200)).toBe(200);
    expect(sanitizeHysteresis(5000)).toBe(1000);
    expect(sanitizeHysteresis(-5)).toBe(0);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe("sanitizeIds", () => {
  it("trims, drops non-strings, empty values and duplicates", () => {
    const ids = ["a", " a ", "", 1, "b", "  "] as unknown as string[];
    expect(sanitizeIds(ids)).toEqual(["a", "b"]);
    expect(warn).toHaveBeenCalledWith('[domet] Duplicate id "a" detected. Skipping.');
    expect(warn).toHaveBeenCalledTimes(4);
  });

  it("returns an empty array for a non-array input", () => {
    expect(sanitizeIds(undefined)).toEqual([]);
    expect(sanitizeIds("a" as unknown as string[])).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("accepts an empty array silently", () => {
    expect(sanitizeIds([])).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("sanitizeSelector", () => {
  it("trims the selector", () => {
    expect(sanitizeSelector("  [data-section] ")).toBe("[data-section]");
    expect(sanitizeSelector(undefined)).toBe("");
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns on an empty or non-string selector", () => {
    expect(sanitizeSelector("   ")).toBe("");
    expect(sanitizeSelector(5 as unknown as string)).toBe("");
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
