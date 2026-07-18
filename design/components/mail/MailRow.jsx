import React from "react";
import { Avatar } from "../core/Avatar.jsx";
import { Pill } from "../core/Pill.jsx";

/**
 * MailRow — one conversation row in the inbox list. Keyboard-first density:
 * unread dot, sender(s), subject + snippet on one line, optional snooze pill /
 * star, and a right-aligned time. Selected rows use bg-selected; hover uses
 * bg-hover. Unread text goes semibold + full-strength.
 */
export function MailRow({
  sender,
  subject,
  snippet,
  time,
  email = "",
  unread = false,
  selected = false,
  checked = false,
  starred = false,
  count,
  snooze,
  onClick,
  style,
}) {
  const [hover, setHover] = React.useState(false);
  const bg = selected
    ? "var(--bg-selected)"
    : checked
      ? "var(--accent-dim)"
      : hover
        ? "var(--bg-hover)"
        : "transparent";
  const senderColor = unread
    ? "var(--text-primary)"
    : selected
      ? "var(--text-secondary)"
      : "var(--text-muted)";
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        background: bg,
        cursor: "pointer",
        fontSize: "13.5px",
        ...style,
      }}
    >
      {checked ? (
        <span style={{ width: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", lineHeight: 1, color: "var(--accent-strong)" }}>
          {"✓"}
        </span>
      ) : (
        <span
          style={{
            width: 6,
            height: 6,
            flexShrink: 0,
            borderRadius: "var(--radius-pill)",
            background: unread ? "var(--accent-strong)" : "transparent",
          }}
        />
      )}
      <div style={{ width: 176, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <span style={{ color: senderColor, fontWeight: unread ? "var(--fw-semibold)" : "var(--fw-regular)" }}>
          {sender}
        </span>
        {count > 1 && (
          <span style={{ marginLeft: 6, fontSize: "11px", color: "var(--text-muted)" }}>{count}</span>
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <span style={{ color: unread ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: unread ? "var(--fw-semibold)" : "var(--fw-regular)" }}>
          {subject}
        </span>
        {snippet && (
          <span style={{ marginLeft: 8, fontSize: "12px", color: "var(--text-muted)" }}>{snippet}</span>
        )}
      </div>
      {snooze && (
        <Pill tone="accent" fill="dim" style={{ fontSize: "11px", padding: "0 6px" }}>{snooze}</Pill>
      )}
      {starred && <span style={{ flexShrink: 0, fontSize: "12px", color: "var(--warning)" }}>★</span>}
      <span style={{ width: 56, flexShrink: 0, textAlign: "right", fontSize: "11.5px", color: "var(--text-muted)" }}>
        {time}
      </span>
    </div>
  );
}
