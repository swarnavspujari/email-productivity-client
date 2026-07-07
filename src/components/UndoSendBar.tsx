// Bottom-left Undo Send notification. Shows while a sent message waits out its
// Undo Send window: a live countdown, Undo (Z — pull the draft back), and Send
// now (Ctrl/Cmd+Shift+Z — flush instantly). Driven by ui.pendingSend; it clears
// itself when the window elapses (the outbox processor delivers at the same
// moment). Positioned by the stack container in App.tsx.
import { useEffect, useState } from "react";
import { formatKeyExpr } from "@/lib/keyboard";
import { shortcutHint, runCommandById } from "@/lib/commands";
import { popUndo } from "@/lib/undo";
import { useUi } from "@/stores/ui";

export function UndoSendBar() {
  const pending = useUi((s) => s.pendingSend);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!pending) return;
    const tick = () => {
      const t = Date.now();
      if (t >= pending.expiresAt) useUi.getState().clearPendingSend();
      else setNow(t);
    };
    tick();
    const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, [pending?.expiresAt]);

  if (!pending) return null;
  const secs = Math.max(0, Math.ceil((pending.expiresAt - now) / 1000));

  return (
    <div className="zb-pop-in flex min-w-[300px] items-stretch gap-3 overflow-hidden rounded-lg border border-line-strong bg-raised shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
      <span className="w-[3px] shrink-0 bg-accent" />
      <span className="flex-1 self-center py-2.5 text-[13px] text-ink">
        {pending.label} · undo in {secs}s
      </span>
      {/* Same as pressing Z — undo the most recent action (the send). */}
      <button
        onClick={() => void popUndo()}
        title="Undo Send (Z)"
        className="self-center text-[12px] font-semibold uppercase tracking-wide text-accent-strong hover:text-accent"
      >
        Undo
      </button>
      <button
        onClick={() => runCommandById("send.accelerate")}
        title={`Send now (${formatKeyExpr(shortcutHint("send.accelerate"))})`}
        className="self-center py-2.5 pr-4 text-[12px] font-medium text-ink-3 hover:text-ink"
      >
        Send now
      </button>
    </div>
  );
}
