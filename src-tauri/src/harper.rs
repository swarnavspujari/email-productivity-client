//! Local spell/grammar checking for the compose body via harper-core —
//! fully offline, nothing leaves the machine. The curated linter is built
//! once (dictionary load is the expensive part) and reused.
use harper_core::linting::{LintGroup, Linter, Suggestion};
use harper_core::spell::FstDictionary;
use harper_core::{Dialect, Document};
use serde::Serialize;
use std::sync::{Mutex, OnceLock};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LintSpan {
    pub start: usize,
    pub end: usize,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LintHit {
    /// UTF-16 code-unit offsets, directly usable against a JS string.
    pub span: LintSpan,
    pub message: String,
    /// Replacement texts; an empty string means "delete the span".
    pub suggestions: Vec<String>,
}

fn linter() -> &'static Mutex<LintGroup> {
    static LINTER: OnceLock<Mutex<LintGroup>> = OnceLock::new();
    LINTER.get_or_init(|| {
        Mutex::new(LintGroup::new_curated(FstDictionary::curated(), Dialect::American))
    })
}

pub fn lint(text: &str) -> Vec<LintHit> {
    let document = Document::new_plain_english_curated(text);
    let lints = linter().lock().unwrap().lint(&document);

    // Harper spans are char-indexed; JS wants UTF-16 code units.
    let mut utf16_at = Vec::with_capacity(text.chars().count() + 1);
    let mut acc = 0usize;
    utf16_at.push(0);
    for c in text.chars() {
        acc += c.len_utf16();
        utf16_at.push(acc);
    }
    let at = |i: usize| *utf16_at.get(i).unwrap_or(&acc);

    lints
        .iter()
        .take(100)
        .map(|l| LintHit {
            span: LintSpan { start: at(l.span.start), end: at(l.span.end) },
            message: l.message.clone(),
            suggestions: l
                .suggestions
                .iter()
                .filter_map(|s| match s {
                    Suggestion::ReplaceWith(cs) => Some(cs.iter().collect::<String>()),
                    Suggestion::Remove => Some(String::new()),
                    Suggestion::InsertAfter(_) => None,
                })
                .take(5)
                .collect(),
        })
        .collect()
}
