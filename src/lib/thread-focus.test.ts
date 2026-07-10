import { describe, expect, it } from "vitest";
import { nextFocusIndex } from "./thread-focus";

// The per-message cursor math for thread navigation: step within [0, count-1],
// clamp at both ends (no wrap), and degenerate safely for 0/1-message threads.
describe("nextFocusIndex", () => {
  it("steps down within range", () => {
    expect(nextFocusIndex(0, 1, 3)).toBe(1);
    expect(nextFocusIndex(1, 1, 3)).toBe(2);
  });

  it("steps up within range", () => {
    expect(nextFocusIndex(2, -1, 3)).toBe(1);
  });

  it("clamps at the last message (no wrap past the end)", () => {
    expect(nextFocusIndex(2, 1, 3)).toBe(2);
  });

  it("clamps at the first message (no wrap before the start)", () => {
    expect(nextFocusIndex(0, -1, 3)).toBe(0);
  });

  it("stays put in a single-message thread", () => {
    expect(nextFocusIndex(0, 1, 1)).toBe(0);
    expect(nextFocusIndex(0, -1, 1)).toBe(0);
  });

  it("returns 0 for an empty thread", () => {
    expect(nextFocusIndex(0, 1, 0)).toBe(0);
  });
});
