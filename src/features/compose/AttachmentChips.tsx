// The attachment chip row, shared by both composer shells. Renders nothing when
// the draft has no attachments. The "Attach" affordance (file picker) lives in
// the action bar; this only displays what's attached and lets you remove one.
// Oversized files mid-upload to Drive show here too, as pending chips with a
// live progress bar (they become link chips in the body when done).
import { useUi } from "@/stores/ui";

function fmtSize(bytes: number): string {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes > 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

export function AttachmentChips() {
  const attachments = useUi((s) => s.compose?.attachments) ?? [];
  const uploads = useUi((s) => s.driveUploads);
  if (attachments.length === 0 && uploads.length === 0) return null;

  const remove = (index: number) =>
    useUi.setState((s) => ({
      compose: s.compose
        ? {
            ...s.compose,
            attachments: s.compose.attachments.filter((_, j) => j !== index),
          }
        : null,
    }));

  return (
    <div className="flex flex-wrap gap-2 border-t border-line px-4 py-2">
      {uploads.map((u) => (
        <span
          key={`up-${u.id}`}
          className="relative flex items-center gap-1.5 overflow-hidden rounded-md border border-accent/40 bg-surface px-2.5 py-1 text-[12px] text-ink-2"
          title={`Uploading to Google Drive — becomes a link when done (${Math.round(
            (u.sent / u.total) * 100
          )}%)`}
        >
          <span
            className="absolute inset-y-0 left-0 bg-accent-dim"
            style={{ width: `${Math.round((u.sent / u.total) * 100)}%` }}
          />
          <span className="relative">▲ {u.name}</span>
          <span className="relative text-ink-3">
            {Math.round((u.sent / u.total) * 100)}%
          </span>
        </span>
      ))}
      {attachments.map((a, i) => (
        <span
          key={`${a.filename}-${i}`}
          className="flex items-center gap-1.5 rounded-md border border-line-strong bg-surface py-1 pl-2.5 pr-1 text-[12px] text-ink-2"
        >
          📎 {a.filename}
          <span className="text-ink-3">
            {fmtSize(Math.round(a.dataBase64.length * 0.75))}
          </span>
          <button
            onClick={() => remove(i)}
            className="rounded px-1 text-ink-3 hover:bg-hover hover:text-ink"
            title="Remove attachment"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
