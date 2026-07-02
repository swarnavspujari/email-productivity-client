// Sender avatar: photo when we have one, else a tinted monogram.
// Hue derives from the email so a given sender always gets the same color.

function hueOf(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return ((h % 360) + 360) % 360;
}

export function Avatar({
  name,
  email,
  src,
  size = 32,
}: {
  name: string;
  email: string;
  src?: string | null;
  size?: number;
}) {
  const initial = (name.trim()[0] ?? email.trim()[0] ?? "?").toUpperCase();
  const hue = hueOf(email.toLowerCase());
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex shrink-0 select-none items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.44,
        background: `oklch(0.42 0.09 ${hue})`,
        color: `oklch(0.93 0.03 ${hue})`,
      }}
    >
      {initial}
    </div>
  );
}
