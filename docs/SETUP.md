# Setup — Windows 11

## 1. Install the toolchain (one time)

1. **Node.js 20+** — [nodejs.org](https://nodejs.org) → LTS installer.
2. **Rust (MSVC)** — [rustup.rs](https://rustup.rs) → run `rustup-init.exe`, accept defaults.
   Or: `winget install Rustlang.Rustup`
3. **Visual Studio Build Tools** (C++ workload) — required by the Rust MSVC toolchain:
   ```powershell
   winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
   ```
4. WebView2 runtime — preinstalled on Windows 11; otherwise [download from Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/).

## 2. Build and run

```powershell
git clone https://github.com/swarnavspujari/zenbox-mail.git
cd zenbox-mail
npm install
npm run app:dev
```

The first Rust build compiles the whole dependency tree (several minutes). After that it's incremental. The app opens in **demo mode** with a mock inbox — everything works without credentials.

## 3. Create the Gmail OAuth client (one time, ~5 minutes)

ZenBox talks to Gmail directly from your machine, so you bring your own OAuth client. Nothing about this client is shared with anyone.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in with any Google account (it does **not** have to be the mail account you'll connect).
2. Top bar → project selector → **New project**. Name it e.g. `zenbox-mail`, Create, and make sure it's selected.
3. **Enable the Gmail API:** ☰ menu → *APIs & Services* → *Library* → search **Gmail API** → Enable.
4. **Consent screen:** *APIs & Services* → *OAuth consent screen*.
   - User type: **External** → Create.
   - App name `ZenBox Mail`, your email for the two contact fields → Save through the remaining steps (no scopes changes needed here).
   - Under **Audience** (or *Test users*): click **Add users** and add the Gmail address you'll connect (e.g. `ssp@rubiareserve.com`). While the app is in "Testing" status, only these users can authorize — that's exactly what we want.
5. **Create the client:** *APIs & Services* → *Credentials* → **Create credentials → OAuth client ID**.
   - Application type: **Desktop app**. Name: `ZenBox Desktop`. Create.
   - Copy the **Client ID** (`…apps.googleusercontent.com`) and **Client secret**.
6. In ZenBox: **Settings → Account** → paste both → **Connect Gmail**. Your browser opens Google's consent page; approve access. You'll see a "Connected" page, and your inbox syncs in.

Notes:
- The requested scope is `gmail.modify` — read, send, archive, label. ZenBox cannot permanently delete mail or touch account settings.
- Credentials are stored in the **Windows Credential Manager**, never on disk or in the repo.
- Google shows an "unverified app" warning while your consent screen is in Testing status — that's your own app; click *Continue*.

## 4. Add an AI key

Settings → **AI Providers** → paste a key for Claude, OpenAI, or NVIDIA NIM → **Save** → **Test connection**. See [AI_PROVIDERS.md](AI_PROVIDERS.md).

## 5. Troubleshooting

| Symptom | Fix |
|---|---|
| `link.exe not found` during build | Install VS Build Tools with C++ workload (step 1.3), restart the terminal |
| Blank window on `app:dev` | Make sure `npm run dev` isn't already running elsewhere on port 1420 |
| `Connect Gmail` opens no browser | Check the client ID/secret for stray whitespace; watch the app console |
| Google error `access_denied` | The connecting address isn't in the consent screen's **Test users** |
| Google error `redirect_uri_mismatch` | Client type must be **Desktop app**, not Web application |
| AI test fails 401 | Key pasted wrong or revoked; save it again |
