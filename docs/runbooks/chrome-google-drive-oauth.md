# Google Drive OAuth Runbook

AI-MarkDone Chrome production item ID:

```text
bmdhdihdbhjbkfaaainidcjbgidkbeoh
```

Google Drive Backup follows the browser-extension OAuth path selected from runtime capability:

1. Chrome/Chromium builds request `identity`, include manifest `oauth2.client_id/scopes`, and also carry a Web application OAuth client ID for WebAuth-compatible browsers.
2. Google Chrome uses `chrome.identity.getAuthToken()` with the manifest Chrome Extension OAuth client so Chrome manages the Google identity cache and refresh behavior.
3. WebAuth-compatible browsers use `identity.launchWebAuthFlow()` with the configured Web application OAuth client and `identity.getRedirectURL()`.
4. Firefox requests `identity` plus Google API host permissions and uses the same WebAuth path with its configured Web application OAuth client.
5. Safari v1 does not expose Google Drive Backup.
6. The runtime never stores refresh tokens or client secrets.

Google Chrome uses browser-managed Google identity. Interactive connect first tries `getAuthToken({ interactive: false })`, then calls `getAuthToken({ interactive: true })` only when confirmation is required. Later backup/list/restore/manage operations reuse the short local token cache first, then call `getAuthToken`. Browser identity owns Chrome's long-lived authorization experience. If Drive returns 401, the provider removes the browser cached token, clears the local token cache, and retries once with a fresh token.

WebAuth fallback builds the Google OAuth URL with only `client_id`, `redirect_uri`, `response_type=token`, and `scope=https://www.googleapis.com/auth/drive.file`; no custom path, state field, prompt field, or runtime scope override is added. The `client_id` for this fallback must be a Google Cloud **Web application** OAuth client, because Google matches `identity.getRedirectURL()` as an authorized redirect URI. Chromium uses the stable redirect `https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/`; this is one Chromium redirect as long as the extension ID stays stable, not one redirect per Chromium browser brand. If Firefox returns Mozilla's `*.extensions.allizom.org` domain, the provider uses Firefox 86+'s Google-compatible loopback form `http://127.0.0.1/mozoauth2/<derived-subdomain>`.

Access tokens are never written to snapshots, protocol responses, or docs. The provider caches short-lived access tokens in extension local storage only until their expiry so service-worker restarts do not break a user-triggered workflow. The extension never stores refresh tokens. Status responses separate `connectedAccount` from `sessionState`: the account label tells the user which Drive was connected, while `sessionState` tells the UI whether the current provider strategy is ready.

## Local Development ID

Chrome builds now include the Chrome Web Store public key by default, so local `Load unpacked` builds should use the same extension ID as production:

```bash
npm run build:chrome
```

If you are auditing the key source, use this checklist:

1. Open the Chrome Web Store Developer Dashboard.
2. Open the AI-MarkDone item.
3. Go to Package and copy the public key.

The Chrome Web Store public key is tracked in `config/extension/chromeWebStore.ts`. The manifest generator derives the extension ID from that key and fails if it does not equal `bmdhdihdbhjbkfaaainidcjbgidkbeoh`. This key keeps local unpacked Chromium builds aligned with the Chrome Extension OAuth client binding.

If you need to test a different Chrome Web Store item, override the key explicitly:

```bash
AIMD_CHROME_EXTENSION_KEY="<public key copied from Chrome Web Store>" npm run build:chrome
```

## OAuth Clients

For Google Cloud Console:

1. Enable Google Drive API.
2. Configure the OAuth consent screen with the Drive `drive.file` scope.
3. Create a **Chrome Extension** OAuth client for Chromium builds.
4. Bind that Chrome Extension OAuth client to item ID `bmdhdihdbhjbkfaaainidcjbgidkbeoh`.
5. Put that client ID in `GOOGLE_DRIVE_CHROME_EXTENSION_CLIENT_ID` in `config/extension/cloudBackup.ts`; this value becomes `manifest.oauth2.client_id`.
6. Create a **Web application** OAuth client for `launchWebAuthFlow` fallback.
7. Add the Chromium redirect URI `https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/` to that Web OAuth client's Authorized redirect URIs.
8. Add the Firefox redirect URI returned by diagnostics, or the provider's loopback equivalent when Firefox returns an allizom URL. Firefox uses the stable AMO Gecko ID `ai-markdone@zhaoliangbin.com`, so its redirect URI stays stable after the manifest is generated. These redirects belong in the OAuth client redirect list, not in the OAuth consent screen authorized-domain list.
9. Put that Web OAuth client ID in `GOOGLE_DRIVE_WEB_AUTH_CLIENT_ID` in `config/extension/cloudBackup.ts`.
10. Regenerate the target manifest after any client or redirect URI change.

Do not put a client secret into the extension.

The OAuth client IDs are public application identifiers for AI-MarkDone. They are not developer Google account credentials and do not cause users to sign in as the developer. Each installed copy asks the browser identity API for a token from the current user's browser/profile, and the user authorizes their own Google account. Keep `identity.email` out of the manifest unless a future feature has a reviewed reason to request that permission; account display currently comes from Drive `about.get`.

## Google Auth Platform Publishing

Google Drive Backup must be published from Google Auth Platform before non-test Google accounts can connect.

Current production settings:

- App name: `AI-MarkDone`
- Publishing status: `Production`
- User type: `External`
- Scope: `https://www.googleapis.com/auth/drive.file` only
- Sensitive scopes: none
- Restricted scopes: none
- Authorized domains: `zhaoliangbin42.github.io`
- Homepage: `https://zhaoliangbin42.github.io/ai-markdone/en/`
- Privacy policy: `https://zhaoliangbin42.github.io/ai-markdone/privacy/`
- Terms link: `https://zhaoliangbin42.github.io/ai-markdone/privacy/`

Google blocks non-test users with "has not completed the Google verification process" when the app remains in Testing. Moving the app to Production fixes that access gate when the app only requests the non-sensitive `drive.file` scope. If a logo, sensitive scope, restricted scope, or additional brand domains are added later, re-check Google Auth Platform verification before release.

Google Auth Platform brand verification checks Search Console ownership for the homepage domain. `zhaoliangbin42.github.io` is registered in Search Console with Google Analytics verification. Keep the site's `gtag.js` tracking code in place or add another Search Console verification method before changing the homepage or authorized domains.

## Release Check

Before releasing Google Drive Backup:

1. Confirm `manifest.chrome.json` contains `identity`, `oauth2.client_id`, `drive.file`, Google API host permissions, and the stable `key`.
2. Confirm `GOOGLE_DRIVE_CHROME_EXTENSION_CLIENT_ID` is a Google Cloud Chrome Extension OAuth client bound to `bmdhdihdbhjbkfaaainidcjbgidkbeoh`.
3. Confirm the generated Firefox manifest contains `identity`, Google API host permissions, and Gecko ID `ai-markdone@zhaoliangbin.com`.
4. Confirm `GOOGLE_DRIVE_WEB_AUTH_CLIENT_ID` is a Google Cloud Web application OAuth client and contains the exact Chromium and Firefox redirect URIs reported by diagnostics.
5. Confirm Google Auth Platform is `Production`, `External`, and only lists `drive.file` under non-sensitive scopes.
6. Confirm the OAuth consent page reaches account selection for a non-test account without `invalid_request` or "has not completed the Google verification process".
7. Load a local Chrome build created by `npm run build:chrome` and verify `chrome://extensions` shows the same ID.
8. Open Settings -> Data Management -> Google Drive Backup (Experimental) -> Google Drive backup settings, then run Test connection. Google Chrome should report `browserManagedGoogleIdentity`; WebAuth-compatible browsers should report `webExtensionAccessToken` and use the Web OAuth client; Firefox should report `webExtensionAccessToken` when manifest OAuth is unavailable.
9. Connect Google Drive from Settings -> Data Management -> Google Drive Backup (Experimental) and confirm the settings panel shows the connected account.
10. Run one backup and verify the file appears under `AI-MarkDone/Backups/bookmarks`.
11. Open Manage cloud backups from the gear panel and verify moving a test backup to trash uses Drive trash semantics without changing local bookmarks.

## Local Reload Troubleshooting

When switching an existing unpacked build from a generated local ID to the stable Chrome Web Store ID, do not rely on the old extension card's Reload button. Chrome can retain both the previous local ID and the new keyed ID for the same `dist-chrome` path, and newly added permissions such as `identity` or Google API host permissions may leave the old entry disabled until the extension is loaded fresh.

Use this sequence for local Google Drive testing:

1. Run `npm run build:chrome`.
2. Open `chrome://extensions`.
3. Remove any unpacked AI-MarkDone entries that point to `/Users/benko/Projects/AI-MarkDone/dist-chrome`, especially entries whose ID is not `bmdhdihdbhjbkfaaainidcjbgidkbeoh`.
4. If the Chrome Web Store version with ID `bmdhdihdbhjbkfaaainidcjbgidkbeoh` is installed, disable it while testing the unpacked build.
5. Click Load unpacked and select `/Users/benko/Projects/AI-MarkDone/dist-chrome`.
6. Verify the loaded extension ID is `bmdhdihdbhjbkfaaainidcjbgidkbeoh` and the permissions include `identity`.
7. Open Google Drive backup settings and click Test connection. If Google Chrome reports an invalid `getAuthToken` request, verify the manifest Chrome Extension OAuth client type, item ID binding, and stable extension ID. If WebAuth reports `redirect_uri_mismatch`, compare the exact diagnostics redirect URI with the Authorized redirect URIs in the Google Cloud Web OAuth client.
8. If Chrome still reports a load error, open the Errors view for that extension and copy the first error message before changing the build again.
