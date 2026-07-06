# Keyboard Shortcuts

Aligned with **Superhuman v7 (Windows & Linux edition)**. `mod` = `Ctrl` on Windows/Linux, `⌘` on macOS. Everything is remappable in **Settings → Shortcuts** (formats: `e`, `mod+k`, `shift+e`, `g i` chords, `j|down` alternatives) and every action is in the `Ctrl+K` palette with its hint.

## Global

| Key | Action |
|---|---|
| `Ctrl+K` | Command palette (toggle) |
| `C` | Compose new email |
| `/` | Search |
| `Alt+1` … `Alt+9` | **Switch account** (slot = order in Settings → Account; reorder to reassign) |
| `Esc` | Back / close (palette → picker → AI bar → compose → thread → screen) |
| `Ctrl+,` | Settings |

## Go to (chords)

| Key | Action | Key | Action |
|---|---|---|---|
| `G` then `I` | Inbox / Important | `G` then `E` | Done |
| `G` then `O` | Other | `G` then `H` | Reminders |
| `G` then `S` | Starred | `G` then `D` | Drafts (resume unsent) |
| `G` then `T` | Trash | `G` then `C` | Calendar (week view) |

## Triage

| Key | Action |
|---|---|
| `E` | Mark Done (archive) |
| `Shift+E` | Mark Not Done (back to inbox — in Done/Reminders; **restores** from Trash) |
| `H` | Remind me / snooze… |
| `S` | Star / unstar |
| `#` / `Delete` / `Backspace` | Trash — browsable under `G`,`T`, synced two-way with Gmail |
| `!` | Mark spam |
| `M` | Mute — archive now and auto-archive future replies |
| `Z` (or `Ctrl+Z`) | **Undo** the last action (done, trash, spam, mute, snooze, star, send — bulk sweeps undo as one) |
| `U` | Mark read / unread (toggle) |
| `V` | Move to folder / label… (applies to the whole selection) |
| `Ctrl+U` | Unsubscribe (opens the newsletter's List-Unsubscribe link) |
| `Ctrl+A` | **Select** the cursor row and everything below it (bulk bar appears) |
| `X` | Select / deselect the cursor row |

## Conversations

| Key | Action |
|---|---|
| `J`, `K` | Next / previous conversation — works in the list **and** while reading (advances and opens the next thread, Superhuman-style) |
| `↑` / `↓` | In the list: move the cursor. In a thread: scroll the open email a step |
| `Space` / `Shift+Space` | Page the open email down / up |
| `Enter` | Open thread (in list) / **Reply-all inline** (in thread — docks the composer at the bottom, To populated, cursor in the body) |
| `R` | Reply (inserts the previewed Instant Reply if one is selected) |
| `A` | Reply all |
| `F` | Forward |
| `Tab` | Next split (in list) · preview next Instant Reply (in thread) |
| `Shift+Tab` | Previous split |
| `?` | Ask AI about this thread |

## Calendar

| Key | Action |
|---|---|
| `←` / `→` | Previous / next day — when the calendar has focus (the week view, or the day panel after opening/clicking it; clicking back into the list releases the keys) |
| `G` then `C` | Open the week view (`Esc` returns to mail) |

## Compose

| Key | Action |
|---|---|
| `Ctrl+B` / `Ctrl+I` / `Ctrl+U` | **Bold** / *italic* / underline |
| `Ctrl+K` | Insert / edit a link on the selection |
| `Ctrl+Shift+8` / `Ctrl+Shift+7` | Bullet list / numbered list |
| `Ctrl+Shift+O` / `C` / `B` / `S` | Reply dock: reveal + focus **To** / **Cc** / **Bcc** / **Subject** (then `Tab` walks To→Cc→Bcc→Subject→body) |
| `Ctrl+J` | Write with AI (empty body: draft from prompt · existing text: edit with instruction) |
| `Ctrl+Enter` | Send — **with a 10-second Undo window (`Z`)** |
| `Ctrl+Shift+Enter` | Send & Mark Done |
| `Ctrl+Shift+L` | Send Later… (delivers even after an app restart) |
| `Ctrl+;` | Insert snippet (from Settings → Knowledge Base) |
| `Esc` | Close AI bar, then close compose — **the draft is saved automatically** (`G`,`D` resumes; Discard deletes) |

Rich text: the compose body is a full **WYSIWYG editor** — the keys above and rich paste (sanitized). The message is sent as HTML with a plain-text fallback.

Replying: `R`/`A`/`F` (or `Enter` in a thread) thread the composer **inline into the conversation**, at the same width as the email above it. Recipients collapse to a one-line summary (`Ctrl+Shift+O/C/B/S` to edit a field). Select text in your message to get a floating **formatting bubble** (bold, italic, underline, link, text color, bulleted/numbered list, block quote). Your **signature and the quoted email** are tucked behind a subtle `•••` and both **render faithfully AND stay editable** (real email HTML — tables, images, layout — in a sandboxed frame) — press `↓` to focus the `•••` then `Enter`, or click it, then edit in place; `Ctrl+Enter` still sends and `Esc` collapses it. They're appended to the message on send. New-message compose (`C`) opens as a centered window with a persistent toolbar.

Attachments: **📎 Attach** in compose (25 MB total). In the reading pane, click an attachment to open it, `⭳` to save. HTML mail renders sanitized (scripts stripped) with quoted trails collapsed behind `•••`.

Spelling & grammar: the compose body is checked locally by **Harper** (nothing leaves the machine). Misspellings get a wavy underline that follows your edits — put the caret in one to see suggestions, click one to apply, `×` to ignore.

Recipients: start typing a name or email in **To**/**Cc** and the closest contacts you've corresponded with drop down (ranked by frequency + recency). `↓`/`↑` move, `Enter`/`Tab` or a click fills in `Name <email>`, `Esc` closes the dropdown. Contacts are derived locally from your synced mail — no extra Google permission.

## Palette-only

- **Get Me To Zero (bulk archive)…** · **Sync Now** · **Toggle Folder Sidebar** · **Toggle Calendar Panel** · **Switch to <account>** (also Alt+N)

Superhuman keys not yet mapped (their features land in later releases): `G-T` sent view (our `G`,`T` is Trash).

---

# Smoke-test checklist (run on Windows after each phase)

Launch `npm run app:dev`, then:

0. [ ] First run: the welcome flow appears (connect / demo → AI key → theme → tour); finishing it lands in the inbox and it stays gone after a restart
1. [ ] App opens dark, inbox lists threads, split tabs show **total** counts
2. [ ] `Ctrl+K` opens palette; typing filters; `Esc` closes; every row shows its key hint
3. [ ] `J`/`K` move selection; `Enter` opens; `Esc` returns
4. [ ] `E` archives (count drops, toast); thread appears under `G`,`E` (Done); `Shift+E` there returns it
5. [ ] `H` → "In 30 seconds (demo)"; thread appears in Reminders (`G`,`H`) and returns to inbox ~30s later, unread
6. [ ] `S` stars/unstars; `#` trashes; `U` toggles read state
7. [ ] `Tab`/`Shift+Tab` cycle splits; `G`,`O` jumps to Other; the **Calendar button** (top right) toggles the day panel with events
8. [ ] **`Alt+2` switches to the second account (angel@ in demo); `Alt+1` back; header dropdown matches**
9. [ ] Settings → Splits → create a custom split — a new tab appears with matching threads
10. [ ] `R`/`A`/`F` (or `Enter` in a thread) dock the composer **inline** at the thread bottom, recipients correct, cursor in the body; `Ctrl+Enter` sends; `Ctrl+Shift+Enter` sends & archives
11. [ ] Settings → Account → set a signature → compose shows it; sent mail includes it
12. [ ] `C` → `Ctrl+J` → instruction → draft **streams** in; with text present `Ctrl+J` edits it
13. [ ] Open a thread → up to 3 Instant Replies; `Tab` previews; `R` inserts
14. [ ] `?` on a thread → ask a question → streamed answer
15. [ ] Archive a split to zero → celebration + streak; palette → "Get Me To Zero" works
16. [ ] `/` search finds body text instantly; `Enter` opens the hit
17. [ ] Settings → AI Providers → **Test connection** OK for each configured provider
18. [ ] Settings → Knowledge Base → add an instruction → next AI draft complies
19. [ ] Settings → Shortcuts → remap Compose to `n` → `n` composes, `c` doesn't
20. [ ] The StrictlyVC newsletter (Other) renders as rich HTML on the theme's raised card (navy in dark, white in light) — table, links, no layout blowout; `•••` toggles quoted trails on threads that have them
21. [ ] A 2+ message thread collapses older messages to one-line rows (click expands); attachment chips **open** and **save**; compose 📎 attaches a file that arrives on send
22. [ ] Compose → type → `Esc` → "Draft saved"; `G`,`D` lists it; `Enter` resumes it; Discard deletes it
23. [ ] Open a thread → `↑`/`↓` and `Space`/`Shift+Space` scroll the open email; `J`/`K` change conversation; `Esc` returns to the list
24. [ ] `Ctrl+A` selects from the cursor down (bulk bar shows the count, browser select-all suppressed); `E` archives them all with one toast; a single `Z` restores every one
25. [ ] `Delete` trashes; `G`,`T` shows the Trash view; `Shift+E` there restores; Gmail-side trashing appears in Trash after the next reconcile
26. [ ] ☰ opens the folder sidebar — real Gmail label **names** (not `Label_…` ids); clicking a label filters the list to it
27. [ ] Open the calendar panel (▦) → events paint instantly on reopen; `←`/`→` change days while the panel is focused and stop after clicking the list; `G`,`C` opens the week view with a now-line on today
28. [ ] Empty a split → the rest state shows the daily photo with "Photo by … on Unsplash" attribution (built-in key; Settings → Appearance accepts your own)
29. [ ] Compose → type "recieve" → wavy underline appears; caret inside it → suggestion chips; clicking "receive" fixes the word
30. [ ] Toggle light theme → whole app retints (warm off-white), the palette stays dark, HTML mail re-renders on light tokens
31. [ ] Compose → type a name/email fragment in To (e.g. "maya") → a contact dropdown appears; ↓/Enter or click fills "Maya Chen <maya@…>, "; a second fragment suggests without clobbering the first
32. [ ] In a thread hit `Enter` → the composer docks inline (recipients summarized on one line, cursor in the body); `Ctrl+Shift+B` reveals + focuses Bcc, `Tab` walks the fields into the body; select text → the formatting bubble (bold/color/lists/quote) applies; `↓` then `Enter` expands the `•••` to reveal the signature + quoted email, which **render faithfully and are editable** (rich HTML — verify a table/image-heavy newsletter keeps its layout, then edit a word inside it and confirm the edit is in the sent message); `Esc` on an untouched reply leaves **no** junk draft
