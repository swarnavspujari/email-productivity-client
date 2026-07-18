import React from "react";

/**
 * EventPopover — the details card shown when you click an event block. Shows
 * time, location, a Google Meet join link, the calendar name (with read-only
 * note), organizer, description, and the guest list with RSVP glyphs. Actions
 * gate on your role: an owned event shows Delete / Edit (with a notify-guests
 * step when guests exist); an invited event shows Yes / Maybe / No RSVP.
 *
 * This renders just the 320px card — the caller positions it (anchor at the
 * click point via `style`) and supplies its own scrim/backdrop, matching the
 * UndoToast pattern. Behaviour is prop-driven so the same card serves the
 * owner and the invitee.
 */
const EP_RSVP = [
  { value: "accepted", label: "Yes" },
  { value: "tentative", label: "Maybe" },
  { value: "declined", label: "No" },
];
function epGlyph(s) { return s === "accepted" ? "✓" : s === "declined" ? "✕" : s === "tentative" ? "?" : "·"; }
function epGlyphColor(s) { return s === "accepted" ? "var(--success)" : s === "declined" ? "var(--danger)" : "var(--text-muted)"; }

const EP_ghost = { borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", padding: "5px 10px", fontSize: 12.5, cursor: "pointer" };
const EP_danger = { borderRadius: "var(--radius-sm)", border: "1px solid transparent", background: "var(--danger)", color: "#fff", padding: "5px 10px", fontSize: 12.5, fontWeight: 500, cursor: "pointer" };

export function EventPopover({
  title,
  when,
  location,
  meetLink,
  calendar,
  readOnly = false,
  organizerEmail,
  description,
  attendees = [],
  htmlLink,
  canRsvp = false,
  selfStatus = null,
  onRsvp,
  canEdit = false,
  onEdit,
  onDelete,
  onClose,
  onOpenExternal,
  style,
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const hasGuests = attendees.length > 0;
  const link = (url, children, key) => (
    <button key={key} onClick={() => onOpenExternal && onOpenExternal(url)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: "var(--accent-strong)", fontSize: 12.5 }}>{children}</button>
  );
  return (
    <div className="sm-pop-in" style={{ width: 320, boxSizing: "border-box", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-strong)", background: "var(--bg-overlay)", padding: 14, boxShadow: "var(--shadow-overlay)", ...style }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: "20px", color: "var(--text-primary)" }}>{title}</div>
          {when && <div style={{ marginTop: 2, fontSize: 12, color: "var(--text-muted)" }}>{when}</div>}
        </div>
        {onClose && <button onClick={onClose} aria-label="Close" title="Close (Esc)" style={{ borderRadius: "var(--radius-xs)", padding: "0 5px", background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 13 }}>✕</button>}
      </div>

      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--text-secondary)" }}>
        {location && <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {location}</div>}
        {meetLink && link(meetLink, "Join Google Meet", "meet")}
        {calendar && <div style={{ color: "var(--text-muted)" }}>{calendar}{readOnly ? " · read-only" : ""}</div>}
        {organizerEmail && <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-muted)" }}>Organizer: {organizerEmail}</div>}
        {description && <div style={{ maxHeight: 96, overflowY: "auto", whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.55, color: "var(--text-secondary)" }}>{description}</div>}
      </div>

      {hasGuests && (
        <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
          <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>{attendees.length} guest{attendees.length > 1 ? "s" : ""}</div>
          <div style={{ maxHeight: 112, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {attendees.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{ color: epGlyphColor(a.status), width: 10, textAlign: "center", flexShrink: 0 }}>{epGlyph(a.status)}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>{a.name || a.email}{a.organizer ? " (organizer)" : ""}{a.optional ? " (optional)" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {htmlLink && <div style={{ marginTop: 8 }}>{link(htmlLink, "Open in Google Calendar", "html")}</div>}

      {canRsvp && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <span style={{ marginRight: 4, fontSize: 12, color: "var(--text-muted)" }}>Going?</span>
          {EP_RSVP.map(({ value, label }) => {
            const on = selfStatus === value;
            return <button key={value} onClick={() => onRsvp && onRsvp(value)} style={{ borderRadius: "var(--radius-sm)", padding: "5px 10px", fontSize: 12.5, cursor: "pointer", border: on ? "1px solid transparent" : "1px solid var(--border-strong)", background: on ? "var(--accent)" : "transparent", color: on ? "var(--on-accent)" : "var(--text-secondary)", fontWeight: on ? 500 : 400 }}>{label}</button>;
          })}
        </div>
      )}

      {canEdit && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          {confirmDelete ? (hasGuests ? (
            <React.Fragment>
              <span style={{ flex: 1, fontSize: 12, color: "var(--text-secondary)" }}>Notify guests?</span>
              <button onClick={() => { setConfirmDelete(false); onDelete && onDelete(false); }} style={EP_ghost}>Delete silently</button>
              <button onClick={() => { setConfirmDelete(false); onDelete && onDelete(true); }} style={EP_danger}>Delete &amp; notify</button>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <span style={{ flex: 1, fontSize: 12, color: "var(--text-secondary)" }}>Delete this event?</span>
              <button onClick={() => setConfirmDelete(false)} style={EP_ghost}>Cancel</button>
              <button onClick={() => { setConfirmDelete(false); onDelete && onDelete(false); }} style={EP_danger}>Delete</button>
            </React.Fragment>
          )) : (
            <React.Fragment>
              <button onClick={() => setConfirmDelete(true)} style={EP_ghost}>Delete</button>
              <button onClick={onEdit} style={{ ...EP_ghost, border: "1px solid transparent", background: "var(--accent)", color: "var(--on-accent)", fontWeight: 500 }}>Edit</button>
            </React.Fragment>
          )}
        </div>
      )}
    </div>
  );
}
