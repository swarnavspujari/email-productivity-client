// The bottom action bar, shared by both composer shells. Matches Superhuman's
// layout: text actions on the left (Send · Send later), icon actions on the
// right (✦ AI · {} snippet · 📎 attach · 🗑 discard), with a send-key hint. The
// hidden file <input> that backs 📎 lives here so the whole attach flow is in
// one place.
import { backend } from "@/lib/ipc";
import { formatKeyExpr } from "@/lib/keyboard";
import { shortcutHint } from "@/lib/commands";
import { useUi } from "@/stores/ui";

export function ComposeActionBar({
  sending,
  error,
  fileRef,
  addFiles,
}: {
  sending: boolean;
  error: string | null;
  fileRef: React.RefObject<HTMLInputElement>;
  addFiles: (files: FileList | null) => void | Promise<void>;
}) {
  const aiBarOpen = useUi((s) => s.aiBarOpen);

  return (
    <div className="flex items-center gap-3 border-t border-line px-4 py-2.5">
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("fission:send"))}
        disabled={sending}
        className="rounded-md bg-accent px-4 py-1.5 text-[13px] font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
      >
        {sending ? "Sending…" : "Send"}
      </button>
      <button
        onClick={() => useUi.getState().openPicker("sendLater")}
        className="text-[12.5px] text-ink-2 hover:text-ink"
      >
        Send later
      </button>
      <div className="flex-1" />
      <button
        onClick={() => useUi.getState().setAiBarOpen(!aiBarOpen)}
        className={`rounded px-1.5 py-1 text-[13px] ${
          aiBarOpen ? "text-accent-strong" : "text-ink-3 hover:text-ink"
        }`}
        title={`Write with AI (${formatKeyExpr(shortcutHint("compose.ai"))})`}
      >
        ✦
      </button>
      <button
        onClick={() => useUi.getState().openPicker("snippet")}
        className="rounded px-1.5 py-1 text-[13px] text-ink-3 hover:text-ink"
        title="Insert snippet"
      >
        {"{ }"}
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        className="rounded px-1.5 py-1 text-[13px] text-ink-3 hover:text-ink"
        title="Attach files"
      >
        📎
      </button>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => {
          const c = useUi.getState().compose;
          if (c?.draftId != null) void backend.deleteDraft(c.draftId).catch(() => {});
          useUi.getState().closeCompose();
        }}
        className="rounded px-1.5 py-1 text-[13px] text-ink-3 hover:text-bad"
        title="Discard draft"
      >
        🗑
      </button>
      <span className="ml-1 text-[11px] text-ink-3">
        <span className="kbd">{formatKeyExpr(shortcutHint("compose.send"))}</span> send
      </span>
      {error && <span className="text-[12px] text-bad">{error}</span>}
    </div>
  );
}
