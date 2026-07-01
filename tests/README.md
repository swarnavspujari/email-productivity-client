# Tests

P0 verification is behavioral, executed on the target OS:

- **[DEMO.md](../DEMO.md)** — the <10-minute acceptance script covering every Definition-of-Done item.
- **[docs/SHORTCUTS.md](../docs/SHORTCUTS.md)** — the 17-point smoke-test checklist walked on Windows after each phase.
- The browser build (`npm run dev`) runs the complete UI against the mock backend (`src/lib/mock.ts`), which is the same fixture dataset the Rust core seeds in demo mode — keyboard flows are scriptable against it (see the keyboard walkthroughs used during development).

Unit/integration suites are a P1 item; candidates in order of value: split-assignment rules (TS+Rust parity), the keyboard token/chord parser, MIME body extraction, and the context-assembler budget truncation.
