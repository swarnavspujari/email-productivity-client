import { useState } from "react";
import { advanceAfterTriage, pushTriageUndo, triageAnchor } from "@/lib/commands";
import { parseSnooze } from "@/lib/snooze-parse";
import { useMail } from "@/stores/mail";
import { actionTargetThreadId, useUi } from "@/stores/ui";
import { PickerShell, type PickerItem } from "./PickerShell";

function at(hour: number, dayOffset: number): number {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

/** Clock time with the local zone abbrev, e.g. "8:00 AM EST". */
function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Weekday + clock time with the zone abbrev, e.g. "Sat, 8:00 AM EST". */
function fmtDayTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function SnoozePicker() {
  const id = actionTargetThreadId();
  const [dynamic, setDynamic] = useState<PickerItem | null>(null);

  const snooze = (until: number, label: string) => async () => {
    if (!id) return;
    const anchor = triageAnchor([id]);
    await useMail.getState().snooze(id, until);
    await advanceAfterTriage(anchor);
    pushTriageUndo("Snooze", () => useMail.getState().moveToInbox(id));
    useUi.getState().showToast(`Reminder set — ${label}`);
    await useUi.getState().checkInboxZero();
  };

  const now = new Date();
  const twoHours = Date.now() + 2 * 3600_000;
  const evening = at(18, now.getHours() >= 18 ? 1 : 0);
  const tomorrow = at(8, 1);
  const weekend = at(8, (6 - now.getDay() + 7) % 7 || 7);
  const nextWeek = at(8, (1 - now.getDay() + 7) % 7 || 7);

  // Curated defaults — the list you see before typing. Details carry the zone
  // abbrev so a reminder time never renders without it.
  const presets: PickerItem[] = [
    { label: "In 2 hours", detail: fmtTime(twoHours), run: snooze(twoHours, "in 2 hours") },
    { label: "This evening", detail: fmtTime(evening), run: snooze(evening, "this evening") },
    { label: "Tomorrow morning", detail: fmtTime(tomorrow), run: snooze(tomorrow, "tomorrow") },
    { label: "This weekend", detail: fmtDayTime(weekend), run: snooze(weekend, "this weekend") },
    { label: "Next week", detail: fmtDayTime(nextWeek), run: snooze(nextWeek, "next week") },
    {
      label: "In 30 seconds (demo)",
      detail: "for testing",
      run: snooze(Date.now() + 30_000, "in 30 seconds"),
    },
  ];

  // Natural-language match, prepended above the presets when the query parses.
  const onQuery = (q: string) => {
    const parsed = parseSnooze(q);
    setDynamic(
      parsed
        ? {
            label: parsed.label,
            detail: fmtTime(parsed.atMs),
            run: snooze(parsed.atMs, parsed.label),
          }
        : null
    );
  };

  const items = dynamic ? [dynamic, ...presets] : presets;

  return (
    <PickerShell
      title="Remind me…"
      items={items}
      onQuery={onQuery}
      queryPlaceholder="Try: 8 am, 3 days, aug 7"
    />
  );
}
