// Hand-rolled natural-language parser for the Remind-me (snooze) picker.
// Turns a typed phrase into an absolute epoch + a human day label:
//   "8 am"        → next 8:00 (today or tomorrow)
//   "in 2 hours"  → now + 2h (exact instant)
//   "3 days"      → +3 days at 8 AM
//   "next tuesday"→ next-week Tuesday at 8 AM
//   "aug 7", "8/7"→ next future Aug 7 at 8 AM
//
// Times are built with a LOCAL-anchored Date (setHours/setDate), exactly like
// the picker's old at() helper, so the returned epoch is an absolute instant
// that survives DST and stays correct regardless of the machine's zone. Any
// input that omits a time-of-day defaults to 8 AM local. The result is always
// strictly in the future — the Rust core rejects past reminder times.

export interface SnoozeParse {
  atMs: number;
  /** Day description for the row/toast, e.g. "Tomorrow", "Monday", "Mon, Aug 7". */
  label: string;
}

// Canonical names in full. A typed word matches only if a name STARTS WITH it,
// so real forms and abbreviations ("mon", "monday", "tues", "thurs", "sept")
// resolve, while look-alike words ("month", "friend", "wedding") do not.
const WEEKDAY_NAMES: readonly [string, number][] = [
  ["sunday", 0], ["monday", 1], ["tuesday", 2], ["wednesday", 3],
  ["thursday", 4], ["friday", 5], ["saturday", 6],
];
const MONTH_NAMES: readonly [string, number][] = [
  ["january", 0], ["february", 1], ["march", 2], ["april", 3],
  ["may", 4], ["june", 5], ["july", 6], ["august", 7],
  ["september", 8], ["october", 9], ["november", 10], ["december", 11],
];

const DAY_MS = 86_400_000;
const DEFAULT_HOUR = 8;

interface TimeTok {
  hour: number; // 0–23 once resolved, or the raw 1–11 when ambiguous
  minute: number;
  /** true → `hour` is an exact 24h value; false → ambiguous 1–11 (am/pm unknown). */
  fixed: boolean;
}

export function parseSnooze(query: string, now: Date = new Date()): SnoozeParse | null {
  const raw = query.trim().toLowerCase();
  if (!raw) return null;

  // A) Instant offsets that carry an exact time-of-day: seconds / minutes / hours.
  //    (Days and weeks fall through so they can default to 8 AM instead.)
  const off = raw.match(
    /^(?:in\s+)?(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)$/
  );
  if (off) {
    const n = parseInt(off[1], 10);
    if (n <= 0) return null;
    const unit = off[2];
    const ms = /^s/.test(unit) ? 1000 : /^h/.test(unit) ? 3_600_000 : 60_000;
    const atMs = now.getTime() + n * ms;
    return atMs > now.getTime() ? build(atMs, now) : null;
  }

  // B) An optional time-of-day plus a date phrase (either order).
  const { time, rest } = extractTime(raw);

  // Pure time-of-day: nothing left after pulling the clock, or a lone hour number.
  if (rest === "" || /^\d{1,2}$/.test(rest)) {
    let t = time;
    if (!t && /^\d{1,2}$/.test(rest)) {
      const h = parseInt(rest, 10);
      if (h > 23) return null;
      t = toTime(h, 0, undefined); // bare "8" → ambiguous, soonest of 8am/8pm
    }
    if (!t) return null;
    const atMs = resolveTimeOnly(now, t);
    return atMs > now.getTime() ? build(atMs, now) : null;
  }

  // A date phrase, possibly with a time.
  const date = parseDate(rest, now);
  if (!date) return null;

  const base = date.base; // local midnight of the target day
  if (time) applyTime(base, time);
  else base.setHours(DEFAULT_HOUR, 0, 0, 0);

  let atMs = base.getTime();
  if (atMs <= now.getTime() && date.rollYear) {
    const month = base.getMonth();
    const day = base.getDate();
    base.setFullYear(base.getFullYear() + 1); // "aug 7" already passed → next year
    // A "feb 29" roll can land on a non-leap year; don't emit a drifted date.
    if (base.getMonth() !== month || base.getDate() !== day) return null;
    atMs = base.getTime();
  }
  if (atMs <= now.getTime()) return null;
  return build(atMs, now);
}

/** Pull a time-of-day out of the phrase; return it plus the leftover date text. */
function extractTime(input: string): { time: TimeTok | null; rest: string } {
  let time: TimeTok | null = null;
  let rest = input;

  if (/\bnoon\b/.test(rest)) {
    time = { hour: 12, minute: 0, fixed: true };
    rest = rest.replace(/\bnoon\b/, " ");
  } else if (/\bmidnight\b/.test(rest)) {
    time = { hour: 0, minute: 0, fixed: true };
    rest = rest.replace(/\bmidnight\b/, " ");
  } else {
    // H:MM with optional am/pm — "8:30", "8:30pm", "20:15"
    let m = rest.match(/\b(\d{1,2}):(\d{2})\s*(am|pm|a|p)?\b/);
    if (m && parseInt(m[1], 10) <= 23 && parseInt(m[2], 10) <= 59) {
      time = toTime(parseInt(m[1], 10), parseInt(m[2], 10), m[3]);
      rest = rest.replace(m[0], " ");
    } else {
      // H with am/pm — "3pm", "8 am", "8a"
      m = rest.match(/\b(\d{1,2})\s*(am|pm|a|p)\b/);
      if (m && parseInt(m[1], 10) <= 23) {
        time = toTime(parseInt(m[1], 10), 0, m[2]);
        rest = rest.replace(m[0], " ");
      }
    }
  }

  rest = rest.replace(/\bat\b/g, " ").replace(/@/g, " ").replace(/\s+/g, " ").trim();
  return { time, rest };
}

/** Normalize a raw hour + optional meridiem into a TimeTok. */
function toTime(rawHour: number, minute: number, meridiem: string | undefined): TimeTok {
  if (meridiem) {
    const pm = meridiem[0] === "p";
    let hour = rawHour % 12; // 12am/12pm → 0, then +12 for pm
    if (pm) hour += 12;
    return { hour, minute, fixed: true };
  }
  // No meridiem: 0, 12 (noon) and 13–23 are unambiguous; 1–11 are not.
  if (rawHour === 0 || rawHour === 12 || rawHour >= 13) {
    return { hour: rawHour, minute, fixed: true };
  }
  return { hour: rawHour, minute, fixed: false };
}

/** Bare time with no date → the next occurrence of that clock time. */
function resolveTimeOnly(now: Date, t: TimeTok): number {
  if (t.fixed) {
    const c = new Date(now);
    c.setHours(t.hour, t.minute, 0, 0);
    if (c.getTime() <= now.getTime()) c.setDate(c.getDate() + 1);
    return c.getTime();
  }
  // Ambiguous 1–11: pick the soonest future of the AM or PM reading.
  const am = new Date(now);
  am.setHours(t.hour, t.minute, 0, 0);
  const pm = new Date(now);
  pm.setHours(t.hour + 12, t.minute, 0, 0);
  const future = [am.getTime(), pm.getTime()]
    .filter((ms) => ms > now.getTime())
    .sort((a, b) => a - b);
  if (future.length) return future[0];
  // Both readings passed today → tomorrow's AM reading.
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(t.hour, t.minute, 0, 0);
  return next.getTime();
}

/** Apply a time to an explicit target date (ambiguous 1–11 reads as AM). */
function applyTime(base: Date, t: TimeTok): void {
  base.setHours(t.hour, t.minute, 0, 0);
}

interface DateHit {
  base: Date; // local midnight of the target day
  rollYear: boolean; // bump a year if already past (undated month/day)
}

/** Parse the date portion of the phrase (no time-of-day). */
function parseDate(s: string, now: Date): DateHit | null {
  if (/^(today|tod)$/.test(s)) return { base: midnight(now), rollYear: false };
  if (/^(tomorrow|tomo|tmrw|tmr|tom)$/.test(s)) {
    return { base: addDays(midnight(now), 1), rollYear: false };
  }

  // Relative "N days" / "N weeks" (default 8 AM applied by the caller).
  let m = s.match(/^(?:in\s+)?(\d+)\s*(days?|d|weeks?|wks?|w)$/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n <= 0) return null;
    const days = /^w/.test(m[2]) ? n * 7 : n;
    return { base: addDays(midnight(now), days), rollYear: false };
  }

  // "next week" → the coming Monday (excluding today), like the curated preset.
  if (/^next\s+week$/.test(s)) {
    const ahead = ((1 - now.getDay() + 7) % 7) || 7;
    return { base: addDays(midnight(now), ahead), rollYear: false };
  }

  // Weekday, optional "next"/"this"/"on" prefix.
  m = s.match(/^(?:(next|this)\s+)?(?:on\s+)?([a-z]{3,9})$/);
  if (m) {
    const target = lookup(WEEKDAY_NAMES, m[2]);
    if (target >= 0) {
      const dow = now.getDay();
      const ahead =
        m[1] === "next"
          ? ((7 - dow) % 7 || 7) + target // that weekday in next calendar week
          : ((target - dow + 7) % 7) || 7; // coming weekday, excluding today
      return { base: addDays(midnight(now), ahead), rollYear: false };
    }
  }

  // Month name + day: "aug 7", "august 7th", "aug 7 2027", "aug 7, 2027".
  m = s.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:[,\s]+(\d{4}))?$/);
  if (m && lookup(MONTH_NAMES, m[1]) >= 0) {
    return monthDay(lookup(MONTH_NAMES, m[1]), parseInt(m[2], 10), m[3], now);
  }
  // Day + month: "7 aug", "7th august 2027".
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?(?:[,\s]+(\d{4}))?$/);
  if (m && lookup(MONTH_NAMES, m[2]) >= 0) {
    return monthDay(lookup(MONTH_NAMES, m[2]), parseInt(m[1], 10), m[3], now);
  }

  // Numeric M/D or M/D/Y (US-first), "/" or "-" separated.
  m = s.match(/^(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?$/);
  if (m) {
    let month = parseInt(m[1], 10) - 1;
    let day = parseInt(m[2], 10);
    if (month > 11 && day <= 12) {
      const first = month + 1; // first field can't be a month → treat as D/M
      month = day - 1;
      day = first;
    }
    return monthDay(month, day, m[3], now);
  }

  return null;
}

/** Build a validated month/day hit; rejects impossible dates (e.g. Feb 30). */
function monthDay(
  month: number,
  day: number,
  yearStr: string | undefined,
  now: Date
): DateHit | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const explicit = yearStr !== undefined;
  const year = explicit ? normalizeYear(yearStr!) : now.getFullYear();
  const base = new Date(year, month, day, 0, 0, 0, 0);
  if (base.getMonth() !== month || base.getDate() !== day) return null;
  return { base, rollYear: !explicit };
}

function normalizeYear(y: string): number {
  const n = parseInt(y, 10);
  return n < 100 ? 2000 + n : n;
}

function lookup(names: readonly [string, number][], word: string): number {
  for (const [name, index] of names) if (name.startsWith(word)) return index;
  return -1;
}

function midnight(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function addDays(d: Date, days: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
}

function build(atMs: number, now: Date): SnoozeParse {
  return { atMs, label: describeDay(new Date(atMs), now) };
}

/** Human day label relative to now; DST-safe (compares local midnights). */
function describeDay(target: Date, now: Date): string {
  const diff = Math.round((midnight(target).getTime() - midnight(now).getTime()) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff >= 2 && diff <= 6) return target.toLocaleDateString(undefined, { weekday: "long" });
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  if (target.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return target.toLocaleDateString(undefined, opts);
}
