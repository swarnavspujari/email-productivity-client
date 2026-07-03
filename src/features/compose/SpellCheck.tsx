// Harper spell/grammar checking for the compose body: a transparent-text
// backdrop mirrors the textarea and draws wavy underlines under flagged
// spans; putting the caret in one (click or arrows) offers Harper's
// suggestions below, and accepting applies the fix. All linting is local
// (harper-core in the Rust core; a small fixture list in the browser demo).
import { useEffect, useMemo, useRef, useState } from "react";
import { backend } from "@/lib/ipc";
import type { LintHit } from "@/lib/types";

const DEBOUNCE_MS = 500;

/** Stable identity for a hit across re-lints: flagged text + message. */
function lintKey(text: string, l: LintHit): string {
  return `${text.slice(l.span.start, l.span.end)}|${l.message}`;
}

export function LintedBody({
  value,
  onChange,
  textareaRef,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  placeholder: string;
}) {
  const [lints, setLints] = useState<LintHit[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [caret, setCaret] = useState<number | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    if (!value.trim()) {
      setLints([]);
      return;
    }
    const t = setTimeout(() => {
      backend
        .lintText(value)
        .then((hits) => {
          if (seq.current === id) setLints(hits);
        })
        .catch(() => {});
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value]);

  const visible = useMemo(
    () =>
      lints.filter(
        (l) =>
          l.span.end <= value.length &&
          l.span.end > l.span.start &&
          !dismissed.has(lintKey(value, l))
      ),
    [lints, dismissed, value]
  );

  const active =
    caret === null
      ? null
      : (visible.find((l) => caret >= l.span.start && caret <= l.span.end) ??
        null);

  const segments = useMemo(() => {
    const out: React.ReactNode[] = [];
    let pos = 0;
    const sorted = [...visible].sort((a, b) => a.span.start - b.span.start);
    for (const l of sorted) {
      if (l.span.start < pos) continue; // overlapping hit — skip
      if (l.span.start > pos) out.push(value.slice(pos, l.span.start));
      out.push(
        <span
          key={`${l.span.start}-${l.span.end}`}
          style={{
            textDecorationLine: "underline",
            textDecorationStyle: "wavy",
            textDecorationColor: "var(--danger)",
            textDecorationSkipInk: "none",
          }}
        >
          {value.slice(l.span.start, l.span.end)}
        </span>
      );
      pos = l.span.end;
    }
    out.push(value.slice(pos));
    return out;
  }, [visible, value]);

  const syncScroll = () => {
    const ta = textareaRef.current;
    const bd = backdropRef.current;
    if (ta && bd) bd.scrollTop = ta.scrollTop;
  };

  const trackCaret = () => {
    setCaret(textareaRef.current?.selectionStart ?? null);
  };

  const applyFix = (l: LintHit, replacement: string) => {
    const next =
      value.slice(0, l.span.start) + replacement + value.slice(l.span.end);
    onChange(next);
    setLints((ls) => ls.filter((x) => x !== l));
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      const p = l.span.start + replacement.length;
      requestAnimationFrame(() => ta.setSelectionRange(p, p));
    }
  };

  // The backdrop must mirror the textarea's typography exactly.
  const textCls = "px-4 py-3 text-[13.5px] leading-relaxed";

  return (
    <>
      <div className="relative min-h-0 flex-1">
        <div
          ref={backdropRef}
          aria-hidden
          className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-transparent ${textCls}`}
        >
          {segments}
          {"\n"}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onSelect={trackCaret}
          onKeyUp={trackCaret}
          onClick={trackCaret}
          onBlur={() => setCaret(null)}
          spellCheck={false}
          className={`absolute inset-0 h-full w-full resize-none bg-transparent text-ink outline-none ${textCls}`}
          placeholder={placeholder}
        />
      </div>
      {active && (
        <div className="zb-fade-in flex items-center gap-2 border-t border-line bg-raised px-4 py-1.5 text-[12.5px]">
          <span className="min-w-0 truncate text-ink-3">{active.message}</span>
          <div className="flex-1" />
          {active.suggestions.slice(0, 3).map((s, i) => (
            <button
              key={i}
              onClick={() => applyFix(active, s)}
              className="rounded-full border border-accent/40 bg-accent-dim px-2.5 py-0.5 text-ink hover:border-accent"
            >
              {s === "" ? "Remove" : s}
            </button>
          ))}
          <button
            onClick={() =>
              setDismissed((d) => new Set(d).add(lintKey(value, active)))
            }
            className="rounded px-1.5 py-0.5 text-ink-3 hover:bg-hover hover:text-ink"
            title="Ignore"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
