//! Attachment content extraction for the context assembler.
//! PDF and plain text are first-class; .docx is best-effort (unzip + strip
//! the XML); images pass through as base64 for multimodal providers.
use std::io::Read;

pub fn is_image(mime: &str) -> bool {
    matches!(mime, "image/png" | "image/jpeg" | "image/gif" | "image/webp")
}

pub fn extract_text(filename: &str, mime: &str, bytes: &[u8]) -> Option<String> {
    let lower = filename.to_ascii_lowercase();
    if mime.starts_with("text/")
        || lower.ends_with(".txt")
        || lower.ends_with(".md")
        || lower.ends_with(".csv")
        || lower.ends_with(".log")
    {
        return Some(String::from_utf8_lossy(bytes).to_string());
    }
    if mime == "application/pdf" || lower.ends_with(".pdf") {
        return pdf_extract::extract_text_from_mem(bytes).ok();
    }
    if lower.ends_with(".docx") {
        return extract_docx(bytes);
    }
    None
}

fn extract_docx(bytes: &[u8]) -> Option<String> {
    let cursor = std::io::Cursor::new(bytes);
    let mut zip = zip::ZipArchive::new(cursor).ok()?;
    let mut file = zip.by_name("word/document.xml").ok()?;
    let mut xml = String::new();
    file.read_to_string(&mut xml).ok()?;
    // Paragraph tags become newlines, everything else is stripped.
    let xml = xml.replace("</w:p>", "\n");
    Some(crate::mail::gmail::strip_html(&xml))
}
