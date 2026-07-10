import { beforeAll, describe, expect, it } from "vitest";
import { parseSnooze, type SnoozeParse } from "./snooze-parse";

// Local-anchored expected instant, matching the parser's own construction.
const local = (y: number, mo: number, d: number, h = 8, mi = 0) =>
  new Date(y, mo, d, h, mi, 0, 0).getTime();

// Parse-or-throw for cases that must resolve.
function must(query: string, now: Date): SnoozeParse {
  const r = parseSnooze(query, now);
  if (!r) throw new Error(`expected "${query}" to parse`);
  return r;
}

const HOUR = 3_600_000;

// Month indices: Jan=0 … Jul=6, Aug=7, Sep=8, Oct=9, Nov=10, Dec=11.
const THU_2PM = new Date(2026, 6, 9, 14, 0, 0); // Thu Jul 9 2026, 14:00
const THU_6AM = new Date(2026, 6, 9, 6, 0, 0); // Thu Jul 9 2026, 06:00
const THU_4PM = new Date(2026, 6, 9, 16, 0, 0); // Thu Jul 9 2026, 16:00
const MON_NOON = new Date(2026, 6, 13, 12, 0, 0); // Mon Jul 13 2026, 12:00

beforeAll(() => {
  // The DST tests are only meaningful in a DST-observing zone. vitest.config.ts
  // pins TZ=America/New_York; fail loudly if that didn't take effect.
  const janOffset = new Date(2026, 0, 1).getTimezoneOffset();
  expect(janOffset, "tests must run in America/New_York (TZ not applied)").toBe(300);
});

describe("bare clock times — next occurrence, rolling to tomorrow if past", () => {
  it("rolls '8 am' to tomorrow when 8am already passed today", () => {
    expect(must("8 am", THU_2PM).atMs).toBe(local(2026, 6, 10, 8));
  });

  it("keeps '8 am' today when still ahead", () => {
    expect(must("8 am", THU_6AM).atMs).toBe(local(2026, 6, 9, 8));
  });

  it("resolves '3pm' to today when ahead", () => {
    expect(must("3pm", THU_2PM).atMs).toBe(local(2026, 6, 9, 15));
  });

  it("rolls '3pm' to tomorrow when past", () => {
    expect(must("3pm", THU_4PM).atMs).toBe(local(2026, 6, 10, 15));
  });

  it("parses colon times '8:30' (still ahead → today)", () => {
    expect(must("8:30", THU_6AM).atMs).toBe(local(2026, 6, 9, 8, 30));
  });

  it("resolves 'noon' and 'midnight'", () => {
    expect(must("noon", THU_6AM).atMs).toBe(local(2026, 6, 9, 12));
    // midnight today already passed at 2pm → tomorrow 00:00
    expect(must("midnight", THU_2PM).atMs).toBe(local(2026, 6, 10, 0));
  });
});

describe("8 AM default when a time is omitted", () => {
  it("defaults relative days to 8 AM", () => {
    const r = must("3 days", THU_2PM);
    expect(r.atMs).toBe(local(2026, 6, 12, 8));
    expect(new Date(r.atMs).getHours()).toBe(8);
  });

  it("defaults weeks to 8 AM", () => {
    expect(must("2 weeks", THU_2PM).atMs).toBe(local(2026, 6, 23, 8));
  });

  it("defaults weekdays to 8 AM", () => {
    expect(must("monday", THU_2PM).atMs).toBe(local(2026, 6, 13, 8));
  });

  it("defaults absolute dates to 8 AM", () => {
    expect(new Date(must("aug 20", THU_2PM).atMs).getHours()).toBe(8);
  });
});

describe("relative durations carry an exact instant", () => {
  it("'in 2 hours' adds exactly two hours of real time", () => {
    expect(must("in 2 hours", THU_2PM).atMs).toBe(THU_2PM.getTime() + 2 * HOUR);
  });

  it("'90 minutes' (no 'in') adds ninety minutes", () => {
    expect(must("90 minutes", THU_2PM).atMs).toBe(THU_2PM.getTime() + 90 * 60_000);
  });

  it("'in 30 seconds' supports short demo reminders", () => {
    expect(must("in 30 seconds", THU_2PM).atMs).toBe(THU_2PM.getTime() + 30_000);
  });
});

describe("weekdays", () => {
  it("bare 'tuesday' → the coming Tuesday", () => {
    const r = must("tuesday", MON_NOON);
    expect(r.atMs).toBe(local(2026, 6, 14, 8));
    expect(new Date(r.atMs).getDay()).toBe(2);
  });

  it("bare weekday excludes today (Monday → next Monday)", () => {
    expect(must("mon", MON_NOON).atMs).toBe(local(2026, 6, 20, 8));
  });

  it("'next tuesday' → Tuesday of next calendar week", () => {
    const r = must("next tuesday", MON_NOON);
    expect(r.atMs).toBe(local(2026, 6, 21, 8));
    expect(new Date(r.atMs).getDay()).toBe(2);
  });
});

describe("absolute dates resolve to the next FUTURE occurrence", () => {
  it("'aug 7' after Aug 7 rolls to next year", () => {
    const now = new Date(2026, 8, 1, 12, 0, 0); // Sep 1 2026 — Aug 7 has passed
    const r = must("aug 7", now);
    expect(r.atMs).toBe(local(2027, 7, 7, 8));
    expect(new Date(r.atMs).getFullYear()).toBe(2027);
  });

  it("'aug 7' before Aug 7 stays this year", () => {
    const now = new Date(2026, 0, 1, 12, 0, 0); // Jan 1 2026
    expect(must("aug 7", now).atMs).toBe(local(2026, 7, 7, 8));
  });

  it("numeric '8/7' is US month/day", () => {
    expect(must("8/7", THU_2PM).atMs).toBe(local(2026, 7, 7, 8));
  });

  it("'8/7/2027' honors an explicit year", () => {
    expect(must("8/7/2027", THU_2PM).atMs).toBe(local(2027, 7, 7, 8));
  });

  it("an explicitly past date does not parse (can't be a future reminder)", () => {
    expect(parseSnooze("aug 7 2020", THU_2PM)).toBeNull();
  });
});

describe("DST boundaries (America/New_York)", () => {
  it("spring-forward: 'tomorrow' at 8 AM is 23h of real time away", () => {
    const now = new Date(2026, 2, 7, 8, 0, 0); // Mar 7 2026 08:00 EST
    const r = must("tomorrow", now);
    expect(r.atMs).toBe(local(2026, 2, 8, 8)); // Mar 8 08:00 EDT
    expect(r.atMs - now.getTime()).toBe(23 * HOUR); // lost an hour
    expect(new Date(r.atMs).getHours()).toBe(8); // wall clock preserved
  });

  it("fall-back: 'tomorrow' at 8 AM is 25h of real time away", () => {
    const now = new Date(2026, 9, 31, 8, 0, 0); // Oct 31 2026 08:00 EDT
    const r = must("tomorrow", now);
    expect(r.atMs).toBe(local(2026, 10, 1, 8)); // Nov 1 08:00 EST
    expect(r.atMs - now.getTime()).toBe(25 * HOUR); // gained an hour
  });

  it("hour offsets add real elapsed time across a spring-forward gap", () => {
    const now = new Date(2026, 2, 8, 1, 0, 0); // Mar 8 01:00 EST, before the 2am jump
    expect(must("in 2 hours", now).atMs).toBe(now.getTime() + 2 * HOUR);
  });

  it("relative days stay wall-anchored across spring-forward (71h, not 72h)", () => {
    const now = new Date(2026, 2, 7, 8, 0, 0); // Mar 7 08:00 EST
    const r = must("3 days", now);
    expect(r.atMs).toBe(local(2026, 2, 10, 8)); // Mar 10 08:00 EDT, wall clock held
    expect(r.atMs - now.getTime()).toBe(71 * HOUR); // one clock hour lost in the gap
  });
});

describe("ambiguous bare hour picks the soonest AM/PM reading", () => {
  it("bare '8' after 8 AM → 8 PM today", () => {
    expect(must("8", THU_2PM).atMs).toBe(local(2026, 6, 9, 20));
  });

  it("bare '8' before 8 AM → 8 AM today", () => {
    expect(must("8", THU_6AM).atMs).toBe(local(2026, 6, 9, 8));
  });
});

describe("does not misparse ordinary words that share a weekday/month prefix", () => {
  it("returns null for English words, not a bogus weekday reminder", () => {
    for (const w of ["friend", "month", "wedding", "sunny", "satisfy", "money", "monster"]) {
      expect(parseSnooze(w, THU_2PM), `"${w}" must not parse`).toBeNull();
    }
  });

  it("still parses real weekday/month names and abbreviations", () => {
    for (const w of ["mon", "monday", "tues", "thurs", "sept 11", "friday"]) {
      expect(parseSnooze(w, THU_2PM), `"${w}" must parse`).not.toBeNull();
    }
  });
});

describe("leap-day roll never emits a wrong date", () => {
  it("'feb 29' whose year-roll lands on a non-leap year returns null, not Mar 1", () => {
    const now = new Date(2028, 2, 1, 12, 0, 0); // Mar 1 2028; Feb 29 2028 already passed
    expect(parseSnooze("feb 29", now)).toBeNull();
  });
});

describe("combined date + time", () => {
  it("'tomorrow 9am'", () => {
    expect(must("tomorrow 9am", THU_2PM).atMs).toBe(local(2026, 6, 10, 9));
  });

  it("'aug 7 3pm'", () => {
    expect(must("aug 7 3pm", THU_2PM).atMs).toBe(local(2026, 7, 7, 15));
  });
});

describe("labels describe the resolved day", () => {
  it("'tomorrow' → Tomorrow", () => {
    expect(must("tomorrow", THU_2PM).label).toBe("Tomorrow");
  });

  it("same-day relative → Today", () => {
    expect(must("in 2 hours", THU_2PM).label).toBe("Today");
  });

  it("within the week → weekday name", () => {
    expect(must("monday", THU_2PM).label).toBe("Monday");
  });

  it("far out → month + day", () => {
    const now = new Date(2026, 8, 1, 12, 0, 0);
    expect(must("aug 7", now).label).toContain("Aug 7");
  });
});

describe("guarantees & rejections", () => {
  it("every resolved reminder is strictly in the future", () => {
    const inputs = [
      "8 am",
      "3pm",
      "8:30",
      "noon",
      "midnight",
      "in 2 hours",
      "90 minutes",
      "3 days",
      "2 weeks",
      "monday",
      "next tuesday",
      "aug 7",
      "8/7",
    ];
    for (const q of inputs) {
      const r = must(q, THU_2PM);
      expect(r.atMs, `"${q}" must be future`).toBeGreaterThan(THU_2PM.getTime());
    }
  });

  it("returns null for unparseable input", () => {
    expect(parseSnooze("", THU_2PM)).toBeNull();
    expect(parseSnooze("   ", THU_2PM)).toBeNull();
    expect(parseSnooze("asdf", THU_2PM)).toBeNull();
    expect(parseSnooze("the quick brown fox", THU_2PM)).toBeNull();
  });
});
