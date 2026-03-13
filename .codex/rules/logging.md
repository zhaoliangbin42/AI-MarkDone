# Logging

Use logs to preserve diagnosability without leaking sensitive information.

## Format

Preferred shape:

```ts
logger.debug('[AI-MarkDone][ReaderPanel] Rendered current item', { itemId });
logger.warn('[AI-MarkDone][Bookmarks] Missing folder path', { folderId });
logger.error('[AI-MarkDone][Parser] Failed to parse message', error);
```

## Levels

- `debug`
  - development diagnostics and state transitions
- `info`
  - notable operational events with user-visible value
- `warn`
  - degraded behavior, fallbacks, or recoverable issues
- `error`
  - failures that require investigation or alter behavior

## Rules

- Include enough module context to locate the source quickly.
- Do not log secrets, raw tokens, or personal content unless there is a clear redaction strategy.
- Remove temporary debug logging before completion.
- Prefer structured context objects for machine-readable details.
