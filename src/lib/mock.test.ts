// @vitest-environment happy-dom
import { beforeEach, describe, expect, test } from "vitest";
import { MockBackend } from "./mock";

// The contact panel's mail history: threads a person was actually ON (a
// sender or recipient), never every message that merely mentions them.
describe("MockBackend.threadsWithContact", () => {
  beforeEach(() => localStorage.clear());

  test("lists every thread the address is a participant in, newest first", async () => {
    const be = new MockBackend();
    // Priya sent the board-deck draft (recent) and an archived memo (older).
    const hits = await be.threadsWithContact("priya@fissionventures.com");
    expect(hits.map((h) => h.threadId)).toEqual(["t-board-deck", "t-done-memo"]);
  });

  test("matches the address columns, not the message body", async () => {
    const be = new MockBackend();
    // Maya sent the term-sheet thread. Her address ALSO appears in the body of
    // the board-meeting invitation ("Organizer: maya@heliosrobotics.io") — the
    // old first-name FTS surfaced that; an address-scoped query must not.
    const hits = await be.threadsWithContact("maya@heliosrobotics.io");
    expect(hits.map((h) => h.threadId)).toEqual(["t-term-sheet"]);
  });

  test("a contact with no other mail returns nothing (no full-text noise)", async () => {
    const be = new MockBackend();
    expect(await be.threadsWithContact("stranger@example.com")).toEqual([]);
  });
});
