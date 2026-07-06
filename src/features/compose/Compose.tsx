import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { backend } from "@/lib/ipc";
import { formatKeyExpr } from "@/lib/keyboard";
import { shortcutHint } from "@/lib/commands";
import { useSettings } from "@/stores/settings";
import {
  escapeHtml,
  signatureHtml,
  splitBodySignature,
  useUi,
} from "@/stores/ui";
import { ComposeEditor } from "./ComposeEditor";
import { RecipientInput } from "./RecipientInput";
import { useComposeController } from "./useComposeController";

function fmtSize(bytes: number): string {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes > 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

/** Plain streamed AI text → simple paragraph HTML for the editor. */
function paragraphsToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>") || "<br>"}</p>`)
    .join("");
}

/** The Ctrl+J "Write with AI" instruction bar. Streams into the editor: a
 *  fresh draft replaces the (empty) body, an edit rewrites it in place. */
function AiBar({ editor }: { editor: Editor }) {
  const [instruction, setInstruction] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const compose = useUi((s) => s.compose);
  const provider = useSettings((s) => s.settings.defaultAiProvider);
  // "Has the user written a message?" — the seeded signature doesn't count, so a
  // fresh compose with a signature still drafts from the prompt (not an edit).
  const hasBody = useMemo(
    () => splitBodySignature(editor.getHTML()).message.length > 0,
    [editor]
  );

  useEffect(() => {
    inputRef.current?.focus();
    return () => cancelRef.current?.();
  }, []);

  const go = () => {
    if (!instruction.trim() || running) return;
    setError(null);
    setRunning(true);
    // Draft from the user's MESSAGE only (never the signature), and keep the
    // signature the user hasn't removed instead of overwriting the whole body.
    const sig = signatureHtml();
    const { message, hasSignature } = splitBodySignature(editor.getHTML());
    const isEdit = message.length > 0;
    const sigSuffix = hasSignature && sig ? `<p></p>${sig}` : "";
    let received = "";
    cancelRef.current = backend.aiDraft(
      {
        threadId: compose?.threadId ?? null,
        instruction,
        existingText: isEdit ? message : null,
        providerId: null, // default provider; per-request override lives in Settings
      },
      {
        onChunk: (c) => {
          received += c;
          // emitUpdate=true so send + autosave see the streamed draft.
          editor.commands.setContent(paragraphsToHtml(received) + sigSuffix, true);
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
              // Close the AI bar only — don't bubble to the compose closer.
              e.preventDefault();
              e.stopPropagation();
              useUi.getState().setAiBarOpen(false);
            }
          }}
          placeholder={
            hasBody
              ? 'Edit instruction — e.g. "make it warmer", "tighten to 3 sentences"'
              : 'What should this say? e.g. "confirm the 15th works, ask about wiring details"'
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

export function Compose() {
  const compose = useUi((s) => s.compose)!;
  const aiBarOpen = useUi((s) => s.aiBarOpen);
  const [showQuote, setShowQuote] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const { sending, error, fileRef, addFiles } = useComposeController();

  const patch = (p: Partial<typeof compose>) =>
    useUi.setState((s) => ({ compose: s.compose ? { ...s.compose, ...p } : null }));

  // Sync the editor's HTML into the store. Stable so it never churns the editor.
  // (New mail focuses To; replies/forwards focus the body top — both handled by
  // RecipientInput autoFocus and ComposeEditor's autofocus, so no effect here.)
  const onBody = useCallback((body: string) => {
    useUi.setState((s) => ({ compose: s.compose ? { ...s.compose, body } : null }));
  }, []);

  const modeLabel =
    compose.mode === "new"
      ? "New message"
      : compose.mode === "reply"
        ? "Reply"
        : compose.mode === "replyAll"
          ? "Reply all"
          : "Forward";

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
      <div className="zb-pop-in flex h-[80%] w-[760px] max-w-[94vw] flex-col rounded-xl border border-line-strong bg-overlay shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="text-[13px] font-medium text-ink">{modeLabel}</span>
          <div className="flex-1" />
          <span className="text-[11px] text-ink-3">
            <span className="kbd">{formatKeyExpr(shortcutHint("compose.ai"))}</span>{" "}
            write with AI ·{" "}
            <span className="kbd">{formatKeyExpr(shortcutHint("compose.send"))}</span>{" "}
            send · <span className="kbd">Esc</span> saves draft
          </span>
        </div>

        <div className="flex items-center gap-2 border-b border-line px-4 py-2">
          <label className="w-16 text-[12px] text-ink-3">To</label>
          <RecipientInput
            value={compose.to}
            onChange={(to) => patch({ to })}
            placeholder="Start typing a name or email…"
            autoFocus={compose.mode === "new"}
          />
        </div>
        <div className="flex items-center gap-2 border-b border-line px-4 py-2">
          <label className="w-16 text-[12px] text-ink-3">Cc</label>
          <RecipientInput value={compose.cc} onChange={(cc) => patch({ cc })} />
        </div>
        <div className="flex items-center gap-2 border-b border-line px-4 py-2">
          <label className="w-16 text-[12px] text-ink-3">Subject</label>
          <input
            value={compose.subject}
            onChange={(e) => patch({ subject: e.target.value })}
            className="flex-1 bg-transparent text-[13px] font-medium text-ink outline-none placeholder:font-normal"
            placeholder="What is this email about?"
          />
        </div>

        <ComposeEditor
          mode={compose.mode}
          variant="modal"
          initialContent={compose.body}
          placeholder="Write, or press Ctrl+J to draft with AI…"
          onChange={onBody}
          onReady={setEditor}
        />

        {compose.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-line px-4 py-2">
            {compose.attachments.map((a, i) => (
              <span
                key={`${a.filename}-${i}`}
                className="flex items-center gap-1.5 rounded-md border border-line-strong bg-raised py-1 pl-2.5 pr-1 text-[12px] text-ink-2"
              >
                📎 {a.filename}
                <span className="text-ink-3">
                  {fmtSize(Math.round(a.dataBase64.length * 0.75))}
                </span>
                <button
                  onClick={() =>
                    patch({
                      attachments: compose.attachments.filter((_, j) => j !== i),
                    })
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

        {/* Thread history — collapsed behind ••• like Gmail's trimmed content;
            only present for replies/forwards (a new email has no thread). */}
        {compose.quote && (
          <div className="border-t border-line px-4 py-2">
            {showQuote ? (
              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-line bg-surface px-3 py-2 text-[12px] leading-relaxed text-ink-3">
                {compose.quote}
              </div>
            ) : (
              <button
                onClick={() => setShowQuote(true)}
                title="Show trimmed thread history"
                className="rounded-full border border-line-strong px-2 leading-4 text-ink-3 hover:bg-hover hover:text-ink"
              >
                •••
              </button>
            )}
          </div>
        )}

        {aiBarOpen && editor && <AiBar editor={editor} />}

        <div className="flex items-center gap-3 border-t border-line px-4 py-3">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("fission:send"))}
            disabled={sending}
            className="rounded-md bg-accent px-4 py-1.5 text-[13px] font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-md px-3 py-1.5 text-[13px] text-ink-2 hover:bg-hover"
            title="Attach files"
          >
            📎 Attach
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
            className="rounded-md px-3 py-1.5 text-[13px] text-ink-2 hover:bg-hover"
            title="Delete the draft and close (Esc keeps it)"
          >
            Discard
          </button>
          {error && <span className="text-[12px] text-bad">{error}</span>}
        </div>
      </div>
    </div>
  );
}
