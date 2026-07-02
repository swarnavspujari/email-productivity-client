import { useEffect, useMemo, useState } from "react";
import { backend } from "@/lib/ipc";
import type { CalendarEvent } from "@/lib/types";

const DAY_MS = 24 * 3600_000;
const FIRST_HOUR = 7;
const LAST_HOUR = 20;
const PX_PER_HOUR = 52;

function startOfDay(offset: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() + offset * DAY_MS;
}

function hourLabel(h: number): string {
  if (h === 12) return "12 pm";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

function timeRange(e: CalendarEvent): string {
  const fmt = (ms: number) =>
    new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${fmt(e.startMs)} – ${fmt(e.endMs)}`;
}

function EventBlock({ e, dayStart }: { e: CalendarEvent; dayStart: number }) {
  const gridStart = dayStart + FIRST_HOUR * 3600_000;
  const gridEnd = dayStart + LAST_HOUR * 3600_000;
  const s = Math.max(e.startMs, gridStart);
  const end = Math.min(Math.max(e.endMs, s + 15 * 60_000), gridEnd);
  if (end <= gridStart || s >= gridEnd) return null;
  const top = ((s - gridStart) / 3600_000) * PX_PER_HOUR;
  const height = Math.max(20, ((end - s) / 3600_000) * PX_PER_HOUR - 2);
  const past = e.endMs < Date.now();
  return (
    <div
      className={`absolute left-1 right-1 overflow-hidden rounded-md border border-accent/30 bg-accent-dim px-2 py-1 ${
        past ? "opacity-55" : ""
      }`}
      style={{ top, height }}
      title={`${e.title} · ${timeRange(e)}${e.location ? ` · ${e.location}` : ""}${
        e.calendar !== "Demo" ? ` · ${e.calendar}` : ""
      }`}
    >
      <div className="truncate text-[12px] font-medium leading-4 text-ink">
        {e.title}
      </div>
      {height > 34 && (
        <div className="truncate text-[11px] text-ink-3">{timeRange(e)}</div>
      )}
    </div>
  );
}

/** Right-hand day calendar, Superhuman-style: toggleable, read-only, fed by
 *  Google Calendar (or fixture events in demo mode). */
export function CalendarPanel() {
  const [dayOffset, setDayOffset] = useState(0);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const dayStart = useMemo(() => startOfDay(dayOffset), [dayOffset]);

  useEffect(() => {
    let stale = false;
    setError(null);
    backend
      .listEvents(dayStart, dayStart + DAY_MS)
      .then((ev) => {
        if (!stale) setEvents(ev);
      })
      .catch((e) => {
        if (!stale) {
          setEvents([]);
          setError(String(e));
        }
      });
    return () => {
      stale = true;
    };
  }, [dayStart]);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const timed = (events ?? []).filter((e) => !e.allDay);
  const allDay = (events ?? []).filter((e) => e.allDay);
  const isToday = dayOffset === 0;
  const nowTop =
    isToday && nowTick > dayStart + FIRST_HOUR * 3600_000 && nowTick < dayStart + LAST_HOUR * 3600_000
      ? ((nowTick - dayStart - FIRST_HOUR * 3600_000) / 3600_000) * PX_PER_HOUR
      : null;

  const title = new Date(dayStart).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-line bg-surface">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="flex-1 text-[14px] font-semibold text-ink">
          {title}
          {!isToday && (
            <button
              className="ml-2 rounded px-1.5 text-[11px] text-accent-strong hover:bg-hover"
              onClick={() => setDayOffset(0)}
            >
              today
            </button>
          )}
        </span>
        <button
          className="rounded-md border border-line px-2 py-0.5 text-ink-3 hover:bg-hover hover:text-ink"
          onClick={() => setDayOffset((d) => d - 1)}
          title="Previous day"
        >
          ‹
        </button>
        <button
          className="rounded-md border border-line px-2 py-0.5 text-ink-3 hover:bg-hover hover:text-ink"
          onClick={() => setDayOffset((d) => d + 1)}
          title="Next day"
        >
          ›
        </button>
      </div>

      {allDay.length > 0 && (
        <div className="space-y-1 px-4 pb-2">
          {allDay.map((e) => (
            <div
              key={e.id}
              className="truncate rounded-md border border-accent/30 bg-accent-dim px-2 py-1 text-[12px] font-medium text-ink"
              title={e.title}
            >
              {e.title}
            </div>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="px-4 py-6 text-[12px] leading-relaxed text-ink-3">
            {error.includes("reconnect")
              ? "Calendar needs a fresh Google consent — Settings → Account → Disconnect, then Connect Gmail again."
              : error}
          </div>
        ) : (
          <div className="relative mx-3 my-2" style={{ height: (LAST_HOUR - FIRST_HOUR) * PX_PER_HOUR }}>
            {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-line"
                style={{ top: i * PX_PER_HOUR }}
              >
                <span className="absolute -top-2 left-0 bg-surface pr-1 text-[10.5px] text-ink-3">
                  {hourLabel(FIRST_HOUR + i)}
                </span>
              </div>
            ))}
            <div className="absolute bottom-0 left-12 right-0 top-0">
              {timed.map((e) => (
                <EventBlock key={e.id} e={e} dayStart={dayStart} />
              ))}
              {events !== null && timed.length === 0 && (
                <div className="pt-10 text-center text-[12px] text-ink-3">
                  Nothing scheduled.
                </div>
              )}
            </div>
            {nowTop !== null && (
              <div
                className="absolute left-10 right-0 border-t-2 border-bad"
                style={{ top: nowTop }}
              >
                <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-bad" />
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
