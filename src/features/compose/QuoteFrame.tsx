// Faithful render — and optional editing — of a reply's signature + quoted
// history. The original is real email HTML (tables, inline CSS, images) that a
// schema editor (ProseMirror/TipTap) would mangle, so it lives in its own
// script-less, sandboxed, same-origin iframe. With `editable`, the iframe body
// is contentEditable: the email HTML renders faithfully AND stays editable (the
// approach Gmail/Outlook web use), and edits sync back out via onChange. No
// allow-scripts, so inline JS/onerror in the quote can never run.
import { useEffect, useMemo, useRef, useState } from "react";
import { openExternal } from "@/lib/ipc";
import { useSettings } from "@/stores/settings";

export function QuoteFrame({
  html,
  editable = false,
  onChange,
  onEscape,
}: {
  html: string;
  editable?: boolean;
  onChange?: (html: string) => void;
  onEscape?: () => void;
}) {
  const theme = useSettings((s) => s.settings.theme);
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(60);
  // Seed the frame ONCE (content + theme captured at open) so live edits never
  // reload it and reset the caret. Callbacks flow through refs for the same
  // reason. Re-opening the quote (unmount/remount) re-seeds from current props.
  const seedRef = useRef(html);
  const seedTheme = useRef(theme);
  const onChangeRef = useRef(onChange);
  const onEscapeRef = useRef(onEscape);
  onChangeRef.current = onChange;
  onEscapeRef.current = onEscape;

  const srcDoc = useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) =>
      css.getPropertyValue(name).trim() || fallback;
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      :root{color-scheme:${seedTheme.current}}
      html,body{margin:0;padding:0;height:auto!important}
      body{background:${v("--bg-raised", "#ffffff")};color:${v("--text-primary", "#1d222b")};
           font:13.5px/1.55 "Segoe UI",system-ui,sans-serif;
           padding:4px 2px;word-break:break-word;overflow-x:hidden}
      #fm-root{overflow:hidden;outline:none}
      #fm-root:focus{outline:none}
      img{max-width:100%;height:auto}
      table{max-width:100%}
      a{color:${v("--accent-strong", "#3b52c4")}}
      blockquote.fm-quote{margin:10px 0 0;padding-left:12px;
           border-left:2px solid ${v("--border-strong", "#d5d9e2")}}
      p.fm-quote-attr{margin:12px 0 6px;color:${v("--text-secondary", "#5b6272")}}
      pre{white-space:pre-wrap}
    </style></head><body><div id="fm-root"${
      editable ? ' contenteditable="true"' : ""
    }>${seedRef.current}</div></body></html>`;
  }, [editable]);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    let ro: ResizeObserver | null = null;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let writeTimer: ReturnType<typeof setTimeout> | undefined;
    let flush = () => {};
    let wired = false;
    const wire = () => {
      const doc = iframe.contentDocument;
      // #fm-root only exists once the srcDoc has actually parsed; the guard also
      // stops the immediate call + the load event from wiring twice.
      if (wired || !doc || !doc.getElementById("fm-root")) return;
      wired = true;
      const rootEl = () => doc.getElementById("fm-root");
      const measure = () => {
        const root = rootEl();
        const h = Math.max((root?.offsetHeight ?? 0) + 16, doc.body.scrollHeight);
        setHeight(Math.min(20_000, Math.max(32, h)));
      };
      measure();
      ro = new ResizeObserver(measure);
      const root = rootEl();
      if (root) ro.observe(root);
      ro.observe(doc.body);
      for (const img of Array.from(doc.images)) img.addEventListener("load", measure);
      for (const d of [150, 500, 1200]) timers.push(setTimeout(measure, d));
      doc.addEventListener("click", (e) => {
        const a = (e.target as Element | null)?.closest?.("a");
        const href = a?.getAttribute("href");
        if (!href) return;
        e.preventDefault(); // never navigate inside the frame
        if (!editable && /^https?:|^mailto:/.test(href)) void openExternal(href);
      });
      if (editable) {
        flush = () => {
          const root = rootEl();
          if (root) onChangeRef.current?.(root.innerHTML);
        };
        doc.addEventListener("input", () => {
          clearTimeout(writeTimer);
          writeTimer = setTimeout(flush, 300);
        });
        doc.addEventListener("keydown", (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            // Ctrl+Enter must send even from inside the quote iframe.
            e.preventDefault();
            flush();
            window.dispatchEvent(new CustomEvent("fission:send"));
          } else if (e.key === "Escape") {
            e.preventDefault();
            flush();
            onEscapeRef.current?.();
          }
        });
      }
    };
    iframe.addEventListener("load", wire);
    wire();
    return () => {
      iframe.removeEventListener("load", wire);
      ro?.disconnect();
      timers.forEach(clearTimeout);
      clearTimeout(writeTimer);
      flush(); // persist final edits when the quote collapses/unmounts
    };
  }, [srcDoc, editable]);

  return (
    <iframe
      ref={ref}
      sandbox="allow-same-origin"
      srcDoc={srcDoc}
      title="quoted message"
      className="w-full border-0 bg-raised"
      style={{ height }}
    />
  );
}
