import React from "react";

/**
 * NavRail — the slim vertical icon rail on the far left. Holds the brand mark
 * at top and a short stack of primary destinations (Mail, Calendar) grouped
 * into a single pill: one raised "thumb" slides between the slots as the
 * active destination changes, so the stack reads as one segmented control
 * rather than a set of separate buttons. Depth is the bg-raised thumb over the
 * bg-surface track (no shadow), per the resting-surface rule. Icons are
 * Unicode glyphs, per the brand's iconography.
 */
const SLOT = 34, PAD = 3;
export function NavRail({ items = [], active, onSelect, brand, width = 56, style }) {
  const activeIndex = Math.max(0, items.findIndex((it) => it.id === active));
  return (
    <nav style={{ display: "flex", width, flexShrink: 0, flexDirection: "column", alignItems: "center", gap: 8, borderRight: "1px solid var(--border)", background: "var(--bg-base)", padding: "12px 0", ...style }}>
      {brand && <div style={{ marginBottom: 10 }}>{brand}</div>}
      {items.length > 0 && (
        <div role="tablist" aria-orientation="vertical" style={{ position: "relative", display: "flex", flexDirection: "column", padding: PAD, borderRadius: 999, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: PAD,
              top: PAD,
              width: SLOT,
              height: SLOT,
              boxSizing: "border-box",
              borderRadius: 999,
              background: "var(--bg-raised)",
              border: "1px solid var(--border)",
              transform: `translateY(${activeIndex * SLOT}px)`,
              transition: "transform 220ms var(--ease-pop)",
            }}
          />
          {items.map((it) => (
            <RailBtn key={it.id} on={it.id === active} label={it.label} onClick={() => onSelect && onSelect(it.id)}>{it.icon}</RailBtn>
          ))}
        </div>
      )}
    </nav>
  );
}

function RailBtn({ children, label, on, onClick }) {
  const [h, setH] = React.useState(false);
  return (
    <button
      role="tab"
      aria-selected={on}
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: SLOT,
        height: SLOT,
        borderRadius: 999,
        border: "none",
        background: "transparent",
        color: on ? "var(--accent-strong)" : h ? "var(--text-secondary)" : "var(--text-muted)",
        cursor: "pointer",
        fontSize: 17,
        transition: "color 140ms ease",
      }}
    >
      {children}
    </button>
  );
}
