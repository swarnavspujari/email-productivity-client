import React from "react";

/* ------------------------------------------------------------------ *
 * Keyboard display helpers — ported from the product's keyboard engine
 * (src/lib/keyboard.ts). Bindings come from the shortcut catalog (the
 * repo, transcribed from the Superhuman sheet); these turn a binding
 * EXPR into the labels shown on the keycaps.
 *
 * Casing matches the reference sheet: modifier / named keys render
 * lowercase (ctrl, shift, esc, tab…), letters uppercase, arrows as
 * glyphs. Snail Mail is Windows-first, so "mod" -> "ctrl".
 * ------------------------------------------------------------------ */

export function formatKeyToken(p) {
  switch (p) {
    case "mod": return "ctrl";
    case "shift": return "shift";
    case "alt": return "alt";
    case "ctrl": return "ctrl";
    case "escape": return "esc";
    case "esc": return "esc";
    case "enter": return "enter";
    case "return": return "enter";
    case "tab": return "tab";
    case "space": return "space";
    case "backspace": return "backspace";
    case "delete": return "del";
    case "up": return "↑";
    case "down": return "↓";
    case "left": return "←";
    case "right": return "→";
    default:
      return p.length === 1 && p >= "a" && p <= "z" ? p.toUpperCase() : p;
  }
}

/** One chip label per keycap for a single binding alternative (no "|").
 *  Combos and chords both flatten to ADJACENT keycaps — no "+" and no "then"
 *  separator; proximity alone conveys the grouping. "mod+shift+c" ->
 *  ["ctrl","shift","C"]; "g i" -> ["G","I"]. */
export function exprKeycaps(expr) {
  if (!expr) return [];
  const chips = [];
  expr.trim().split(/\s+/).forEach((part) => {
    for (const p of part.split("+")) chips.push(formatKeyToken(p));
  });
  return chips;
}

/** A binding EXPR as a flat chip list. "|" alternatives ("j|k") render as
 *  side-by-side keycaps ["J","K"], the way the shortcut sheet shows them. */
export function keycapsForExpr(expr) {
  if (!expr) return [];
  return expr
    .split("|")
    .flatMap((alt) => exprKeycaps(alt.trim()));
}

/** Plain human string for a single binding, e.g. "ctrl K" / "G I". */
export function formatKeyExpr(expr) {
  return exprKeycaps((expr || "").split("|")[0]).join(" ");
}

/**
 * KeyHint — renders a keyboard binding as one or more keycap chips: the
 * "square button icons combined" look from the Superhuman shortcut sheet,
 * instead of plain "(Ctrl+K)" text. This is the atom every shortcut hint in
 * the system is built from (HoverHint, ShortcutsPanel, palette rows, footer).
 *
 *   <KeyHint expr="e" />          ->  E
 *   <KeyHint expr="mod+k" />      ->  ctrl  K        (combo — no "+")
 *   <KeyHint expr="shift+e" />    ->  shift  E
 *   <KeyHint expr="g i" />        ->  G  I           (chord — no "then")
 *   <KeyHint expr="j|k" />        ->  J  K           (alternatives)
 *
 * `on` selects the surface it sits on:
 *   "surface" (default) — inline on an app surface: the raised, hairline
 *                         `.kbd` keycap (footer strip, palette, panel rows).
 *   "tooltip"           — inside a HoverHint's inverse card: solid keycaps
 *                         tuned to read on the tip (--tip-key-* tokens).
 */
export function KeyHint({ expr, keys, on = "surface", size = "md", style, ...rest }) {
  const chips = keys ? keys.slice() : keycapsForExpr(expr);

  const dims =
    size === "sm"
      ? { fs: "10px", pad: "0 5px", h: 15, minW: 15, gap: 3 }
      : { fs: "11px", pad: "1px 6px", h: 18, minW: 18, gap: 4 };

  const cap =
    on === "tooltip"
      ? { background: "var(--tip-key-bg)", color: "var(--tip-key-fg)", border: "1px solid transparent" }
      : { background: "var(--bg-raised)", color: "var(--text-secondary)", border: "1px solid var(--border-strong)" };

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: dims.gap, verticalAlign: "middle", ...style }}
      {...rest}
    >
      {chips.map((chip, i) => (
        <kbd
          key={i}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: dims.minW,
            height: dims.h,
            padding: dims.pad,
            borderRadius: "var(--radius-xs)",
            fontFamily: "var(--font-mono)",
            fontSize: dims.fs,
            fontStyle: "normal",
            lineHeight: 1,
            whiteSpace: "nowrap",
            ...cap,
          }}
        >
          {chip}
        </kbd>
      ))}
    </span>
  );
}
