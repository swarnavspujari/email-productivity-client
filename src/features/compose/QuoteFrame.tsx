// Faithful render of a reply's signature + quoted history. The original email
// is real (often table/inline-CSS-heavy) HTML that a schema editor would
// mangle, so it renders in a script-less, themed, sandboxed iframe — the same
// technique the reading pane uses — and is appended verbatim on send. Height
// tracks the content; links open in the system browser.
import { useEffect, useMemo, useRef, useState } from "react";
import { openExternal } from "@/lib/ipc";
import { useSettings } from "@/stores/settings";

export function QuoteFrame({ html }: { html: string }) {
  const theme = useSettings((s) => s.settings.theme);
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(60);

  const srcDoc = useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) =>
      css.getPropertyValue(name).trim() || fallback;
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      :root{color-scheme:${theme}}
      html,body{margin:0;padding:0;height:auto!important}
      body{background:${v("--bg-raised", "#ffffff")};color:${v("--text-primary", "#1d222b")};
           font:13.5px/1.55 "Segoe UI",system-ui,sans-serif;
           padding:4px 2px;word-break:break-word;overflow-x:hidden}
      #fm-root{overflow:hidden}
      img{max-width:100%;height:auto}
      table{max-width:100%}
      a{color:${v("--accent-strong", "#3b52c4")}}
      blockquote.fm-quote{margin:10px 0 0;padding-left:12px;
           border-left:2px solid ${v("--border-strong", "#d5d9e2")}}
      p.fm-quote-attr{margin:12px 0 6px;color:${v("--text-secondary", "#5b6272")}}
      pre{white-space:pre-wrap}
    </style></head><body><div id="fm-root">${html}</div></body></html>`;
  }, [html, theme]);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    let ro: ResizeObserver | null = null;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wire = () => {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;
      const measure = () => {
        const root = doc.getElementById("fm-root");
        const h = Math.max((root?.offsetHeight ?? 0) + 16, doc.body.scrollHeight);
        setHeight(Math.min(20_000, Math.max(32, h)));
      };
      measure();
      ro = new ResizeObserver(measure);
      const root = doc.getElementById("fm-root");
      if (root) ro.observe(root);
      ro.observe(doc.body);
      for (const img of Array.from(doc.images)) img.addEventListener("load", measure);
      for (const d of [150, 500, 1200]) timers.push(setTimeout(measure, d));
      doc.addEventListener("click", (e) => {
        const a = (e.target as Element | null)?.closest?.("a");
        const href = a?.getAttribute("href");
        if (href && /^https?:|^mailto:/.test(href)) {
          e.preventDefault();
          void openExternal(href);
        }
      });
    };
    iframe.addEventListener("load", wire);
    wire();
    return () => {
      iframe.removeEventListener("load", wire);
      ro?.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [srcDoc]);

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
