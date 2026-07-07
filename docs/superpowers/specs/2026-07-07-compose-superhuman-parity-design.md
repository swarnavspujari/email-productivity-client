# New-Message Compose — Superhuman Parity Rebuild

**Date:** 2026-07-07 · **Area:** `src/features/compose` · **Target:** v0.12.0

## Goal

The new-message composer (`Compose.tsx`) still uses the pre-v0.11 design: three
always-visible bordered rows (To / Cc / Subject, **no Bcc**), a persistent
formatting toolbar, and a bare `Send · Attach · Discard` action bar. The reply
composer (`ReplyDock.tsx`, built in v0.11) already matches Superhuman. This rebuild
brings the new-message modal up to the same parity **by extracting the dock's
patterns into a shared shell**, so the two composers stop drifting.

**Success:** opening a new message looks and behaves like the Superhuman "New
Message" screenshots — a centered, airy card with collapsible recipients, a
selection-bubble editor (no persistent toolbar), and the rich icon action bar —
while the reply dock keeps working exactly as it does today.

## Current state — the gap

| Trait | Reply dock (target) | New-message modal (today) |
| --- | --- | --- |
| Recipient rows | Collapsible: one-line summary → expand To/Cc/Bcc/Subject | 3 always-open rows, **no Bcc** |
| Formatting UI | Selection bubble on highlight | Persistent top toolbar |
| Signature / quote | Behind subtle `•••` (QuoteFrame) | Signature seeded **inline** in body |
| Action bar | Send · Send later · ✦ · `{}` · 📎 · 🗑 · hint | Send · 📎 Attach · Discard |
| Field focus (Ctrl+Shift+O/C/B/S) | Yes | No |

Both already share `useComposeController` (send/autosave/attach), `ComposeEditor`,
`RecipientInput`, and `QuoteFrame`. The duplication lives in the **AI bar**
(`AiBar` vs `DockAiBar`, near-identical), the **attachment chips**, the **field
rows**, and the **action bar**.

## Decisions (locked with the user)

1. **Refactor depth → Extract a shared shell.** Pull the recipient block, quote
   trailer, attachment chips, AI bar, and action bar into shared pieces used by
   *both* the modal and the dock. The modal keeps its centered-card chrome.
2. **Signature in new compose → Keep inline in the body.** Unlike the dock (which
   hides signature + quote behind the `•••`), the new-message composer keeps the
   signature seeded visibly/editable in the body, as it is today. The modal has no
   quoted history (it is always `mode: "new"`), so it renders **no `•••` trailer**.
3. **Unbacked Superhuman items → Wire what exists, omit the rest.** Include Send,
   Send later, ✦ AI, `{}` snippets, 📎 attach, 🗑 discard (all backed). **Omit**
   Remind me, Share draft, the ↑↓ multi-draft stack nav, and minimize-to-pill — no
   dead buttons.

## Architecture — shared shell

The modal is only ever `mode: "new"` (App gates it; replies/forwards route to the
dock in ThreadView), so `layout`, not `mode`, drives the chrome differences.

```
Compose.tsx (modal chrome)          ReplyDock.tsx (inline chrome)
  backdrop + centered card            zb-fade-in inline wrapper
  header "New Message"                (no header)
      └── <ComposeShell layout="modal"/>     └── <ComposeShell layout="dock"/>

ComposeShell.tsx  (shared inner stack, parameterized by layout)
  ├── RecipientFields        (collapsible To/Cc/Bcc/Subject + focus events)
  ├── ComposeEditor          (selection-bubble WYSIWYG; layout drives sizing)
  ├── QuoteFrame trailer      (only when compose.quote is non-empty → dock only)
  ├── AttachmentChips
  ├── ComposeAiBar           (Ctrl+J draft bar; preserveSignature prop)
  └── ComposeActionBar       (Send · Send later · ✦ · {} · 📎 · 🗑 · hint)
```

### New / changed units

- **`ComposeShell.tsx` (new).** Owns the shared inner layout and the
  `editor`/`aiBarOpen` wiring currently duplicated in both files. Prop:
  `layout: "modal" | "dock"`. Renders the quote trailer only when
  `compose.quote.trim()` is non-empty (empty for the modal, so it never shows).

- **`RecipientFields.tsx` (new).** Absorbs the dock's `FieldRow`, `summarize`,
  `expanded`/`focusField` state, and the `fission:compose-field` listener. One
  prop selects the collapse behavior:
  - `collapse="summary"` (**dock**): pre-filled recipients collapse to a one-line
    summary button (`To …  Cc …`); click/Ctrl+Shift+O expands all four rows.
  - `collapse="cc-bcc"` (**modal**): To + Subject always visible (Superhuman
    default); a chevron on the To row reveals Cc/Bcc between them. To is
    auto-focused on open (new message starts at the recipient).
  Tab order stays To → Cc → Bcc → Subject → body in both modes.

- **`ComposeAiBar.tsx` (new).** Merge of `AiBar` + `DockAiBar`. They differ only
  in signature handling, so add `preserveSignature: boolean`:
  - `true` (**modal**): drafts from the message only and re-appends the seeded
    signature (today's `splitBodySignature` logic).
  - `false` (**dock**): drafts straight into the message (signature lives outside
    the editor).

- **`AttachmentChips.tsx` (new).** The chips + remove-button block, lifted
  verbatim (identical in both files today).

- **`ComposeActionBar.tsx` (new).** `Send · Send later · ⟨spacer⟩ · ✦ · {} · 📎 ·
  🗑 · ⌘↵ hint` — the dock's bar, now shared. Matches Superhuman's layout (text
  actions left, icon actions right). This replaces the modal's bare bar.

- **`ComposeEditor.tsx` (changed).** Drop the persistent-toolbar branch entirely —
  neither Superhuman surface shows one. The editor **always** uses the
  `SelectionBubble` and includes `TextStyle`+`Color`. Replace the `variant` prop
  with `layout: "modal" | "dock"` controlling only sizing: modal → `flex-1
  overflow-y-auto` (fills the card, scrolls); dock → `min-h-[84px]` auto-grow.
  `onArrowDownAtEnd` stays optional (dock passes it for the `•••` handoff; modal
  omits it). `LinkBar`, `SuggestionBar`, Harper, and paste-sanitize are unchanged.

- **`Compose.tsx` (rewritten to chrome only).** Backdrop + `zb-pop-in` centered
  card (slightly wider/airier: ~`w-[820px]`, roomier row padding, softer
  dividers to match the screenshots) + header "New Message". Header keeps the
  title only — **omit** the ↑↓ nav and minimize icon. Keyboard hints move to
  button tooltips + the existing footer shortcut bar (cleaner header, matches
  Superhuman). Body = `<ComposeShell layout="modal"/>`.

- **`ReplyDock.tsx` (slimmed).** Keeps its inline wrapper + scroll-into-view
  effect; body becomes `<ComposeShell layout="dock"/>`. Net: it loses the code now
  living in the shared units but behaves identically.

## Behavior details

- **Recipients (modal):** open → To focused, Subject visible, Cc/Bcc hidden behind
  a chevron. Typing a recipient uses the existing `RecipientInput` autocomplete
  (contacts from synced mail). Bcc becomes reachable for the first time in new
  compose.
- **Signature (modal):** unchanged — `compose.body` is seeded `<p></p>{signature}`;
  the editor shows it inline and it is editable. Nothing appended at send. AI
  drafts preserve it via `preserveSignature`.
- **Formatting:** selection bubble (B / I / U / link / color / lists / quote) on
  highlight; Ctrl+B/I/U and Ctrl+K keyboard paths unchanged.
- **Action bar:** Send fires `fission:send`; Send later opens the `sendLater`
  picker; ✦ toggles the AI bar (also Ctrl+J); `{}` opens the snippet picker; 📎
  opens the file dialog; 🗑 deletes the draft and closes. All already backed.
- **Send / autosave / attachments:** untouched — still `useComposeController`.
  `outgoingFromCompose`, the 10s Undo-Send fuse, and draft autosave are unchanged.

## Explicitly omitted (no backend)

Remind me · Share draft · ↑↓ multi-draft stack (compose state is singular) ·
minimize-to-pill window. Not rendered — avoids dead controls.

## Files touched

- **New:** `ComposeShell.tsx`, `RecipientFields.tsx`, `ComposeAiBar.tsx`,
  `AttachmentChips.tsx`, `ComposeActionBar.tsx`
- **Changed:** `Compose.tsx` (→ chrome only), `ReplyDock.tsx` (→ chrome only),
  `ComposeEditor.tsx` (drop toolbar, `variant`→`layout`)
- **Unchanged:** `useComposeController.ts`, `RecipientInput.tsx`, `QuoteFrame.tsx`,
  `SelectionBubble.tsx`, `harper.ts`, `stores/ui.ts`, `lib/commands.ts`,
  `App.tsx` (still gates modal to `mode === "new"`), send path
- **CSS:** minor additions in `styles/theme.css` for the airier modal card /
  recipient rows if the existing tokens don't cover it

## Data flow (unchanged)

`compose` store shape, `startCompose`, `outgoingFromCompose`, draft autosave, the
`fission:send` / `fission:compose-field` events, and the mock/Rust IPC seam are all
untouched. This is a **presentational refactor** — no store or backend changes.

## Verification (no unit-test harness in repo)

1. `npm run build` — `tsc --noEmit` typecheck + vite build must stay clean.
2. `npm run dev` (mock backend) — behavioral checks:
   - Press **C** → centered card, "New Message", To focused, Cc/Bcc collapsed.
   - Chevron reveals Cc/Bcc; Tab walks To→Cc→Bcc→Subject→body.
   - Highlight text → selection bubble; no persistent toolbar.
   - Signature visible/editable inline; no `•••` trailer.
   - Action bar: Send · Send later · ✦ · {} · 📎 · 🗑 all work; Ctrl+J opens AI bar.
   - Attach a file → chip appears/removes; Send → Undo-Send toast.
   - **Regression:** open a thread, **R** → reply dock still collapses recipients,
     shows `•••` signature+quote, sends correctly.
3. Walk the relevant rows of `docs/SHORTCUTS.md` on Windows.

## Risks

- **Editor `variant`→`layout` change** touches the one file both composers share —
  the dock regression check above is the guard.
- **RecipientFields two collapse modes** is the only genuinely new logic; keep the
  focus/Tab/`fission:compose-field` behavior identical to today's dock.
- Low overall: no data-model or send-path changes.
