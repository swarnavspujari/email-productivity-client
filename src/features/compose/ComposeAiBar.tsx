// Ctrl+J "Write with AI" instruction bar, shared by both composer shells. It
// streams an AI draft straight into the editor: a fresh draft replaces the
// (empty) message, an edit rewrites it in place.
//
// The one difference between the shells is the signature. The new-message modal
// seeds the signature INSIDE the editable body, so `preserveSignature` keeps it
// out of the draft prompt and re-appends it after streaming. The reply dock
// keeps its signature outside the editor (behind the •••), so there's nothing to
// preserve and the draft flows straight in.
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { backend } from "@/lib/ipc";
import { useSettings } from "@/stores/settings";
import {
  escapeHtml,
  signatureHtml,
  splitBodySignature,
  useUi,
} from "@/stores/ui";

/** Plain streamed AI text → simple paragraph HTML for the editor. */
function paragraphsToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>") || "<br>"}</p>`)
    .join("");
}

export function ComposeAiBar({
  editor,
  preserveSignature,
}: {
  editor: Editor;
  /** Modal only: keep the seeded signature and draft from the message alone. */
  preserveSignature: boolean;
}) {
  const [instruction, setInstruction] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const compose = useUi((s) => s.compose);
  const provider = useSettings((s) => s.settings.defaultAiProvider);

  // The user's message, with the seeded signature stripped when it lives inside
  // the body (modal). "Has the user written anything?" drives draft-vs-edit.
  const messageText = (): string => {
    if (preserveSignature) return splitBodySignature(editor.getHTML()).message;
    return (
      new DOMParser().parseFromString(editor.getHTML(), "text/html").body
        .textContent?.trim() ?? ""
    );
  };
  // Plain per-render read (the component re-renders on every keystroke via the
  // compose subscription); memoizing on the stable `editor` identity would
  // freeze the draft-vs-edit placeholder at its mount value.
  const hasBody = messageText().length > 0;

  useEffect(() => {
    inputRef.current?.focus();
    return () => cancelRef.current?.();
  }, []);

  const go = () => {
    if (!instruction.trim() || running) return;
    setError(null);
    setRunning(true);
    const message = messageText();
    const isEdit = message.length > 0;
    // Modal: re-append the signature the user hasn't removed, instead of
    // overwriting the whole body with the AI draft.
    let sigSuffix = "";
    if (preserveSignature) {
      const sig = signatureHtml();
      const { hasSignature } = splitBodySignature(editor.getHTML());
      sigSuffix = hasSignature && sig ? `<p></p>${sig}` : "";
    }
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
