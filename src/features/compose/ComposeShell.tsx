// The shared inner body of both composers — recipients → editor → quoted
// history → attachments → AI bar → action bar — parameterized by `variant`.
// The two shells (Compose.tsx modal, ReplyDock.tsx inline) wrap this in their
// own chrome. Exactly one is ever mounted (ui.compose is singular), so the lone
// useComposeController here (send/autosave/attach) runs once.
//
//   modal (new message): fills the card (flex column, editor flexes/scrolls);
//     signature is seeded inside the body; no quoted history.
//   dock (reply/forward): grows inline; signature + quoted history render behind
//     the ••• in a sandboxed, editable QuoteFrame.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useUi } from "@/stores/ui";
import { ComposeEditor } from "./ComposeEditor";
import { RecipientFields } from "./RecipientFields";
import { AttachmentChips } from "./AttachmentChips";
import { ComposeAiBar } from "./ComposeAiBar";
import { ComposeActionBar } from "./ComposeActionBar";
import { QuoteFrame } from "./QuoteFrame";
import { useComposeController } from "./useComposeController";

export function ComposeShell({ variant }: { variant: "modal" | "dock" }) {
  const compose = useUi((s) => s.compose)!;
  const aiBarOpen = useUi((s) => s.aiBarOpen);
  const { sending, error, fileRef, addFiles } = useComposeController();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [showQuote, setShowQuote] = useState(false);
  const dotsRef = useRef<HTMLButtonElement>(null);

  const patch = (p: Partial<typeof compose>) =>
    useUi.setState((s) => ({ compose: s.compose ? { ...s.compose, ...p } : null }));

  const onBody = useCallback((body: string) => {
    useUi.setState((s) => ({ compose: s.compose ? { ...s.compose, body } : null }));
  }, []);

  // Insert rich HTML (Drive link chips) at the caret. An event, not store
  // state: the editor is uncontrolled after seeding, so writing to
  // compose.body would never reach it — only the live instance can insert.
  useEffect(() => {
    if (!editor) return;
    const handler = (e: Event) => {
      const html = (e as CustomEvent).detail?.html as string | undefined;
      if (!html) return;
      // Trailing space exits the link mark so typing after a chip is plain.
      editor.chain().focus().insertContent(`${html} `).run();
    };
    window.addEventListener("fission:insert-html", handler);
    return () => window.removeEventListener("fission:insert-html", handler);
  }, [editor]);

  const isDock = variant === "dock";
  const hasQuote = compose.quote.trim().length > 0;

  return (
    <div className={isDock ? "" : "flex min-h-0 flex-1 flex-col"}>
      <RecipientFields variant={variant} />

      <ComposeEditor
        mode={compose.mode}
        variant={variant}
        initialContent={compose.body}
        placeholder={
          isDock ? "Tip: Hit Ctrl+J for AI" : "Write, or press Ctrl+J to draft with AI…"
        }
        onChange={onBody}
        onReady={setEditor}
        onArrowDownAtEnd={
          isDock && hasQuote ? () => dotsRef.current?.focus() : undefined
        }
      />

      {/* Signature + quoted history — rendered faithfully AND editable in a
          sandboxed frame, tucked behind a subtle ••• (↓ from the message
          focuses it; Enter/click toggles it). Reply/forward only. */}
      {hasQuote && (
        <div className="px-4 pb-1">
          <button
            ref={dotsRef}
            onClick={() => setShowQuote((s) => !s)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowQuote((s) => !s);
              }
            }}
            title={
              showQuote
                ? "Hide signature & quoted history"
                : "Show signature & quoted history (editable)"
            }
            aria-label="Toggle signature and quoted history"
            aria-expanded={showQuote}
            className="fm-dots"
          >
            ···
          </button>
          {showQuote && (
            <QuoteFrame
              html={compose.quote}
              editable
              onChange={(q) => patch({ quote: q })}
              onEscape={() => {
                setShowQuote(false);
                editor?.commands.focus("end");
              }}
            />
          )}
        </div>
      )}

      <AttachmentChips />

      {aiBarOpen && editor && (
        <ComposeAiBar editor={editor} preserveSignature={!isDock} />
      )}

      <ComposeActionBar
        sending={sending}
        error={error}
        fileRef={fileRef}
        addFiles={addFiles}
      />
    </div>
  );
}
