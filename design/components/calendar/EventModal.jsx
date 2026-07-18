import React from "react";

/**
 * EventModal — the create / edit event dialog. Title, all-day toggle, writable
 * calendar selector, start/end date+time, guests, location, description.
 * Submitting an event that has (or had) guests first asks whether to notify
 * them — Google's sendUpdates choice — before saving. An optional "changed
 * elsewhere" conflict banner supports the review-and-retry flow.
 *
 * Renders just the 480px dialog card — the caller centers it and supplies the
 * scrim/backdrop (matching the UndoToast pattern). Field state is internal;
 * `onSave(draft, sendUpdates)` hands back the collected values.
 */
const EM_input = { width: "100%", boxSizing: "border-box", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-surface)", padding: "7px 10px", fontSize: 13, color: "var(--text-primary)", outline: "none", fontFamily: "var(--font-sans)" };
const EM_label = { display: "block", marginBottom: 4, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" };
const EM_ghost = { borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", padding: "7px 14px", fontSize: 12.5, cursor: "pointer" };
const EM_primary = { borderRadius: "var(--radius-sm)", border: "1px solid transparent", background: "var(--accent)", color: "var(--on-accent)", padding: "7px 14px", fontSize: 12.5, fontWeight: 500, cursor: "pointer" };

export function EventModal({ mode = "create", initial = {}, calendars = [], conflict = false, onLoadLatest, onSave, onCancel, style }) {
  const editing = mode === "edit";
  const [title, setTitle] = React.useState(initial.title || "");
  const [calendarId, setCalendarId] = React.useState(initial.calendarId || (calendars[0] && calendars[0].id) || "");
  const [allDay, setAllDay] = React.useState(!!initial.allDay);
  const [startDate, setStartDate] = React.useState(initial.startDate || "");
  const [startTime, setStartTime] = React.useState(initial.startTime || "09:00");
  const [endDate, setEndDate] = React.useState(initial.endDate || initial.startDate || "");
  const [endTime, setEndTime] = React.useState(initial.endTime || "10:00");
  const [guests, setGuests] = React.useState(initial.guests || "");
  const [location, setLocation] = React.useState(initial.location || "");
  const [description, setDescription] = React.useState(initial.description || "");
  const [error, setError] = React.useState(null);
  const [notify, setNotify] = React.useState(false);
  const titleRef = React.useRef(null);
  React.useEffect(() => { titleRef.current && titleRef.current.focus(); }, []);

  const guestCount = guests.split(/[,;]/).map((s) => s.trim()).filter(Boolean).length;
  const draft = () => ({ calendarId, title: title.trim(), allDay, startDate, startTime, endDate, endTime, guests, location: location.trim(), description: description.trim() });

  const submit = () => {
    if (!title.trim()) { setError("Give the event a title"); return; }
    if (!startDate || !endDate) { setError("Set a valid date and time"); return; }
    setError(null);
    if (guestCount > 0) setNotify(true);
    else onSave && onSave(draft(), "none");
  };

  return (
    <div className="sm-pop-in" style={{ width: 480, maxWidth: "92vw", boxSizing: "border-box", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-strong)", background: "var(--bg-overlay)", padding: 16, boxShadow: "var(--shadow-overlay)", ...style }}>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center" }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{editing ? "Edit event" : "New event"}</span>
        <button onClick={onCancel} aria-label="Close" title="Close (Esc)" style={{ borderRadius: "var(--radius-xs)", padding: "0 6px", background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 13 }}>✕</button>
      </div>

      {conflict && (
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8, borderRadius: "var(--radius-sm)", border: "1px solid color-mix(in oklab, var(--warning) 40%, transparent)", background: "color-mix(in oklab, var(--warning) 12%, transparent)", padding: "8px 10px", fontSize: 12, color: "var(--text-primary)" }}>
          <span style={{ flex: 1 }}>This event changed elsewhere — review and retry.</span>
          <button onClick={onLoadLatest} style={{ ...EM_ghost, padding: "2px 8px", fontSize: 12 }}>Load latest</button>
        </div>
      )}

      <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" style={{ width: "100%", boxSizing: "border-box", border: "none", borderBottom: "1px solid var(--border)", background: "transparent", paddingBottom: 6, fontSize: 16, fontWeight: 500, color: "var(--text-primary)", outline: "none", fontFamily: "var(--font-sans)" }} />

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-secondary)", cursor: "pointer" }}>
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day
        </label>
        {calendars.length > 1 && (
          <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)} disabled={editing} title={editing ? "Events can't move between calendars here" : "Calendar"} style={{ minWidth: 0, flex: 1, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-surface)", padding: "6px 8px", fontSize: 12.5, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>
            {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={EM_input} />
        {!allDay && <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={EM_input} />}
        <span style={{ flexShrink: 0, fontSize: 12, color: "var(--text-muted)" }}>to</span>
        {!allDay && <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={EM_input} />}
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={EM_input} />
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={EM_label}>Guests</label>
        <input value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="Add guests (email, email…)" style={EM_input} />
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={EM_label}>Location</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add location" style={EM_input} />
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={EM_label}>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Add description" style={{ ...EM_input, resize: "none" }} />
      </div>

      {error && <div style={{ marginTop: 12, fontSize: 12, color: "var(--danger)" }}>{error}</div>}

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
        {notify ? (
          <React.Fragment>
            <span style={{ flex: 1, fontSize: 12.5, color: "var(--text-secondary)" }}>Send invites/updates to guests?</span>
            <button onClick={() => { setNotify(false); onSave && onSave(draft(), "none"); }} style={EM_ghost}>Don't send</button>
            <button onClick={() => { setNotify(false); onSave && onSave(draft(), "all"); }} style={EM_primary}>Send</button>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <button onClick={onCancel} style={EM_ghost}>Cancel</button>
            <button onClick={submit} style={EM_primary}>{editing ? "Save" : "Create"}</button>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}
