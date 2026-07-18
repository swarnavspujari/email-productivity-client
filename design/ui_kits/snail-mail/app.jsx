/* global React, ReactDOM */
const { useState, useEffect, useCallback } = React;
const { threads: THREADS } = window.SM_DATA;
const { NavRail, FolderSidebar, Header, HintBar, MailList, RestState } = window.SM_UI;
const { ThreadView, Compose, CommandPalette, SearchView, UndoToast } = window.SM_PANELS;
const { CalendarView } = window.SM_CALENDAR;

const HINTS = {
  list: [{ keys: ["E"], label: "Mark Done" }, { keys: ["H"], label: "to set a reminder" }, { keys: ["C"], label: "to compose" }, { keys: ["/"], label: "to search" }, { keys: ["⌘", "K"], label: "for Shell Command" }],
  thread: [{ keys: ["E"], label: "Mark Done" }, { keys: ["H"], label: "to set a reminder" }, { keys: ["↵"], label: "to reply all" }, { keys: ["⌘", "K"], label: "for Shell Command" }],
  calendar: [{ keys: ["="], label: "next week" }, { keys: ["-"], label: "previous week" }, { keys: ["T"], label: "for today" }, { keys: ["B"], label: "to create an event" }],
};

function App() {
  const [theme, setTheme] = useState("light");
  const [view, setView] = useState("calendar"); // mail | calendar | search
  const [folder, setFolder] = useState("inbox");
  const [sidebar, setSidebar] = useState(false);
  const [activeSplit, setActiveSplit] = useState("important");
  const [openId, setOpenId] = useState(null);
  const [selectedId, setSelectedId] = useState("t-term-sheet");
  const [compose, setCompose] = useState(null);
  const [palette, setPalette] = useState(false);
  const [undo, setUndo] = useState(null);
  const [states, setStates] = useState({});
  const [threads, setThreads] = useState(THREADS);
  const [checkedIds, setCheckedIds] = useState(() => new Set());

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const flashUndo = useCallback((m) => { setUndo(m); }, []);
  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 6000); return () => clearTimeout(t); }, [undo]);

  const openThread = (id) => { setOpenId(id); setStates((s) => ({ ...s, [id]: { ...s[id], unread: false } })); };
  const doneThread = (id) => { setThreads((ts) => ts.filter((t) => t.id !== id)); setOpenId(null); flashUndo("Marked as Done."); };

  // Multi-select bulk triage (design system mail/BulkBar): X toggles the cursor
  // row, Ctrl/⌘+click toggles any row; the bar's actions triage the whole set
  // and push ONE counted undo.
  const toggleCheck = (id) => setCheckedIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearChecked = () => setCheckedIds(new Set());
  const bulkDone = () => { const ids = checkedIds; const n = ids.size; if (!n) return; setThreads((ts) => ts.filter((t) => !ids.has(t.id))); setCheckedIds(new Set()); flashUndo(n > 1 ? `Marked Done (${n}).` : "Marked as Done."); };
  const bulkTrash = () => { const ids = checkedIds; const n = ids.size; if (!n) return; setThreads((ts) => ts.filter((t) => !ids.has(t.id))); setCheckedIds(new Set()); flashUndo(n > 1 ? `Moved ${n} to trash — undo?` : "Moved to trash — undo?"); };
  const bulkLabel = () => { const n = checkedIds.size; if (!n) return; setCheckedIds(new Set()); flashUndo(n > 1 ? `Labeled ${n} conversations.` : "Labeled."); };

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test((e.target || {}).tagName || "");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); return; }
      if (compose || palette) { if (e.key === "Escape") { setCompose(null); setPalette(false); } return; }
      if (e.key === "Escape") { if (view === "search") { setView("mail"); return; } if (!openId && checkedIds.size > 0) { setCheckedIds(new Set()); return; } if (openId) { setOpenId(null); return; } }
      if (typing) return;
      const k = e.key;
      if (k === "c" || k === "C") { e.preventDefault(); setCompose({ mode: "New message" }); }
      else if (k === "/") { e.preventDefault(); setView("search"); }
      else if (k === "Tab" && view === "mail" && !openId) { e.preventDefault(); setActiveSplit((s) => s === "important" ? "other" : "important"); setCheckedIds(new Set()); }
      else if ((k === "x" || k === "X") && view === "mail" && !openId) { e.preventDefault(); toggleCheck(selectedId); }
      else if ((k === "e" || k === "E") && !openId && checkedIds.size > 0) { e.preventDefault(); bulkDone(); }
      else if ((k === "e" || k === "E") && openId) doneThread(openId);
      else if ((k === "r" || k === "R") && openId) { const t = threads.find((x) => x.id === openId); setCompose({ mode: "Reply", to: t.messages[0].from, subject: "Re: " + t.subject }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compose, palette, openId, threads, view, checkedIds, selectedId]);

  const openThreadObj = openId ? threads.find((t) => t.id === openId) : null;
  const hintKey = view === "calendar" ? "calendar" : openThreadObj ? "thread" : "list";
  const importantCount = threads.filter((t) => t.split === "important").length;

  const zero = view === "mail" && !openThreadObj && threads.filter((t) => t.split === activeSplit).length === 0;
  let main;
  if (view === "search") main = <SearchView onClose={() => setView("mail")} />;
  else if (view === "calendar") main = <CalendarView />;
  else if (openThreadObj) main = <ThreadView thread={openThreadObj} onBack={() => setOpenId(null)} />;
  else main = <MailList {...{ threads, activeSplit, setActiveSplit, selectedId, states }} restOwned={zero} checked={checkedIds} onToggleCheck={toggleCheck} onSelect={setSelectedId} onOpen={openThread} onDone={doneThread} onBulkDone={bulkDone} onBulkTrash={bulkTrash} onBulkLabel={bulkLabel} onBulkClear={clearChecked} />;

  return (
    <div style={{ position: "relative", display: "flex", height: "100%", flexDirection: "column", background: "var(--bg-base)" }}>
      {zero && <RestState streak={12} full />}
      {zero && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 150, background: "linear-gradient(to bottom, rgba(10,16,28,0.62), rgba(10,16,28,0.34) 55%, transparent)", pointerEvents: "none", zIndex: 1 }} />}
      <Header overlay={zero} theme={theme} setTheme={setTheme} onMenu={() => setSidebar((s) => !s)} onSearch={() => setView("search")} onCompose={() => setCompose({ mode: "New message" })} />
      <div style={{ position: "relative", display: "flex", minHeight: 0, flex: 1 }}>
        <NavRail overlay={zero} view={view} setView={(v) => { setView(v); setOpenId(null); }} />
        <FolderSidebar open={sidebar} active={folder} onSelect={(f) => { setFolder(f); setSidebar(false); setView("mail"); setOpenId(null); setCheckedIds(new Set()); }} count={importantCount} />
        <main style={{ position: "relative", minWidth: 0, flex: 1, display: "flex", background: zero ? "transparent" : "var(--bg-base)" }}>
          <div style={{ position: "relative", minWidth: 0, flex: 1, display: "flex" }}>{main}</div>
          {compose && <Compose initial={compose} onClose={() => setCompose(null)} onSend={() => { setCompose(null); flashUndo("Sent — undo?"); }} />}
          {palette && <CommandPalette onClose={() => setPalette(false)} onRun={(c) => {
            setPalette(false);
            if (c.t === "Compose") setCompose({ mode: "New message" });
            else if (c.t === "Search") setView("search");
            else if (c.t === "Set Theme: Dark") setTheme("dark");
            else if (c.t === "Set Theme: Light") setTheme("light");
            else if (c.t === "Mark Done" && openId) doneThread(openId);
            else flashUndo(c.t + ".");
          }} />}
          {undo && <UndoToast message={undo} onUndo={() => { setThreads(THREADS); setUndo(null); }} onDismiss={() => setUndo(null)} />}
        </main>
      </div>
      <HintBar overlay={zero} hints={HINTS[hintKey]} />
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
