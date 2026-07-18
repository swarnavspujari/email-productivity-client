import React from "react";

/**
 * Kbd — a keycap hint chip. Snail Mail is keyboard-first, so these appear
 * everywhere: the footer strip, palette rows, inline help ("press <Tab>").
 * Mono font, hairline border, raised background. Matches the global .kbd rule.
 */
export function Kbd({ children, style, ...rest }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        borderRadius: "var(--radius-xs)",
        border: "1px solid var(--border-strong)",
        background: "var(--bg-raised)",
        color: "var(--text-secondary)",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        lineHeight: "16px",
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
