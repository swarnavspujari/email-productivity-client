// The inline reply composer, threaded into the conversation column at the same
// width as the email above it (ThreadView renders it inside the message column).
// The body is the shared <ComposeShell/>; this file is just the inline chrome
// and the open-scroll behavior. The message is an editable TipTap surface;
// recipients collapse to a one-line summary; the signature + quoted history
// render faithfully behind a subtle ••• and are appended on send.
import { useEffect } from "react";
import { ComposeShell } from "./ComposeShell";

export function ReplyDock() {
  // Opening the reply smooth-scrolls the thread down so the dock is in view.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-thread-scroll]");
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  return (
    <div className="zb-fade-in mt-4 overflow-hidden rounded-[10px] border border-line-strong bg-raised">
      <ComposeShell variant="dock" />
    </div>
  );
}
