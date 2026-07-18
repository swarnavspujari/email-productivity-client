import React from "react";

/**
 * EventBlock — a single event chip in the calendar day panel / week grid.
 * Renders in its CALENDAR'S color: a muted tinted fill (the hue mixed into the
 * surface — never a big saturated block) with a saturated left bar + a hairline
 * border in the same hue that strengthens on hover. `color` is a --cal-* key
 * (cerulean · green · violet · amber · rose · teal · gray) or any CSS color;
 * default cerulean. Mirrors the product's event states exactly: past events
 * fade, a declined invite strikes through and fades, and a pending / tentative
 * invite gets a dashed edge. The caller positions it (pass top/height via
 * `style`).
 */
const EB_CAL = { cerulean: "--cal-cerulean", green: "--cal-green", violet: "--cal-violet", amber: "--cal-amber", rose: "--cal-rose", teal: "--cal-teal", gray: "--cal-gray" };
export function EventBlock({ title, time, allDay = false, past = false, rsvp = null, color = "cerulean", onClick, style }) {
  const [hover, setHover] = React.useState(false);
  const declined = rsvp === "declined";
  const pending = rsvp === "needsAction" || rsvp === "tentative";
  const col = EB_CAL[color] ? `var(${EB_CAL[color]})` : color;
  const borderPct = hover ? 52 : 34;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={time ? `${title} · ${time}` : title}
      style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        textAlign: "left",
        overflow: "hidden",
        borderRadius: "var(--radius-sm)",
        border: `1px solid color-mix(in oklab, ${col} ${borderPct}%, transparent)`,
        borderStyle: pending ? "dashed" : "solid",
        background: `color-mix(in oklab, ${col} ${hover ? 30 : 24}%, var(--bg-surface))`,
        boxShadow: `inset 3px 0 0 ${col}`,
        padding: "3px 8px 3px 11px",
        cursor: "pointer",
        opacity: declined ? 0.45 : past ? 0.55 : 1,
        ...style,
      }}
    >
      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: 500, lineHeight: "16px", color: "var(--text-primary)", textDecoration: declined ? "line-through" : "none" }}>{title}</div>
      {time && !allDay && (
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: "var(--text-muted)" }}>{time}</div>
      )}
    </button>
  );
}
