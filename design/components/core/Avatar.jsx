import React from "react";

// Hue derives from the email so a given sender always gets the same color.
function hueOf(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return ((h % 360) + 360) % 360;
}

/**
 * Avatar — sender identity. Shows a photo when one is available, otherwise a
 * tinted monogram whose hue is derived from the email address (so a given
 * sender always renders the same color). Ported from the product's Avatar.
 */
export function Avatar({ name, email = "", src = null, size = 32, style }) {
  const initial = ((name ?? "").trim()[0] ?? email.trim()[0] ?? "?").toUpperCase();
  const hue = hueOf(email.toLowerCase());
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: "var(--radius-pill)", objectFit: "cover", flexShrink: 0, ...style }}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        width: size,
        height: size,
        borderRadius: "var(--radius-pill)",
        fontWeight: "var(--fw-semibold)",
        fontSize: size * 0.44,
        background: `oklch(0.42 0.09 ${hue})`,
        color: `oklch(0.93 0.03 ${hue})`,
        ...style,
      }}
    >
      {initial}
    </div>
  );
}
