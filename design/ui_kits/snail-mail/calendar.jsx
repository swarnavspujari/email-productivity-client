/* global React, ReactDOM */
/* Snail Mail — full calendar. A 24-hour, 7-day week grid where every event is
   drawn in its calendar's color, plus the right-hand calendar-management panel
   (mini month, Meet, Booking Pages, and the color-coded calendar list grouped
   by account). Toggling a calendar's checkbox shows/hides its events live. */
const { useState, useEffect, useRef, useLayoutEffect } = React;
const { days: DAYS, calAccounts: CAL_ACCOUNTS, weekEvents: WEEK_EVENTS } = window.SM_DATA;
const { Button, IconBtn, HoverHint, Kbd } = window.SM_UI;

/* ---- geometry ---- */
const GUT = 56;   // hour-label gutter width
const PXH = 48;   // pixels per hour row
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_ANCHOR = new Date(2026, 6, 5);   // Sun Jul 5 2026 — start of the demo week
const REF_TODAY = new Date(2026, 6, 10);    // Fri Jul 10 2026 — "today" in the demo

/* ---- calendar color lookup ---- */
const CAL_VAR = { cerulean: "--cal-cerulean", green: "--cal-green", violet: "--cal-violet", amber: "--cal-amber", rose: "--cal-rose", teal: "--cal-teal", gray: "--cal-gray" };
const cvar = (k) => `var(${CAL_VAR[k] || "--cal-cerulean"})`;
const CALS = {};
CAL_ACCOUNTS.forEach((a) => a.calendars.forEach((c) => { CALS[c.id] = c; }));
const colorOf = (id) => (CALS[id] ? CALS[id].color : "cerulean");

/* ---- time + date helpers ---- */
function hm(dec) { const h = Math.floor(dec + 1e-9); const m = Math.round((dec - h) * 60); const hh = ((h + 11) % 12) + 1; return `${hh}:${String(m).padStart(2, "0")}`; }
function ampm(dec) { return Math.floor(dec + 1e-9) < 12 ? "AM" : "PM"; }
function hourLabel(h) { if (h === 0) return "12 am"; if (h === 12) return "12 pm"; return h < 12 ? `${h} am` : `${h - 12} pm`; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function startOfWeek(d) { return addDays(d, -d.getDay()); }

/* Cluster-pack a day's events into side-by-side columns so overlaps sit next
   to each other (each ev gets _col + _cols). */
function layoutDay(list) {
  const evs = list.slice().sort((a, b) => a.start - b.start || a.end - b.end);
  const out = [];
  let cluster = [], clusterEnd = -Infinity;
  const flush = () => {
    const laneEnds = [];
    cluster.forEach((ev) => {
      let placed = false;
      for (let i = 0; i < laneEnds.length; i++) { if (laneEnds[i] <= ev.start + 1e-9) { ev._col = i; laneEnds[i] = ev.end; placed = true; break; } }
      if (!placed) { ev._col = laneEnds.length; laneEnds.push(ev.end); }
    });
    cluster.forEach((ev) => { ev._cols = laneEnds.length; out.push(ev); });
    cluster = [];
  };
  evs.forEach((ev) => { if (cluster.length && ev.start >= clusterEnd - 1e-9) { flush(); clusterEnd = -Infinity; } cluster.push(ev); clusterEnd = Math.max(clusterEnd, ev.end); });
  flush();
  return out;
}

/* ---- small line icons (stroke, 2px, round — matches the paperclip set) ---- */
function ico(paths, size, extra) { return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, display: "block", ...extra }}>{paths}</svg>; }
const UsersIcon = ({ size = 15 }) => ico(<React.Fragment><circle cx="9" cy="8" r="3.1" /><path d="M3.6 19a5.4 5.4 0 0 1 10.8 0" /><path d="M16 5.6a3 3 0 0 1 0 5.6" /><path d="M17 13.3a5.4 5.4 0 0 1 3.4 5" /></React.Fragment>, size);
const LinkIcon = ({ size = 15 }) => ico(<React.Fragment><path d="M9.5 14.5l5-5" /><path d="M12 7l1.2-1.2a3.4 3.4 0 0 1 4.8 4.8L16.8 12" /><path d="M12 17l-1.2 1.2a3.4 3.4 0 0 1-4.8-4.8L7.2 12" /></React.Fragment>, size);
const CalSquareIcon = ({ size = 15 }) => ico(<React.Fragment><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17" /><path d="M8 3v3.5" /><path d="M16 3v3.5" /></React.Fragment>, size);
const Chevron = ({ size = 14, open }) => ico(<path d="M6 9l6 6 6-6" />, size, { transition: "transform 140ms var(--ease-pop)", transform: open ? "none" : "rotate(-90deg)" });
const WarnIcon = ({ size = 14 }) => ico(<React.Fragment><path d="M12 3.5l8.5 15H3.5z" /><path d="M12 10v4" /><path d="M12 17h.01" /></React.Fragment>, size);

function PlusBtn({ label }) {
  const [h, setH] = useState(false);
  return <button aria-label={label} title={label} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 6, border: "none", background: h ? "var(--bg-hover)" : "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>+</button>;
}

/* ---------------- event chip ------------------------------------------------ */
function EventChip({ ev, onClick }) {
  const [h, setH] = useState(false);
  const col = cvar(colorOf(ev.cal));
  const top = ev.start * PXH, height = Math.max(15, (ev.end - ev.start) * PXH - 2);
  const pending = ev.rsvp === "needsAction" || ev.rsvp === "tentative";
  const declined = ev.rsvp === "declined";
  const showTime = height >= 30;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(ev, e); }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      title={`${ev.title} · ${hm(ev.start)} – ${hm(ev.end)}`}
      style={{
        position: "absolute", top, height,
        left: `calc(${(ev._col / ev._cols) * 100}% + 1px)`, width: `calc(${100 / ev._cols}% - 2px)`,
        boxSizing: "border-box", textAlign: "left", overflow: "hidden", cursor: "pointer",
        borderRadius: 6, border: `1px solid color-mix(in oklab, ${col} ${h ? 52 : 34}%, transparent)`, borderStyle: pending ? "dashed" : "solid",
        background: `color-mix(in oklab, ${col} ${h ? 32 : 26}%, var(--bg-surface))`,
        boxShadow: `inset 3px 0 0 ${col}`, padding: "2px 6px 2px 9px", opacity: declined ? 0.45 : ev.past ? 0.55 : 1,
        transition: "background 120ms ease, border-color 120ms ease",
      }}>
      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11.5, fontWeight: 500, lineHeight: "15px", color: "var(--text-primary)", textDecoration: declined ? "line-through" : "none" }}>{ev.title}</div>
      {showTime && <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10.5, lineHeight: "14px", color: "var(--text-muted)" }}>{hm(ev.start)} – {hm(ev.end)}</div>}
    </button>
  );
}

/* ---------------- week grid ------------------------------------------------- */
function WeekGrid({ weekOffset, checked, onEvent, onToday, onShiftWeek, title, dayDates }) {
  const bodyRef = useRef(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id); }, []);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 7 * PXH - 8; }, []);

  const todayIndex = dayDates.findIndex((d) => sameDay(d, REF_TODAY));
  const shown = weekOffset === 0 ? WEEK_EVENTS.filter((e) => checked.has(e.cal)) : [];
  const allDay = shown.filter((e) => e.allDay);
  const hasAllDay = allDay.length > 0;
  const nowDec = now.getHours() + now.getMinutes() / 60;

  const DayName = ({ i }) => {
    const d = dayDates[i], today = i === todayIndex;
    return (
      <div style={{ flex: 1, minWidth: 0, textAlign: "center", padding: "7px 0 8px" }}>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: today ? "3px 10px" : 0, borderRadius: 999, background: today ? "var(--accent-dim)" : "transparent" }}>
          <span style={{ fontSize: 12.5, fontWeight: today ? 600 : 400, color: today ? "var(--accent-strong)" : "var(--text-muted)" }}>{DAY_NAMES[i]}</span>
          <span style={{ fontSize: 13, fontWeight: today ? 700 : 500, color: today ? "var(--accent-strong)" : "var(--text-secondary)" }}>{d.getDate()}</span>
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", minWidth: 0, flex: 1, flexDirection: "column", overflow: "hidden" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px 8px" }}>
        <Button variant="secondary" size="sm" onClick={onToday}>Today</Button>
        <IconBtn label="Previous week" hint="Previous week" keys="-" place="bottom" bordered onClick={() => onShiftWeek(-1)}>‹</IconBtn>
        <IconBtn label="Next week" hint="Next week" keys="=" place="bottom" bordered onClick={() => onShiftWeek(1)}>›</IconBtn>
        <span style={{ marginLeft: 6, fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>{title}</span>
      </div>
      {/* day header row */}
      <div style={{ display: "flex", alignItems: "flex-end", borderBottom: "1px solid var(--border)" }}>
        <div style={{ width: GUT, flexShrink: 0, display: "flex", justifyContent: "flex-end", padding: "0 8px 8px 0" }}><span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-muted)" }}>EDT</span></div>
        {dayDates.map((_, i) => <DayName key={i} i={i} />)}
      </div>
      {/* all-day lane */}
      {hasAllDay && (
        <div style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <div style={{ width: GUT, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 8px", fontSize: 10, color: "var(--text-muted)" }}>all-day</div>
          <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
            {dayDates.map((_, i) => (
              <div key={i} style={{ flex: 1, minWidth: 0, borderLeft: i ? "1px solid var(--border)" : "none", padding: "4px 3px", display: "flex", flexDirection: "column", gap: 3 }}>
                {allDay.filter((e) => e.day === i).map((e, k) => {
                  const col = cvar(colorOf(e.cal));
                  return <div key={k} onClick={(ev) => onEvent(e, ev)} title={e.title} style={{ cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, fontWeight: 500, color: "var(--text-primary)", borderRadius: 5, boxShadow: `inset 3px 0 0 ${col}`, background: `color-mix(in oklab, ${col} 26%, var(--bg-surface))`, border: `1px solid color-mix(in oklab, ${col} 34%, transparent)`, padding: "2px 6px 2px 9px" }}>{e.title}</div>;
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* scrolling hour grid */}
      <div ref={bodyRef} style={{ minHeight: 0, flex: 1, overflowY: "auto" }}>
        <div style={{ position: "relative", height: 24 * PXH }}>
          {Array.from({ length: 24 }, (_, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div style={{ position: "absolute", left: GUT, right: 0, top: i * PXH, borderTop: "1px solid var(--border)" }} />}
              <span style={{ position: "absolute", left: 0, width: GUT - 10, textAlign: "right", top: i === 0 ? 4 : i * PXH - 6, fontSize: 10.5, color: "var(--text-muted)" }}>{hourLabel(i)}</span>
            </React.Fragment>
          ))}
          <div style={{ position: "absolute", inset: `0 0 0 ${GUT}px`, display: "flex" }}>
            {dayDates.map((_, i) => {
              const dayEvents = layoutDay(shown.filter((e) => e.day === i && !e.allDay));
              const isToday = i === todayIndex;
              return (
                <div key={i} style={{ position: "relative", flex: 1, minWidth: 0, borderLeft: i ? "1px solid var(--border)" : "none", background: isToday ? "color-mix(in oklab, var(--accent) 6%, transparent)" : "transparent" }}>
                  {dayEvents.map((ev, k) => <EventChip key={k} ev={ev} onClick={onEvent} />)}
                  {isToday && (
                    <div style={{ position: "absolute", left: 0, right: 0, top: nowDec * PXH, borderTop: "2px solid var(--danger)", zIndex: 3, pointerEvents: "none" }}>
                      <span style={{ position: "absolute", left: -3, top: -4, width: 7, height: 7, borderRadius: 999, background: "var(--danger)" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- mini month ------------------------------------------------ */
const MINI_DOW = ["S", "M", "T", "W", "T", "F", "S"];
function MiniMonth({ monthOffset, setMonthOffset, weekStart, onPick }) {
  const view = new Date(2026, 6 + monthOffset, 1);
  const gridStart = addDays(view, -view.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weekEnd = addDays(weekStart, 6);
  const label = view.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const navBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 6, border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 14 };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
        <button style={navBtn} title="Previous month" onClick={() => setMonthOffset((o) => o - 1)}>‹</button>
        <button style={navBtn} title="Next month" onClick={() => setMonthOffset((o) => o + 1)}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", rowGap: 1 }}>
        {MINI_DOW.map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 500, color: "var(--text-muted)", paddingBottom: 3 }}>{d}</div>)}
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === view.getMonth();
          const today = sameDay(d, REF_TODAY);
          const inWeek = d >= weekStart && d <= weekEnd;
          return (
            <button key={i} onClick={() => onPick(d)} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 26, border: "none", cursor: "pointer", borderRadius: 999, fontSize: 12, fontVariantNumeric: "tabular-nums",
              background: today ? "var(--accent)" : inWeek ? "var(--bg-hover)" : "transparent",
              color: today ? "var(--on-accent)" : inMonth ? "var(--text-secondary)" : "var(--text-muted)",
              fontWeight: today ? 700 : inWeek ? 600 : 400, opacity: inMonth ? 1 : 0.45 }}>{d.getDate()}</button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- calendar side panel --------------------------------------- */
function CheckBox({ color, on }) {
  const col = cvar(color);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, flexShrink: 0, borderRadius: 4, boxSizing: "border-box",
      background: on ? col : "transparent", border: on ? "1px solid transparent" : `1.5px solid color-mix(in oklab, ${col} 55%, transparent)`,
      color: "var(--on-accent)", fontSize: 11, lineHeight: 1 }}>{on ? "✓" : ""}</span>
  );
}
function CalRow({ c, on, onToggle }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={() => onToggle(c.id)} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "6px 8px", borderRadius: 6, border: "none", background: h ? "var(--bg-hover)" : "transparent", cursor: "pointer" }}>
      <CheckBox color={c.color} on={on} />
      <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: on ? "var(--text-primary)" : "var(--text-muted)" }}>{c.name}</span>
    </button>
  );
}
function AccountGroup({ acct, expanded, onToggleExpand, checked, onToggleCal }) {
  const [h, setH] = useState(false);
  return (
    <div>
      <button onClick={() => onToggleExpand(acct.email)} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px", borderRadius: 6, border: "none", background: h ? "var(--bg-hover)" : "transparent", cursor: "pointer" }}>
        <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{acct.email}</span>
        {acct.warning && <span title={acct.warning} style={{ color: "var(--warning)", display: "inline-flex" }}><WarnIcon /></span>}
        <span style={{ color: "var(--text-muted)", display: "inline-flex" }}><Chevron open={expanded} /></span>
      </button>
      {expanded && acct.calendars.map((c) => <CalRow key={c.id} c={c} on={checked.has(c.id)} onToggle={onToggleCal} />)}
      {expanded && acct.warning && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px 6px 8px", fontSize: 12, color: "var(--text-muted)" }}>
          <span>Disconnected.</span>
          <button style={{ border: "none", background: "transparent", padding: 0, color: "var(--accent-strong)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Reconnect</button>
        </div>
      )}
    </div>
  );
}
function SectionRow({ icon, label, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px" }}>
      <span style={{ color: "var(--text-muted)", display: "inline-flex" }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label}</span>
      {action}
    </div>
  );
}
function CalendarPanel({ checked, onToggleCal, expanded, onToggleExpand, monthOffset, setMonthOffset, weekStart, onPick }) {
  const divider = <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />;
  return (
    <aside style={{ display: "flex", width: "var(--w-calendar)", flexShrink: 0, flexDirection: "column", borderLeft: "1px solid var(--border)", background: "var(--bg-surface)" }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
        <MiniMonth monthOffset={monthOffset} setMonthOffset={setMonthOffset} weekStart={weekStart} onPick={onPick} />
        {divider}
        <SectionRow icon={<UsersIcon />} label="Meet" />
        <input placeholder="Enter name or email" style={{ width: "100%", boxSizing: "border-box", margin: "0 0 4px", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--bg-base)", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "var(--font-sans)" }} />
        <SectionRow icon={<LinkIcon />} label="Booking Pages" action={<PlusBtn label="New booking page" />} />
        {divider}
        <SectionRow icon={<CalSquareIcon />} label="Calendars" action={<PlusBtn label="Add calendar" />} />
        {CAL_ACCOUNTS.map((a) => <AccountGroup key={a.email} acct={a} expanded={expanded.has(a.email)} onToggleExpand={onToggleExpand} checked={checked} onToggleCal={onToggleCal} />)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border)", padding: "8px 14px" }}>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: "transparent", padding: "4px 0", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}><UsersIcon size={14} /> Create Team</button>
        <span style={{ flex: 1 }} />
        <IconBtn label="Help">?</IconBtn>
        <IconBtn label="Calendar settings">⚙</IconBtn>
      </div>
    </aside>
  );
}

/* ---------------- event popover (click a block) ----------------------------- */
function EventPopover({ ev, dayDates, at, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: at.x, top: at.y, ready: false });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight, M = 12;
    const left = Math.max(M, Math.min(at.x + 8, window.innerWidth - w - M));
    const top = Math.max(M, Math.min(at.y + 6, window.innerHeight - h - M));
    setPos({ left, top, ready: true });
  }, [at]);
  const cal = CALS[ev.cal] || {};
  const d = dayDates[ev.day];
  const when = ev.allDay
    ? `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · All day`
    : `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${hm(ev.start)} – ${hm(ev.end)} ${ampm(ev.end)}`;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60 }} onClick={onClose}>
      <div ref={ref} className="sm-pop-in" onClick={(e) => e.stopPropagation()} style={{ position: "fixed", left: pos.left, top: pos.top, opacity: pos.ready ? 1 : 0, width: 300, boxSizing: "border-box", borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--bg-overlay)", boxShadow: "var(--shadow-overlay)", padding: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span style={{ marginTop: 5, width: 10, height: 10, flexShrink: 0, borderRadius: 3, background: cvar(cal.color) }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: "19px", color: "var(--text-primary)" }}>{ev.title}</div>
            <div style={{ marginTop: 2, fontSize: 12, color: "var(--text-muted)" }}>{when}</div>
          </div>
          <button onClick={onClose} aria-label="Close" title="Close" style={{ border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", padding: "0 4px" }}>✕</button>
        </div>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, color: "var(--text-secondary)" }}>
          {ev.loc && <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {ev.loc}</div>}
          {ev.meet && <button onClick={onClose} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--accent-strong)", fontSize: 12.5 }}>Join video call</button>}
          <div style={{ color: "var(--text-muted)" }}>{cal.name || "Calendar"}</div>
        </div>
        {ev.guests && ev.guests.length > 0 && (
          <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>{ev.guests.length} guest{ev.guests.length > 1 ? "s" : ""}</div>
            {ev.guests.map((g, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                <span style={{ width: 10, textAlign: "center", color: g.status === "accepted" ? "var(--success)" : "var(--text-muted)" }}>{g.status === "accepted" ? "✓" : "·"}</span>
                {g.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- view root ------------------------------------------------- */
function initialChecked() { const s = new Set(); CAL_ACCOUNTS.forEach((a) => a.calendars.forEach((c) => { if (c.on) s.add(c.id); })); return s; }
function initialExpanded() { const s = new Set(); CAL_ACCOUNTS.forEach((a) => { if (a.expanded) s.add(a.email); }); return s; }

function CalendarView() {
  const [checked, setChecked] = useState(initialChecked);
  const [expanded, setExpanded] = useState(initialExpanded);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState(null);

  const weekStart = addDays(WEEK_ANCHOR, weekOffset * 7);
  const dayDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = dayDates[6];
  const title = weekStart.getMonth() === weekEnd.getMonth()
    ? weekStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : `${weekStart.toLocaleDateString("en-US", { month: "short" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;

  const toggleCal = (id) => setChecked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleExpand = (email) => setExpanded((s) => { const n = new Set(s); n.has(email) ? n.delete(email) : n.add(email); return n; });
  const goToday = () => { setWeekOffset(0); setMonthOffset(0); };
  const pickDay = (d) => setWeekOffset(Math.round((startOfWeek(d) - WEEK_ANCHOR) / (7 * 86400000)));

  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA)$/.test((e.target || {}).tagName || "")) return;
      if (e.key === "Escape") { setSelected(null); return; }
      if (e.key === "=" || e.key === "+") setWeekOffset((o) => o + 1);
      else if (e.key === "-" || e.key === "_") setWeekOffset((o) => o - 1);
      else if (e.key === "t" || e.key === "T") goToday();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ display: "flex", height: "100%", minWidth: 0, flex: 1 }}>
      <WeekGrid weekOffset={weekOffset} checked={checked} title={title} dayDates={dayDates}
        onToday={goToday} onShiftWeek={(n) => setWeekOffset((o) => o + n)}
        onEvent={(ev, e) => setSelected({ ev, at: { x: e.clientX, y: e.clientY } })} />
      <CalendarPanel checked={checked} onToggleCal={toggleCal} expanded={expanded} onToggleExpand={toggleExpand}
        monthOffset={monthOffset} setMonthOffset={setMonthOffset} weekStart={weekStart} onPick={pickDay} />
      {selected && <EventPopover ev={selected.ev} dayDates={dayDates} at={selected.at} onClose={() => setSelected(null)} />}
    </div>
  );
}

window.SM_CALENDAR = { CalendarView };
