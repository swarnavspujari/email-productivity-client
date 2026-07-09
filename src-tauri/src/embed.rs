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

/// One loaded model, shared by the embed beat and query embedding. The
/// inner mutex exists because fastembed's `embed` takes `&mut self`; both
/// callers run on blocking threads, so a query at worst waits out one
/// in-flight batch inference.
pub type SharedModel = Arc<std::sync::Mutex<TextEmbedding>>;

/// The AppState slot for the lazy local model.
pub enum Slot {
    Idle,
    Ready(SharedModel),
    /// Load/download failed at `at_ms`; retried no sooner than +10 min so an
    /// offline machine isn't hammering Hugging Face every 30s beat.
    Failed { at_ms: i64 },
}

pub const RETRY_AFTER_MS: i64 = 10 * 60 * 1000;

/// Blocking: the first call downloads ~34 MB into `cache_dir`. Callers run
/// this on a blocking thread, never the async runtime.
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
pub fn embed_passages(
    m: &std::sync::Mutex<TextEmbedding>,
    texts: Vec<String>,
) -> Result<Vec<Vec<f32>>, String> {
    m.lock().unwrap().embed(texts, Some(32)).map_err(|e| e.to_string())
}

/// Blocking; one small inference.
pub fn embed_query(m: &std::sync::Mutex<TextEmbedding>, q: &str) -> Result<Vec<f32>, String> {
    m.lock()
        .unwrap()
        .embed(vec![format!("{QUERY_PREFIX}{q}")], None)
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
    /// `cargo test --lib -- --ignored embed` to verify the local runtime E2E.
    #[test]
    #[ignore]
    fn local_model_downloads_and_ranks_synonyms() {
        let dir = std::env::temp_dir().join("fission-embed-test");
        let m = std::sync::Mutex::new(load_local(dir).expect("model load/download"));
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
