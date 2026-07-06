// Superhuman-style floating formatting bar: appears only when you select text
// in the reply body. Built on ProseMirror selection coords (no tippy / bubble
// extension) so it's self-contained and pixel-matches the design. Buttons keep
// the caret via onMouseDown-preventDefault. AI is intentionally omitted here —
// it lands in a later release.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";

const COLORS: { name: string; value: string | null }[] = [
  { name: "Default", value: null },
  { name: "Red", value: "#e5484d" },
  { name: "Orange", value: "#e5771e" },
  { name: "Green", value: "#30a46c" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Violet", value: "#7c7ff2" },
  { name: "Gray", value: "#8b8f9a" },
];

function BubBtn({
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

export function SelectionBubble({
  editor,
  onLink,
}: {
  editor: Editor;
  onLink: () => void;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const { state, view } = editor;
      const { from, to, empty } = state.selection;
      const keepingFocus =
        view.hasFocus() || !!barRef.current?.contains(document.activeElement);
      if (empty || !editor.isEditable || !keepingFocus) {
        setPos(null);
        setColorOpen(false);
        return;
      }
      try {
        const start = view.coordsAtPos(from);
        const end = view.coordsAtPos(to);
        setPos({
          left: (start.left + end.left) / 2,
          top: Math.min(start.top, end.top),
        });
      } catch {
        setPos(null);
      }
    };
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    editor.on("focus", update);
    editor.on("blur", update);
    const onScroll = () => update();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
      editor.off("focus", update);
      editor.off("blur", update);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [editor]);

  if (!pos) return null;
  const activeColor = (editor.getAttributes("textStyle").color as string) ?? null;

  return createPortal(
    <div
      ref={barRef}
      className="fm-bubble"
      style={{ left: pos.left, top: pos.top }}
      // never let a click in the bar bubble up to the reader/global handlers
      onMouseDown={(e) => e.stopPropagation()}
    >
      <BubBtn
        title="Bold (Ctrl+B)"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-bold">B</span>
      </BubBtn>
      <BubBtn
        title="Italic (Ctrl+I)"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </BubBtn>
      <BubBtn
        title="Underline (Ctrl+U)"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </BubBtn>
      <BubBtn
        title="Link (Ctrl+K)"
        active={editor.isActive("link")}
        onClick={onLink}
      >
        🔗
      </BubBtn>

      <div className="relative">
        <BubBtn
          title="Text color"
          active={colorOpen || !!activeColor}
          onClick={() => setColorOpen((o) => !o)}
        >
          <span
            className="h-3.5 w-3.5 rounded-full border border-line-strong"
            style={{ background: activeColor ?? "currentColor" }}
          />
        </BubBtn>
        {colorOpen && (
          <div className="fm-bubble-swatches">
            {COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                tabIndex={-1}
                title={c.name}
                aria-label={c.name}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const chain = editor.chain().focus();
                  if (c.value) chain.setColor(c.value).run();
                  else chain.unsetColor().run();
                  setColorOpen(false);
                }}
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-hover"
              >
                <span
                  className="h-4 w-4 rounded-full border border-line-strong"
                  style={{ background: c.value ?? "var(--text-primary)" }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="mx-0.5 h-4 w-px bg-line" />
      <BubBtn
        title="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <span className="text-[11px] leading-none">1.</span>
      </BubBtn>
      <BubBtn
        title="Bulleted list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •
      </BubBtn>
      <BubBtn
        title="Block quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <span className="leading-none">&#8220;</span>
      </BubBtn>
    </div>,
    document.body
  );
}
