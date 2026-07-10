# Per-message keyboard navigation in threads

**Date:** 2026-07-09
**Branch:** `claude/thread-message-keyboard-nav-a8c6c2`
**Scope:** Thread reading-pane navigation only. No keyboard-engine refactor.

## Goal / user story

In an open multi-message thread, ↑/↓ should move a selection cursor between the
individual messages (highlight + scroll into view) — like Superhuman's
conversation view — and Enter should drill into the focused message. Today ↑/↓
only nudge-scroll the pane and there is no per-message cursor.

## Behavior specification

### Keys while reading a thread

| Key | Single-message thread | Multi-message thread |
|-----|----------------------|----------------------|
| ↓ / ↑ | **Unchanged** — nudge-scroll the pane (`reader.lineDown` / `reader.lineUp`) | **New** — move the focus cursor to the next/previous message: highlight it and scroll it into view. Does **not** expand it. Clamps at the ends (no wrap). |
| Enter | **Unchanged** — Reply All (to latest) | **New (two-stage):** focused message collapsed → **open** it; focused message already open → **Reply All to that specific message** (dock composer below). Never collapses. |
| `j` / `k` | **Unchanged** — previous/next conversation | **Unchanged** — previous/next conversation |
| Space / Shift+Space | **Unchanged** — page the pane down/up | **Unchanged** — page the pane down/up |
| `a` | Reply All | Reply All (unchanged; the always-available Reply-All key) |
| `r` / `f` | Reply / Forward (to latest) | Reply / Forward (to latest, unchanged) |
| Click on a card header | Toggle expand/collapse | Toggle expand/collapse **and** move the cursor to that card |

Single-message threads have nothing to navigate, so they retain today's behavior
byte-for-byte.

### The focus cursor

- `focused: number` — index of the highlighted message, `0..lastIndex`.
- Resets to `lastIndex` (the newest message, where the pane already opens) whenever
  the thread's messages settle.
- Rendered only when `messages.length > 1`: the focused card gets an accent border +
  subtle `accent-dim` wash (existing `--accent` tokens) and `data-focused` /
  `data-message-index` attributes for testability.
- The cursor is **virtual** — arrow navigation does not move browser DOM focus onto
  the card `<button>`, so there is no double-activation of Enter/Space.

### Expansion is unchanged

Focus and expansion are **independent**. The existing rule stands:

```
isExpanded(m, i) = overrides[m.id] ?? (i === lastIndex || m.unread)
```

Arrowing does not touch expansion. Enter (stage 1) writes `overrides[id] = true` to
open a collapsed focused message — identical to a click-to-open. Opened messages stay
open (sticky); collapsing is via click, as today.

### Enter, precisely

Evaluated against the **focused** message `m` at index `i` (multi-message thread):

1. `!isExpanded(m, i)` → set `overrides[m.id] = true`, then scroll `m` into view.
2. `isExpanded(m, i)` → `startReply("replyAll", pickedSuggestion, m.id)` — the reply
   targets `m` specifically (its sender/recipients, its quoted body), and the inline
   ReplyDock opens below the conversation.

Because `focused` starts at `lastIndex` and the last message opens expanded by
default, the common flow "open thread → Enter → reply-all to the newest message"
works on the first keystroke.

## Architecture

### 1. Command layer (`src/lib/commands.ts`) — thin, gated dispatchers

Three new commands, each gated `when: () => inThread() && mail().openMessages.length > 1`,
placed in the registry **before** `thread.replyAllOrOpen` (so also before
`reader.lineDown/Up`). They only dispatch a `window` CustomEvent — all cursor and
expansion knowledge stays in `ThreadView`:

| id | key | dispatches |
|----|-----|-----------|
| `thread.focusNext` | `down` | `fission:thread-step` `{ dir: 1 }` |
| `thread.focusPrev` | `up` | `fission:thread-step` `{ dir: -1 }` |
| `thread.focusEnter` | `enter` | `fission:thread-enter` |

All `hidden: true`, mirroring the sibling `reader.*` / `list.cursor*` commands.

**Coexistence — no engine changes.** `installKeyboard`'s `tryMatch` returns the first
binding whose alternative matches **and** whose live `when()` passes. So:

- Multi-message thread: the focus command's `when` is true and it is ordered first →
  it wins over `reader.lineDown/Up` (`down`/`up`) and `thread.replyAllOrOpen` (`enter`).
- Single-message thread: the focus command's `when` is false → falls straight through
  to the existing scroll / Reply-All command.
- `reader.lineDown/Up` and `thread.replyAllOrOpen` keep their current `when: inThread()`
  (unchanged) and act as a graceful fallback if a focus command is ever unbound.

`j`/`k` (`list.next/prev`, `when: onMailScreen()`) are a different key and untouched.

### 2. Reply targeting (`src/lib/commands.ts`)

`startReply` gains an optional third argument:

```ts
export async function startReply(
  mode: "reply" | "replyAll" | "forward",
  presetBody?: string,
  targetMessageId?: string,
)
```

When `targetMessageId` resolves to a message in the thread, it is used as the reply
target (the value currently derived as "latest message that isn't me"); otherwise the
existing default is kept. Only the `thread.focusEnter` path passes it. `thread.reply`,
`thread.replyAll`, `thread.forward` (bare `r`/`a`/`f`) call `startReply` without it and
are unchanged.

### 3. ThreadView (`src/features/thread/ThreadView.tsx`) — owns the cursor

- New state `focused`; a `focusedRef` mirrors it for event handlers.
- Reset `focused = messages.length - 1` in an effect keyed on `[threadId, messages.length]`
  (co-located with the existing overrides reset / open-scroll effects; runs before the
  early `return null`).
- Subscribe to `fission:thread-step` and `fission:thread-enter` on `window` in a
  `useEffect` (cleanup on unmount):
  - **step**: `next = nextFocusIndex(focusedRef.current, dir, messages.length)`;
    `setFocused(next)`; after paint (`requestAnimationFrame`) scroll card `next` into
    view.
  - **enter**: read focused `m`; if collapsed → `setOverrides(o => ({...o, [m.id]: true}))`
    + scroll into view; else → `void startReply("replyAll", pickedSuggestion, m.id)`.
    (ThreadView already reads `suggestions`/`suggestionIndex` from `useUi`, so it can
    compute `pickedSuggestion` locally; `startReply` is imported from `commands.ts` —
    no import cycle, since `commands.ts` does not import `ThreadView`.)
- Scroll-into-view helper: reuse the existing open-scroll math (rect of
  `listRef.current.children[i]` relative to the `[data-thread-scroll]` scroller; adjust
  `scrollTop` only when the card is outside the viewport, 12px margin; instant, so it is
  headless-deterministic). Runs via `requestAnimationFrame` after the expansion
  re-render paints — never on mount (the existing open-scroll effect positions the pane).
- Pass `focused={messages.length > 1 && i === focused}` to `MessageCard`; the card adds
  the accent border/wash + `data-focused`/`data-message-index` on its root (both the
  collapsed `<button>` and the expanded `<div>`).
- `onToggle` (click) also sets `focused = i`, so the keyboard picks up where you clicked.

### 4. Pure helper (`src/lib/thread-focus.ts`) — unit-tested

```ts
export function nextFocusIndex(cur: number, dir: 1 | -1, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(cur + dir, 0), count - 1);
}
```

Vitest covers: step within range, clamp at 0, clamp at `count-1`, `count <= 1`.

### 5. Rust parity (`src-tauri/src/store/mod.rs`)

Add the three defaults alongside the mirrored shortcut map (`~line 300–315`), matching
`src/lib/defaults.ts`, so a real (non-mock) settings load stays in parity:

```
("thread.focusNext", "down"),
("thread.focusPrev", "up"),
("thread.focusEnter", "enter"),
```

`src/lib/defaults.ts` `DEFAULT_SHORTCUTS` gets the same three entries. Existing
`reader.lineDown/Up` (`down`/`up`) and `thread.replyAllOrOpen` (`enter`) entries stay —
multiple commands sharing a key is already normal here (e.g. `down` is on both
`list.cursorDown` and `reader.lineDown`).

## Edge cases

- **`overrides` wins over focus:** a message the user explicitly collapsed stays
  collapsed; Enter re-opens it (writes `true`). Consistent with click semantics.
- **New message arrives mid-read:** `messages.length` changes → `focused` resets to the
  new last message. Rare; acceptable (Superhuman also jumps to the newest).
- **Focus on the default-open last message + Enter:** it is already expanded → Reply All
  to it immediately (the expected "reply to the newest" path).
- **`j`/`k` to another conversation:** `threadId` changes → overrides + focus reset for
  the new thread; no interference.

## Non-goals

- No changes to `keyboard.ts`.
- Bare `r`/`a`/`f` do **not** follow the focus cursor (still reply to latest). Only Enter
  targets the focused message. (Easy to extend later if desired.)
- No auto-collapse of previously-opened messages (opened stays open; click to collapse).

## Verification (browser demo)

Run the mock/demo build and drive the page (dispatch key events at `window`, read state
from the DOM — the keyboard engine listens on `window`):

1. Open `t-term-sheet` (2 messages: older collapsed, newest unread/open) and a longer
   fixture. Press ↑/↓ → assert `data-focused` moves to the expected `data-message-index`
   and the card scrolls into view; assert arrowing does **not** change expansion.
2. On a collapsed focused message, press Enter → assert it expands (body appears).
   Press Enter again → assert the ReplyDock opens with the composer `To` = that
   message's sender.
3. Press `j`/`k` → assert `openThreadId` changes (conversation stepping intact).
4. Open a single-message thread → assert ↑/↓ change `scrollTop` (scroll, not step) and
   no `data-focused` highlight is rendered.
5. Screenshot the highlighted cursor in a multi-message thread as proof.

Report exactly what was exercised.
