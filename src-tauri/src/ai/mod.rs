//! Provider-agnostic AI dispatch: one interface, three adapters.
pub mod anthropic;
pub mod attachments;
pub mod context;
pub mod openai;

use crate::secrets;
use crate::types::*;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

pub struct ResolvedProvider {
    pub id: String,
    pub model: String,
    pub base_url: String,
    pub key: String,
}

/// Pick the requested (or default) provider and pull its key from the
/// keychain. Fails with a human-readable message when no key is stored.
pub fn resolve(settings: &Settings, requested: Option<&str>) -> Result<ResolvedProvider, String> {
    let id = requested.unwrap_or(&settings.default_ai_provider);
    let cfg = settings
        .providers
        .iter()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("unknown AI provider \"{id}\""))?;
    let entry = secrets::ai_key_entry(&cfg.id).ok_or("unknown AI provider")?;
    let key = secrets::get(entry).ok_or_else(|| {
        format!(
            "No API key saved for {}. Add one in Settings → AI Providers.",
            cfg.label
        )
    })?;
    let base_url = cfg
        .base_url
        .clone()
        .unwrap_or_else(|| openai::OPENAI_BASE.to_string());
    Ok(ResolvedProvider {
        id: cfg.id.clone(),
        model: cfg.model.clone(),
        base_url,
        key,
    })
}

pub fn supports_images(provider_id: &str) -> bool {
    // NIM models vary; text-only keeps the request valid everywhere.
    matches!(provider_id, "claude" | "openai")
}

pub async fn stream_draft(
    http: &reqwest::Client,
    p: &ResolvedProvider,
    ctx: &context::AssembledContext,
    on_chunk: impl FnMut(String),
    cancel: Arc<AtomicBool>,
) -> Result<(), String> {
    match p.id.as_str() {
        "claude" => {
            anthropic::stream(
                http, &p.key, &p.model, &ctx.system, &ctx.user_text, &ctx.images, on_chunk, cancel,
            )
            .await
        }
        _ => {
            openai::stream(
                http, &p.base_url, &p.key, &p.model, &ctx.system, &ctx.user_text, &ctx.images,
                on_chunk, cancel,
            )
            .await
        }
    }
}

pub async fn complete(
    http: &reqwest::Client,
    p: &ResolvedProvider,
    system: &str,
    text: &str,
) -> Result<String, String> {
    match p.id.as_str() {
        "claude" => anthropic::complete(http, &p.key, &p.model, system, text).await,
        _ => openai::complete(http, &p.base_url, &p.key, &p.model, system, text).await,
    }
}

pub async fn test_provider(http: &reqwest::Client, p: &ResolvedProvider) -> TestResult {
    let result = match p.id.as_str() {
        "claude" => anthropic::test(http, &p.key, &p.model).await,
        _ => openai::test(http, &p.base_url, &p.key, &p.model).await,
    };
    match result {
        Ok(message) => TestResult { ok: true, message },
        Err(message) => TestResult { ok: false, message },
    }
}

/// Parse "up to 3 suggested replies" out of a model response that was asked
/// for a JSON array. Tolerates prose around the array.
pub fn parse_suggestions(raw: &str) -> Vec<String> {
    let start = raw.find('[');
    let end = raw.rfind(']');
    if let (Some(s), Some(e)) = (start, end) {
        if e > s {
            if let Ok(v) = serde_json::from_str::<Vec<String>>(&raw[s..=e]) {
                return v.into_iter().take(3).collect();
            }
        }
    }
    vec![]
}
