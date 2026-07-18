import React from "react";
import { KeyHint } from "./KeyHint.jsx";

/* Portal target — every consumer (specimen cards, the UI kit) loads ReactDOM
 * UMD, so this resolves at runtime; if it's ever missing we render inline. */
const RD = typeof ReactDOM !== "undefined" ? ReactDOM : null;

function HintTip({ label, expr, keys, placement, align, gap, anchor }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState({ top: -9999, left: -9999, ready: false });

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const M = 8; // keep this far from the viewport edge
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let p = placement;
    if (p === "top" && anchor.top - gap - h < M) p = "bottom";
    else if (p === "bottom" && anchor.bottom + gap + h > vh - M) p = "top";
    else if (p === "left" && anchor.left - gap - w < M) p = "right";
    else if (p === "right" && anchor.right + gap + w > vw - M) p = "left";

    let top, left;
    if (p === "top") top = anchor.top - gap - h;
    else if (p === "bottom") top = anchor.bottom + gap;
    else top = anchor.cy - h / 2;

    if (p === "left") left = anchor.left - gap - w;
    else if (p === "right") left = anchor.right + gap;
    else if (align === "start") left = anchor.left;
    else if (align === "end") left = anchor.right - w;
    else left = anchor.cx - w / 2;

    left = Math.max(M, Math.min(left, vw - M - w));
    top = Math.max(M, Math.min(top, vh - M - h));
    setPos({ top, left, ready: true });
  }, [anchor, placement, align, gap, label, expr, keys]);

  const tip = (
    <div
      ref={ref}
      role="tooltip"
      className="sm-pop-in"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        opacity: pos.ready ? 1 : 0,
        zIndex: 2147483000,
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        padding: "5px 8px 5px 11px",
        borderRadius: "var(--radius-md)",
        background: "var(--tip-bg)",
        color: "var(--tip-fg)",
        border: "1px solid var(--tip-border)",
        boxShadow: "var(--tip-shadow)",
        fontFamily: "var(--font-sans)",
        fontSize: "13px",
        fontWeight: "var(--fw-medium)",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        pointerEvents: "none",
      }}
    >
      <span>{label}</span>
      {(expr || keys) && <KeyHint expr={expr} keys={keys} on="tooltip" />}
    </div>
  );

  return RD && typeof document !== "undefined" ? RD.createPortal(tip, document.body) : tip;
}

/**
 * HoverHint — THE design-system rule for surfacing a control's keyboard
 * shortcut. Wrap any interactive control; on hover (or keyboard focus) it
 * floats a tooltip pairing the action LABEL with its shortcut as keycap chips
 * (KeyHint) — never a plain "(Ctrl+K)" string, never a bare title attribute.
 *
 * The card is a THEME-AWARE INVERSE of the app (light card on dark, dark card
 * on light — the --tip-* tokens) so it always pops off the surface, matching
 * the Superhuman hover reference. It portals to <body> with fixed positioning,
 * so it never clips inside a row or a scrolling panel, and flips / clamps to
 * stay on-screen.
 *
 *   <HoverHint label="Mark Done" expr="e"><IconButton …>{"✓"}</IconButton></HoverHint>
 *   <HoverHint label="Shell Command" expr="mod+k" placement="bottom"> … </HoverHint>
 *
 * Wrap exactly one interactive child. Keep `label` a short imperative (the
 * command's name); pull `expr` from the shortcut catalog so hint and keymap
 * never drift.
 */
export function HoverHint({
  label,
  expr,
  keys,
  placement = "top",
  align = "center",
  delay = 320,
  gap = 8,
  disabled = false,
  children,
  wrapStyle,
  ...rest
}) {
  const ref = React.useRef(null);
  const timer = React.useRef(null);
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState(null);

  const show = () => {
    if (disabled) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setAnchor({
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
      });
      setOpen(true);
    }, delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };

  React.useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      style={{ display: "inline-flex", ...wrapStyle }}
      {...rest}
    >
      {children}
      {open && anchor && (
        <HintTip
          label={label}
          expr={expr}
          keys={keys}
          placement={placement}
          align={align}
          gap={gap}
          anchor={anchor}
        />
      )}
    </span>
  );
}
