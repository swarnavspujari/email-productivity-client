// The rich-text (WYSIWYG) compose body — TipTap/ProseMirror, headless and
// styled entirely off the design tokens (see theme.css `.fm-editor`). Replaces
// the old textarea+backdrop SpellCheck: bold/italic/underline, bullet + ordered
// lists, and links, with Harper underlines rendered as ProseMirror decorations
// that survive edits. Keyboard-first (Ctrl+B/I/U, Ctrl+K for link); the toolbar
// is a mouse convenience and stays out of the To→Cc→Subject→body tab order.
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Selection } from "@tiptap/pm/state";
import { backend } from "@/lib/ipc";
import { sanitizeUserHtml } from "@/lib/sanitize";
import { escapeHtml, type ComposeMode } from "@/stores/ui";
import {
  activeHarperFinding,
  dismissHarperFinding,
  Harper,
  type HarperFinding,
} from "./harper";
import { SelectionBubble } from "./SelectionBubble";

/** How the editor is hosted. Both composers format via the floating selection
 *  bubble (Superhuman-style, no persistent toolbar); `variant` only controls
 *  sizing — the "modal" new-message editor flexes to fill its card and scrolls,
 *  the inline "dock" reply editor auto-grows and hands ↓-at-end off to the •••
 *  that reveals the signature + quoted-history trailer. */
export type ComposeVariant = "modal" | "dock";

/** Seed content for the editor. Rich HTML passes through; a legacy plain-text
 *  draft body (saved before the WYSIWYG editor) is converted to paragraphs so
 *  its line breaks survive the round-trip. */
function toEditorHtml(content: string): string {
  if (!content) return "";
  if (/<\w+[^>]*>/.test(content)) return content;
  return content
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>") || "<br>"}</p>`)
    .join("");
}

/** Add a scheme to a bare link target so `example.com` becomes a real URL. */
function normalizeUrl(v: string): string {
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (v.startsWith("/") || v.startsWith("#")) return v;
  return `https://${v}`;
}

/** Inline link editor (Ctrl+K or the selection-bubble 🔗). Enter applies, empty removes,
 *  Esc closes without touching compose. */
function LinkBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [url, setUrl] = useState<string>(
    () => (editor.getAttributes("link").href as string) ?? ""
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const apply = () => {
    const v = url.trim();
    if (!v) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onClose();
      return;
    }
    const href = normalizeUrl(v);
    const { from, to } = editor.state.selection;
    if (from === to) {
      if (editor.isActive("link")) {
        editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      } else {
        editor
          .chain()
          .focus()
          .insertContent({ type: "text", text: v, marks: [{ type: "link", attrs: { href } }] })
          .run();
      }
    } else {
      editor.chain().focus().setLink({ href }).run();
    }
    onClose();
  };

  return (
    <div className="zb-fade-in flex items-center gap-2 border-t border-line bg-raised px-4 py-1.5 text-[12.5px]">
      <span className="shrink-0 text-ink-3">Link</span>
      <input
        ref={inputRef}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          } else if (e.key === "Escape") {
            // Close the link bar only — don't bubble to the compose closer.
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
        placeholder="https://example.com  ·  empty removes the link"
        className="min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2.5 py-1 text-ink outline-none placeholder:text-ink-3 focus:border-accent"
      />
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={apply}
        className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-on-accent hover:bg-accent-strong"
      >
        Apply
      </button>
    </div>
  );
}

/** Harper suggestion bar for the finding under the caret. */
function SuggestionBar({
  editor,
  finding,
}: {
  editor: Editor;
  finding: HarperFinding;
}) {
  const applyFix = (replacement: string) => {
    if (!replacement) {
      editor.chain().focus().deleteRange({ from: finding.from, to: finding.to }).run();
    } else {
      editor
        .chain()
        .focus()
        .insertContentAt({ from: finding.from, to: finding.to }, replacement)
        .run();
    }
  };

  return (
    <div className="zb-fade-in flex items-center gap-2 border-t border-line bg-raised px-4 py-1.5 text-[12.5px]">
      <span className="min-w-0 truncate text-ink-3">{finding.message}</span>
      <div className="flex-1" />
      {finding.suggestions.slice(0, 3).map((s, i) => (
        <button
          key={i}
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyFix(s)}
          className="rounded-full border border-accent/40 bg-accent-dim px-2.5 py-0.5 text-ink hover:border-accent"
        >
          {s === "" ? "Remove" : s}
        </button>
      ))}
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          dismissHarperFinding(editor.view, finding);
          editor.chain().focus().run();
        }}
        className="rounded px-1.5 py-0.5 text-ink-3 hover:bg-hover hover:text-ink"
        title="Ignore"
      >
        ×
      </button>
    </div>
  );
}

export function ComposeEditor({
  mode,
  variant,
  initialContent,
  placeholder,
  onChange,
  onReady,
  onArrowDownAtEnd,
}: {
  mode: ComposeMode;
  variant: ComposeVariant;
  initialContent: string;
  placeholder: string;
  onChange: (html: string) => void;
  onReady: (editor: Editor) => void;
  /** Dock only: ArrowDown at the end of the message (used to focus the •••). */
  onArrowDownAtEnd?: () => void;
}) {
  // TipTap is uncontrolled: seed the body once, then sync OUT via onUpdate.
  const initialRef = useRef(toEditorHtml(initialContent));
  const [linkOpen, setLinkOpen] = useState(false);
  const isDock = variant === "dock";

  const editor = useEditor({
    // Avoids React 18 StrictMode's flushSync-in-render warning; the editor
    // mounts a tick later, which onReady handles.
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer nofollow" },
      }),
      // Signatures (and pasted content) can carry inline data: URI images —
      // keep them in the schema so they survive editing. No toolbar insert yet.
      Image.configure({ allowBase64: true }),
      Placeholder.configure({ placeholder }),
      Harper.configure({ lint: (t) => backend.lintText(t), debounceMs: 350 }),
      // Text color for the selection bubble (both composers).
      TextStyle,
      Color,
    ],
    content: initialRef.current,
    // Replies/forwards land the caret at the top, above the signature; new mail
    // focuses To (the RecipientInput), so the editor doesn't grab focus.
    autofocus: mode === "new" ? false : "start",
    editorProps: {
      attributes: { class: "fm-editor", "aria-label": "Message body" },
      // Accept rich paste, but strip anything active before ProseMirror parses.
      transformPastedHTML: (html) => sanitizeUserHtml(html),
      handleKeyDown: (view, event) => {
        // Dock: ↓ at the very end of the message hands off to the ••• (which
        // reveals the signature + quoted history) instead of doing nothing.
        if (
          isDock &&
          onArrowDownAtEnd &&
          event.key === "ArrowDown" &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.altKey &&
          view.state.selection.empty &&
          view.state.selection.$head.pos === Selection.atEnd(view.state.doc).from
        ) {
          event.preventDefault();
          onArrowDownAtEnd();
          return true;
        }
        const mod = event.ctrlKey || event.metaKey;
        if (!mod) return false;
        // Ctrl/Cmd+Enter (and +Shift) must send, not insert a hard break: block
        // ProseMirror's HardBreak keymap but let the event bubble to the global
        // engine.
        if (event.key === "Enter") return true;
        // Ctrl/Cmd+K edits a link. Stop it from reaching the global palette.
        if (event.key.toLowerCase() === "k") {
          event.preventDefault();
          event.stopPropagation();
          setLinkOpen(true);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor) onReady(editor);
  }, [editor, onReady]);

  const closeLink = useCallback(() => {
    setLinkOpen(false);
    editor?.chain().focus().run();
  }, [editor]);

  const finding = editor ? activeHarperFinding(editor.state) : null;

  return (
    <>
      <div
        className={
          isDock
            ? "relative min-h-[84px]"
            : "relative min-h-0 flex-1 overflow-y-auto"
        }
      >
        <EditorContent editor={editor} />
      </div>

      {editor && (
        <SelectionBubble editor={editor} onLink={() => setLinkOpen(true)} />
      )}

      {editor &&
        (linkOpen ? (
          <LinkBar editor={editor} onClose={closeLink} />
        ) : finding ? (
          <SuggestionBar editor={editor} finding={finding} />
        ) : null)}
    </>
  );
}
