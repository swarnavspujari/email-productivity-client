// Cursor math for per-message keyboard navigation in a thread. Pure so it can be
// unit-tested without a DOM; ThreadView owns the state that feeds it.

/** Next focused-message index after a step, clamped to [0, count-1] (no wrap).
 *  Degenerates safely for 0/1-message threads (always 0). */
export function nextFocusIndex(cur: number, dir: 1 | -1, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(cur + dir, 0), count - 1);
}
