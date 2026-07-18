import React from "react";
import { Avatar } from "../core/Avatar.jsx";

/**
 * MessageCard — one message inside a thread. Collapsed (older messages) shows
 * a single-line summary; expanded shows the full header (from/to/cc), body,
 * and attachments. Superhuman-style: the newest message and any unread stay
 * open. Rounded-lg card on the surface layer with a hairline border.
 */
export function MessageCard({
  fromName,
  from,
  to = [],
  cc = [],
  time,
  body,
  snippet,
  expanded = true,
  onToggle,
  children,
  style,
}) {
  const [hover, setHover] = React.useState(false);
  if (!expanded) {
    return (
      <button
        onClick={onToggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: "12px",
          textAlign: "left",
          padding: "10px 16px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
          background: hover ? "var(--bg-hover)" : "var(--bg-surface)",
          cursor: "pointer",
        }}
      >
        <Avatar name={fromName} email={from} size={26} />
        <span style={{ width: 160, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "13px", fontWeight: "var(--fw-medium)", color: "var(--text-secondary)" }}>
          {fromName}
        </span>
        <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "12.5px", color: "var(--text-muted)" }}>
          {snippet}
        </span>
        <span style={{ flexShrink: 0, fontSize: "11.5px", color: "var(--text-muted)" }}>{time}</span>
      </button>
    );
  }
  return (
    <div style={{ overflow: "hidden", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-surface)", ...style }}>
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: "12px",
          textAlign: "left",
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          background: "transparent",
          cursor: onToggle ? "pointer" : "default",
        }}
      >
        <Avatar name={fromName} email={from} size={32} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontWeight: "var(--fw-medium)", color: "var(--text-primary)" }}>{fromName}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "12px", color: "var(--text-muted)" }}>{from}</span>
          </div>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "12px", color: "var(--text-muted)" }}>
            to {to.join(", ")}
            {cc.length > 0 && ` · cc ${cc.join(", ")}`}
          </div>
        </div>
        <span style={{ flexShrink: 0, fontSize: "12px", color: "var(--text-muted)" }}>{time}</span>
      </button>
      <div style={{ padding: "12px 16px", lineHeight: "var(--lh-relaxed)", color: "var(--text-primary)", whiteSpace: "pre-wrap", fontSize: "13.5px" }}>
        {body}
      </div>
      {children}
    </div>
  );
}
