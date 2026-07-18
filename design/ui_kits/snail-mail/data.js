// Snail Mail — demo inbox fixtures (adapted from the product's mock-data.ts).
// Plain globals so the JSX app can read them without a module system.
window.SM_DATA = (function () {
  const ME = "you@snailmail.app";
  const threads = [
    {
      id: "t-term-sheet", split: "important", unread: true, starred: true, label: "IMPORTANT",
      subject: "Term sheet — Series A close timing",
      messages: [
        { fromName: "Maya Chen", from: "maya@heliosrobotics.io", to: [ME], cc: ["legal@heliosrobotics.io"], time: "Jul 2, 9:14 AM",
          body: "Hi,\n\nAttached is the revised term sheet with the changes we discussed on the board pro-rata and the option pool sizing. Our counsel flagged one open item: the closing date. We'd like to target the 15th, but need your confirmation on wiring logistics before we lock it.\n\nCan you confirm by Thursday?\n\nBest,\nMaya",
          attachments: [{ filename: "Helios_SeriesA_TermSheet_v4.pdf", size: "182 KB" }] },
        { fromName: "Maya Chen", from: "maya@heliosrobotics.io", to: [ME], cc: [], time: "10:24 AM", unread: true,
          body: "Quick nudge on the note below — our counsel needs the go/no-go on the 15th by EOD tomorrow to hold the schedule.\n\nMaya" },
      ],
    },
    {
      id: "t-diligence", split: "important", unread: true, starred: false, label: "IMPORTANT",
      subject: "Diligence follow-ups from Tuesday's call",
      messages: [
        { fromName: "Dev Arora", from: "dev.arora@granitecapital.com", to: [ME], cc: [], time: "7h", unread: true,
          body: "Following up on Tuesday — three things outstanding from our side:\n\n1. Cohort retention data past month 18\n2. The updated cap table post-SAFE conversion\n3. Reference contacts for the two enterprise pilots\n\nWe're aiming to bring this to IC on Monday, so anything you can get us by Friday helps.\n\nDev" },
      ],
    },
    {
      id: "t-board-deck", split: "important", unread: false, starred: false, label: "IMPORTANT",
      subject: "Q2 board deck — review draft",
      messages: [
        { fromName: "Priya Nair", from: "priya@cadenceventures.com", to: [ME], cc: [], time: "Wed",
          body: "Draft of the Q2 board deck is attached. The open questions are on slide 14 (hiring plan) and slide 19 (the revised burn multiple). Would love your pass before I circulate to the rest of the board Sunday night.\n\nPriya",
          attachments: [{ filename: "Q2_Board_Deck_DRAFT.pdf", size: "2.4 MB" }, { filename: "burn_notes.txt", size: "4 KB" }] },
      ],
    },
    {
      id: "t-intro-founder", split: "important", unread: true, starred: false, label: "IMPORTANT",
      subject: "Intro: Lena Okafor (Fieldstone Bio) <> you",
      messages: [
        { fromName: "James Whitfield", from: "james@thirdactvc.com", to: [ME, "lena@fieldstone.bio"], cc: [], time: "Tue", unread: true,
          body: "Connecting you two — Lena is building Fieldstone Bio (computational protein design for ag). Raising a seed, and given your thesis around applied bio tooling I thought this was worth your time. Lena, over to you to share the deck.\n\nJames" },
        { fromName: "Lena Okafor", from: "lena@fieldstone.bio", to: [ME], cc: ["james@thirdactvc.com"], time: "Tue", unread: true,
          body: "Thanks James!\n\nGreat to meet you. Deck attached — we're raising a $3.5M seed to get our first two crop-protection candidates through greenhouse trials. Happy to find 30 minutes next week if there's mutual interest.\n\nLena",
          attachments: [{ filename: "Fieldstone_Seed_Deck.pdf", size: "3.1 MB" }] },
      ],
    },
    {
      id: "t-cal-board", split: "important", unread: true, starred: false, label: "CALENDAR",
      subject: "Invitation: Helios Robotics Board Meeting @ Thu Jul 9, 10:00 (PT)",
      snooze: "Jul 9",
      messages: [
        { fromName: "Google Calendar", from: "calendar-invite@google.com", to: [ME], cc: [], time: "9h", unread: true,
          body: "You have been invited to: Helios Robotics Board Meeting\nWhen: Thursday, July 9, 2026 10:00 – 11:30 AM (PT)\nWhere: Zoom (link in event)\nOrganizer: maya@heliosrobotics.io\n\nAgenda: Q2 financials, Series A close, hiring plan." },
      ],
    },
    {
      id: "t-newsletter-strictly", split: "other", unread: true, starred: false, label: "",
      subject: "StrictlyVC: Andreessen's newest fund, a fintech reckoning",
      messages: [
        { fromName: "StrictlyVC", from: "connie@strictlyvc.com", to: [ME], cc: [], time: "12h", unread: true,
          html: `<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;font-family:Georgia,serif">
  <tr><td style="background:#111827;color:#f9fafb;padding:18px 24px;font-size:20px;font-weight:bold">StrictlyVC</td></tr>
  <tr><td style="padding:20px 24px;font-size:15px;line-height:1.6;color:#111827">
    <p style="margin:0 0 12px">Top of the morning. <strong>A16z is raising its largest fund yet</strong>, per two sources with knowledge of the matter — a vehicle that would eclipse its 2024 flagship.</p>
    <p style="margin:0 0 12px">Also today: the fintech secondaries market heats up, and a profile of <a href="#">the quiet giant of vertical SaaS</a>.</p>
    <table cellpadding="8" style="border:1px solid #e5e7eb;border-collapse:collapse;width:100%;font-size:13px">
      <tr style="background:#f3f4f6"><td><b>Fund</b></td><td><b>Target</b></td><td><b>Status</b></td></tr>
      <tr><td>Flagship VIII</td><td>$8.0B</td><td>Raising</td></tr>
      <tr><td>Bio Fund IV</td><td>$2.5B</td><td>Closed</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#6b7280">You're receiving this because you subscribed. <a href="#">Unsubscribe</a></p>
  </td></tr>
</table>` },
      ],
    },
    {
      id: "t-newsletter-lenny", split: "other", unread: true, starred: false, label: "",
      subject: "How the best PMs run discovery (Lenny's Newsletter)",
      messages: [
        { fromName: "Lenny Rachitsky", from: "lenny@substack.com", to: [ME], cc: [], time: "Mon", unread: true,
          body: "This week: a deep dive on continuous discovery habits, with playbooks from PMs at Figma, Linear, and Notion.\n\nRead time: 12 minutes." },
      ],
    },
    {
      id: "t-github", split: "other", unread: false, starred: false, label: "",
      subject: "[snail-mail] Your workflow run failed: CI on main",
      messages: [
        { fromName: "GitHub", from: "notifications@github.com", to: [ME], cc: [], time: "Mon",
          body: "CI on main failed after 2m14s.\n\nwindows-build: error LNK2019 unresolved external symbol...\n\nView the full run for details." },
      ],
    },
    {
      id: "t-wire-receipt", split: "other", unread: false, starred: false, label: "",
      subject: "Wire transfer confirmation — Mercury",
      messages: [
        { fromName: "Mercury", from: "no-reply@mercury.com", to: [ME], cc: [], time: "Sun",
          body: "Your outgoing wire of $250,000.00 to Helios Robotics Inc. has been sent. Reference: MRC-99418-2026. It should arrive within 1 business day." },
      ],
    },
    {
      id: "t-lp-update", split: "other", unread: false, starred: true, label: "IMPORTANT",
      subject: "LP quarterly update — Fund II",
      messages: [
        { fromName: "Fund Ops", from: "ops@cadencevp.com", to: [ME], cc: [], time: "Jun 27",
          body: "Reminder that the Fund II quarterly letter is due to LPs by the 10th. Draft numbers are in the data room; the TVPI moved to 1.8x with the Helios markup. Need your narrative section by Wednesday." },
      ],
    },
  ];

  const events = [
    { title: "Standup", start: 8.5, end: 9, past: true },
    { title: "Helios Board Meeting", start: 10, end: 11.5 },
    { title: "1:1 — Priya", start: 12, end: 12.5 },
    { title: "Founder pitch — Fieldstone Bio", start: 14, end: 14.5 },
    { title: "LP call", start: 16, end: 17 },
  ];

  const suggestions = [
    "Confirmed — the 15th works on our end. I'll send wiring details separately today.",
    "Thanks Maya. Reviewing with counsel now; you'll have the go/no-go by tomorrow AM.",
    "Can we push the close to the 17th? Two of our wires settle Monday.",
  ];

  // Per-thread presentation metadata: auto-labels, unread dot hue, and the
  // contact-panel identity. Kept separate so thread fixtures stay clean.
  const meta = {
    "t-term-sheet": { dot: "blue", labels: [{ name: "pitch", color: "violet" }], contact: { role: "Partner", company: "Helios Robotics", history: ["Series A term sheet", "Board pro-rata changes", "Wiring logistics"] } },
    "t-diligence": { dot: "pink", labels: [{ name: "CRM", color: "green" }], contact: { role: "Principal", company: "Granite Capital", history: ["Diligence follow-ups", "IC memo — draft", "Retention cohorts"] } },
    "t-board-deck": { dot: "violet", labels: [], contact: { role: "Operating Partner", company: "Cadence Ventures", history: ["Q2 board deck", "Corvid memo feedback", "Hiring plan"] } },
    "t-intro-founder": { dot: "amber", labels: [{ name: "pitch", color: "violet" }], contact: { role: "Founder & CEO", company: "Fieldstone Bio", history: ["Fieldstone seed deck", "Intro from James"] } },
    "t-cal-board": { dot: "blue", labels: [{ name: "calendar", color: "blue" }], contact: { role: "", company: "Google Calendar", history: ["Board meeting invite"] } },
    "t-newsletter-strictly": { dot: "amber", labels: [{ name: "news", color: "amber" }], contact: { role: "Editor", company: "StrictlyVC", history: ["Daily briefing"] } },
    "t-newsletter-lenny": { dot: "amber", labels: [{ name: "news", color: "amber" }], contact: { role: "Author", company: "Substack", history: ["Weekly essay"] } },
    "t-github": { dot: "gray", labels: [], contact: { role: "", company: "GitHub", history: ["CI on main failed"] } },
    "t-wire-receipt": { dot: "gray", labels: [{ name: "receipts", color: "gray" }], contact: { role: "", company: "Mercury", history: ["Wire confirmation"] } },
    "t-lp-update": { dot: "pink", labels: [{ name: "CRM", color: "green" }], contact: { role: "Fund Operations", company: "Cadence VP", history: ["LP quarterly letter", "TVPI update"] } },
  };

  const autoLabels = [
    { name: "CRM", color: "green" },
    { name: "Marketing", color: "blue" },
    { name: "News", color: "amber" },
    { name: "Pitch", color: "violet" },
  ];

  const searchTips = [
    ["from:maya", "from Maya"], ["to:dev", "to Dev"], ["\"term sheet\"", "contains \"term sheet\""],
    ["has:attachment", "with attachments"], ["subject:diligence", "subject contains \"diligence\""],
    ["in:sent", "in Sent"], ["in:inbox", "in the Inbox"], ["-in:inbox", "not in the Inbox"],
    ["is:unread", "unread conversations"], ["is:starred", "starred conversations"],
    ["before:2026/06/01", "before June 2026"], ["older_than:3d", "more than 3 days ago"],
  ];

  // Week of Sun Jul 5 – Sat Jul 11, 2026. Today is Fri Jul 10 (index 5).
  // Hours are 24h decimals (8.5 = 8:30). Every event names a `cal`; its color
  // comes from that calendar in `calAccounts`.
  const days = ["Sun 5", "Mon 6", "Tue 7", "Wed 8", "Thu 9", "Fri 10", "Sat 11"];
  const todayCol = 5;

  // Calendars, grouped by connected account — the right-hand panel. Each owns
  // one hue from the --cal-* palette. `on` = shown by default; toggling a
  // checkbox shows/hides that calendar's events in the grid. The two accounts
  // with `warning` are disconnected (need reconnect) — collapsed, no calendars.
  const calAccounts = [
    { email: "you@snailmail.app", expanded: true, calendars: [
      { id: "you", name: "You", color: "cerulean", on: true },
      { id: "team", name: "Team", color: "green", on: true },
      { id: "focus", name: "Focus", color: "violet", on: true },
      { id: "holidays", name: "Holidays in United States", color: "gray", on: false },
    ] },
    { email: "partners@cadence.vc", expanded: true, calendars: [
      { id: "cadence", name: "Cadence Partners", color: "amber", on: true },
      { id: "portfolio", name: "Portfolio reviews", color: "rose", on: true },
      { id: "intros", name: "Founder intros", color: "teal", on: false },
    ] },
    { email: "you@gmail.com", expanded: false, warning: "Needs reconnect", calendars: [] },
    { email: "board@heliosrobotics.io", expanded: false, warning: "Needs reconnect", calendars: [] },
  ];

  const weekEvents = [
    // Sun 5
    { day: 0, cal: "focus", title: "Weekend reading", start: 10, end: 11 },
    { day: 0, cal: "you", title: "Family brunch", start: 12, end: 13.5 },
    // Mon 6
    { day: 1, cal: "holidays", title: "Summer bank holiday (UK)", allDay: true },
    { day: 1, cal: "team", title: "Daily standup", start: 8.5, end: 9, past: true },
    { day: 1, cal: "focus", title: "Focus block — deep work", start: 9, end: 12 },
    { day: 1, cal: "cadence", title: "Kristen's office hours", start: 11.5, end: 12.5, loc: "Zoom", meet: true },
    { day: 1, cal: "you", title: "1:1 — Priya", start: 15, end: 15.5, guests: [{ name: "Priya Nair", status: "accepted" }] },
    { day: 1, cal: "portfolio", title: "Spain & Portugal — trip hold", start: 17.5, end: 19 },
    // Tue 7
    { day: 2, cal: "team", title: "Daily standup", start: 8.5, end: 9 },
    { day: 2, cal: "team", title: "Reminder: complete your reviews", start: 9, end: 9.25 },
    { day: 2, cal: "cadence", title: "Reach out to SF billing", start: 10, end: 10.75 },
    { day: 2, cal: "intros", title: "Julie ↔ you", start: 15, end: 16, guests: [{ name: "Julie Tran", status: "accepted" }] },
    { day: 2, cal: "portfolio", title: "Climate smart community sync", start: 20, end: 20.75 },
    // Wed 8
    { day: 3, cal: "team", title: "Daily standup", start: 8.5, end: 9 },
    { day: 3, cal: "cadence", title: "You & Karim", start: 11, end: 11.5, meet: true },
    { day: 3, cal: "team", title: "Functional lead team meeting", start: 11, end: 12.5, loc: "War room" },
    { day: 3, cal: "portfolio", title: "Second nature policy review", start: 13.5, end: 14.25 },
    { day: 3, cal: "cadence", title: "July market insight [virtual]", start: 14, end: 14.75, meet: true },
    { day: 3, cal: "portfolio", title: "TB/SSP flex weekly check-in", start: 14.75, end: 15.5 },
    { day: 3, cal: "you", title: "SSP personal block", start: 15.5, end: 18 },
    { day: 3, cal: "you", title: "Send off for Tara (in person)", start: 15.5, end: 17, loc: "The Battery" },
    // Thu 9
    { day: 4, cal: "cadence", title: "Fuel bid bi-weekly working session", start: 9.5, end: 11.5, meet: true },
    { day: 4, cal: "team", title: "BDR end-to-end automation", start: 11, end: 12 },
    { day: 4, cal: "intros", title: "Lena (Fieldstone) intro", start: 13, end: 13.5, guests: [{ name: "Lena Okafor", status: "needsAction" }] },
    { day: 4, cal: "portfolio", title: "Helios board prep", start: 16, end: 17 },
    // Fri 10 (today)
    { day: 5, cal: "you", title: "SSP personal block", start: 8, end: 11 },
    { day: 5, cal: "cadence", title: "Tina's office hours", start: 11, end: 12, meet: true },
    { day: 5, cal: "team", title: "Reminder: submit your timesheet", start: 16, end: 16.25 },
    // Sat 11
    { day: 6, cal: "focus", title: "Long run", start: 8, end: 9.5 },
  ];

  return { ME, threads, events, suggestions, meta, autoLabels, searchTips, days, todayCol, calAccounts, weekEvents };
})();
