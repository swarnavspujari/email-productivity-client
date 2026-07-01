//! Claude adapter: POST /v1/messages with SSE streaming.
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

const URL: &str = "https://api.anthropic.com/v1/messages";
const VERSION: &str = "2023-06-01";

fn user_content(text: &str, images: &[(String, String)]) -> Value {
    if images.is_empty() {
        return json!(text);
    }
    let mut blocks: Vec<Value> = images
        .iter()
        .map(|(mime, b64)| {
            json!({
                "type": "image",
                "source": { "type": "base64", "media_type": mime, "data": b64 }
            })
        })
        .collect();
    blocks.push(json!({ "type": "text", "text": text }));
    json!(blocks)
}

fn request_body(model: &str, system: &str, text: &str, images: &[(String, String)], stream: bool) -> Value {
    json!({
        "model": model,
        "max_tokens": 2048,
        "stream": stream,
        "system": system,
        "messages": [{ "role": "user", "content": user_content(text, images) }]
    })
}

async fn send_with_retry(
    http: &reqwest::Client,
    key: &str,
    body: &Value,
) -> Result<reqwest::Response, String> {
    for attempt in 0..3u32 {
        let resp = http
            .post(URL)
            .header("x-api-key", key)
            .header("anthropic-version", VERSION)
            .json(body)
            .send()
            .await
            .map_err(|_| "Claude request failed (network)".to_string())?;
        let status = resp.status().as_u16();
        if status == 429 || status == 529 {
            tokio::time::sleep(std::time::Duration::from_millis(800 * 2u64.pow(attempt))).await;
            continue;
        }
        if !resp.status().is_success() {
            let hint = match status {
                401 => " — the API key was rejected",
                404 => " — check the model name in Settings",
                _ => "",
            };
            return Err(format!("Claude API error ({status}){hint}"));
        }
        return Ok(resp);
    }
    Err("Claude is rate-limiting; try again shortly".to_string())
}

pub async fn stream(
    http: &reqwest::Client,
    key: &str,
    model: &str,
    system: &str,
    text: &str,
    images: &[(String, String)],
    mut on_chunk: impl FnMut(String),
    cancel: Arc<AtomicBool>,
) -> Result<(), String> {
    let body = request_body(model, system, text, images, true);
    let resp = send_with_retry(http, key, &body).await?;
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
                if let Ok(v) = serde_json::from_str::<Value>(data) {
                    if v["type"] == "content_block_delta" {
                        if let Some(t) = v["delta"]["text"].as_str() {
                            on_chunk(t.to_string());
                        }
                    } else if v["type"] == "error" {
                        return Err(format!(
                            "Claude stream error ({})",
                            v["error"]["type"].as_str().unwrap_or("unknown")
                        ));
                    }
                }
            }
        }
    }
    Ok(())
}

pub async fn complete(
    http: &reqwest::Client,
    key: &str,
    model: &str,
    system: &str,
    text: &str,
) -> Result<String, String> {
    let body = request_body(model, system, text, &[], false);
    let resp = send_with_retry(http, key, &body).await?;
    let v: Value = resp
        .json()
        .await
        .map_err(|_| "Claude returned an unexpected response".to_string())?;
    Ok(v["content"][0]["text"].as_str().unwrap_or_default().to_string())
}

pub async fn test(http: &reqwest::Client, key: &str, model: &str) -> Result<String, String> {
    let body = json!({
        "model": model,
        "max_tokens": 8,
        "messages": [{ "role": "user", "content": "Reply with the single word: ok" }]
    });
    send_with_retry(http, key, &body).await?;
    Ok(format!("Connected — {model} responded."))
}
