import React from "react";

/**
 * RestState — the calm inbox-zero surface. When a split hits zero, the list is
 * replaced by the full-bleed daily photo (rotated from the Unsplash API). No
 * overlaid headline: just the inbox-zero streak bottom-left and the required
 * Unsplash attribution bottom-right, both under a bottom scrim. The one
 * full-bleed image moment in an otherwise image-free client.
 *
 * Pass a real photo `src` in production; with none, an atmospheric dawn
 * placeholder stands in for the rotating slot (per the imagery rule — we never
 * hotlink or hand-draw the photo).
 */
export function RestState({
  src,
  streak = 0,
  photoBy = "Aditya Chinchure",
  photoByUrl,
  onCredit,
  style,
  ...rest
}) {
  const streakLabel =
    streak > 0 ? `🔥 ${streak}-day inbox-zero streak` : "Inbox zero";
  return (
    <div
      style={{
        position: "relative", height: "100%", width: "100%", overflow: "hidden",
        background: "var(--bg-surface)", fontFamily: "var(--font-sans)", ...style,
      }}
      {...rest}
    >
      {src ? (
        <img src={src} alt="" draggable={false} style={{ position: "absolute", inset: 0, height: "100%", width: "100%", objectFit: "cover" }} />
      ) : (
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            backgroundColor: "oklch(0.5 0.05 250)",
            backgroundImage:
              "radial-gradient(135% 82% at 50% 32%, oklch(0.95 0.06 82 / 0.92) 0%, oklch(0.88 0.05 74 / 0.35) 34%, transparent 62%)," +
              "radial-gradient(120% 100% at 50% 125%, oklch(0.27 0.03 252) 0%, transparent 55%)," +
              "linear-gradient(180deg, oklch(0.83 0.035 232) 0%, oklch(0.66 0.05 248) 40%, oklch(0.46 0.05 254) 74%, oklch(0.34 0.04 256) 100%)",
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", letterSpacing: "0.04em", color: "oklch(0.28 0.03 252 / 0.5)" }}>
            {"↻"} rotating daily photo · Unsplash
          </span>
        </div>
      )}

      {/* bottom scrim keeps the streak + attribution legible on any photo */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 96, background: "linear-gradient(to top, rgba(0,0,0,0.45), transparent)", pointerEvents: "none" }} />

      {/* streak — the one intentional functional glyph (🔥); no headline copy */}
      <div style={{ position: "absolute", left: 14, bottom: 10, fontSize: "12px", fontWeight: "var(--fw-medium)", color: "rgba(255,255,255,0.85)", textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}>
        {streakLabel}
      </div>

      <div style={{ position: "absolute", right: 14, bottom: 10, fontSize: "11px", color: "rgba(255,255,255,0.7)", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}>
        Photo by{" "}
        <button
          onClick={onCredit}
          style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", color: "inherit", textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.4)" }}
        >
          {photoBy}
        </button>{" "}
        on{" "}
        <button
          onClick={onCredit}
          style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", color: "inherit", textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.4)" }}
        >
          Unsplash
        </button>
      </div>
    </div>
  );
}
