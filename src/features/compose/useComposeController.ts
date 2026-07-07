// Send + autosave + attachment plumbing shared by both composer shells: the
// new-message modal (Compose.tsx) and the inline reply dock (ReplyDock.tsx).
// Exactly one shell is mounted at a time (ui.compose is singular; the modal is
// gated to mode "new", the dock to reply/forward), so this hook — and its lone
// `fission:send` listener — runs once. Extracting it keeps the two shells
// purely presentational and the send path in one place.
import { useEffect, useRef, useState } from "react";
import { backend } from "@/lib/ipc";
import { pushTriageUndo } from "@/lib/commands";
import { pushUndo } from "@/lib/undo";
import { useMail } from "@/stores/mail";
import { useSettings } from "@/stores/settings";
import { composeHasContent, outgoingFromCompose, useUi } from "@/stores/ui";
import type { MailAttachment } from "@/lib/types";

const MAX_ATTACH_TOTAL = 25_000_000; // Gmail's raw-message ceiling

function splitAddresses(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function readFileB64(file: File): Promise<MailAttachment> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error(`could not read ${file.name}`));
    r.onload = () => {
      const url = String(r.result); // data:<mime>;base64,<data>
      resolve({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        dataBase64: url.slice(url.indexOf(",") + 1),
      });
    };
    r.readAsDataURL(file);
  });
}

export function useComposeController() {
  const compose = useUi((s) => s.compose);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Autosave the draft while typing, so a crash or close loses nothing.
  useEffect(() => {
    const t = setTimeout(() => {
      const c = useUi.getState().compose;
      if (!c) return;
      if (!composeHasContent(c)) return;
      const { draftId, ...payload } = c;
      void backend
        .saveDraft(draftId, JSON.stringify(payload))
        .then((id) => {
          const cur = useUi.getState().compose;
          if (cur && cur.draftId !== id) {
            useUi.setState((s) => ({
              compose: s.compose ? { ...s.compose, draftId: id } : null,
            }));
          }
        })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [
    compose?.to,
    compose?.cc,
    compose?.bcc,
    compose?.subject,
    compose?.body,
    compose?.quote,
    compose?.attachments,
  ]);

  useEffect(() => {
    const send = async (markDone: boolean) => {
      const c = useUi.getState().compose;
      if (!c || sending) return;
      const to = splitAddresses(c.to);
      if (to.length === 0) {
        setError("Add at least one recipient.");
        return;
      }
      // The Undo Send window (seconds) is a user setting: 0 = off (leave now),
      // else the fuse the message waits out before it actually sends.
      const undoMs =
        Math.max(0, useSettings.getState().settings.undoSendSeconds ?? 10) * 1000;
      setSending(true);
      setError(null);
      try {
        const outgoing = outgoingFromCompose(c);

        // "Send & mark done": archive the thread + register its own triage undo.
        // Returns whether it ran, so the notification can say "& marked done".
        const runMarkDone = async () => {
          if (!(markDone && c.threadId)) return false;
          if (useMail.getState().openThreadId === c.threadId)
            useMail.getState().closeThread();
          const tid = c.threadId;
          await useMail.getState().archive(tid);
          pushTriageUndo("Mark Done", () => useMail.getState().moveToInbox(tid));
          await useUi.getState().checkInboxZero();
          return true;
        };

        if (undoMs === 0) {
          // Undo Send off: deliver immediately, no window, nothing to undo.
          await backend.sendMailNow(outgoing);
          if (c.draftId !== null) void backend.deleteDraft(c.draftId).catch(() => {});
          useUi.getState().closeCompose();
          const done = await runMarkDone();
          useUi.getState().showToast(done ? "Sent & marked done" : "Sent");
        } else {
          // Queue with the fuse — that delay IS the Undo Send window (Z pulls
          // the draft back; the UndoSendBar shows the countdown + Send now).
          const outboxId = await backend.queueMail(outgoing, undoMs);
          if (c.draftId !== null) void backend.deleteDraft(c.draftId).catch(() => {});
          const saved = { ...c, draftId: null };
          useUi.getState().closeCompose();
          pushUndo({
            // Match the bar + the actual send time exactly — a shorter buffer
            // left a dead second where Z skipped this entry and undid an older
            // action while the mail still went out. cancelOutbox's catch handles
            // the rare race where the flush already fired.
            label: "Send",
            expiresAt: Date.now() + undoMs,
            run: async () => {
              try {
                await backend.cancelOutbox(outboxId);
                useUi.getState().startCompose(saved);
                useUi.getState().showToast("Send undone — draft restored");
              } catch {
                useUi.getState().showToast("Too late — already sent");
              }
              useUi.getState().clearPendingSend();
            },
          });
          const done = await runMarkDone();
          useUi.getState().setPendingSend({
            outboxId,
            expiresAt: Date.now() + undoMs,
            label: done ? "Sent & marked done" : "Sent",
          });
        }
        await useMail.getState().refresh();
      } catch (e) {
        setError(String(e));
      } finally {
        setSending(false);
      }
    };
    const handler = (e: Event) =>
      void send(Boolean((e as CustomEvent).detail?.markDone));
    window.addEventListener("fission:send", handler);
    return () => window.removeEventListener("fission:send", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending]);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const current = useUi.getState().compose;
    if (!current) return;
    const existing = current.attachments.reduce(
      (n, a) => n + a.dataBase64.length * 0.75,
      0
    );
    let total = existing;
    const added: MailAttachment[] = [];
    for (const f of Array.from(files)) {
      total += f.size;
      if (total > MAX_ATTACH_TOTAL) {
        setError("Attachments exceed the 25 MB limit.");
        break;
      }
      added.push(await readFileB64(f));
    }
    if (added.length) {
      useUi.setState((s) => ({
        compose: s.compose
          ? { ...s.compose, attachments: [...s.compose.attachments, ...added] }
          : null,
      }));
    }
  };

  return { sending, error, setError, fileRef, addFiles };
}
