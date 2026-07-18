// Pure view math for the calendar screens: per-calendar hue assignment (the
// seven --cal-* tokens) and side-by-side packing of overlapping events.
// No DOM, no store — unit-testable.
import type { CalendarInfo } from "./types";

/** The seven theme-aware calendar hues, in assignment order. */
export const CAL_HUES = [
  "cerulean",
  "green",
  "violet",
  "amber",
  "rose",
  "teal",
  "gray",
] as const;
export type CalHue = (typeof CAL_HUES)[number];

/** CSS value for a hue: `var(--cal-green)`. */
export function hueVar(hue: CalHue): string {
  return `var(--cal-${hue})`;
}

/** One hue per calendar: the primary calendar is always cerulean, the rest
 *  follow list order through the seven-hue cycle. Stable as long as the
 *  calendarList order is (Google keeps primary first, then alphabetical). */
export function assignCalendarHues(
  calendars: CalendarInfo[]
): Record<string, CalHue> {
  const ordered = [...calendars].sort(
    (a, b) => Number(b.primary) - Number(a.primary)
  );
  const map: Record<string, CalHue> = {};
  ordered.forEach((c, i) => {
    map[c.id] = CAL_HUES[i % CAL_HUES.length];
  });
  return map;
}

/** Hue for an event's calendar; unknown ids (calendarList not loaded yet)
 *  hash to a stable hue instead of flashing a default. */
export function calendarHue(
  map: Record<string, CalHue>,
  calendarId: string
): CalHue {
  const hit = map[calendarId];
  if (hit) return hit;
  let h = 0;
  for (let i = 0; i < calendarId.length; i++) {
    h = (h * 31 + calendarId.charCodeAt(i)) >>> 0;
  }
  return CAL_HUES[h % CAL_HUES.length];
}

export interface PackSpan {
  id: string;
  startMs: number;
  endMs: number;
}

export interface PackSlot {
  /** Zero-based column within the cluster. */
  col: number;
  /** Total columns in the cluster (divide the day width by this). */
  cols: number;
}

/** Cluster-pack a day's timed events into side-by-side columns, Google-style:
 *  transitively overlapping events form a cluster; within it each event takes
 *  the first column that's free at its start, and every member shares the
 *  cluster's column count. Non-overlapping events stay full-width. */
export function packDay(spans: PackSpan[]): Record<string, PackSlot> {
  const evs = [...spans].sort(
    (a, b) => a.startMs - b.startMs || a.endMs - b.endMs
  );
  const out: Record<string, PackSlot> = {};

  let cluster: PackSpan[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const cols: Record<string, number> = {};
    for (const ev of cluster) {
      let placed = false;
      for (let i = 0; i < laneEnds.length; i++) {
        if (laneEnds[i] <= ev.startMs) {
          cols[ev.id] = i;
          laneEnds[i] = ev.endMs;
          placed = true;
          break;
        }
      }
      if (!placed) {
        cols[ev.id] = laneEnds.length;
        laneEnds.push(ev.endMs);
      }
    }
    for (const ev of cluster) {
      out[ev.id] = { col: cols[ev.id], cols: laneEnds.length };
    }
    cluster = [];
  };

  for (const ev of evs) {
    if (cluster.length > 0 && ev.startMs >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.endMs);
  }
  flush();
  return out;
}
