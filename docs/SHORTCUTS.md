# Keyboard Shortcuts

`mod` = `Ctrl` on Windows, `⌘` on macOS. Everything below is remappable in **Settings → Shortcuts** (formats: `e`, `mod+k`, `g i` chords, `j|down` alternatives). Every action is also in the `Ctrl+K` palette with its hint.

## Global

| Key | Action |
|---|---|
| `Ctrl+K` | Command palette (toggle) |
| `C` | Compose new email |
| `/` | Search |
| `Esc` | Back / close (palette → picker → AI bar → compose → thread → screen) |
| `Ctrl+,` | Settings |
| `G` then `I` | Go to Inbox |
| `G` then `E` | Go to Done |
| `G` then `H` | Go to Reminders |

## List & thread

| Key | Action |
|---|---|
| `J` / `↓` | Next conversation (follows into the open thread) |
| `K` / `↑` | Previous conversation |
| `Enter` | Open thread (in list) / Reply-all (in thread) |
| `E` | Mark Done (archive) |
| `H` | Remind me / snooze… |
| `R` | Reply (inserts the previewed Instant Reply if one is selected) |
| `F` | Forward |
| `U` | Mark unread |
| `V` | Move to folder / label… |
| `Tab` | Next split inbox (in list) · preview next Instant Reply (in thread) |
| `Shift+Tab` | Previous split inbox |
| `?` | Ask AI about this thread |

## Compose

| Key | Action |
|---|---|
| `Ctrl+J` | Write with AI (empty body: draft from prompt · existing text: edit with instruction) |
| `Ctrl+Enter` | Send |
| `Esc` | Close AI bar, then discard |

## Palette-only

- **Get Me To Zero (bulk archive)…** — sweeps the active split with keep-unread/keep-starred options
- **Sync Now**
- **Reply All** (also `Enter` in thread)

---

# Smoke-test checklist (run on Windows after each phase)

Launch `npm run app:dev`, then:

1. [ ] App opens dark, inbox lists threads, split tabs show **total** counts
2. [ ] `Ctrl+K` opens palette; typing filters; `Esc` closes; every row shows its key hint
3. [ ] `J`/`K` move selection; `Enter` opens; `Esc` returns
4. [ ] `E` archives (count drops, toast); thread appears under `G`,`E` (Done)
5. [ ] `H` → "In 30 seconds (demo)"; thread appears in Reminders (`G`,`H`) and returns to inbox ~30s later, unread
6. [ ] `Tab`/`Shift+Tab` cycle splits; Calendar split contains the invite threads
7. [ ] Settings → Splits → create a custom split (e.g. `from` contains `substack`) — a new tab appears with matching threads
8. [ ] `R` opens reply with quoted context; `Ctrl+Enter` sends (mock: appears in thread; Gmail: actually sends)
9. [ ] `C` → `Ctrl+J` → instruction → draft **streams** in; with text present `Ctrl+J` edits it
10. [ ] Open a thread → up to 3 Instant Replies; `Tab` previews; `R` inserts
11. [ ] `?` on a thread → ask a question → streamed answer
12. [ ] Archive a split to zero → full-screen celebration + streak; any key dismisses
13. [ ] Palette → "Get Me To Zero" → options work; count toast shown
14. [ ] `/` search finds body text instantly; `Enter` opens the hit
15. [ ] Settings → AI Providers → key saved (Credential Manager) → **Test connection** OK for each configured provider
16. [ ] Settings → Knowledge Base → add "always sign off with 'Cheers, S'" → next AI draft complies
17. [ ] Settings → Shortcuts → remap Compose to `n` → `n` composes, `c` doesn't
