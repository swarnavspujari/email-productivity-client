import { describe, expect, it } from "vitest";
import {
  assignCalendarHues,
  CAL_HUES,
  calendarHue,
  packDay,
} from "./calendar-view";
import type { CalendarInfo } from "./types";

const cal = (id: string, primary = false): CalendarInfo => ({
  id,
  name: id,
  color: null,
  accessRole: "owner",
  primary,
});

const H = 3600_000;
const span = (id: string, startH: number, endH: number) => ({
  id,
  startMs: startH * H,
  endMs: endH * H,
});

describe("assignCalendarHues", () => {
  it("gives the primary calendar cerulean regardless of list position", () => {
    const map = assignCalendarHues([cal("b"), cal("a", true), cal("c")]);
    expect(map["a"]).toBe("cerulean");
    expect(map["b"]).toBe("green");
    expect(map["c"]).toBe("violet");
  });

  it("cycles past seven calendars", () => {
    const cals = Array.from({ length: 9 }, (_, i) => cal(`c${i}`, i === 0));
    const map = assignCalendarHues(cals);
    expect(map["c7"]).toBe(CAL_HUES[0]);
    expect(map["c8"]).toBe(CAL_HUES[1]);
  });

  it("hashes unknown ids to a stable hue", () => {
    const map = assignCalendarHues([cal("known", true)]);
    const first = calendarHue(map, "mystery@group.calendar.google.com");
    expect(CAL_HUES).toContain(first);
    expect(calendarHue(map, "mystery@group.calendar.google.com")).toBe(first);
    expect(calendarHue(map, "known")).toBe("cerulean");
  });
});

describe("packDay", () => {
  it("keeps non-overlapping events full width", () => {
    const slots = packDay([span("a", 9, 10), span("b", 10, 11)]);
    expect(slots["a"]).toEqual({ col: 0, cols: 1 });
    expect(slots["b"]).toEqual({ col: 0, cols: 1 });
  });

  it("packs two overlapping events side by side", () => {
    const slots = packDay([span("a", 9, 11), span("b", 10, 12)]);
    expect(slots["a"]).toEqual({ col: 0, cols: 2 });
    expect(slots["b"]).toEqual({ col: 1, cols: 2 });
  });

  it("shares the cluster width across transitive overlaps", () => {
    // a overlaps b, b overlaps c, but a and c don't touch — one cluster of 2 lanes
    const slots = packDay([span("a", 9, 10.5), span("b", 10, 12), span("c", 11, 13)]);
    expect(slots["a"].cols).toBe(2);
    expect(slots["b"].cols).toBe(2);
    expect(slots["c"].cols).toBe(2);
    expect(slots["c"].col).toBe(0); // reuses a's lane once a ended
    expect(slots["b"].col).toBe(1);
  });

  it("gives three concurrent events three columns", () => {
    const slots = packDay([span("a", 9, 12), span("b", 9.5, 11), span("c", 10, 11.5)]);
    expect(new Set([slots["a"].col, slots["b"].col, slots["c"].col]).size).toBe(3);
    expect(slots["a"].cols).toBe(3);
  });

  it("starts a fresh cluster after a gap", () => {
    const slots = packDay([
      span("a", 9, 11),
      span("b", 10, 11),
      span("c", 14, 15),
    ]);
    expect(slots["a"].cols).toBe(2);
    expect(slots["c"]).toEqual({ col: 0, cols: 1 });
  });

  it("handles an empty day", () => {
    expect(packDay([])).toEqual({});
  });

  it("back-to-back events (end == next start) do not overlap", () => {
    const slots = packDay([span("a", 9, 10), span("b", 10, 10.5), span("c", 10, 11)]);
    expect(slots["a"].cols).toBe(1);
    expect(slots["b"].cols).toBe(2);
    expect(slots["c"].cols).toBe(2);
  });
});
