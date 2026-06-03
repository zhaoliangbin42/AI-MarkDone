# Chrome Google Drive OAuth Runbook

AI-MarkDone Chrome production item ID:

```text
bmdhdihdbhjbkfaaainidcjbgidkbeoh
```

Google Drive Backup uses Chrome extension `identity`, manifest `oauth2`, and the Drive `drive.file` scope. The Google Cloud OAuth client must use the **Chrome Extension** application type and its Item ID must match the Chrome Web Store item ID above.

## Local Development ID

Chrome builds now include the Chrome Web Store public key by default, so local `Load unpacked` builds should use the same extension ID as production:

```bash
npm run build:chrome
```

If you are auditing the key source, use this checklist:

1. Open the Chrome Web Store Developer Dashboard.
2. Open the AI-MarkDone item.
3. Go to Package and copy the public key.

The Chrome Web Store public key is tracked in `config/extension/chromeWebStore.ts`. The manifest generator derives the extension ID from that key and fails if it does not equal `bmdhdihdbhjbkfaaainidcjbgidkbeoh`.

If you need to test a different Chrome Web Store item, override the key explicitly:

```bash
AIMD_CHROME_EXTENSION_KEY="<public key copied from Chrome Web Store>" npm run build:chrome
```

## OAuth Client

In Google Cloud Console:

1. Enable Google Drive API.
2. Configure the OAuth consent screen with the Drive `drive.file` scope.
3. Create an OAuth client with application type **Chrome Extension**.
4. Set Item ID to `bmdhdihdbhjbkfaaainidcjbgidkbeoh`.
5. Put that OAuth client ID in `config/extension/cloudBackup.ts`.

Do not use a Web application, Desktop app, or Android OAuth client for Chrome `identity.getAuthToken()`.

The OAuth client ID is a public application identifier for the AI-MarkDone Chrome extension. It is not a developer Google account credential and does not cause users to sign in as the developer. Each installed copy asks Chrome identity for a token from the current user's Chrome profile, and the user authorizes their own Google account. Keep `identity.email` out of the manifest unless a future feature has a reviewed reason to display account identity.

## Release Check

Before releasing Google Drive Backup:

1. Confirm `manifest.chrome.json` contains `identity`, `oauth2.client_id`, and `https://www.googleapis.com/auth/drive.file`.
2. Confirm the Google Cloud Chrome Extension OAuth client Item ID is `bmdhdihdbhjbkfaaainidcjbgidkbeoh`.
3. Load a local Chrome build created by `npm run build:chrome` and verify `chrome://extensions` shows the same ID.
4. Open Settings -> Data Management -> Google Drive Backup (Experimental) -> Google Drive backup settings, then run Test connection. It should complete without asking the UI to expose raw diagnostics.
5. Connect Google Drive from Settings -> Data Management -> Google Drive Backup (Experimental).
6. Run one backup and verify the file appears under `AI-MarkDone/Backups/bookmarks`.
7. Open Manage cloud backups from the gear panel and verify moving a test backup to trash uses Drive trash semantics without changing local bookmarks.

## Local Reload Troubleshooting

When switching an existing unpacked build from a generated local ID to the stable Chrome Web Store ID, do not rely on the old extension card's Reload button. Chrome can retain both the previous local ID and the new keyed ID for the same `dist-chrome` path, and newly added permissions such as `identity` or Google API host permissions may leave the old entry disabled until the extension is loaded fresh.

Use this sequence for local Google Drive testing:

1. Run `npm run build:chrome`.
2. Open `chrome://extensions`.
3. Remove any unpacked AI-MarkDone entries that point to `/Users/benko/Projects/AI-MarkDone/dist-chrome`, especially entries whose ID is not `bmdhdihdbhjbkfaaainidcjbgidkbeoh`.
4. If the Chrome Web Store version with ID `bmdhdihdbhjbkfaaainidcjbgidkbeoh` is installed, disable it while testing the unpacked build.
5. Click Load unpacked and select `/Users/benko/Projects/AI-MarkDone/dist-chrome`.
6. Verify the loaded extension ID is `bmdhdihdbhjbkfaaainidcjbgidkbeoh` and the permissions include `identity`.
7. Open Google Drive backup settings and click Test connection. If the error message says Chrome is still loading an incomplete OAuth build, remove the old unpacked card and reload `dist-chrome` instead of retrying sign-in.
8. If Chrome still reports a load error, open the Errors view for that extension and copy the first error message before changing the build again.
