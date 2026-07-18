import React from "react";
import { Avatar } from "../core/Avatar.jsx";
import { Label } from "../mail/Label.jsx";

/**
 * FolderSidebar — the slide-in mailbox navigator: account header, the core
 * folder list (Inbox, Starred, Drafts, Sent, Done, Scheduled, Reminders,
 * Snippets, Muted, Spam, Trash), and an Auto Labels section of colored
 * labels. The active folder gets an accent left-bar + raised background.
 */
export function FolderSidebar({ account = "you@snailmail.app", folders, active, onSelect, autoLabels = [], count, width = 260, style }) {
  const list = folders ?? [
    { id: "inbox", name: "Inbox", sub: "Important · Other", count },
    { id: "starred", name: "Starred" },
    { id: "drafts", name: "Drafts" },
    { id: "sent", name: "Sent" },
    { id: "done", name: "Done" },
    { id: "archived", name: "Auto Archived" },
    { id: "scheduled", name: "Scheduled" },
    { id: "reminders", name: "Reminders" },
    { id: "snippets", name: "Snippets" },
    { id: "muted", name: "Muted" },
    { id: "spam", name: "Spam" },
    { id: "trash", name: "Trash" },
  ];
  return (
    <nav style={{ display: "flex", width, flexShrink: 0, flexDirection: "column", borderRight: "1px solid var(--border)", background: "var(--bg-surface)", padding: "12px 8px", gap: 2, overflowY: "auto", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 12px" }}>
        <Avatar name={account} email={account} size={30} />
        <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: "var(--text-secondary)" }}>{account}</span>
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>›</span>
      </div>
      {list.map((f) => <FolderItem key={f.id} f={f} on={f.id === active} onClick={() => onSelect && onSelect(f.id)} />)}
      {autoLabels.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "14px 10px 6px", fontSize: 12.5, fontWeight: 500, color: "var(--accent-strong)" }}>
            Auto Labels <span aria-hidden="true">✦</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "2px 10px" }}>
            {autoLabels.map((l) => (
              <div key={l.name} style={{ display: "flex" }}><Label color={l.color}>{l.name}</Label></div>
            ))}
          </div>
        </>
      )}
    </nav>
  );
}

function FolderItem({ f, on, onClick }) {
  const [h, setH] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 8,
        textAlign: "left",
        width: "100%",
        padding: "7px 10px",
        borderRadius: "var(--radius-sm)",
        border: "none",
        background: on ? "var(--bg-selected)" : h ? "var(--bg-hover)" : "transparent",
        cursor: "pointer",
      }}
    >
      {on && <span style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 3, borderRadius: 3, background: "var(--accent)" }} />}
      <span style={{ fontSize: 13.5, fontWeight: on ? 500 : 400, color: on ? "var(--text-primary)" : "var(--text-secondary)" }}>{f.name}</span>
      {f.sub && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{f.sub}</span>}
      <span style={{ flex: 1 }} />
      {f.count != null && <span style={{ fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{f.count}</span>}
    </button>
  );
}
