# Search Phase 4 — Semantic / Vector Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fuse semantic (vector) recall into Fission Mail's existing lexical search so "invoice" finds "wire transfer receipt" — entirely on-device, additive, and degrading to exactly today's behavior when the model or embeddings are absent.

**Architecture:** sqlite-vec (statically linked into the existing rusqlite `bundled`) holds one normalized 384-dim embedding per message in a `vec0` table, bookkept by a plain `vec_meta` table. A lazy fastembed (ONNX, quantized bge-small-en-v1.5) embedder fills it from a background beat riding the existing crawl spawn; `store::search_planned`'s term route gains an optional query vector and fuses the bm25 leg with a KNN leg by Reciprocal Rank Fusion. Demo accounts exercise the same vec0/RRF plumbing through a hand-curated concept-group toy embedder (both mocks), so browser and Rust demos show semantic recall without the model runtime.

**Tech Stack:** Rust (Tauri v2), rusqlite 0.32 `bundled` + sqlite-vec 0.1.9, fastembed 5.17.2 (`BGESmallENV15Q`), React/TS mock in `src/lib/mock.ts`.

---

## Step 0 — landscape verification (DONE, 2026-07-09)

Verified from crate sources in the local registry + a web-research pass (docs/README/release notes, HF model cards):

| Fact | Value | Source |
|---|---|---|
| sqlite-vec crate | **0.1.9** stable (0.1.10-alpha.4 exists; alphas add ANN + upsert — not needed) | crates.io, C source inspected |
| Registration | `sqlite3_auto_extension(Some(transmute(sqlite3_vec_init)))` before first `Connection::open`, process-wide, works with `bundled` | crate's own test |
| vec0 in 0.1.9 | `float[384] distance_metric=cosine`, KNN `MATCH ? AND k = ?`, partition/metadata/aux cols, DELETE ok, **no INSERT OR REPLACE** (delete+insert) | C source grep + docs |
| KNN mode | brute-force (fine ≤ ~10⁵ vectors; ANN is alpha-only) | release notes |
| fastembed | **5.17.2**; `TextInitOptions::new(model).with_cache_dir(..).with_show_download_progress(false).with_intra_threads(4)`; `embed(Vec<S>, batch)`; output **L2-normalized**; **no auto query prefix** | crate source inspected |
| Features | `default-features = false, features = ["hf-hub-rustls-tls", "ort-download-binaries-rustls-tls"]` (match project rustls; drop image models) | crate metadata |
| ort linking (Windows) | fastembed pins `ort =2.0.0-rc.12`; pyke binaries **statically linked** since rc.10 → **no onnxruntime.dll to ship**, no tauri.conf resources; ~29 MB build-time download from cdn.pyke.io; **do not set `+crt-static`** (libs are /MD) | ort release notes |
| Model | **bge-small-en-v1.5 quantized** (`BGESmallENV15Q`): 384-dim, ~34 MB on disk, MTEB retrieval 51.7 (vs MiniLM 42.0); queries need prefix `"Represent this sentence for searching relevant passages: "` (passages bare) | HF model cards |
| Cache dir | fastembed default is **relative** `./.fastembed_cache` — must override to app-data `models/` | fastembed docs |
| Newer options | model2vec (faster, worse retrieval), EmbeddingGemma (768-dim, 6× size) — no reason to deviate | sanity check |

**Runtime routing (per the build prompt):** embeddings = local model (default) with an optional `"openai"` remote setting (`text-embedding-3-small`, `dimensions=384` — Anthropic has no embeddings API); NL parse stays on the existing `ai::complete` path, untouched.

---

## File structure

- Modify `src-tauri/Cargo.toml` — add `sqlite-vec`, `fastembed`.
- Modify `src-tauri/src/store/mod.rs` — extension registration in `open()`, `mail_vec`/`vec_meta` migration, `search_planned` qvec param + RRF, delete/heal vector cleanup, `pub mod vec;`.
- Create `src-tauri/src/store/vec.rs` — all sqlite-vec plumbing (blob encode, insert, missing, counts, KNN, model-tag wipe). One responsibility: vectors in SQLite.
- Create `src-tauri/src/embed.rs` — embedder lifecycle: fastembed init, passage/query embedding, model tags, the AppState slot type. One responsibility: producing vectors.
- Modify `src-tauri/src/ai/openai.rs` — `embed()` for the optional remote path (OpenAI-compatible `/embeddings`).
- Modify `src-tauri/src/mail/sync.rs` — `embed_step` (local, closure-driven) + `embed_step_remote` beats next to `crawl_step`.
- Modify `src-tauri/src/lib.rs` — AppState (`db` → `Arc<Mutex<..>>`, `embedder` slot, `data_dir`), embed beat wiring in `spawn_history_crawl`, query vector in `search_all`, demo vector seeding call.
- Modify `src-tauri/src/types.rs` — `Settings.embeddings`.
- Modify `src-tauri/src/mail/mock.rs` — `CONCEPT_GROUPS`, `demo_embed`, `ensure_demo_vectors` + test.
- Modify `src/lib/types.ts`, `src/lib/defaults.ts`, `src/features/settings/SettingsScreen.tsx` — the setting, mirrored.
- Modify `src/lib/mock.ts` — semantic leg + RRF in `searchAll`.
- Modify `docs/DECISIONS.md`, `docs/FOLLOWUP-PROMPTS.md` — record decisions + STATUS.

Task order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8; each compiles + tests green before the next.

---

### Task 1: Dependencies, extension registration, schema

**Files:**
- Modify: `src-tauri/Cargo.toml:28` (after rusqlite)
- Modify: `src-tauri/src/store/mod.rs:7` (`open`), `:62-67` (after mail_fts creation block)

- [ ] **Step 1.1: Add dependencies**

```toml
# statically-linked sqlite extension: vec0 virtual tables for semantic search
sqlite-vec = "0.1.9"
# local sentence embeddings (ONNX, quantized bge-small); rustls to match reqwest
fastembed = { version = "5.17", default-features = false, features = ["hf-hub-rustls-tls", "ort-download-binaries-rustls-tls"] }
```

- [ ] **Step 1.2: Register the extension at the top of `store::open`** (before `Connection::open`; process-global, `Once`-guarded so tests/multi-opens don't re-register):

```rust
pub fn open(path: &std::path::Path) -> Result<Connection, String> {
    // sqlite-vec's vec0 module rides every connection opened after this via
    // SQLite's process-global auto-extension hook. Registered here (not main)
    // so tests that open stores directly get it too.
    static VEC_INIT: std::sync::Once = std::sync::Once::new();
    VEC_INIT.call_once(|| unsafe {
        rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
            sqlite_vec::sqlite3_vec_init as *const (),
        )));
    });
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    ...
```

- [ ] **Step 1.3: Migration block** at the end of `open()` (after the people_contacts block, before `Ok(conn)`), guarded like the other migrations:

```rust
    // Phase 4 (search): semantic vectors. mail_vec holds one normalized
    // 384-dim embedding per message; vec_meta is its plain-table bookkeeping
    // mirror (which message/thread/account a vector belongs to and which
    // model produced it) — a vec0 table can't be LEFT-JOINed efficiently to
    // answer "which messages still need embedding".
    conn.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS mail_vec USING vec0(
             embedding float[384] distance_metric=cosine
         );
         CREATE TABLE IF NOT EXISTS vec_meta (
             vec_rowid INTEGER PRIMARY KEY,
             message_id TEXT NOT NULL UNIQUE,
             thread_id TEXT NOT NULL,
             account_id TEXT NOT NULL,
             model TEXT NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_vec_meta_thread ON vec_meta(thread_id);
         CREATE INDEX IF NOT EXISTS idx_vec_meta_account ON vec_meta(account_id);",
    )
    .map_err(|e| e.to_string())?;
```

- [ ] **Step 1.4: Write the failing test** (store/mod.rs tests module):

```rust
    #[test]
    fn vec0_loads_and_knn_returns_hand_inserted_vector() {
        let conn = open(std::path::Path::new(":memory:")).unwrap();
        let v: String = conn.query_row("SELECT vec_version()", [], |r| r.get(0)).unwrap();
        assert!(v.starts_with('v'));
        let mut a = vec![0f32; 384];
        a[0] = 1.0;
        let mut b = vec![0f32; 384];
        b[1] = 1.0;
        vec::insert(&conn, "m-a", "t-a", ACCT, "test", &a).unwrap();
        vec::insert(&conn, "m-b", "t-b", ACCT, "test", &b).unwrap();
        // query near a: a must come back first with ~0 distance
        let mut q = vec![0f32; 384];
        q[0] = 1.0;
        let hits: Vec<(i64, f64)> = conn
            .prepare("SELECT rowid, distance FROM mail_vec WHERE embedding MATCH ?1 AND k = 2")
            .unwrap()
            .query_map(rusqlite::params![vec::vec_to_blob(&q)], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(hits.len(), 2);
        assert!(hits[0].1 < 0.001 && hits[1].1 > 0.9);
    }
```

(Depends on `vec::insert`/`vec_to_blob` from Task 2 — Tasks 1+2 compile/test together; run `cargo check` after 1.3 to prove the migration itself is valid.)

- [ ] **Step 1.5:** `cargo check` — expected: green (first run downloads ort static libs, slow).

### Task 2: `store::vec` module + delete/heal wiring

**Files:**
- Create: `src-tauri/src/store/vec.rs`
- Modify: `src-tauri/src/store/mod.rs:5` (`pub mod vec;` after the `use` block), `delete_thread` (:1119), healed-body block (:779)

- [ ] **Step 2.1: The module, complete:**

```rust
//! sqlite-vec plumbing: one embedding per message in `mail_vec` (vec0),
//! bookkept by the plain `vec_meta` table. Producers L2-normalize every
//! vector, so vec0's cosine distance ranks like similarity. Writes are
//! DELETE-then-INSERT: stable sqlite-vec (0.1.9) has no upsert.
use rusqlite::{params, Connection};

/// f32 slice → the little-endian blob sqlite-vec binds as a query/row vector.
pub fn vec_to_blob(v: &[f32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(v.len() * 4);
    for f in v {
        out.extend_from_slice(&f.to_le_bytes());
    }
    out
}

pub fn insert(
    conn: &Connection,
    message_id: &str,
    thread_id: &str,
    account_id: &str,
    model: &str,
    embedding: &[f32],
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO vec_meta (message_id, thread_id, account_id, model) VALUES (?1,?2,?3,?4)
         ON CONFLICT(message_id) DO UPDATE SET model = excluded.model",
        params![message_id, thread_id, account_id, model],
    )
    .map_err(|e| e.to_string())?;
    let rowid: i64 = conn
        .query_row("SELECT vec_rowid FROM vec_meta WHERE message_id = ?1", params![message_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM mail_vec WHERE rowid = ?1", params![rowid])
        .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO mail_vec (rowid, embedding) VALUES (?1, ?2)",
        params![rowid, vec_to_blob(embedding)],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Bookkeeping-only row for a message deliberately not embedded (demo text
/// with no concept words) so `missing` stops offering it.
pub fn mark_skipped(
    conn: &Connection,
    message_id: &str,
    thread_id: &str,
    account_id: &str,
    model: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT OR IGNORE INTO vec_meta (message_id, thread_id, account_id, model) VALUES (?1,?2,?3,?4)",
        params![message_id, thread_id, account_id, model],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Messages of `account_id` with no vec_meta row yet — newest first (recent
/// mail is what users search). Text is subject + body clipped to 2000 chars
/// (the model truncates at 512 tokens anyway; the clip keeps tokenization
/// cheap). Hidden (trash/spam) threads are skipped; un-hiding surfaces them
/// here again on a later beat.
pub fn missing(
    conn: &Connection,
    account_id: &str,
    limit: usize,
) -> Result<Vec<(String, String, String)>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT m.id, m.thread_id, substr(m.subject || char(10) || m.body_text, 1, 2000)
             FROM messages m
             JOIN threads t ON t.id = m.thread_id
             LEFT JOIN vec_meta vm ON vm.message_id = m.id
             WHERE t.account_id = ?1 AND t.hidden IS NULL AND vm.message_id IS NULL
             ORDER BY m.date DESC LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![account_id, limit as i64], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

pub fn count_missing(conn: &Connection, account_id: &str) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*)
         FROM messages m
         JOIN threads t ON t.id = m.thread_id
         LEFT JOIN vec_meta vm ON vm.message_id = m.id
         WHERE t.account_id = ?1 AND t.hidden IS NULL AND vm.message_id IS NULL",
        params![account_id],
        |r| r.get(0),
    )
    .map_err(|e| e.to_string())
}

pub fn count_embedded(conn: &Connection, account_id: &str) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM vec_meta WHERE account_id = ?1",
        params![account_id],
        |r| r.get(0),
    )
    .map_err(|e| e.to_string())
}

/// Drop a thread's vectors (thread deleted, or its bodies healed and it must
/// re-embed — the next beat's `missing` pass picks it back up).
pub fn delete_thread_vectors(conn: &Connection, thread_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM mail_vec WHERE rowid IN (SELECT vec_rowid FROM vec_meta WHERE thread_id = ?1)",
        params![thread_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM vec_meta WHERE thread_id = ?1", params![thread_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// mail_vec rows are only comparable to queries embedded by the SAME model.
/// On a tag change (local↔remote flip, model bump) wipe every non-demo
/// vector so the backfill rebuilds; demo fixtures keep their hand vectors.
/// Returns true when a wipe happened.
pub fn ensure_model_tag(conn: &Connection, tag: &str) -> Result<bool, String> {
    let current: Option<String> = super::get_json(conn, "embed_model");
    if current.as_deref() == Some(tag) {
        return Ok(false);
    }
    conn.execute(
        "DELETE FROM mail_vec WHERE rowid IN (SELECT vec_rowid FROM vec_meta WHERE model <> 'demo')",
        [],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM vec_meta WHERE model <> 'demo'", [])
        .map_err(|e| e.to_string())?;
    super::set_json(conn, "embed_model", &tag.to_string())?;
    Ok(true)
}
```

- [ ] **Step 2.2:** In `delete_thread` (store/mod.rs:1119), first line of body: `vec::delete_thread_vectors(conn, id)?;`
- [ ] **Step 2.3:** In `upsert_thread`'s `if any_healed` block (:779), after the FTS rebuild: `vec::delete_thread_vectors(conn, &t.id)?;` with comment `// healed bodies must re-embed too — drop vectors; the embed beat re-adds them`.
- [ ] **Step 2.4: Tests** (store/mod.rs tests): the Task 1.4 test, plus:

```rust
    #[test]
    fn deleting_a_thread_drops_its_vectors_and_missing_finds_unembedded() {
        let conn = open(std::path::Path::new(":memory:")).unwrap();
        seed(&conn, "t-1", "Invoice", "amount due", "Ann", 1_000);
        let missing = vec::missing(&conn, ACCT, 10).unwrap();
        assert_eq!(missing.len(), 1);
        assert_eq!(missing[0].0, "t-1-m1");
        assert!(missing[0].2.starts_with("Invoice\namount due"));
        let mut v = vec![0f32; 384];
        v[3] = 1.0;
        vec::insert(&conn, "t-1-m1", "t-1", ACCT, "test", &v).unwrap();
        assert_eq!(vec::count_missing(&conn, ACCT).unwrap(), 0);
        assert_eq!(vec::count_embedded(&conn, ACCT).unwrap(), 1);
        delete_thread(&conn, "t-1").unwrap();
        assert_eq!(vec::count_embedded(&conn, ACCT).unwrap(), 0);
        let n: i64 = conn.query_row("SELECT COUNT(*) FROM mail_vec", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn model_tag_change_wipes_all_but_demo_vectors() {
        let conn = open(std::path::Path::new(":memory:")).unwrap();
        let v = {
            let mut v = vec![0f32; 384];
            v[0] = 1.0;
            v
        };
        vec::insert(&conn, "m-real", "t-r", ACCT, "local:x", &v).unwrap();
        vec::insert(&conn, "m-demo", "t-d", "demo@fission.local", "demo", &v).unwrap();
        assert!(vec::ensure_model_tag(&conn, "local:y").unwrap());
        assert_eq!(vec::count_embedded(&conn, ACCT).unwrap(), 0);
        assert_eq!(vec::count_embedded(&conn, "demo@fission.local").unwrap(), 1);
        // same tag again: no wipe
        assert!(!vec::ensure_model_tag(&conn, "local:y").unwrap());
    }
```

- [ ] **Step 2.5:** `cargo test -p fission-mail --lib store` — expected: all pass, incl. the Task 1.4 KNN test.
- [ ] **Step 2.6:** Commit `feat(search): sqlite-vec vector store + bookkeeping (phase 4.1)`.

### Task 3: Embedder module, settings field, remote embed

**Files:**
- Create: `src-tauri/src/embed.rs`; register `mod embed;` in `src-tauri/src/lib.rs:3` block
- Modify: `src-tauri/src/types.rs:116` (Settings), `src-tauri/src/store/mod.rs:362` (`default_settings`), `src-tauri/src/ai/openai.rs` (add `embed`), `src/lib/types.ts:120`, `src/lib/defaults.ts:163`, `src/features/settings/SettingsScreen.tsx:523` (new Section)

- [ ] **Step 3.1: `embed.rs`, complete:**

```rust
//! Producing embeddings: a lazy local ONNX model (fastembed, quantized
//! bge-small-en-v1.5) or the optional OpenAI-compatible remote. The local
//! model loads/downloads ONLY from the background embed beat; searches use
//! an already-ready model or skip the semantic leg — a search never blocks
//! on a 34 MB download.
use fastembed::{EmbeddingModel, TextEmbedding, TextInitOptions};
use std::sync::Arc;

pub const DIM: usize = 384;
/// Tags stamp mail_vec rows (kv `embed_model`) — bump LOCAL_TAG when
/// changing EMBED_MODEL so stale vectors are wiped and re-embedded.
pub const LOCAL_TAG: &str = "local:bge-small-en-v1.5-q";
pub const REMOTE_TAG: &str = "openai:text-embedding-3-small-384";
pub const REMOTE_MODEL: &str = "text-embedding-3-small";
const EMBED_MODEL: EmbeddingModel = EmbeddingModel::BGESmallENV15Q;
/// bge-family retrieval instruction — queries only, never passages.
const QUERY_PREFIX: &str = "Represent this sentence for searching relevant passages: ";

/// The AppState slot for the lazy local model.
pub enum Slot {
    Idle,
    Ready(Arc<TextEmbedding>),
    /// Load/download failed at `at_ms`; retried no sooner than +10 min so an
    /// offline machine isn't hammering Hugging Face every 30s beat.
    Failed { at_ms: i64 },
}

pub const RETRY_AFTER_MS: i64 = 10 * 60 * 1000;

/// Blocking: first call downloads ~34 MB into `cache_dir`. Callers run this
/// on a blocking thread, never the async runtime.
pub fn load_local(cache_dir: std::path::PathBuf) -> Result<TextEmbedding, String> {
    TextEmbedding::try_new(
        TextInitOptions::new(EMBED_MODEL)
            .with_cache_dir(cache_dir)
            .with_show_download_progress(false)
            // half a laptop's cores is plenty for 32-doc batches and keeps
            // the background beat from pinning the machine
            .with_intra_threads(4),
    )
    .map_err(|e| e.to_string())
}

/// Blocking. fastembed L2-normalizes, so cosine==L2 ranking downstream.
pub fn embed_passages(m: &TextEmbedding, texts: Vec<String>) -> Result<Vec<Vec<f32>>, String> {
    m.embed(texts, Some(32)).map_err(|e| e.to_string())
}

/// Blocking; one small inference.
pub fn embed_query(m: &TextEmbedding, q: &str) -> Result<Vec<f32>, String> {
    m.embed(vec![format!("{QUERY_PREFIX}{q}")], None)
        .map_err(|e| e.to_string())?
        .pop()
        .ok_or_else(|| "empty embedding".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cos(a: &[f32], b: &[f32]) -> f32 {
        a.iter().zip(b).map(|(x, y)| x * y).sum()
    }

    /// Real model: downloads ~34 MB on first run — run explicitly with
    /// `cargo test -- --ignored embed::` to verify the local runtime E2E.
    #[test]
    #[ignore]
    fn local_model_downloads_and_ranks_synonyms() {
        let dir = std::env::temp_dir().join("fission-embed-test");
        let m = load_local(dir).expect("model load/download");
        let vecs = embed_passages(
            &m,
            vec![
                "Your unpaid invoice is attached, please arrange payment".into(),
                "Wire transfer confirmation: your outgoing wire has been sent".into(),
                "Picnic on Saturday if the weather holds".into(),
            ],
        )
        .unwrap();
        assert_eq!(vecs[0].len(), DIM);
        let q = embed_query(&m, "invoice").unwrap();
        let (inv, wire, picnic) = (cos(&q, &vecs[0]), cos(&q, &vecs[1]), cos(&q, &vecs[2]));
        assert!(inv > picnic && wire > picnic, "inv={inv} wire={wire} picnic={picnic}");
    }
}
```

- [ ] **Step 3.2: Settings (Rust).** types.rs after `drive_share_mode`:

```rust
    /// Semantic-search embeddings: "local" (bundled ONNX model, default) or
    /// "openai" (text-embedding-3-small via the stored OpenAI key —
    /// Anthropic has no embeddings API, so remote is never Claude).
    #[serde(default = "default_embeddings")]
    pub embeddings: String,
```

plus `fn default_embeddings() -> String { "local".into() }` next to the other defaults, and `embeddings: "local".into(),` in `store::default_settings()`.

- [ ] **Step 3.3: `openai::embed`** in ai/openai.rs (mirror `complete`'s error style; check that file's exact reqwest idioms when editing):

```rust
/// OpenAI-compatible /embeddings. `dimensions` matches the mail_vec schema
/// (text-embedding-3-* support Matryoshka truncation server-side).
pub async fn embed(
    http: &reqwest::Client,
    base_url: &str,
    key: &str,
    model: &str,
    texts: &[String],
    dimensions: usize,
) -> Result<Vec<Vec<f32>>, String> {
    let url = format!("{}/embeddings", base_url.trim_end_matches('/'));
    let body = serde_json::json!({ "model": model, "input": texts, "dimensions": dimensions });
    let resp = http
        .post(&url)
        .bearer_auth(key)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = resp.status();
    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("embeddings ({status}): {}", v["error"]["message"].as_str().unwrap_or("?")));
    }
    let mut out: Vec<(i64, Vec<f32>)> = v["data"]
        .as_array()
        .ok_or("no data")?
        .iter()
        .map(|d| {
            let idx = d["index"].as_i64().unwrap_or(0);
            let e: Vec<f32> = d["embedding"]
                .as_array()
                .map(|a| a.iter().filter_map(|x| x.as_f64()).map(|f| f as f32).collect())
                .unwrap_or_default();
            (idx, e)
        })
        .collect();
    out.sort_by_key(|(i, _)| *i);
    // normalize defensively so cosine==L2 holds regardless of provider
    Ok(out
        .into_iter()
        .map(|(_, mut e)| {
            let n = e.iter().map(|x| x * x).sum::<f32>().sqrt();
            if n > 0.0 {
                for x in &mut e {
                    *x /= n;
                }
            }
            e
        })
        .collect())
}
```

- [ ] **Step 3.4: TS mirror.** types.ts `Settings`: `embeddings: "local" | "openai";` with doc comment; defaults.ts: `embeddings: "local",`. SettingsScreen AI tab, new `<Section>` after the providers one (reuse `inputCls`-style classes found in the file):

```tsx
      <Section
        title="Semantic search"
        hint="Vector search finds meaning, not just words ('invoice' matches a wire-transfer receipt). Local keeps mail on-device and works offline; the model (~34 MB) downloads in the background on first use."
      >
        <select
          className={inputCls}
          value={settings.embeddings}
          onChange={(e) =>
            void useSettings.getState().save({
              embeddings: e.target.value as "local" | "openai",
            })
          }
        >
          <option value="local">Local model (private, offline)</option>
          <option value="openai">OpenAI text-embedding-3-small (uses your OpenAI key)</option>
        </select>
      </Section>
```

- [ ] **Step 3.5:** `cargo check` + `npm run build` — expected green (fastembed compiles; TS types flow).
- [ ] **Step 3.6:** Commit `feat(search): embedder module + embeddings setting (phase 4.2a)`.

### Task 4: Background embed beat

**Files:**
- Modify: `src-tauri/src/mail/sync.rs` (after `crawl_step`), `src-tauri/src/lib.rs` (AppState :21-35, setup :3178, `spawn_history_crawl` :1494-1539)

- [ ] **Step 4.1: sync.rs beats** (below the crawl section):

```rust
// ------------------------------------------------------------------ embed
//
// Semantic indexing rides the same background cadence as the crawl: every
// beat embeds a few batches of messages that have no vector yet (newest
// first), so it backfills existing mail AND keeps up with new mail with one
// mechanism. Compute happens on the caller's blocking thread; the DB lock
// is held only around short reads/writes.

pub const EMBED_BATCH: usize = 32;
/// Per-beat wall-clock budget: a beat embeds until this runs out, so a cold
/// 50k-message backfill converges in hours without ever pinning the CPU.
const EMBED_BEAT_BUDGET_MS: u128 = 4_000;

pub struct EmbedBeat {
    pub embedded: usize,
    pub remaining: i64,
}

/// One local-model beat. Blocking (model inference) — call on a blocking
/// thread. `embed` maps texts → normalized vectors (the fastembed closure).
pub fn embed_step(
    db: &std::sync::Mutex<Connection>,
    account_id: &str,
    model_tag: &str,
    embed: &dyn Fn(Vec<String>) -> Result<Vec<Vec<f32>>, String>,
) -> Result<EmbedBeat, String> {
    let start = std::time::Instant::now();
    {
        let conn = db.lock().unwrap();
        store::vec::ensure_model_tag(&conn, model_tag)?;
    }
    let mut embedded = 0usize;
    while start.elapsed().as_millis() < EMBED_BEAT_BUDGET_MS {
        let batch = {
            let conn = db.lock().unwrap();
            store::vec::missing(&conn, account_id, EMBED_BATCH)?
        };
        if batch.is_empty() {
            break;
        }
        let texts: Vec<String> = batch.iter().map(|(_, _, t)| t.clone()).collect();
        let vecs = embed(texts)?;
        let conn = db.lock().unwrap();
        conn.execute_batch("BEGIN IMMEDIATE").map_err(|e| e.to_string())?;
        let write = (|| -> Result<(), String> {
            for ((mid, tid, _), v) in batch.iter().zip(&vecs) {
                store::vec::insert(&conn, mid, tid, account_id, model_tag, v)?;
            }
            Ok(())
        })();
        match write {
            Ok(()) => conn.execute_batch("COMMIT").map_err(|e| e.to_string())?,
            Err(e) => {
                let _ = conn.execute_batch("ROLLBACK");
                return Err(e);
            }
        }
        embedded += vecs.len();
    }
    let remaining = {
        let conn = db.lock().unwrap();
        store::vec::count_missing(&conn, account_id)?
    };
    Ok(EmbedBeat { embedded, remaining })
}

/// The remote flavor (settings.embeddings = "openai"): same loop, awaited
/// HTTP embedding instead of local inference. Kept separate because the
/// closure-driven local path must stay synchronous for spawn_blocking.
pub async fn embed_step_remote(
    http: &reqwest::Client,
    db: &std::sync::Mutex<Connection>,
    account_id: &str,
    base_url: &str,
    key: &str,
) -> Result<EmbedBeat, String> {
    let start = std::time::Instant::now();
    {
        let conn = db.lock().unwrap();
        store::vec::ensure_model_tag(&conn, crate::embed::REMOTE_TAG)?;
    }
    let mut embedded = 0usize;
    while start.elapsed().as_millis() < EMBED_BEAT_BUDGET_MS {
        let batch = {
            let conn = db.lock().unwrap();
            store::vec::missing(&conn, account_id, EMBED_BATCH)?
        };
        if batch.is_empty() {
            break;
        }
        let texts: Vec<String> = batch.iter().map(|(_, _, t)| t.clone()).collect();
        let vecs = crate::ai::openai::embed(
            http,
            base_url,
            key,
            crate::embed::REMOTE_MODEL,
            &texts,
            crate::embed::DIM,
        )
        .await?;
        let conn = db.lock().unwrap();
        conn.execute_batch("BEGIN IMMEDIATE").map_err(|e| e.to_string())?;
        let write = (|| -> Result<(), String> {
            for ((mid, tid, _), v) in batch.iter().zip(&vecs) {
                store::vec::insert(&conn, mid, tid, account_id, crate::embed::REMOTE_TAG, v)?;
            }
            Ok(())
        })();
        match write {
            Ok(()) => conn.execute_batch("COMMIT").map_err(|e| e.to_string())?,
            Err(e) => {
                let _ = conn.execute_batch("ROLLBACK");
                return Err(e);
            }
        }
        embedded += vecs.len();
    }
    let remaining = {
        let conn = db.lock().unwrap();
        store::vec::count_missing(&conn, account_id)?
    };
    Ok(EmbedBeat { embedded, remaining })
}
```

- [ ] **Step 4.2: AppState.** `db: Mutex<Connection>` → `db: Arc<Mutex<Connection>>` (auto-deref keeps every `state.db.lock()` call compiling; needed so the blocking embed task can own a handle); add `data_dir: std::path::PathBuf` and `embedder: tokio::sync::Mutex<embed::Slot>`. Setup: `db: Arc::new(Mutex::new(conn))`, `data_dir: data_dir.clone()`, `embedder: tokio::sync::Mutex::new(embed::Slot::Idle)`.
- [ ] **Step 4.3: Lazy init helper** (lib.rs, near spawn_history_crawl):

```rust
/// Ready → clone; Idle/stale-Failed → load (blocking thread; first run
/// downloads the model); fresh-Failed → None (backoff). Holding the slot
/// lock across the load also serializes concurrent init attempts.
async fn ensure_local_embedder(state: &AppState) -> Option<std::sync::Arc<fastembed::TextEmbedding>> {
    let mut slot = state.embedder.lock().await;
    match &*slot {
        embed::Slot::Ready(m) => Some(m.clone()),
        embed::Slot::Failed { at_ms } if now_ms() - at_ms < embed::RETRY_AFTER_MS => None,
        _ => {
            let dir = state.data_dir.join("models");
            match tauri::async_runtime::spawn_blocking(move || embed::load_local(dir)).await {
                Ok(Ok(m)) => {
                    let m = std::sync::Arc::new(m);
                    *slot = embed::Slot::Ready(m.clone());
                    Some(m)
                }
                other => {
                    let err = match other {
                        Ok(Err(e)) => e,
                        Err(e) => e.to_string(),
                        Ok(Ok(_)) => unreachable!(),
                    };
                    eprintln!("[embed] local model unavailable: {err}");
                    *slot = embed::Slot::Failed { at_ms: now_ms() };
                    None
                }
            }
        }
    }
}
```

- [ ] **Step 4.4: Wire into `spawn_history_crawl`** after the crawl `match`, inside the per-email loop (embedding shares the crawl's busy-guard and cadence):

```rust
            // Semantic indexing: embed whatever the crawl/sync landed.
            let embeddings_mode = {
                let conn = state.db.lock().unwrap();
                store::get_settings(&conn).embeddings
            };
            if embeddings_mode == "openai" {
                let remote = {
                    let conn = state.db.lock().unwrap();
                    ai::resolve(&store::get_settings(&conn), Some("openai")).ok()
                };
                if let Some(p) = remote {
                    match mail::sync::embed_step_remote(&state.http, &state.db, &email, &p.base_url, &p.key).await {
                        Ok(b) if b.embedded > 0 => eprintln!("[embed:{email}] +{} embedded (remote), {} to go", b.embedded, b.remaining),
                        Ok(_) => {}
                        Err(e) => eprintln!("[embed:{email}] {e}"),
                    }
                }
            } else if let Some(m) = ensure_local_embedder(&state).await {
                let db = state.db.clone();
                let email2 = email.clone();
                let beat = tauri::async_runtime::spawn_blocking(move || {
                    mail::sync::embed_step(&db, &email2, embed::LOCAL_TAG, &|texts| {
                        embed::embed_passages(&m, texts)
                    })
                })
                .await;
                match beat {
                    Ok(Ok(b)) if b.embedded > 0 => eprintln!("[embed:{email}] +{} embedded, {} to go", b.embedded, b.remaining),
                    Ok(Ok(_)) => {}
                    Ok(Err(e)) => eprintln!("[embed:{email}] {e}"),
                    Err(e) => eprintln!("[embed:{email}] task: {e}"),
                }
            }
```

- [ ] **Step 4.5: Convergence test** (sync.rs tests — fake embedder closure, no model):

```rust
    #[test]
    fn embed_step_converges_to_full_coverage_and_resumes() {
        let conn = store::open(std::path::Path::new(":memory:")).unwrap();
        for i in 0..5 {
            crate::store::tests::seed_public(
                &conn,
                &format!("t-{i}"),
                "Subject",
                "body words",
                "Ann",
                1_000 + i,
            );
        }
        drop(conn); // reopen shared handle
        // (seed helper note: expose store::tests::seed as pub(crate) seed_public
        //  or duplicate the 20-line seeder here — implementer's choice.)
        ...
    }
```

Concretely: wrap an in-memory store in `std::sync::Mutex`, seed 5 threads via the same seeding used in store tests (make store's test `seed` reusable: `pub(crate)` under `#[cfg(test)]` via a small `#[cfg(test)] pub mod testutil` in store — implement as part of this step), then:

```rust
        let db = std::sync::Mutex::new(conn);
        let fake = |texts: Vec<String>| -> Result<Vec<Vec<f32>>, String> {
            Ok(texts
                .iter()
                .map(|_| {
                    let mut v = vec![0f32; 384];
                    v[0] = 1.0;
                    v
                })
                .collect())
        };
        let b1 = embed_step(&db, crate::store::testutil::ACCT, "test", &fake).unwrap();
        assert_eq!(b1.embedded, 5);
        assert_eq!(b1.remaining, 0);
        // second beat: nothing left, and it doesn't re-embed
        let b2 = embed_step(&db, crate::store::testutil::ACCT, "test", &fake).unwrap();
        assert_eq!(b2.embedded, 0);
        {
            let conn = db.lock().unwrap();
            assert_eq!(crate::store::vec::count_embedded(&conn, crate::store::testutil::ACCT).unwrap(), 5);
        }
```

- [ ] **Step 4.6:** `cargo test -p fission-mail --lib` — expected: all green. `cargo check` for the lib.rs wiring.
- [ ] **Step 4.7:** Commit `feat(search): background embedding beat off the crawl spawn (phase 4.2b)`.

### Task 5: Hybrid RRF retrieval

**Files:**
- Modify: `src-tauri/src/store/vec.rs` (add `VecHit` + `knn_threads`), `src-tauri/src/store/mod.rs` (`search` :1666, `search_planned` :1713), `src-tauri/src/lib.rs` (`search_all` :2117)

- [ ] **Step 5.1: KNN leg** in store/vec.rs (same narrowing semantics as the lexical leg):

```rust
pub struct VecHit {
    pub result: crate::types::SearchResult,
    pub distance: f64,
}

/// Message-level KNN over-fetch (threads have several messages and other
/// accounts' rows are filtered after the scan).
const KNN_K: usize = 240;

/// Nearest threads to `qvec` for this account, best (smallest cosine
/// distance over any message) first, honoring the plan's date window and
/// people narrowing exactly like the lexical leg.
pub fn knn_threads(
    conn: &Connection,
    qvec: &[f32],
    account_id: &str,
    plan: &crate::search::SearchPlan,
    limit: usize,
) -> Result<Vec<VecHit>, String> {
    use rusqlite::types::Value;
    let mut sql = String::from(
        "SELECT vm.thread_id, t.subject, t.snippet, t.last_date, MIN(v.distance) AS d
         FROM (SELECT rowid, distance FROM mail_vec WHERE embedding MATCH ? AND k = ?) v
         JOIN vec_meta vm ON vm.vec_rowid = v.rowid
         JOIN threads t ON t.id = vm.thread_id
         WHERE vm.account_id = ? AND t.hidden IS NULL",
    );
    let mut params_v: Vec<Value> = vec![
        Value::Blob(vec_to_blob(qvec)),
        Value::Integer(KNN_K as i64),
        Value::Text(account_id.to_string()),
    ];
    if let Some(ms) = plan.after {
        sql.push_str(" AND t.last_date >= ?");
        params_v.push(Value::Integer(ms));
    }
    if let Some(ms) = plan.before {
        sql.push_str(" AND t.last_date < ?");
        params_v.push(Value::Integer(ms));
    }
    for p in &plan.people {
        sql.push_str(
            " AND EXISTS (SELECT 1 FROM messages m WHERE m.thread_id = t.id
               AND (m.from_addr LIKE ? ESCAPE '\\' OR m.from_name LIKE ? ESCAPE '\\'
                    OR m.to_addrs LIKE ? ESCAPE '\\' OR m.cc_addrs LIKE ? ESCAPE '\\'))",
        );
        let pat = super::like_pattern(p);
        for _ in 0..4 {
            params_v.push(Value::Text(pat.clone()));
        }
    }
    sql.push_str(" GROUP BY vm.thread_id ORDER BY d ASC LIMIT ?");
    params_v.push(Value::Integer(limit as i64));
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params_v), |r| {
            Ok(VecHit {
                result: crate::types::SearchResult {
                    thread_id: r.get(0)?,
                    subject: r.get(1)?,
                    snippet: r.get(2)?,
                    last_date: r.get(3)?,
                },
                distance: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}
```

(`like_pattern` becomes `pub(crate)` in store/mod.rs.)

- [ ] **Step 5.2: search_planned gains `qvec`** — signature `pub fn search_planned(conn: &Connection, plan: &crate::search::SearchPlan, account_id: &str, qvec: Option<&[f32]>)`. Restructure the tail so all three branches share one executor, and the term branch fuses:

```rust
    // (end of the existing if/else chain — replace the shared stmt/query_map
    //  tail with:)
    let lexical = run_search_sql(conn, &sql, params_v)?;
    if let (Some(q), true) = (qvec, has_terms) {
        // Semantic leg: KNN the query vector over this account's mail with
        // the same narrowing, then fuse. Vector-only threads extend recall;
        // RRF keeps dual-leg (exact) hits on top. Absent/failed embeddings
        // simply mean an empty leg — lexical results pass through unchanged.
        let vhits = vec::knn_threads(conn, q, account_id, plan, VEC_LEG_LIMIT)?;
        if !vhits.is_empty() {
            return Ok(rrf_fuse(lexical, vhits));
        }
    }
    Ok(lexical)
```

with, above `search_planned`:

```rust
/// Cap on vector-leg threads folded into a fused result: bounds the "20
/// semantically-nearest threads" tail a query can pull in past its exact
/// matches (brute-force KNN always returns k rows, however weak).
const VEC_LEG_LIMIT: usize = 20;

fn run_search_sql(
    conn: &Connection,
    sql: &str,
    params_v: Vec<rusqlite::types::Value>,
) -> Result<Vec<SearchResult>, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    // Collect row errors instead of swallowing them: a step-time SQL error
    // must surface as a failed search, never as silently-empty results.
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params_v), |r| {
            Ok(SearchResult {
                thread_id: r.get(0)?,
                subject: r.get(1)?,
                snippet: r.get(2)?,
                last_date: r.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

/// Reciprocal Rank Fusion (k=60). Each leg contributes 1/(60+rank); a
/// thread on both legs sums them, so exact-term hits (present in both)
/// always outrank a same-rank semantic-only neighbor — semantic extends
/// recall below the exact matches instead of displacing them. Ties fall
/// back to recency.
fn rrf_fuse(lexical: Vec<SearchResult>, vector: Vec<vec::VecHit>) -> Vec<SearchResult> {
    const RRF_K: f64 = 60.0;
    let mut fused: HashMap<String, (f64, SearchResult)> = HashMap::new();
    for (i, r) in lexical.into_iter().enumerate() {
        fused.insert(r.thread_id.clone(), (1.0 / (RRF_K + 1.0 + i as f64), r));
    }
    for (i, h) in vector.into_iter().enumerate() {
        let s = 1.0 / (RRF_K + 1.0 + i as f64);
        fused
            .entry(h.result.thread_id.clone())
            .and_modify(|e| e.0 += s)
            .or_insert((s, h.result));
    }
    let mut out: Vec<(f64, SearchResult)> = fused.into_values().collect();
    out.sort_by(|a, b| {
        b.0.partial_cmp(&a.0)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(b.1.last_date.cmp(&a.1.last_date))
    });
    out.into_iter().map(|(_, r)| r).take(60).collect()
}
```

`has_terms` is `fts_match_expr(&plan.terms).is_some()` captured where the branch chooses (only the term branch sets it true). `store::search` (:1666) passes `None`. Update the three existing `search_planned` test call sites with `, None`.

- [ ] **Step 5.3: search_all embeds the query once** (lib.rs) — after `let plan = ...`, before the local search:

```rust
    // One query embedding per search (never per keystroke — the instant
    // search_threads path stays lexical-only). Demo accounts use the toy
    // concept embedder; real accounts an already-ready local model or the
    // remote endpoint. Any failure = no semantic leg, lexical unchanged.
    let qvec: Option<Vec<f32>> = if plan.terms.is_empty() {
        None
    } else if !is_gmail {
        mail::mock::demo_embed(&plan.terms.join(" "))
    } else {
        query_vector(&state, &plan.terms.join(" ")).await
    };
    let local = {
        let conn = state.db.lock().unwrap();
        store::search_planned(&conn, &plan, &active, qvec.as_deref())?
    };
```

with the helper:

```rust
/// Embed a search query, or None when semantic search isn't ready (model
/// still downloading, no key, offline, or the embedder is mid-load — a
/// search never waits on any of that).
async fn query_vector(state: &State<'_, AppState>, text: &str) -> Option<Vec<f32>> {
    let (mode, remote) = {
        let conn = state.db.lock().unwrap();
        let settings = store::get_settings(&conn);
        let remote = if settings.embeddings == "openai" {
            ai::resolve(&settings, Some("openai")).ok()
        } else {
            None
        };
        (settings.embeddings.clone(), remote)
    };
    if mode == "openai" {
        let p = remote?;
        let texts = vec![text.to_string()];
        return tokio::time::timeout(
            std::time::Duration::from_secs(3),
            ai::openai::embed(&state.http, &p.base_url, &p.key, embed::REMOTE_MODEL, &texts, embed::DIM),
        )
        .await
        .ok()?
        .ok()?
        .pop();
    }
    // local: use a ready model; never load/download on the search path
    let m = match state.embedder.try_lock() {
        Ok(slot) => match &*slot {
            embed::Slot::Ready(m) => m.clone(),
            _ => return None,
        },
        Err(_) => return None,
    };
    let text = text.to_string();
    tauri::async_runtime::spawn_blocking(move || embed::embed_query(&m, &text).ok())
        .await
        .ok()
        .flatten()
}
```

- [ ] **Step 5.4: Tests** (store/mod.rs) — hand vectors through the REAL vec0 KNN + RRF path:

```rust
    #[test]
    fn hybrid_surfaces_semantic_match_lexical_misses() {
        let conn = open(std::path::Path::new(":memory:")).unwrap();
        // "bill"/"receipt" body — the word "invoice" appears nowhere
        seed(&conn, "t-bill", "Wire receipt", "your bill payment receipt is attached", "Mercury", 1_000);
        seed(&conn, "t-noise", "Picnic", "sunny weather saturday", "Ann", 2_000);
        // toy space: dim0 = money concept, dim1 = leisure
        let mut money = vec![0f32; 384];
        money[0] = 1.0;
        let mut leisure = vec![0f32; 384];
        leisure[1] = 1.0;
        vec::insert(&conn, "t-bill-m1", "t-bill", ACCT, "test", &money).unwrap();
        vec::insert(&conn, "t-noise-m1", "t-noise", ACCT, "test", &leisure).unwrap();
        let plan = crate::search::SearchPlan { terms: vec!["invoice".into()], ..Default::default() };
        // lexical alone: nothing
        assert!(search_planned(&conn, &plan, ACCT, None).unwrap().is_empty());
        // hybrid: the money-space thread surfaces; leisure doesn't outrank it
        let hits = search_planned(&conn, &plan, ACCT, Some(&money)).unwrap();
        assert_eq!(hits[0].thread_id, "t-bill");
        assert!(hits.len() >= 1);
    }

    #[test]
    fn exact_term_hits_stay_on_top_of_semantic_neighbors() {
        let conn = open(std::path::Path::new(":memory:")).unwrap();
        seed(&conn, "t-exact", "Invoice April", "amount due", "Ann", 1_000);
        seed(&conn, "t-sem", "Wire receipt", "payment receipt", "Mercury", 2_000);
        let mut money = vec![0f32; 384];
        money[0] = 1.0;
        // BOTH threads sit in money-space; only t-exact contains the term
        vec::insert(&conn, "t-exact-m1", "t-exact", ACCT, "test", &money).unwrap();
        vec::insert(&conn, "t-sem-m1", "t-sem", ACCT, "test", &money).unwrap();
        let plan = crate::search::SearchPlan { terms: vec!["invoice".into()], ..Default::default() };
        let hits = search_planned(&conn, &plan, ACCT, Some(&money)).unwrap();
        assert_eq!(hits.len(), 2);
        assert_eq!(hits[0].thread_id, "t-exact", "dual-leg must beat vector-only");
        // and with no vector at all, behavior is exactly the old lexical path
        let lex = search_planned(&conn, &plan, ACCT, None).unwrap();
        assert_eq!(lex.len(), 1);
        assert_eq!(lex[0].thread_id, "t-exact");
    }

    #[test]
    fn knn_leg_honors_people_and_date_narrowing() {
        let conn = open(std::path::Path::new(":memory:")).unwrap();
        seed(&conn, "t-in", "Wire receipt", "payment receipt", "Mercury", 5_000);
        seed(&conn, "t-out", "Old wire", "payment receipt", "Mercury", 1_000);
        let mut money = vec![0f32; 384];
        money[0] = 1.0;
        vec::insert(&conn, "t-in-m1", "t-in", ACCT, "test", &money).unwrap();
        vec::insert(&conn, "t-out-m1", "t-out", ACCT, "test", &money).unwrap();
        let plan = crate::search::SearchPlan {
            terms: vec!["invoice".into()],
            after: Some(4_000),
            ..Default::default()
        };
        let hits = search_planned(&conn, &plan, ACCT, Some(&money)).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].thread_id, "t-in");
    }
```

- [ ] **Step 5.5:** `cargo test -p fission-mail --lib store` — green, including the five pre-existing search tests (now `, None`).
- [ ] **Step 5.6:** Commit `feat(search): hybrid bm25+vector retrieval via RRF (phase 4.3)`.

### Task 6: Rust demo parity (toy embedder through real plumbing)

**Files:**
- Modify: `src-tauri/src/mail/mock.rs` (constants + fns + test), `src-tauri/src/lib.rs` setup (call after `seed_if_empty`)

- [ ] **Step 6.1:** In mock.rs (near the seed data):

```rust
/// Hand-curated concept groups — the demos' semantic stand-in (mirrored in
/// src/lib/mock.ts). Each group is one dimension of a toy embedding: enough
/// for "invoice" to surface the wire-transfer fixture through the REAL
/// vec0-KNN + RRF pipeline, with no model runtime in the demo.
pub const CONCEPT_GROUPS: &[&[&str]] = &[
    &["invoice", "invoices", "bill", "bills", "billing", "receipt", "receipts", "payment", "payments", "paid", "wire", "wired", "transfer", "refund"],
    &["meeting", "meet", "call", "sync", "calendar", "schedule", "reschedule", "invite", "invitation", "agenda"],
    &["deck", "decks", "slides", "presentation", "pitch"],
    &["contract", "agreement", "terms", "term", "sheet", "legal", "counsel", "redline", "signature"],
    &["hire", "hiring", "candidate", "candidates", "recruit", "recruiting", "interview", "offer", "shortlist", "role"],
    &["budget", "burn", "runway", "spend", "cost", "costs", "expenses", "finance"],
    &["flight", "flights", "travel", "hotel", "trip", "itinerary", "booking"],
    &["bug", "bugs", "issue", "error", "crash", "ci", "build", "failed", "fix"],
    &["investor", "investors", "fund", "lp", "fundraise", "series", "valuation", "portfolio"],
    &["launch", "release", "ship", "shipping", "beta", "announcement"],
];

/// Toy embedding: normalized bag-of-concept-groups, padded to the real
/// vector width so demo rows share the mail_vec table. None = no concept
/// words (a query like "roadmap" gets no semantic leg in the demo).
pub fn demo_embed(text: &str) -> Option<Vec<f32>> {
    let lower = text.to_lowercase();
    let mut v = vec![0f32; crate::embed::DIM];
    let mut any = false;
    for w in lower.split(|c: char| !c.is_alphanumeric()) {
        if w.is_empty() {
            continue;
        }
        for (i, group) in CONCEPT_GROUPS.iter().enumerate() {
            if group.contains(&w) {
                v[i] += 1.0;
                any = true;
            }
        }
    }
    if !any {
        return None;
    }
    let norm = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    for x in &mut v {
        *x /= norm;
    }
    Some(v)
}

/// Give every demo message a toy vector (or a skip marker) — idempotent, so
/// it covers fresh seeds AND demo DBs that predate Phase 4.
pub fn ensure_demo_vectors(conn: &Connection) -> Result<(), String> {
    for account in [crate::store::DEMO_ACCOUNT, crate::store::DEMO_ACCOUNT_2] {
        for (mid, tid, text) in crate::store::vec::missing(conn, account, 10_000)? {
            match demo_embed(&text) {
                Some(v) => crate::store::vec::insert(conn, &mid, &tid, account, "demo", &v)?,
                None => crate::store::vec::mark_skipped(conn, &mid, &tid, account, "demo")?,
            }
        }
    }
    Ok(())
}
```

- [ ] **Step 6.2:** lib.rs setup, right after the `seed_if_empty` call: `mail::mock::ensure_demo_vectors(&conn)?;` (find the exact call site by grepping `seed_if_empty` in lib.rs).
- [ ] **Step 6.3:** search_all's demo branch is already wired by Task 5.3 (`demo_embed` for `!is_gmail`).
- [ ] **Step 6.4: The demo-recall test** (mock.rs tests):

```rust
    #[test]
    fn demo_semantic_search_finds_wire_receipt_for_invoice() {
        let conn = crate::store::open(std::path::Path::new(":memory:")).unwrap();
        seed_if_empty(&conn).unwrap();
        ensure_demo_vectors(&conn).unwrap();
        let q = demo_embed("invoice").expect("concept word");
        let plan = crate::search::SearchPlan { terms: vec!["invoice".into()], ..Default::default() };
        // lexical-only misses the Mercury wire-transfer fixture…
        let lexical = crate::store::search_planned(&conn, &plan, crate::store::DEMO_ACCOUNT, None).unwrap();
        assert!(!lexical.iter().any(|r| r.thread_id == "t-wire-receipt"));
        // …the hybrid surfaces it through real vec0 KNN + RRF.
        let hybrid = crate::store::search_planned(&conn, &plan, crate::store::DEMO_ACCOUNT, Some(&q)).unwrap();
        assert!(hybrid.iter().any(|r| r.thread_id == "t-wire-receipt"), "semantic recall");
    }
```

- [ ] **Step 6.5:** `cargo test -p fission-mail --lib` — green. Commit `feat(search): demo semantic stand-in through real vector plumbing (phase 4.4a)`.

### Task 7: Browser demo parity (mock.ts)

**Files:**
- Modify: `src/lib/mock.ts` (`searchAll` :609 + helpers nearby)

- [ ] **Step 7.1:** Above the MockBackend class (or beside other module consts):

```ts
// Mirrors CONCEPT_GROUPS in src-tauri/src/mail/mock.rs — the demos'
// semantic stand-in. Keep the two lists identical.
const CONCEPT_GROUPS: string[][] = [
  ["invoice", "invoices", "bill", "bills", "billing", "receipt", "receipts", "payment", "payments", "paid", "wire", "wired", "transfer", "refund"],
  ["meeting", "meet", "call", "sync", "calendar", "schedule", "reschedule", "invite", "invitation", "agenda"],
  ["deck", "decks", "slides", "presentation", "pitch"],
  ["contract", "agreement", "terms", "term", "sheet", "legal", "counsel", "redline", "signature"],
  ["hire", "hiring", "candidate", "candidates", "recruit", "recruiting", "interview", "offer", "shortlist", "role"],
  ["budget", "burn", "runway", "spend", "cost", "costs", "expenses", "finance"],
  ["flight", "flights", "travel", "hotel", "trip", "itinerary", "booking"],
  ["bug", "bugs", "issue", "error", "crash", "ci", "build", "failed", "fix"],
  ["investor", "investors", "fund", "lp", "fundraise", "series", "valuation", "portfolio"],
  ["launch", "release", "ship", "shipping", "beta", "announcement"],
];

/** Toy embedding over concept groups; null = no concept words. */
function demoVec(text: string): number[] | null {
  const v = new Array(CONCEPT_GROUPS.length).fill(0);
  let any = false;
  for (const w of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!w) continue;
    CONCEPT_GROUPS.forEach((group, i) => {
      if (group.includes(w)) {
        v[i] += 1;
        any = true;
      }
    });
  }
  if (!any) return null;
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

const cosSim = (a: number[], b: number[]) =>
  a.reduce((s, x, i) => s + x * b[i], 0);
```

- [ ] **Step 7.2:** Replace `searchAll` with the hybrid (same RRF math as the Rust core):

```ts
  // Demo has no server past the fixtures, so "all mail" adds the semantic
  // leg instead: toy concept vectors + the same RRF fusion as the Rust
  // core. The instant search() stays lexical-only, like search_threads.
  async searchAll(query: string): Promise<SearchResult[]> {
    const lexical = await this.search(query);
    const { terms } = this.parseQuery(query);
    const q = terms.length ? demoVec(terms.join(" ")) : null;
    if (!q) return lexical;
    const vhits: { r: SearchResult; d: number }[] = [];
    for (const t of this.threads.filter((t) => this.inActiveAccount(t))) {
      const msgs = this.messages.get(t.id) ?? [];
      const v = demoVec(`${t.subject}\n${msgs.map((m) => m.bodyText).join("\n")}`);
      if (!v) continue;
      const sim = cosSim(q, v);
      if (sim <= 0) continue;
      vhits.push({
        r: { threadId: t.id, subject: t.subject, snippet: t.snippet, lastDate: t.lastDate },
        d: 1 - sim,
      });
    }
    vhits.sort((a, b) => a.d - b.d);
    vhits.length = Math.min(vhits.length, 20); // VEC_LEG_LIMIT
    // Reciprocal Rank Fusion, k=60 — keep in step with store::rrf_fuse.
    const K = 60;
    const fused = new Map<string, { s: number; r: SearchResult }>();
    lexical.forEach((r, i) => fused.set(r.threadId, { s: 1 / (K + 1 + i), r }));
    vhits.forEach(({ r }, i) => {
      const s = 1 / (K + 1 + i);
      const e = fused.get(r.threadId);
      if (e) e.s += s;
      else fused.set(r.threadId, { s, r });
    });
    return [...fused.values()]
      .sort((a, b) => b.s - a.s || b.r.lastDate - a.r.lastDate)
      .map((e) => e.r)
      .slice(0, 60);
  }
```

- [ ] **Step 7.3:** `npm run build` — tsc green.
- [ ] **Step 7.4: Browser-demo verification** (preview tools): start `npm run dev`, open search (`/`), type `invoice` — instant results must NOT contain "Wire transfer confirmation — Mercury"; after the full pass settles it MUST appear. Screenshot as proof.
- [ ] **Step 7.5:** Commit `feat(search): browser-demo semantic parity (phase 4.4b)`.

### Task 8: End-to-end verification, docs, ship

- [ ] **Step 8.1:** `cargo test -p fission-mail --lib` (full), `cargo check`, `npm run build` — all green.
- [ ] **Step 8.2:** Real-model smoke: `cargo test -p fission-mail --lib -- --ignored embed` — downloads the model, proves query/passage embedding + synonym ranking on the actual runtime. Report model-on-disk size (`du` the cache dir) and load/embed timings. This is the session's stand-in for the live-mailbox backfill; the live crawl+embed on a real account remains owner E2E.
- [ ] **Step 8.3:** Confirm no `onnxruntime*.dll` next to the built test binaries (static linking claim), and note release-exe size expectation (+25–35 MB) in DECISIONS.
- [ ] **Step 8.4:** Docs: DECISIONS.md new section "Search Phase 4 — semantic/vector tier (2026-07-09)" (numbered entries: architecture, model choice + sizes, RRF semantics, demo stand-in, graceful degradation, verification honesty note); FOLLOWUP-PROMPTS.md Phase 4 section gets a STATUS block + routing-table row update.
- [ ] **Step 8.5:** Update auto-memory (zenbox-mail-project.md) — Phase 4 state, branch, pending owner E2E.
- [ ] **Step 8.6:** Final commit; leave the branch unpushed unless asked.

---

## Self-review notes

- **Spec coverage:** vec store+migration (T1/T2), embedding pipeline w/ crawl-beat extension + incremental + throttle + cache-by-message-id + skip-embedded (T4 via `missing`), hybrid RRF in search_planned's term route w/ narrowing + fallbacks (T5), mock parity both demos (T6/T7), remote-provider option (T3), Step 0 verify-first (done), guardrails (one inference/search: T5.3; on-disk ANN: vec0; never per keystroke: search_threads untouched; graceful: `qvec=None` path is byte-identical SQL).
- **Explicitly NOT done:** semantic in the instant per-keystroke path; changing `search_all`'s final date-sort merge (pre-existing Phase 1–3 behavior — noted for the owner, not re-opened); ANN indexes (alpha-only, brute force is ms at mailbox scale); bundling model weights into the installer (escape hatch documented: `try_new_from_user_defined`).
- **Known risks, called out:** first `cargo check` needs cdn.pyke.io + crates.io network; `+crt-static` must stay unset (repo doesn't set it — verified `.cargo/` absent); fastembed API details (`TextInitOptions::new`) verified against 5.17.2 source but exact builder name re-checked at compile time; vec0 `k = ?` param binding smoke-tested in T1.4 before anything builds on it.
