// The reply "trailer": one editable-but-collapsible region holding the
// signature + quoted thread history below your message. Superhuman/Gmail
// behavior — hitting reply drops the caret in an empty message with the
// signature and the original thread tucked behind a ••• toggle. Expand it
// (↓ then Enter, or click) and every part is fully editable, and it all sends.
//
// It's a normal ProseMirror block node, so getHTML() serializes it (marker div
// included, so a resumed draft re-collapses correctly), and edit/undo/paste all
// just work. Collapse is a pure display concern (the content stays in the doc),
// which is why an empty reply still sends the signature + quote.
import { Node, mergeAttributes } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";

export const ReplyTrailer = Node.create({
  name: "replyTrailer",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  selectable: false,

  addAttributes() {
    return {
      // Collapse state is UI-only — never leak it into the sent HTML.
      collapsed: { default: true, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-fm-trailer]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-fm-trailer": "" }), 0];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "fm-trailer";
      dom.dataset.collapsed = String(node.attrs.collapsed);

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "fm-trailer-toggle";
      toggle.setAttribute("contenteditable", "false");
      toggle.tabIndex = 0;
      toggle.textContent = "•••";
      toggle.title = "Signature & quoted history — click or Enter to show";
      toggle.setAttribute("aria-label", toggle.title);

      const body = document.createElement("div");
      body.className = "fm-trailer-body";

      const setCollapsed = (collapsed: boolean) => {
        const pos = typeof getPos === "function" ? getPos() : null;
        if (pos == null) return;
        editor.view.dispatch(
          editor.view.state.tr.setNodeAttribute(pos, "collapsed", collapsed)
        );
        // Expanding: drop the caret into the first editable line of the trailer.
        // Collapsing: pull the caret back to the end of the message (pos-1) —
        // focus(undefined) would leave it stranded inside the now display:none
        // trailer, so the next keystroke would type into the hidden region.
        editor.commands.focus(collapsed ? Math.max(0, pos - 1) : pos + 1);
      };

      const currentlyCollapsed = () => dom.dataset.collapsed !== "false";
      toggle.addEventListener("mousedown", (e) => e.preventDefault());
      toggle.addEventListener("click", () => setCollapsed(!currentlyCollapsed()));
      toggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setCollapsed(!currentlyCollapsed());
        }
      });

      dom.append(toggle, body);
      return {
        dom,
        contentDOM: body,
        // Our own toggle/attribute writes aren't document edits.
        ignoreMutation: (m) =>
          m.target === toggle ||
          (m.type === "attributes" && m.target === dom),
        update: (updated) => {
          if (updated.type.name !== "replyTrailer") return false;
          dom.dataset.collapsed = String(updated.attrs.collapsed);
          return true;
        },
      };
    };
  },
});

/** ArrowDown at the very end of the message (the block right above a collapsed
 *  trailer) focuses the ••• toggle instead of trying to enter the hidden
 *  region — matching Superhuman's "use ↓ to focus •••, then Enter" hint.
 *  Returns true when it handled the key. */
export function focusCollapsedTrailer(view: EditorView): boolean {
  const { state } = view;
  let trailerPos: number | null = null;
  state.doc.forEach((child, offset) => {
    if (child.type.name === "replyTrailer") trailerPos = offset;
  });
  if (trailerPos === null) return false;
  const trailer = state.doc.nodeAt(trailerPos);
  if (!trailer || !trailer.attrs.collapsed) return false;
  const { $head, empty } = state.selection;
  // Only when the caret is collapsed and sitting at the very end of the last
  // message block (position just before the trailer node).
  if (!empty || $head.pos !== trailerPos - 1) return false;
  const btn = view.dom.querySelector<HTMLElement>(".fm-trailer-toggle");
  if (!btn) return false;
  btn.focus();
  return true;
}
