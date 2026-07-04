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
import { backend } from "@/lib/ipc";
import { sanitizeUserHtml } from "@/lib/sanitize";
import { escapeHtml, type ComposeMode } from "@/stores/ui";
import {
  activeHarperFinding,
  dismissHarperFinding,
  Harper,
  type HarperFinding,
} from "./harper";

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

/** A compact formatting toolbar button. tabIndex=-1 keeps Tab on To→…→body;
 *  onMouseDown-preventDefault stops the click from stealing the caret. */
function TbBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-[13px] ${
        active
          ? "bg-accent-dim text-accent-strong"
          : "text-ink-2 hover:bg-hover hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** Inline link editor (Ctrl+K or the toolbar 🔗). Enter applies, empty removes,
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
  initialContent,
  placeholder,
  onChange,
  onReady,
}: {
  mode: ComposeMode;
  initialContent: string;
  placeholder: string;
  onChange: (html: string) => void;
  onReady: (editor: Editor) => void;
}) {
  // TipTap is uncontrolled: seed the body once, then sync OUT via onUpdate.
  const initialRef = useRef(toEditorHtml(initialContent));
  const [linkOpen, setLinkOpen] = useState(false);

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
    ],
    content: initialRef.current,
    // Replies/forwards land the caret at the top, above the signature; new mail
    // focuses To (the RecipientInput), so the editor doesn't grab focus.
    autofocus: mode === "new" ? false : "start",
    editorProps: {
      attributes: { class: "fm-editor", "aria-label": "Message body" },
      // Accept rich paste, but strip anything active before ProseMirror parses.
      transformPastedHTML: (html) => sanitizeUserHtml(html),
      handleKeyDown: (_view, event) => {
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
      <div className="flex items-center gap-0.5 border-b border-line px-3 py-1">
        {editor && (
          <>
            <TbBtn
              title="Bold (Ctrl+B)"
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <span className="font-bold">B</span>
            </TbBtn>
            <TbBtn
              title="Italic (Ctrl+I)"
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <span className="italic">I</span>
            </TbBtn>
            <TbBtn
              title="Underline (Ctrl+U)"
              active={editor.isActive("underline")}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <span className="underline">U</span>
            </TbBtn>
            <span className="mx-1 h-4 w-px bg-line" />
            <TbBtn
              title="Bullet list"
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              •
            </TbBtn>
            <TbBtn
              title="Numbered list"
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              1.
            </TbBtn>
            <span className="mx-1 h-4 w-px bg-line" />
            <TbBtn
              title="Link (Ctrl+K)"
              active={editor.isActive("link")}
              onClick={() => setLinkOpen(true)}
            >
              🔗
            </TbBtn>
          </>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {editor &&
        (linkOpen ? (
          <LinkBar editor={editor} onClose={closeLink} />
        ) : finding ? (
          <SuggestionBar editor={editor} finding={finding} />
        ) : null)}
    </>
  );
}
