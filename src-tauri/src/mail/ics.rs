//! Tiny, tolerant iCalendar reader for invite mail (METHOD:REQUEST/CANCEL):
//! just enough to pull UID / SUMMARY / ORGANIZER / DTSTART / DTEND / URL out
//! of the first VEVENT. Deliberately not a full RFC5545 parser — RSVP acts on
//! the resolved Google Calendar event, so these fields only label the bar
//! (and TZID-local times are approximated as local wall-clock).

/// What an invite's ICS payload tells us.
#[derive(Debug, Clone)]
pub struct ParsedIcs {
    /// REQUEST (invite/update) | CANCEL — anything else is ignored upstream.
    pub method: String,
    pub uid: String,
    pub summary: Option<String>,
    pub organizer_email: Option<String>,
    pub start_ms: Option<i64>,
    pub end_ms: Option<i64>,
    /// DTSTART was a VALUE=DATE (all-day; end is exclusive per RFC5545).
    pub all_day: bool,
    /// URL: property — Google invites carry an event view link here.
    pub url: Option<String>,
}

/// Unfold RFC5545 folded lines (continuations start with space or tab).
fn unfold(raw: &str) -> Vec<String> {
    let mut out: Vec<String> = vec![];
    for line in raw.replace("\r\n", "\n").replace('\r', "\n").split('\n') {
        if (line.starts_with(' ') || line.starts_with('\t')) && !out.is_empty() {
            let last = out.last_mut().unwrap();
            last.push_str(&line[1..]);
        } else {
            out.push(line.to_string());
        }
    }
    out
}

/// "NAME;PARAM=x;PARAM2=y:value" → (NAME, params-string, value).
fn split_prop(line: &str) -> Option<(String, String, String)> {
    let colon = line.find(':')?;
    let (head, value) = line.split_at(colon);
    let value = &value[1..];
    let (name, params) = match head.find(';') {
        Some(i) => (&head[..i], &head[i + 1..]),
        None => (head, ""),
    };
    Some((name.to_ascii_uppercase(), params.to_ascii_uppercase(), value.to_string()))
}

/// TEXT values escape \n \, \; per RFC5545.
fn unescape(v: &str) -> String {
    v.replace("\\n", "\n").replace("\\N", "\n").replace("\\,", ",").replace("\\;", ";")
}

/// Is this property a VALUE=DATE (all-day) form? Matching the exact param —
/// `contains("VALUE=DATE")` would also match VALUE=DATE-TIME — or the bare
/// 8-digit value some senders emit without the param.
fn is_date_only(params: &str, value: &str) -> bool {
    params.split(';').any(|p| p.trim() == "VALUE=DATE") || value.trim().len() == 8
}

/// RFC5545 date/date-time → epoch ms. "...Z" is UTC; DATE and TZID/floating
/// forms are read as LOCAL wall-clock (approximation — see module docs).
fn parse_dt(params: &str, value: &str) -> Option<i64> {
    let v = value.trim();
    if is_date_only(params, v) {
        let date = chrono::NaiveDate::parse_from_str(v, "%Y%m%d").ok()?;
        return crate::mail::calendar::local_day_start_ms(date);
    }
    if let Some(stripped) = v.strip_suffix('Z') {
        let dt = chrono::NaiveDateTime::parse_from_str(stripped, "%Y%m%dT%H%M%S").ok()?;
        return Some(dt.and_utc().timestamp_millis());
    }
    let dt = chrono::NaiveDateTime::parse_from_str(v, "%Y%m%dT%H%M%S").ok()?;
    dt.and_local_timezone(chrono::Local)
        .earliest()
        .map(|t| t.timestamp_millis())
}

/// Parse the first VEVENT out of an ICS payload. None when it isn't an
/// invite-shaped calendar object (no VEVENT or no UID).
pub fn parse(raw: &str) -> Option<ParsedIcs> {
    let lines = unfold(raw);
    let mut method = String::new();
    let mut in_event = false;
    let mut uid = None;
    let mut summary = None;
    let mut organizer_email = None;
    let mut start_ms = None;
    let mut end_ms = None;
    let mut all_day = false;
    let mut url = None;
    for line in &lines {
        let Some((name, params, value)) = split_prop(line) else { continue };
        match (in_event, name.as_str()) {
            (_, "BEGIN") if value.eq_ignore_ascii_case("VEVENT") => {
                if uid.is_some() {
                    break; // only the first VEVENT
                }
                in_event = true;
            }
            (true, "END") if value.eq_ignore_ascii_case("VEVENT") => in_event = false,
            (false, "METHOD") => method = value.trim().to_ascii_uppercase(),
            (true, "UID") => uid = Some(value.trim().to_string()),
            (true, "SUMMARY") => summary = Some(unescape(value.trim())),
            (true, "ORGANIZER") => {
                let v = value.trim();
                let addr = v.strip_prefix("mailto:").or_else(|| v.strip_prefix("MAILTO:"));
                organizer_email = addr.map(|a| a.to_ascii_lowercase());
            }
            (true, "DTSTART") => {
                start_ms = parse_dt(&params, &value);
                all_day = is_date_only(&params, &value);
            }
            (true, "DTEND") => end_ms = parse_dt(&params, &value),
            (true, "URL") => url = Some(value.trim().to_string()),
            _ => {}
        }
    }
    Some(ParsedIcs {
        method: if method.is_empty() { "REQUEST".into() } else { method },
        uid: uid?,
        summary,
        organizer_email,
        start_ms,
        end_ms,
        all_day,
        url,
    })
}
