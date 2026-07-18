/* global React */
const { useState, useEffect, useRef } = React;
const { ME, threads: THREADS, meta: META, suggestions: SUGGESTIONS, searchTips: SEARCH_TIPS } = window.SM_DATA;
const { Avatar, Kbd, KeyHint, HoverHint, Label, Button, IconBtn, Paperclip, AiClip } = window.SM_UI;

/* ---------------- thread + contact panel ----------------------------------- */
function AttachmentChip({ filename, size }) {
  const [h, setH] = useState(false);
  return <span onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--bg-raised)", fontSize: 12, color: h ? "var(--text-primary)" : "var(--text-secondary)", cursor: "pointer" }}><Paperclip size={13} />{filename}<span style={{ color: "var(--text-muted)" }}>{size}</span></span>;
}
function HtmlBody({ html }) {
  return <iframe title="message" sandbox="allow-same-origin" srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0}body{background:#fff;color:#1d222b;font:13.5px/1.55 "Segoe UI",system-ui,sans-serif;padding:16px 18px}img{max-width:100%}a{color:#3b52c4}</style></head><body>${html}</body></html>`} style={{ width: "100%", height: 300, border: 0, borderRadius: "0 0 10px 10px", background: "#fff" }} />;
}
function MessageCard({ m, expanded, onToggle, last }) {
  const [h, setH] = useState(false);
  if (!expanded) {
    return <button onClick={onToggle} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, textAlign: "left", padding: "10px 16px", borderRadius: 10, border: "1px solid var(--border)", background: h ? "var(--bg-hover)" : "var(--bg-surface)", cursor: "pointer" }}>
      <Avatar name={m.fromName} email={m.from} size={26} />
      <span style={{ width: 140, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{m.fromName}</span>
      <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5, color: "var(--text-muted)" }}>{(m.body || "").replace(/\n+/g, " ").slice(0, 120)}</span>
      <span style={{ flexShrink: 0, fontSize: 11.5, color: "var(--text-muted)" }}>{m.time}</span>
    </button>;
  }
  return (
    <div style={{ overflow: "hidden", borderRadius: 10, border: last ? "1px solid var(--border-strong)" : "1px solid var(--border)", background: "var(--bg-raised)", boxShadow: last ? "0 1px 3px rgba(0,0,0,0.06)" : "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px" }}>
        <Avatar name={m.fromName} email={m.from} size={34} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{m.fromName}</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "var(--text-muted)" }}>{m.from}</span></div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>to {m.to.join(", ")}{m.cc && m.cc.length ? ` · cc ${m.cc.join(", ")}` : ""}</div>
        </div>
        <button onClick={onToggle} title="Reply" style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 15 }}>↩</button>
        <span style={{ flexShrink: 0, fontSize: 12, color: "var(--text-muted)" }}>{m.time}</span>
      </div>
      {m.html ? <HtmlBody html={m.html} /> : <div style={{ padding: "4px 18px 18px", lineHeight: 1.65, color: "var(--text-primary)", whiteSpace: "pre-wrap", fontSize: 14 }} className="selectable">{m.body}</div>}
      {m.attachments && m.attachments.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8, borderTop: "1px solid var(--border)", padding: "12px 18px" }}>{m.attachments.map((a, i) => <AttachmentChip key={i} {...a} />)}</div> : null}
    </div>
  );
}
function ContactPanel({ thread }) {
  const first = thread.messages[0];
  const c = (META[thread.id] || {}).contact || {};
  return (
    <aside style={{ display: "flex", width: 280, flexShrink: 0, flexDirection: "column", borderLeft: "1px solid var(--border)", background: "var(--bg-surface)", padding: "18px 22px", gap: 14, overflowY: "auto" }}>
      <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>{first.fromName}</div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{first.from}</div>
      <button style={{ alignSelf: "flex-start", borderRadius: 6, border: "none", background: "var(--accent-dim)", color: "var(--accent-strong)", padding: "8px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}>Add to CRM</button>
      {c.role && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{c.role}{c.company ? ` at ${c.company}` : ""}</div>}
      <div style={{ marginTop: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 10 }}><span aria-hidden="true" style={{ opacity: 0.55 }}>✉</span> Mail</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {(c.history || []).map((h, i) => <div key={i} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>{h}</div>)}
        </div>
      </div>
      {c.company && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, fontSize: 13, color: "var(--text-secondary)" }}><span aria-hidden="true" style={{ opacity: 0.55 }}>🔗</span>{c.company.toLowerCase().replace(/\s+/g, "")}.com</div>}
    </aside>
  );
}
function InstantReply() {
  const [sel, setSel] = useState(0);
  return (
    <div style={{ borderRadius: 10, border: "1px dashed var(--border-strong)", background: "var(--bg-surface)", padding: "12px 16px" }}>
      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}><AiClip size={14} color="var(--accent-strong)" /> Instant replies — <Kbd>Tab</Kbd> preview · <Kbd>R</Kbd> use</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 0 }}>
          {SUGGESTIONS.map((s, i) => <button key={i} onClick={() => setSel(i)} style={{ maxWidth: "32%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderRadius: 999, border: `1px solid ${sel === i ? "var(--accent)" : "var(--border-strong)"}`, padding: "6px 14px", fontSize: 12.5, background: sel === i ? "var(--accent-dim)" : "var(--bg-raised)", color: sel === i ? "var(--text-primary)" : "var(--text-secondary)", cursor: "pointer" }}>{s}</button>)}
        </div>
        <button aria-label="Good" title="Good" style={fb}>👍</button>
        <button aria-label="Bad" title="Bad" style={fb}>👎</button>
      </div>
      {sel !== null && <div className="sm-fade-in" style={{ marginTop: 8, whiteSpace: "pre-wrap", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-raised)", padding: "8px 12px", fontSize: 13, lineHeight: 1.55, color: "var(--text-primary)" }}>{SUGGESTIONS[sel]}</div>}
    </div>
  );
}
const fb = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, opacity: 0.7 };

function ThreadView({ thread, onBack }) {
  const [overrides, setOverrides] = useState({});
  useEffect(() => { setOverrides({}); }, [thread.id]);
  const msgs = thread.messages;
  const isExp = (m, i) => overrides[i] ?? (i === msgs.length - 1 || m.unread);
  const m0 = META[thread.id] || {};
  return (
    <div style={{ display: "flex", height: "100%", minWidth: 0, flex: 1 }}>
      <div style={{ display: "flex", minWidth: 0, flex: 1, flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 28px", flexShrink: 0 }}>
          <IconBtn label="Back" hint="Back" keys="escape" place="bottom" onClick={onBack}>←</IconBtn>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {(m0.labels || []).map((l) => <Label key={l.name} color={l.color}>{l.name}</Label>)}
              <h1 style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>{thread.subject}</h1>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Hit <Kbd>I</Kbd> to summarize · {msgs.length} message{msgs.length > 1 ? "s" : ""}</div>
          </div>
          <IconBtn label="Mark done" hint="Mark Done" keys="e" place="bottom">✓</IconBtn>
          <IconBtn label="Remind me" hint="Remind Me" keys="h" place="bottom">🕑</IconBtn>
          <IconBtn label="More" hint="More actions" place="bottom">⊟</IconBtn>
        </div>
        <div style={{ minHeight: 0, flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "8px 28px 16px" }}>
          {msgs.map((m, i) => <MessageCard key={i} m={m} expanded={isExp(m, i)} last={i === msgs.length - 1} onToggle={() => setOverrides((o) => ({ ...o, [i]: !isExp(m, i) }))} />)}
          <InstantReply />
        </div>
      </div>
      <ContactPanel thread={thread} />
    </div>
  );
}

/* ---------------- compose --------------------------------------------------- */
function Compose({ initial, onClose, onSend }) {
  const [to, setTo] = useState(initial.to || "");
  const [subject, setSubject] = useState(initial.subject || "");
  const [body, setBody] = useState(initial.body || "");
  const [drafting, setDrafting] = useState(false);
  const bodyRef = useRef(null);
  useEffect(() => { bodyRef.current && bodyRef.current.focus(); }, []);
  const field = { display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)", padding: "10px 18px" };
  const label = { width: 40, fontSize: 12, color: "var(--text-muted)" };
  const input = { flex: 1, background: "transparent", fontSize: 13.5, color: "var(--text-primary)", border: "none", outline: "none", fontFamily: "var(--font-sans)" };
  const aiDraft = () => {
    setDrafting(true);
    const text = "Hi Maya,\n\nConfirmed — the 15th works on our end. I'll send wiring details in a separate note today so counsel can hold the schedule.\n\nBest,\nYou";
    let i = 0; setBody("");
    const iv = setInterval(() => { i += 4; setBody(text.slice(0, i)); if (i >= text.length) { clearInterval(iv); setDrafting(false); } }, 16);
  };
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.4)" }} onClick={onClose}>
      <div className="sm-pop-in" onClick={(e) => e.stopPropagation()} style={{ display: "flex", height: "78%", width: 780, maxWidth: "94vw", flexDirection: "column", borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--bg-raised)", boxShadow: "var(--shadow-overlay)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)", padding: "12px 18px" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{initial.mode || "New message"}</span>
          <div style={{ flex: 1 }} />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}><KeyHint expr="mod+j" /><span>AI</span><KeyHint expr="mod+enter" /><span>send</span><KeyHint expr="escape" /><span>saves draft</span></span>
        </div>
        <div style={field}><label style={label}>To</label><input style={input} value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com" /></div>
        <div style={field}><label style={label}>Subject</label><input style={{ ...input, fontWeight: 500 }} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" /></div>
        <textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tip: Hit Ctrl+J for AI" style={{ minHeight: 0, flex: 1, resize: "none", background: "transparent", padding: "14px 18px", fontSize: 14, lineHeight: 1.65, color: "var(--text-primary)", border: "none", outline: "none", fontFamily: "var(--font-sans)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4, borderTop: "1px solid var(--border)", padding: "10px 18px" }}>
          <HoverHint label="Send" expr="mod+enter"><Button onClick={() => onSend(to)}>Send</Button></HoverHint>
          <HoverHint label="Send Instantly" expr="mod+shift+z"><Button variant="quiet" size="sm">Smart Send</Button></HoverHint>
          <HoverHint label="Remind me" expr="mod+shift+h"><Button variant="quiet" size="sm">Remind me</Button></HoverHint>
          <div style={{ flex: 1 }} />
          <IconBtn label="Write with AI" hint="Write with AI" keys="mod+j" onClick={aiDraft} active={drafting}><AiClip size={16} /></IconBtn>
          <IconBtn label="Insert snippet" hint="Use Snippet" keys="mod+;">{"{}"}</IconBtn>
          <IconBtn label="Attach" hint="Attach" keys="mod+shift+u"><Paperclip size={15} /></IconBtn>
          <IconBtn label="Discard" hint="Discard Draft" keys="mod+shift+," onClick={onClose}>🗑</IconBtn>
        </div>
      </div>
    </div>
  );
}

/* ---------------- command palette (dark-on-any-theme, like the product) ----- */
const COMMANDS = [
  { g: "Triage", t: "Mark Done", k: "E", icon: "✓" }, { g: "Triage", t: "Remind Me", k: "H", icon: "🕑" },
  { g: "Triage", t: "Star", k: "S", icon: "☆" }, { g: "Triage", t: "Move", k: "V", icon: "⊕" },
  { g: "Triage", t: "Label", k: "L", icon: "🏷" }, { g: "Triage", t: "Undo", k: "Z", icon: "↺" },
  { g: "Compose", t: "Compose", k: "C", icon: "✎" }, { g: "Compose", t: "Reply", k: "R", icon: "↩" },
  { g: "Compose", t: "Write with AI", k: "⌘J", icon: "✦" },
  { g: "Navigate", t: "Go to Sent", k: "G T", icon: "→" }, { g: "Navigate", t: "Search", k: "/", icon: "⌕" },
  { g: "AI", t: "Ask AI (Semantic Search)", k: "?", icon: "✦" },
  { g: "Theme", t: "Set Theme: Dark", k: "", icon: "☾" }, { g: "Theme", t: "Set Theme: Light", k: "", icon: "☀" },
];
function CommandPalette({ onClose, onRun }) {
  const [q, setQ] = useState(""); const [idx, setIdx] = useState(0);
  const ref = useRef(null);
  useEffect(() => { ref.current && ref.current.focus(); }, []);
  const items = COMMANDS.filter((c) => c.t.toLowerCase().includes(q.toLowerCase()));
  useEffect(() => { setIdx(0); }, [q]);
  const key = (e) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); items[idx] && onRun(items[idx]); }
  };
  let lastG = "";
  return (
    <div className="sm-fade-in" style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", alignItems: "flex-start", justifyContent: "center", background: "rgba(0,0,0,.4)", paddingTop: "12vh" }} onClick={onClose}>
      <div className="sm-pop-in" onClick={(e) => e.stopPropagation()} style={{ width: 620, maxWidth: "92vw", overflow: "hidden", borderRadius: 12, background: "var(--palette-bg)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 24px 60px rgba(0,0,0,0.6)", colorScheme: "dark" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px 10px", color: "rgba(233,236,245,0.5)", fontSize: 13 }}><span aria-hidden="true">⬡</span> Shell Command</div>
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder="" style={{ width: "100%", boxSizing: "border-box", borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)", borderLeft: "none", borderRight: "none", background: "transparent", padding: "12px 18px", fontSize: 15, color: "rgba(233,236,245,0.92)", outline: "none", fontFamily: "var(--font-sans)" }} />
        <div style={{ maxHeight: "50vh", overflowY: "auto", padding: "6px 0" }}>
          {items.map((c, i) => {
            const header = c.g !== lastG ? c.g : null; lastG = c.g;
            return <div key={c.t}>
              {header && <div style={{ padding: "8px 18px 4px", fontSize: 10.5, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(163,171,192,0.5)" }}>{header}</div>}
              <button onClick={() => onRun(c)} onMouseEnter={() => setIdx(i)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "9px 18px", textAlign: "left", fontSize: 14, background: i === idx ? "rgba(255,255,255,0.07)" : "transparent", color: i === idx ? "rgba(233,236,245,0.92)" : "rgba(196,202,218,0.72)", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)" }}>
                <span style={{ width: 18, textAlign: "center", opacity: 0.7 }} aria-hidden="true">{c.icon}</span>
                <span style={{ flex: 1 }}>{c.t}</span>
                {c.k && <span style={{ padding: "1px 7px", borderRadius: 4, background: "rgba(255,255,255,0.08)", color: "rgba(196,202,218,0.72)", fontSize: 11 }}>{c.k}</span>}
              </button>
            </div>;
          })}
          {items.length === 0 && <div style={{ padding: "24px", textAlign: "center", fontSize: 13, color: "rgba(163,171,192,0.5)" }}>No matching commands</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- search (with operator tips) ------------------------------- */
function SearchView({ onClose }) {
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current && ref.current.focus(); }, []);
  return (
    <div style={{ display: "flex", height: "100%", minWidth: 0, flex: 1 }}>
      <div style={{ display: "flex", minWidth: 0, flex: 1, flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 28px", borderBottom: "1px solid var(--border)" }}>
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" style={{ flex: 1, background: "transparent", fontSize: 20, color: "var(--text-primary)", border: "none", outline: "none", fontFamily: "var(--font-sans)" }} />
          <IconBtn label="Close search" hint="Close search" keys="escape" place="bottom" onClick={onClose}>×</IconBtn>
        </div>
        <div style={{ padding: "16px 28px", display: "flex", flexDirection: "column", gap: 14, color: "var(--text-secondary)", fontSize: 14 }}>
          <div style={{ display: "flex", gap: 16 }}><span style={{ width: 160, color: "var(--text-primary)", fontWeight: 500 }}>Salesforce</span><span style={{ color: "var(--text-muted)" }}>notifications@salesforce.com</span></div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            {["has:attachment", "subject:\"term sheet\"", "from:maya", "is:unread", "\"Series A\""].map((s, i) => <span key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{s}</span>)}
          </div>
        </div>
      </div>
      <aside style={{ width: 320, flexShrink: 0, borderLeft: "1px solid var(--border)", background: "var(--bg-surface)", padding: "18px 24px", overflowY: "auto" }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Tips</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {SEARCH_TIPS.map(([op, desc], i) => <div key={i} style={{ display: "flex", gap: 14 }}><span style={{ width: 130, fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-primary)" }}>{op}</span><span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{desc}</span></div>)}
        </div>
      </aside>
    </div>
  );
}

/* ---------------- undo toast + toast ---------------------------------------- */
function UndoToast({ message, onUndo, onDismiss }) {
  return (
    <div className="sm-pop-in" style={{ position: "absolute", bottom: 20, left: 20, zIndex: 25, display: "flex", alignItems: "stretch", gap: 16, minWidth: 260, maxWidth: 380, borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--bg-raised)", boxShadow: "var(--shadow-toast)", overflow: "hidden" }}>
      <span style={{ width: 3, flexShrink: 0, background: "var(--accent)" }} />
      <span style={{ flex: 1, padding: "10px 0", fontSize: 13, color: "var(--text-primary)" }}>{message}</span>
      {onUndo && <button onClick={onUndo} style={{ border: "none", background: "transparent", color: "var(--accent-strong)", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer" }}>Undo</button>}
      <button onClick={onDismiss} aria-label="Dismiss" style={{ border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 15, cursor: "pointer", padding: "10px 14px 10px 4px" }}>×</button>
    </div>
  );
}

window.SM_PANELS = { ThreadView, Compose, CommandPalette, SearchView, UndoToast };
