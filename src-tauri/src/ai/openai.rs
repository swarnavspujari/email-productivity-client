//! OpenAI-compatible adapter. Serves both OpenAI (api.openai.com) and
//! NVIDIA NIM (integrate.api.nvidia.com or self-hosted) via base_url.
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub const OPENAI_BASE: &str = "https://api.openai.com/v1";

fn user_content(text: &str, images: &[(String, String)]) -> Value {
    if images.is_empty() {
        return json!(text);
    }
    let mut blocks: Vec<Value> = images
        .iter()
        .map(|(mime, b64)| {
            json!({
                "type": "image_url",
                "image_url": { "url": format!("data:{mime};base64,{b64}") }
            })
        })
        .collect();
    blocks.push(json!({ "type": "text", "text": text }));
    json!(blocks)
}

fn request_body(model: &str, system: &str, text: &str, images: &[(String, String)], stream: bool) -> Value {
    json!({
        "model": model,
        "stream": stream,
        "max_tokens": 2048,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user_content(text, images) }
        ]
    })
}

async fn send_with_retry(
    http: &reqwest::Client,
    base: &str,
    key: &str,
    body: &Value,
) -> Result<reqwest::Response, String> {
    let url = format!("{}/chat/completions", base.trim_end_matches('/'));
    for attempt in 0..3u32 {
        let resp = http
            .post(&url)
            .bearer_auth(key)
            .json(body)
            .send()
            .await
            .map_err(|_| "provider request failed (network)".to_string())?;
        let status = resp.status().as_u16();
        if status == 429 || status >= 500 {
            tokio::time::sleep(std::time::Duration::from_millis(800 * 2u64.pow(attempt))).await;
            continue;
        }
        if !resp.status().is_success() {
            let hint = match status {
                401 => " — the API key was rejected",
                404 => " — check the model name / base URL in Settings",
                _ => "",
            };
            return Err(format!("provider API error ({status}){hint}"));
        }
        return Ok(resp);
    }
    Err("provider is rate-limiting; try again shortly".to_string())
}

pub async fn stream(
    http: &reqwest::Client,
    base: &str,
    key: &str,
    model: &str,
    system: &str,
    text: &str,
    images: &[(String, String)],
    mut on_chunk: impl FnMut(String),
    cancel: Arc<AtomicBool>,
) -> Result<(), String> {
    let body = request_body(model, system, text, images, true);
    let resp = send_with_retry(http, base, key, &body).await?;
    let mut buf = String::new();
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::Relaxed) {
            return Ok(());
        }
        let bytes = chunk.map_err(|_| "stream interrupted".to_string())?;
        buf.push_str(&String::from_utf8_lossy(&bytes));
        while let Some(pos) = buf.find('\n') {
            let line = buf[..pos].trim().to_string();
            buf.drain(..=pos);
            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    return Ok(());
                }
                if let Ok(v) = serde_json::from_str::<Value>(data) {
                    if let Some(t) = v["choices"][0]["delta"]["content"].as_str() {
                        on_chunk(t.to_string());
                    }
                }
            }
        }
    }
    Ok(())
}

pub async fn complete(
    http: &reqwest::Client,
    base: &str,
    key: &str,
    model: &str,
    system: &str,
    text: &str,
) -> Result<String, String> {
    let body = request_body(model, system, text, &[], false);
    let resp = send_with_retry(http, base, key, &body).await?;
    let v: Value = resp
        .json()
        .await
        .map_err(|_| "provider returned an unexpected response".to_string())?;
    Ok(v["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or_default()
        .to_string())
}

/// OpenAI-compatible /embeddings — the optional remote path for semantic
/// search. `dimensions` matches the mail_vec schema (text-embedding-3-*
/// truncate server-side, Matryoshka-style).
pub async fn embed(
    http: &reqwest::Client,
    base: &str,
    key: &str,
    model: &str,
    texts: &[String],
    dimensions: usize,
) -> Result<Vec<Vec<f32>>, String> {
    let url = format!("{}/embeddings", base.trim_end_matches('/'));
    let body = json!({ "model": model, "input": texts, "dimensions": dimensions });
    let resp = http
        .post(&url)
        .bearer_auth(key)
        .json(&body)
        .send()
        .await
        .map_err(|_| "embedding request failed (network)".to_string())?;
    let status = resp.status();
    let v: Value = resp
        .json()
        .await
        .map_err(|_| "embedding provider returned an unexpected response".to_string())?;
    if !status.is_success() {
        return Err(format!(
            "embedding API error ({status}): {}",
            v["error"]["message"].as_str().unwrap_or("?")
        ));
    }
    let mut out: Vec<(i64, Vec<f32>)> = v["data"]
        .as_array()
        .ok_or("embedding response had no data")?
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

pub async fn test(
    http: &reqwest::Client,
    base: &str,
    key: &str,
    model: &str,
) -> Result<String, String> {
    let body = json!({
        "model": model,
        "max_tokens": 8,
        "messages": [{ "role": "user", "content": "Reply with the single word: ok" }]
    });
    send_with_retry(http, base, key, &body).await?;
    Ok(format!("Connected — {model} responded."))
}
