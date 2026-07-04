// Harper spell/grammar checking as a ProseMirror decoration plugin.
//
// The backend `lint_text(text)` command lints PLAIN text and returns UTF-16
// spans. A rich editor has no single plain string, so on a debounced doc
// change we project the doc to plain text while recording a position map
// (plain-text offset -> ProseMirror doc position), lint it, then translate
// Harper's spans back into inline decorations. ProseMirror maps the decoration
// set through every subsequent transaction, so underlines follow edits for
// free (which a textarea backdrop could never do). Fixes apply as ordinary
// transactions; each finding can be dismissed individually.
import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";
import type { LintHit } from "@/lib/types";

/** A Harper finding, positioned in ProseMirror doc coordinates. */
export interface HarperFinding {
  /** Stable identity across re-lints: flagged text + message. */
  id: string;
  from: number;
  to: number;
  message: string;
  suggestions: string[];
}

interface HarperPluginState {
  findings: HarperFinding[];
  decorations: DecorationSet;
  /** Doc ranges the user chose to ignore. Rebased through edits (like the
   *  findings) so an ignore sticks to that one occurrence and a re-lint doesn't
   *  resurrect it — while a fresh occurrence elsewhere is still flagged. */
  dismissed: { from: number; to: number }[];
}

type HarperMeta =
  | { type: "set"; findings: HarperFinding[] }
  | { type: "dismiss"; from: number; to: number };

/** Two doc ranges overlap (used to match a finding to a dismissed range). */
function overlaps(a: { from: number; to: number }, b: { from: number; to: number }): boolean {
  return a.from < b.to && b.from < a.to;
}

export const harperKey = new PluginKey<HarperPluginState>("harper");

export interface HarperOptions {
  /** Injected so the browser demo can use the mock linter. */
  lint: (text: string) => Promise<LintHit[]>;
  debounceMs: number;
}

/**
 * Flatten the doc to plain text and build `posAt`, where `posAt[i]` is the doc
 * position of the character at text offset `i` (with a trailing sentinel for
 * `i == text.length`). Block boundaries and hard breaks become "\n" so Harper
 * sees word/sentence boundaries; those separators map to the boundary position
 * but never anchor a real finding. ProseMirror text offsets are UTF-16 code
 * units — exactly what Harper returns — so no re-encoding is needed.
 */
function projectDoc(doc: PMNode): { text: string; posAt: number[] } {
  let text = "";
  const posAt: number[] = [];
  let sawBlock = false;
  doc.descendants((node, pos) => {
    if (node.isText) {
      const s = node.text ?? "";
      for (let i = 0; i < s.length; i++) posAt.push(pos + i);
      text += s;
      return false;
    }
    if (node.type.name === "hardBreak") {
      posAt.push(pos);
      text += "\n";
      return false;
    }
    if (node.isTextblock) {
      if (sawBlock) {
        posAt.push(pos);
        text += "\n";
      }
      sawBlock = true;
    }
    return true;
  });
  posAt.push(doc.content.size);
  return { text, posAt };
}

/** Translate Harper's plain-text spans into doc-positioned findings. */
function mapHits(hits: LintHit[], text: string, posAt: number[]): HarperFinding[] {
  const out: HarperFinding[] = [];
  const len = text.length;
  for (const h of hits) {
    let s = Math.max(0, Math.min(h.span.start, len));
    let e = Math.max(s, Math.min(h.span.end, len));
    // Never let a span's edge rest on an injected block/hard-break separator:
    // posAt for a "\n" is the *next* block's boundary, so anchoring there would
    // spill the decoration — and any applied fix — into the following block.
    while (s < e && text[s] === "\n") s++;
    while (e > s && text[e - 1] === "\n") e--;
    if (e <= s) continue;
    const from = posAt[s];
    // Anchor `to` just after the last flagged character (always a real char now).
    const to = posAt[e - 1] + 1;
    if (from == null || to == null || to <= from) continue;
    out.push({
      id: `${text.slice(s, e)}|${h.message}`,
      from,
      to,
      message: h.message,
      suggestions: h.suggestions,
    });
  }
  return out;
}

function buildDecorations(doc: PMNode, findings: HarperFinding[]): DecorationSet {
  return DecorationSet.create(
    doc,
    findings.map((f) => Decoration.inline(f.from, f.to, { class: "fm-lint" }))
  );
}

export const Harper = Extension.create<HarperOptions>({
  name: "harper",

  addOptions() {
    return { lint: async () => [], debounceMs: 350 };
  },

  addProseMirrorPlugins() {
    const { lint, debounceMs } = this.options;
    return [
      new Plugin<HarperPluginState>({
        key: harperKey,
        state: {
          init: () => ({
            findings: [],
            decorations: DecorationSet.empty,
            dismissed: [],
          }),
          apply(tr, value, _oldState, newState) {
            let { findings, decorations, dismissed } = value;
            // Rebase existing findings + decorations + ignored ranges through
            // document edits so underlines (and dismissals) track the text.
            if (tr.docChanged) {
              decorations = decorations.map(tr.mapping, tr.doc);
              findings = findings
                .map((f) => ({
                  ...f,
                  from: tr.mapping.map(f.from, 1),
                  to: tr.mapping.map(f.to, -1),
                }))
                .filter((f) => f.to > f.from);
              dismissed = dismissed
                .map((d) => ({
                  from: tr.mapping.map(d.from, 1),
                  to: tr.mapping.map(d.to, -1),
                }))
                .filter((d) => d.to > d.from);
            }
            const meta = tr.getMeta(harperKey) as HarperMeta | undefined;
            if (meta?.type === "set") {
              findings = meta.findings.filter(
                (f) => !dismissed.some((d) => overlaps(f, d))
              );
              decorations = buildDecorations(newState.doc, findings);
            } else if (meta?.type === "dismiss") {
              dismissed = [...dismissed, { from: meta.from, to: meta.to }];
              findings = findings.filter((f) => !(f.from === meta.from && f.to === meta.to));
              decorations = buildDecorations(newState.doc, findings);
            }
            return { findings, decorations, dismissed };
          },
        },
        props: {
          decorations(state) {
            return harperKey.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
        view(view) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          // Bumped on every schedule/run/destroy so a stale async lint result
          // (or one whose doc has since changed) is dropped.
          let token = 0;
          const run = () => {
            const doc = view.state.doc;
            const { text, posAt } = projectDoc(doc);
            const id = ++token;
            if (!text.trim()) {
              view.dispatch(view.state.tr.setMeta(harperKey, { type: "set", findings: [] }));
              return;
            }
            lint(text)
              .then((hits) => {
                if (id !== token) return; // superseded by a newer run
                if (!view.state.doc.eq(doc)) return; // doc changed; a re-run is queued
                const findings = mapHits(hits, text, posAt);
                view.dispatch(view.state.tr.setMeta(harperKey, { type: "set", findings }));
              })
              .catch(() => {});
          };
          const schedule = () => {
            token++; // invalidate any in-flight lint
            clearTimeout(timer);
            timer = setTimeout(run, debounceMs);
          };
          schedule(); // lint seeded content (e.g. the signature) once on mount
          return {
            update(v, prevState) {
              if (!v.state.doc.eq(prevState.doc)) schedule();
            },
            destroy() {
              token++;
              clearTimeout(timer);
            },
          };
        },
      }),
    ];
  },
});

/** Findings currently mapped into the live document. */
export function harperFindings(state: EditorState): HarperFinding[] {
  return harperKey.getState(state)?.findings ?? [];
}

/** The finding under the collapsed caret, if any (drives the suggestion bar). */
export function activeHarperFinding(state: EditorState): HarperFinding | null {
  const sel = state.selection;
  if (!sel.empty) return null;
  const pos = sel.from;
  return harperFindings(state).find((f) => pos >= f.from && pos <= f.to) ?? null;
}

/** Ignore this one occurrence (by its current doc range, which then rebases
 *  through later edits so it stays ignored — but a fresh occurrence elsewhere
 *  is flagged again). */
export function dismissHarperFinding(view: EditorView, finding: HarperFinding) {
  view.dispatch(
    view.state.tr.setMeta(harperKey, {
      type: "dismiss",
      from: finding.from,
      to: finding.to,
    })
  );
}
