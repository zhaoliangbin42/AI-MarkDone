# DEVLOG (Append-only)

Purpose: evidence log for major changes (commands run + observed results). Keep entries short and factual.

---

## 2026-03-03 — P0 Message Sending (ChatGPT-only) + UI hook + regression gates

- Added message sending vertical domain (core/content driver/service) with ChatGPT adapter hooks.
- Wired ReaderPanel to support a Send action via `sending: { adapter }` (no background/storage writes).
- Fixed ChatGPT send button selection to avoid triggering Voice/Dictate state.
- Adjusted streaming word-count display to avoid duplicate `Streaming…` text.

Verification:
- `npm run type-check` (pass)
- `npm run test:core` (pass)
- `npm run build` (pass; Chrome MV3 + Firefox MV2)

## 2026-03-03 — Docs minimization + governance test scripts update

- Removed outdated docs and legacy review artifacts from `docs/` to keep a small authoritative set.
- Replaced deleted legacy-governance test scripts with current governance gates (dependency boundaries + manifest consistency).

Verification:
- `npm run test:smoke` (pass)
- `npm run type-check` (pass)
- `npm run test:core` (pass)
