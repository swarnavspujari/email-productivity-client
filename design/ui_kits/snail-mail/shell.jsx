/* global React */
const { useState } = React;
const { ME, threads: THREADS, meta: META, autoLabels: AUTO_LABELS } = window.SM_DATA;

/* ---------------- primitives ------------------------------------------------ */
function hueOf(key) { let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0; return ((h % 360) + 360) % 360; }
function Avatar({ name, email = "", size = 32 }) {
  const initial = ((name || "").trim()[0] || "?").toUpperCase();
  const hue = hueOf(email.toLowerCase());
  return <div aria-hidden="true" style={{ display: "flex", flexShrink: 0, alignItems: "center", justifyContent: "center", userSelect: "none", width: size, height: size, borderRadius: 999, fontWeight: 600, fontSize: size * 0.44, background: `oklch(0.62 0.11 ${hue})`, color: "#fff" }}>{initial}</div>;
}
function Kbd({ children }) { return <span className="kbd">{children}</span>; }

/* ---- Keyboard hint (design system core/KeyHint + HoverHint) ----------------
   The rule: any control with a shortcut shows a hover tooltip pairing its
   LABEL with the binding drawn as keycap chips (never plain text). The tip is
   a theme-aware INVERSE card (light on dark, dark on light) via the --tip-*
   tokens; it portals to <body> so it never clips inside a row or panel. */
function smKeyTok(p){switch(p){case"mod":return"ctrl";case"shift":return"shift";case"alt":return"alt";case"escape":return"esc";case"enter":return"enter";case"tab":return"tab";case"space":return"space";case"backspace":return"backspace";case"delete":return"del";case"up":return"↑";case"down":return"↓";case"left":return"←";case"right":return"→";default:return p.length===1&&p>="a"&&p<="z"?p.toUpperCase():p;}}
function smKeycaps(expr){if(!expr)return[];return expr.split("|").flatMap((alt)=>{const out=[];alt.trim().split(/\s+/).forEach((part)=>{for(const p of part.split("+"))out.push(smKeyTok(p));});return out;});}
function KeyHint({ expr, on = "surface" }) {
  const chips = smKeycaps(expr);
  const cap = on === "tooltip" ? { background: "var(--tip-key-bg)", color: "var(--tip-key-fg)", border: "1px solid transparent" } : { background: "var(--bg-raised)", color: "var(--text-secondary)", border: "1px solid var(--border-strong)" };
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{chips.map((c, i) => <kbd key={i} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, padding: "1px 6px", borderRadius: 4, fontFamily: "var(--font-mono)", fontSize: 11, fontStyle: "normal", lineHeight: 1, ...cap }}>{c}</kbd>)}</span>;
}
function HintTip({ label, expr, placement, align, gap, anchor }) {
  const ref = React.useRef(null);
  const [pos, setPos] = useState({ top: -9999, left: -9999, ready: false });
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const w = el.offsetWidth, hh = el.offsetHeight, M = 8, vw = window.innerWidth, vh = window.innerHeight;
    let p = placement;
    if (p === "top" && anchor.top - gap - hh < M) p = "bottom";
    else if (p === "bottom" && anchor.bottom + gap + hh > vh - M) p = "top";
    let top, left;
    if (p === "top") top = anchor.top - gap - hh; else if (p === "bottom") top = anchor.bottom + gap; else top = anchor.cy - hh / 2;
    if (align === "start") left = anchor.left; else if (align === "end") left = anchor.right - w; else left = anchor.cx - w / 2;
    left = Math.max(M, Math.min(left, vw - M - w)); top = Math.max(M, Math.min(top, vh - M - hh));
    setPos({ top, left, ready: true });
  }, [anchor, placement, align, gap]);
  const tip = <div ref={ref} className="sm-pop-in" style={{ position: "fixed", top: pos.top, left: pos.left, opacity: pos.ready ? 1 : 0, zIndex: 2000, display: "inline-flex", alignItems: "center", gap: 10, padding: "5px 8px 5px 11px", borderRadius: 8, background: "var(--tip-bg)", color: "var(--tip-fg)", border: "1px solid var(--tip-border)", boxShadow: "var(--tip-shadow)", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", pointerEvents: "none" }}><span>{label}</span>{expr && <KeyHint expr={expr} on="tooltip" />}</div>;
  return ReactDOM.createPortal(tip, document.body);
}
function HoverHint({ label, expr, placement = "top", align = "center", delay = 320, gap = 8, children }) {
  const ref = React.useRef(null), timer = React.useRef(null);
  const [open, setOpen] = useState(false), [anchor, setAnchor] = useState(null);
  const show = () => { clearTimeout(timer.current); timer.current = setTimeout(() => { const el = ref.current; if (!el) return; const r = el.getBoundingClientRect(); setAnchor({ top: r.top, bottom: r.bottom, left: r.left, right: r.right, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }); setOpen(true); }, delay); };
  const hide = () => { clearTimeout(timer.current); setOpen(false); };
  React.useEffect(() => () => clearTimeout(timer.current), []);
  return <span ref={ref} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} style={{ display: "inline-flex" }}>{children}{open && anchor && <HintTip label={label} expr={expr} placement={placement} align={align} gap={gap} anchor={anchor} />}</span>;
}
function Badge({ children, tone = "neutral" }) {
  const t = { neutral: { border: "1px solid var(--border)", background: "var(--bg-raised)", color: "var(--text-muted)" }, active: { border: "1px solid rgba(124,127,242,.4)", background: "var(--accent-dim)", color: "var(--accent-strong)" }, solid: { border: "1px solid transparent", background: "var(--accent)", color: "var(--on-accent)" } }[tone];
  return <span style={{ display: "inline-block", minWidth: 18, textAlign: "center", padding: "0 6px", borderRadius: 999, fontSize: 10.5, lineHeight: "17px", fontVariantNumeric: "tabular-nums", ...t }}>{children}</span>;
}
const TAGS = { violet: ["--tag-violet-bg", "--tag-violet-fg"], amber: ["--tag-amber-bg", "--tag-amber-fg"], green: ["--tag-green-bg", "--tag-green-fg"], blue: ["--tag-blue-bg", "--tag-blue-fg"], pink: ["--tag-pink-bg", "--tag-pink-fg"], gray: ["--tag-gray-bg", "--tag-gray-fg"] };
function Label({ children, color = "gray" }) {
  const [bg, fg] = TAGS[color] || TAGS.gray;
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 7px", borderRadius: 4, fontSize: 11, lineHeight: "16px", fontWeight: 500, background: `var(${bg})`, color: `var(${fg})`, whiteSpace: "nowrap" }}>{children}</span>;
}
function Button({ children, variant = "primary", size = "md", onClick, disabled, title }) {
  const [h, setH] = useState(false);
  const sz = { sm: ["4px 10px", 12], md: ["6px 16px", 13], lg: ["10px 20px", 13.5] }[size];
  const v = { primary: { background: h ? "var(--accent-strong)" : "var(--accent)", color: "var(--on-accent)", border: "1px solid transparent" }, secondary: { background: h ? "var(--bg-hover)" : "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)" }, quiet: { background: h ? "var(--bg-hover)" : "transparent", color: "var(--text-secondary)", border: "1px solid transparent" } }[variant];
  return <button title={title} disabled={disabled} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 500, fontSize: sz[1], padding: sz[0], borderRadius: 6, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap", fontFamily: "var(--font-sans)", ...v }}>{children}</button>;
}
function IconBtn({ children, label, onClick, bordered, active, keys, hint, place }) {
  const [h, setH] = useState(false);
  const wrapped = keys != null || hint != null;
  const btn = <button aria-label={label} title={wrapped ? undefined : label} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 15, color: active ? "var(--accent-strong)" : h ? "var(--text-primary)" : "var(--text-secondary)", background: h || active ? "var(--bg-hover)" : "transparent", border: bordered ? "1px solid var(--border)" : "1px solid transparent" }}>{children}</button>;
  return wrapped ? <HoverHint label={hint || label} expr={keys} placement={place || "top"}>{btn}</HoverHint> : btn;
}
const DOTS = { blue: "--dot-blue", pink: "--dot-pink", amber: "--dot-amber", violet: "--dot-violet" };

// Line-drawn paperclip (attach) and an original paperclip-with-sparkle for
// AI actions (an homage to the paperclip assistant, not Microsoft's mascot).
function Paperclip({ size = 15 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}><path d="M21 8.5l-9.19 9.19a4 4 0 0 1-5.66-5.66l9.2-9.19a2.67 2.67 0 0 1 3.77 3.77l-9.2 9.19a1.33 1.33 0 0 1-1.88-1.88l8.49-8.49" /></svg>;
}
function AiClip({ size = 15, color = "currentColor" }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}><path d="M16.5 8l-7 7a2.5 2.5 0 0 1-3.54-3.54l7.2-7.2a1.4 1.4 0 0 1 1.98 1.98l-7.1 7.1a.5.5 0 0 1-.7-.7l6.4-6.4" /><path d="M18.7 3l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3L16.9 5l1.3-.5z" fill={color} stroke="none" /></svg>;
}

/* ---------------- nav rail -------------------------------------------------- */
// Mail + Calendar share one vertical pill (a segmented control): a single
// raised "thumb" slides up/down between the two slots as the active view
// changes, so the switch reads as one control with two states rather than two
// separate buttons. Depth is the bg-raised thumb over the bg-surface track
// (no shadow), per the resting-surface rule.
// Rail icons are line-drawn SVGs (stroke, 2px, round joins) rather than the
// brand's Unicode glyphs: the grid glyph (▦) doesn't read as a calendar, so
// the two destinations share one crisp, matched icon set.
function MailIcon({ size = 18 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M4 7.5l6.9 4.8a2 2 0 0 0 2.2 0L20 7.5" /></svg>;
}
function CalendarIcon({ size = 18 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17" /><path d="M8 3v3.5" /><path d="M16 3v3.5" /></svg>;
}
const RAIL_SLOT = 34, RAIL_PAD = 3;
function NavRail({ view, setView, onMenu, overlay }) {
  const items = [{ id: "mail", label: "Mail", icon: <MailIcon /> }, { id: "calendar", label: "Calendar", icon: <CalendarIcon /> }];
  const activeRail = view === "calendar" ? "calendar" : "mail";
  const activeIndex = Math.max(0, items.findIndex((it) => it.id === activeRail));
  const ov = overlay ? { position: "relative", zIndex: 2, background: "transparent", borderRight: "none", "--bg-surface": "rgba(255,255,255,0.12)", "--bg-raised": "rgba(255,255,255,0.24)", "--border": "rgba(255,255,255,0.28)", "--accent-strong": "#fff", "--text-secondary": "rgba(255,255,255,0.9)", "--text-muted": "rgba(255,255,255,0.62)" } : { background: "var(--bg-base)", borderRight: "1px solid var(--border)" };
  return (
    <nav style={{ display: "flex", width: 56, flexShrink: 0, flexDirection: "column", alignItems: "center", gap: 8, padding: "12px 0", ...ov }}>
      <div role="tablist" aria-orientation="vertical" style={{ position: "relative", display: "flex", flexDirection: "column", padding: RAIL_PAD, borderRadius: 999, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <span aria-hidden="true" style={{ position: "absolute", left: RAIL_PAD, top: RAIL_PAD, width: RAIL_SLOT, height: RAIL_SLOT, boxSizing: "border-box", borderRadius: 999, background: "var(--bg-raised)", border: "1px solid var(--border)", transform: `translateY(${activeIndex * RAIL_SLOT}px)`, transition: "transform 220ms var(--ease-pop)" }} />
        {items.map((it) => <RailBtn key={it.id} on={it.id === activeRail} label={it.label} onClick={() => setView(it.id)}>{it.icon}</RailBtn>)}
      </div>
    </nav>
  );
}
function RailBtn({ children, label, on, onClick }) {
  const [h, setH] = useState(false);
  return <button role="tab" aria-selected={on} aria-label={label} title={label} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: RAIL_SLOT, height: RAIL_SLOT, borderRadius: 999, border: "none", background: "transparent", color: on ? "var(--accent-strong)" : h ? "var(--text-secondary)" : "var(--text-muted)", cursor: "pointer", fontSize: 17, transition: "color 140ms ease" }}>{children}</button>;
}

/* ---------------- folder sidebar (slide-in) --------------------------------- */
function FolderSidebar({ open, active, onSelect, count }) {
  const list = [
    { id: "inbox", name: "Inbox", sub: "Important · Other", count },
    { id: "starred", name: "Starred" }, { id: "drafts", name: "Drafts" }, { id: "sent", name: "Sent" },
    { id: "done", name: "Done" }, { id: "archived", name: "Auto Archived" }, { id: "scheduled", name: "Scheduled" },
    { id: "reminders", name: "Reminders" }, { id: "snippets", name: "Snippets" }, { id: "muted", name: "Muted" },
    { id: "spam", name: "Spam" }, { id: "trash", name: "Trash" },
  ];
  return (
    <nav style={{ width: open ? 244 : 0, flexShrink: 0, overflow: "hidden", transition: "width 160ms var(--ease-pop)", borderRight: open ? "1px solid var(--border)" : "none", background: "var(--bg-surface)" }}>
      <div style={{ width: 244, display: "flex", flexDirection: "column", padding: "12px 8px", gap: 2, height: "100%", boxSizing: "border-box", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 12px" }}>
          <Avatar name="You" email={ME} size={28} />
          <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: "var(--text-secondary)" }}>{ME}</span>
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>›</span>
        </div>
        {list.map((f) => <FolderItem key={f.id} f={f} on={f.id === active} onClick={() => onSelect(f.id)} />)}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "14px 10px 6px", fontSize: 12.5, fontWeight: 500, color: "var(--accent-strong)" }}>Auto Labels <span aria-hidden="true">✦</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "2px 10px" }}>{AUTO_LABELS.map((l) => <Label key={l.name} color={l.color}>{l.name}</Label>)}</div>
      </div>
    </nav>
  );
}
function FolderItem({ f, on, onClick }) {
  const [h, setH] = useState(false);
  return <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, textAlign: "left", width: "100%", padding: "7px 10px", borderRadius: 6, border: "none", background: on ? "var(--bg-selected)" : h ? "var(--bg-hover)" : "transparent", cursor: "pointer" }}>
    {on && <span style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 3, borderRadius: 3, background: "var(--accent)" }} />}
    <span style={{ fontSize: 13.5, fontWeight: on ? 500 : 400, color: on ? "var(--text-primary)" : "var(--text-secondary)" }}>{f.name}</span>
    {f.sub && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{f.sub}</span>}
    <span style={{ flex: 1 }} />
    {f.count != null && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{f.count}</span>}
  </button>;
}

/* ---------------- header + hint bar ----------------------------------------- */
function Header({ theme, setTheme, onMenu, onSearch, onCompose, overlay }) {
  const ov = overlay ? { position: "relative", zIndex: 2, background: "transparent", borderBottom: "none", "--text-primary": "#fff", "--text-secondary": "rgba(255,255,255,0.88)", "--text-muted": "rgba(255,255,255,0.62)", "--bg-hover": "rgba(255,255,255,0.14)", "--border": "rgba(255,255,255,0.22)" } : { background: "var(--bg-base)", borderBottom: "1px solid var(--border)" };
  return (
    <header style={{ display: "flex", height: 48, flexShrink: 0, alignItems: "center", gap: 10, padding: "0 14px", ...ov }}>
      <IconBtn label="Toggle folders" onClick={onMenu}>☰</IconBtn>
      <img src={overlay || theme === "dark" ? "../../assets/snail-mail-logo-on-dark.svg" : "../../assets/snail-mail-logo.svg"} alt="Snail Mail" style={{ height: 26, width: "auto", display: "block" }} />
      <div style={{ flex: 1 }} />
      <IconBtn label="Compose" hint="Compose" keys="c" place="bottom" onClick={onCompose}>✎</IconBtn>
      <IconBtn label="Search" hint="Search" keys="/" place="bottom" onClick={onSearch}>⌕</IconBtn>
      <Button variant="quiet" size="sm" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Toggle theme">{theme === "dark" ? "☾" : "☀"}</Button>
    </header>
  );
}
function HintBar({ hints, overlay }) {
  const ov = overlay ? { position: "relative", zIndex: 2, background: "transparent", borderTop: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.72)", "--text-muted": "rgba(255,255,255,0.72)", "--text-secondary": "rgba(255,255,255,0.88)", "--bg-raised": "rgba(255,255,255,0.16)", "--border-strong": "rgba(255,255,255,0.3)", textShadow: "0 1px 2px rgba(0,0,0,0.35)" } : { background: "var(--bg-surface)", borderTop: "1px solid var(--border)", color: "var(--text-muted)" };
  return (
    <footer style={{ display: "flex", height: 30, flexShrink: 0, alignItems: "center", justifyContent: "center", gap: 16, fontSize: 11.5, overflow: "hidden", padding: "0 12px", ...ov }}>
      {hints.map((h, i) => <span key={i} style={{ display: "flex", gap: 5, alignItems: "center", whiteSpace: "nowrap", flexShrink: 0 }}>Hit {h.keys.map((k, j) => <Kbd key={j}>{k}</Kbd>)} {h.label}</span>)}
    </footer>
  );
}

/* ---------------- mail list ------------------------------------------------- */
const SPLITS = [{ id: "important", name: "Important" }, { id: "other", name: "Other" }];

// Inbox-zero rest state (design system mail/RestState): the full-bleed daily
// photo (rotated from the Unsplash API), the inbox-zero streak bottom-left and
// the required Unsplash attribution bottom-right — no headline copy. Placeholder
// gradient stands in for the rotating photo.
function RestState({ streak = 12, full }) {
  const b = full ? 44 : 14;
  const streakLabel = streak > 0 ? `🔥 ${streak}-day inbox-zero streak` : "Inbox zero";
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundColor: "oklch(0.5 0.05 250)", backgroundImage: "radial-gradient(135% 82% at 50% 32%, oklch(0.95 0.06 82 / 0.92) 0%, oklch(0.88 0.05 74 / 0.35) 34%, transparent 62%), radial-gradient(120% 100% at 50% 125%, oklch(0.27 0.03 252) 0%, transparent 55%), linear-gradient(180deg, oklch(0.83 0.035 232) 0%, oklch(0.66 0.05 248) 40%, oklch(0.46 0.05 254) 74%, oklch(0.34 0.04 256) 100%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: full ? 126 : 96, background: "linear-gradient(to top, rgba(0,0,0,0.45), transparent)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: 24, bottom: b, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.85)", textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}>{streakLabel}</div>
      <div style={{ position: "absolute", right: 20, bottom: b, fontSize: 11, color: "rgba(255,255,255,0.7)", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}>Photo by <span style={{ textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.4)" }}>Aditya Chinchure</span> on <span style={{ textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.4)" }}>Unsplash</span></div>
    </div>
  );
}
function MailList({ threads, activeSplit, setActiveSplit, selectedId, onSelect, onOpen, states, onDone, checked, onToggleCheck, onBulkDone, onBulkTrash, onBulkLabel, onBulkClear, restOwned }) {
  const shown = threads.filter((t) => t.split === activeSplit);
  const zero = shown.length === 0;
  return (
    <div style={{ position: "relative", display: "flex", minWidth: 0, flex: 1, flexDirection: "column" }}>
      {zero && !restOwned && <RestState streak={12} />}
      {zero && !restOwned && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 84, background: "linear-gradient(to bottom, rgba(0,0,0,0.26), transparent)", pointerEvents: "none" }} />}
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 20, padding: "0 24px", height: 52, flexShrink: 0 }}>
        {SPLITS.map((sp) => {
          const count = threads.filter((t) => t.split === sp.id).length;
          const active = sp.id === activeSplit;
          return <button key={sp.id} onClick={() => setActiveSplit(sp.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 17, background: "transparent", border: "none", color: active ? (zero ? "rgba(255,255,255,0.98)" : "var(--text-primary)") : (zero ? "rgba(255,255,255,0.58)" : "var(--text-muted)"), fontWeight: active ? 600 : 400, cursor: "pointer", letterSpacing: "-0.01em", textShadow: zero ? "0 1px 3px rgba(0,0,0,0.4)" : "none" }}>{sp.name}<span style={{ fontSize: 12.5, color: zero ? "rgba(255,255,255,0.72)" : (active ? "var(--accent-strong)" : "var(--text-muted)"), fontWeight: 500 }}>{count}</span></button>;
        })}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: zero ? "rgba(255,255,255,0.72)" : "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0, textShadow: zero ? "0 1px 2px rgba(0,0,0,0.4)" : "none" }}>{zero ? "Tab to switch" : <React.Fragment><Kbd>Tab</Kbd> to switch</React.Fragment>}</span>
      </div>
      {!zero && checked && checked.size > 0 && (
        <BulkBar count={checked.size} onDone={onBulkDone} onTrash={onBulkTrash} onLabel={onBulkLabel} onClear={onBulkClear} />
      )}
      {!zero && (
        <div style={{ minHeight: 0, flex: 1, overflowY: "auto" }}>
          {shown.map((t) => {
            const st = states[t.id] || {};
            const unread = st.unread ?? t.unread, starred = st.starred ?? t.starred;
            const m = META[t.id] || {};
            return <MailRow key={t.id} t={t} m={m} unread={unread} starred={starred} selected={t.id === selectedId} checked={checked ? checked.has(t.id) : false}
              onClick={() => { onSelect(t.id); onOpen(t.id); }} onToggleCheck={() => onToggleCheck && onToggleCheck(t.id)} onDone={(e) => { e.stopPropagation(); onDone(t.id); }} />;
          })}
        </div>
      )}
    </div>
  );
}
// Multi-select bulk-triage bar (design system mail/BulkBar): appears above the
// list once rows are checked (Ctrl/⌘+click a row, or X on the cursor row).
// Count + Mark Done (E) · Trash (#) · Label (V) · clear (×), on --accent-dim.
function BulkAct({ children, onClick }) {
  const [h, setH] = useState(false);
  return <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: 6, border: "1px solid var(--border-strong)", background: h ? "var(--bg-hover)" : "transparent", color: "var(--text-primary)", fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "var(--font-sans)" }}>{children}</button>;
}
function BulkBar({ count, onDone, onTrash, onLabel, onClear }) {
  return (
    <div className="sm-fade-in" style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)", background: "var(--accent-dim)", padding: "6px 16px", fontSize: 12.5, color: "var(--text-primary)" }}>
      <span style={{ fontWeight: 500 }}>{count} selected</span>
      <span style={{ flex: 1 }} />
      <BulkAct onClick={onDone}>Mark Done <Kbd>E</Kbd></BulkAct>
      <BulkAct onClick={onTrash}>Trash <Kbd>#</Kbd></BulkAct>
      <BulkAct onClick={onLabel}>Label <Kbd>V</Kbd></BulkAct>
      <button onClick={onClear} aria-label="Clear selection" title="Clear selection (Esc)" style={{ border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 15, lineHeight: 1, cursor: "pointer", padding: "2px 4px" }}>{"×"}</button>
    </div>
  );
}
function MailRow({ t, m, unread, starred, selected, checked, onClick, onToggleCheck, onDone }) {
  const [h, setH] = useState(false);
  const bg = selected ? "var(--bg-selected)" : checked ? "var(--accent-dim)" : h ? "var(--bg-hover)" : "transparent";
  const last = t.messages[t.messages.length - 1];
  const sender = t.messages[0].fromName;
  const dot = m.dot ? `var(${DOTS[m.dot]})` : "var(--accent-strong)";
  return (
    <div onClick={(e) => { if (e.metaKey || e.ctrlKey) { e.preventDefault(); onToggleCheck && onToggleCheck(); return; } onClick(); }} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 24px", background: bg, cursor: "pointer", fontSize: 14 }}>
      {checked
        ? <span style={{ width: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, lineHeight: 1, color: "var(--accent-strong)" }}>{"✓"}</span>
        : <span style={{ width: 7, height: 7, flexShrink: 0, borderRadius: 999, background: unread ? dot : "transparent" }} />}
      <div style={{ width: 180, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <span style={{ color: unread ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: unread ? 600 : 400 }}>{sender}</span>
        {t.messages.length > 1 && <span style={{ marginLeft: 6, fontSize: 12, color: "var(--text-muted)" }}>{t.messages.length}</span>}
      </div>
      <div style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}>
        {(m.labels || []).map((l) => <Label key={l.name} color={l.color}>{l.name}</Label>)}
        <span style={{ color: unread ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: unread ? 600 : 400, flexShrink: 0 }}>{t.subject}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-muted)" }}>{(last.body || "").replace(/\n+/g, " ").slice(0, 100)}</span>
      </div>
      {h ? (
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <IconBtn label="Mark done" hint="Mark Done" keys="e" place="bottom" onClick={onDone}>✓</IconBtn>
          <IconBtn label="Remind me" hint="Remind Me" keys="h" place="bottom">🕑</IconBtn>
        </div>
      ) : (
        <>
          {t.snooze && <span style={{ flexShrink: 0, fontSize: 11, padding: "1px 8px", borderRadius: 999, background: "var(--accent-dim)", color: "var(--accent-strong)", whiteSpace: "nowrap" }}>{t.snooze}</span>}
          {starred && <span style={{ flexShrink: 0, fontSize: 12, color: "var(--warning)" }}>★</span>}
          <span style={{ width: 56, flexShrink: 0, textAlign: "right", fontSize: 12, color: "var(--text-muted)" }}>{last.time}</span>
        </>
      )}
    </div>
  );
}

window.SM_UI = { Avatar, Kbd, KeyHint, HoverHint, Badge, Label, Button, IconBtn, Paperclip, AiClip, DOTS, TAGS, NavRail, FolderSidebar, Header, HintBar, MailList, BulkBar, RestState, SPLITS };
