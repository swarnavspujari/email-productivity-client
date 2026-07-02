//! Email HTML sanitization for the reading pane. Raw HTML stays in the DB;
//! this runs on read, so the allowlist can evolve without a resync.
//!
//! Threat model: untrusted mail rendered in a sandboxed, script-less iframe
//! inside the app webview. Sanitization strips active content (scripts, event
//! handlers, forms, iframes); the iframe sandbox is the second layer. Remote
//! images are allowed (tracking-pixel class of risk, same call Superhuman
//! makes); `cid:` inline images are resolved to data: URIs by the caller.
use std::collections::{HashMap, HashSet};

/// Sanitize message HTML. `cid_data` maps a Content-ID (without angle
/// brackets) to a ready-made `data:` URI for inline images.
pub fn sanitize_email_html(html: &str, cid_data: &HashMap<String, String>) -> String {
    // Resolve cid: references BEFORE sanitizing, so the data: URIs go through
    // the same allowlist as everything else.
    let html = resolve_cids(html, cid_data);

    let mut b = ammonia::Builder::default();
    b.add_tags(["center", "font", "u", "big", "small", "main", "section", "article", "header", "footer", "figure", "figcaption", "picture", "source", "span", "wbr", "s"]);
    // Presentational attributes real newsletters still use everywhere.
    b.add_generic_attributes([
        "style", "align", "valign", "width", "height", "border", "cellpadding",
        "cellspacing", "bgcolor", "background", "color", "dir", "role",
    ]);
    b.add_tag_attributes("img", ["src", "alt", "width", "height", "border", "hspace", "vspace"]);
    b.add_tag_attributes("a", ["href", "name"]);
    b.add_tag_attributes("font", ["face", "size", "color"]);
    b.add_tag_attributes("td", ["colspan", "rowspan", "nowrap"]);
    b.add_tag_attributes("th", ["colspan", "rowspan", "nowrap"]);
    b.add_tag_attributes("source", ["srcset", "media", "type"]);
    let url_schemes: HashSet<&str> = ["http", "https", "mailto", "data", "tel"].into();
    b.url_schemes(url_schemes);
    // Every link opens outside the app; rel guards the opener.
    b.link_rel(Some("noopener noreferrer"));
    b.clean(&html).to_string()
}

/// Replace `cid:<id>` image sources with data: URIs where we have the bytes;
/// unresolved cids become empty sources (broken-image icon beats a leak).
fn resolve_cids(html: &str, cid_data: &HashMap<String, String>) -> String {
    if !html.contains("cid:") || cid_data.is_empty() {
        return html.to_string();
    }
    let mut out = html.to_string();
    for (cid, data_uri) in cid_data {
        // src="cid:xyz" | src='cid:xyz' — attribute quoting varies
        for quote in ['"', '\''] {
            let needle = format!("{quote}cid:{cid}{quote}");
            let replacement = format!("{quote}{data_uri}{quote}");
            out = out.replace(&needle, &replacement);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_scripts_and_handlers() {
        let dirty = r#"<div onclick="evil()"><script>evil()</script><p style="color:red">hi</p></div>"#;
        let clean = sanitize_email_html(dirty, &HashMap::new());
        assert!(!clean.contains("script"));
        assert!(!clean.contains("onclick"));
        assert!(clean.contains(r#"style="color:red""#));
    }

    #[test]
    fn keeps_tables_and_images() {
        let dirty = r##"<table width="600"><tr><td bgcolor="#fff"><img src="https://x.test/a.png" width="10"></td></tr></table>"##;
        let clean = sanitize_email_html(dirty, &HashMap::new());
        assert!(clean.contains("<table"));
        assert!(clean.contains(r#"src="https://x.test/a.png""#));
    }

    #[test]
    fn resolves_cid_images() {
        let mut cids = HashMap::new();
        cids.insert("logo@x".to_string(), "data:image/png;base64,AAAA".to_string());
        let dirty = r#"<img src="cid:logo@x">"#;
        let clean = sanitize_email_html(dirty, &cids);
        assert!(clean.contains("data:image/png;base64,AAAA"));
    }

    #[test]
    fn links_get_rel_and_javascript_urls_die() {
        let dirty = r#"<a href="javascript:evil()">x</a><a href="https://ok.test">y</a>"#;
        let clean = sanitize_email_html(dirty, &HashMap::new());
        assert!(!clean.contains("javascript:"));
        assert!(clean.contains("noopener"));
    }
}
