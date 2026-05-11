# Privacy Policy

**Last Updated: May 11, 2026**

## Data Collection

AI-MarkDone does **not collect or transmit extension data to our own servers**.

## What We Don't Collect

- ❌ No personal information
- ❌ No browsing history
- ❌ No usage analytics
- ❌ No tracking or cookies

## How It Works

Most processing happens **locally in your browser**:
- Content parsing occurs on your device
- We do not operate any backend service and do not receive your data

## Local Storage

AI-MarkDone stores some data **locally in your browser** to provide features:
- **Preferences/Settings**: saved via browser extension storage.
- **Bookmarks (optional, user-triggered)**: may store conversation content (your message and the assistant response) in local extension storage, so you can view/export it later.

You can delete stored data at any time by clearing the extension's site data / extension storage, or by removing the extension.

## Browser Sync (Optional)

Some preferences may be stored using the browser's **sync storage** (if supported and enabled in your browser/account), which may sync those preferences across your devices. This is provided by the browser vendor's sync service.

## Google Drive Backup (Optional)

Google Drive backup is optional and user-initiated. If you connect Google Drive from Settings → Data Management, AI-MarkDone can upload verified bookmark snapshot files directly from your browser to your own Google Drive.

- AI-MarkDone does not operate a backup server and does not receive these files.
- Backup v1 only includes bookmarks. It does not include settings, OAuth tokens, account passwords, or other cloud credentials.
- Google Drive authorization is stored by the browser/extension identity system and can be disconnected from Settings.
- Backup files are saved in a visible Google Drive folder: `AI-MarkDone/Backups/bookmarks`.

## Permissions Used

- **storage**: Save user preferences locally in your browser
- **clipboardWrite**: Copy content when you click copy buttons
- **host permissions**: Inject UI on supported websites (ChatGPT, Gemini, Claude, DeepSeek)
- **identity / Google API host permission (Chrome only)**: Let you optionally connect Google Drive for bookmark backups

## Your Privacy

- ✅ Complete privacy - we see nothing
- ✅ Works offline for core features after installation
- ✅ Open source - code is auditable
- ✅ No AI-MarkDone backend service

---

**In short: We don't have a server. Your data stays in your browser storage, and optional Google Drive backups go directly to the Google Drive account you connect.**
