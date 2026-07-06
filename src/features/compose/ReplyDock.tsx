// The inline reply composer, threaded into the conversation column at the same
// width as the email above it (ThreadView renders it inside the message column).
// The message is an editable TipTap surface; the signature + quoted history are
// rendered faithfully (QuoteFrame) behind a subtle ••• and appended on send —
// a schema editor can't render real email HTML without mangling it. Recipient
// rows collapse to a one-line summary; Ctrl+Shift+O/C/B/S reveal + focus a
// field, then Tab walks To→Cc→Bcc→Subject→body.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { backend } from "@/lib/ipc";
import { formatKeyExpr } from "@/lib/keyboard";
import { shortcutHint } from "@/lib/commands";
import { useSettings } from "@/stores/settings";
import { escapeHtml, useUi } from "@/stores/ui";
import { ComposeEditor } from "./ComposeEditor";
import { RecipientInput } from "./RecipientInput";
import { QuoteFrame } from "./QuoteFrame";
import { useComposeController } from "./useComposeController";

type Field = "to" | "cc" | "bcc" | "subject";

function fmtSize(bytes: number): string {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes > 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

/** "Name <email>" → the friendly name, else the bare address. */
function displayName(addr: string): string {
  const m = addr.match(/^(.*?)<(.+?)>$/);
  if (m) return m[1].trim().replace(/^["']|["']$/g, "") || m[2].trim();
  return addr.trim();
}

function summarize(raw: string): string {
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(displayName)
    .join(", ");
}

function paragraphsToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>") || "<br>"}</p>`)
    .join("");
}

/** Ctrl+J AI bar for the dock — drafts straight into the message (the signature
 *  and quote live outside the editor now, so there's nothing to preserve). */
function DockAiBar({ editor }: { editor: Editor }) {
  const [instruction, setInstruction] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const compose = useUi((s) => s.compose);
  const provider = useSettings((s) => s.settings.defaultAiProvider);
  const messageText = () =>
    new DOMParser().parseFromString(editor.getHTML(), "text/html").body.textContent?.trim() ??
    "";
  const hasBody = useMemo(() => messageText().length > 0, [editor]);

  useEffect(() => {
    inputRef.current?.focus();
    return () => cancelRef.current?.();
  }, []);

  const go = () => {
    if (!instruction.trim() || running) return;
    setError(null);
    setRunning(true);
    const existing = messageText();
    let received = "";
    cancelRef.current = backend.aiDraft(
      {
        threadId: compose?.threadId ?? null,
        instruction,
        existingText: existing.length > 0 ? existing : null,
        providerId: null,
      },
      {
        onChunk: (c) => {
          received += c;
          editor.commands.setContent(paragraphsToHtml(received), true);
        },
        onDone: () => {
          setRunning(false);
          setInstruction("");
          editor.commands.focus("end");
        },
        onError: (e) => {
          setError(e);
          setRunning(false);
        },
      }
    );
  };

  return (
    <div className="border-t border-line bg-raised px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[12px] font-medium text-accent-strong">
          ✦ Write with AI
        </span>
        <input
          ref={inputRef}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              go();
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              useUi.getState().setAiBarOpen(false);
            }
          }}
          placeholder={
            hasBody
              ? 'Edit instruction — e.g. "make it warmer", "tighten to 3 sentences"'
              : 'What should this say? e.g. "confirm the 15th works, ask about wiring"'
          }
          className="min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-3 focus:border-accent"
        />
        <button
          onClick={go}
          disabled={running}
          className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
        >
          {running ? "Drafting…" : "Draft"}
        </button>
      </div>
      <div className="mt-1 text-[11px] text-ink-3">
        Uses the full thread, attachments, and your Knowledge Base · provider:{" "}
        {provider}
        {error && <span className="ml-2 text-bad">{error}</span>}
      </div>
    </div>
  );
}

function FieldRow({
  field,
  label,
  children,
}: {
  field: Field;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-field={field}
      className="flex items-center gap-2 border-b border-line px-4 py-1.5"
    >
      <label className="w-12 shrink-0 text-[12px] text-ink-3">{label}</label>
      {children}
    </div>
  );
}

export function ReplyDock() {
  const compose = useUi((s) => s.compose)!;
  const aiBarOpen = useUi((s) => s.aiBarOpen);
  const { sending, error, fileRef, addFiles } = useComposeController();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLButtonElement>(null);

  const patch = (p: Partial<typeof compose>) =>
    useUi.setState((s) => ({ compose: s.compose ? { ...s.compose, ...p } : null }));

  const onBody = useCallback((body: string) => {
    useUi.setState((s) => ({ compose: s.compose ? { ...s.compose, body } : null }));
  }, []);

  const focusField = useCallback((field: Field) => {
    setExpanded(true);
    requestAnimationFrame(() => {
      rootRef.current
        ?.querySelector<HTMLInputElement>(`[data-field="${field}"] input`)
        ?.focus();
    });
  }, []);

  // Ctrl+Shift+O/C/B/S (from the keyboard engine) reveal + focus a field.
  useEffect(() => {
    const handler = (e: Event) => {
      const field = (e as CustomEvent).detail?.field as Field | undefined;
      if (field) focusField(field);
    };
    window.addEventListener("fission:compose-field", handler);
    return () => window.removeEventListener("fission:compose-field", handler);
  }, [focusField]);

  // Opening the reply smooth-scrolls the thread down so the dock is in view.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-thread-scroll]");
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  const summary = useMemo(() => {
    const to = summarize(compose.to);
    const cc = summarize(compose.cc);
    const bcc = summarize(compose.bcc);
    return (
      <>
        <span className="text-ink-3">To</span> {to || "…"}
        {cc && (
          <>
            {"  "}
            <span className="text-ink-3">Cc</span> {cc}
          </>
        )}
        {bcc && (
          <>
            {"  "}
            <span className="text-ink-3">Bcc</span> {bcc}
          </>
        )}
      </>
    );
  }, [compose.to, compose.cc, compose.bcc]);

  return (
    <div
      ref={rootRef}
      className="zb-fade-in mt-4 overflow-hidden rounded-[10px] border border-line-strong bg-raised"
    >
      {expanded ? (
        <>
          <FieldRow field="to" label="To">
            <RecipientInput value={compose.to} onChange={(to) => patch({ to })} />
          </FieldRow>
          <FieldRow field="cc" label="Cc">
            <RecipientInput value={compose.cc} onChange={(cc) => patch({ cc })} />
          </FieldRow>
          <FieldRow field="bcc" label="Bcc">
            <RecipientInput value={compose.bcc} onChange={(bcc) => patch({ bcc })} />
          </FieldRow>
          <FieldRow field="subject" label="Subject">
            <input
              value={compose.subject}
              onChange={(e) => patch({ subject: e.target.value })}
              className="flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
              placeholder="Subject"
            />
          </FieldRow>
        </>
      ) : (
        <button
          onClick={() => focusField("to")}
          title="Edit recipients — Ctrl+Shift+O To · C Cc · B Bcc · S Subject"
          className="flex w-full items-center gap-1 border-b border-line px-4 py-2 text-left text-[12.5px] text-ink-2 hover:bg-hover"
        >
          {summary}
        </button>
      )}

      <ComposeEditor
        mode={compose.mode}
        variant="dock"
        initialContent={compose.body}
        placeholder="Tip: Hit Ctrl+J for AI"
        onChange={onBody}
        onReady={setEditor}
        onArrowDownAtEnd={() => dotsRef.current?.focus()}
      />

      {/* Signature + quoted history — rendered faithfully, tucked behind a
          subtle ••• (↓ from the message focuses it; Enter/click reveals it). */}
      {compose.quote.trim() && (
        <div className="px-4 pb-1">
          {showQuote ? (
            <QuoteFrame html={compose.quote} />
          ) : (
            <button
              ref={dotsRef}
              onClick={() => setShowQuote(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setShowQuote(true);
                }
              }}
              title="Show signature & quoted history"
              aria-label="Show signature and quoted history"
              className="fm-dots"
            >
              ···
            </button>
          )}
        </div>
      )}

      {compose.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-2">
          {compose.attachments.map((a, i) => (
            <span
              key={`${a.filename}-${i}`}
              className="flex items-center gap-1.5 rounded-md border border-line-strong bg-surface py-1 pl-2.5 pr-1 text-[12px] text-ink-2"
            >
              📎 {a.filename}
              <span className="text-ink-3">
                {fmtSize(Math.round(a.dataBase64.length * 0.75))}
              </span>
              <button
                onClick={() =>
                  patch({ attachments: compose.attachments.filter((_, j) => j !== i) })
                }
                className="rounded px-1 text-ink-3 hover:bg-hover hover:text-ink"
                title="Remove attachment"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {aiBarOpen && editor && <DockAiBar editor={editor} />}

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
    </div>
  );
}
