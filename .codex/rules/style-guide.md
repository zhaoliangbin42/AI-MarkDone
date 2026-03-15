# Style Guide

This rule set covers shipped extension UI, not host-page styling.

## Core Rules

- Use `--aimd-*` tokens as the only canonical source for colors, spacing, radius, z-index, and motion.
- Render extension UI inside Shadow DOM unless the scenario is explicitly documented as an exception.
- Keep selector scope inside the owned UI surface.
- Do not use `!important` outside print-specific rules.
- Treat host-platform theme detection as a driver concern, not a component concern.
- Tailwind is allowed only for overlay-style singleton UI surfaces; do not use it in toolbar, inline message UI, or other high-frequency injected surfaces.
- If Tailwind is used, it must be semantic-alias-only, prefixed with `tw`, and shipped without Preflight.

## Practical Checks

- Prefer semantic tokens over primitive values.
- Prefer shared style entrypoints such as `src/style/tokens.ts` and `src/style/pageTokens.ts`.
- Reuse existing UI style patterns before inventing new component-scoped token layers.
- Tailwind aliases must map back to `--aimd-*`; do not let Tailwind theme values become a second token source.
- New UI modules must pass the mock-first browser visual workflow in `mocks/components/<module>/index.html` before merging into `src/ui/**`.

## References

- `src/style/reference-tokens.ts`
- `src/style/system-tokens.ts`
- `src/style/tokens.ts`
- `docs/style/STYLE_SYSTEM.md`
- `docs/style/STYLE_ARCHITECTURE.md`
- `docs/testing/TESTING_BLUEPRINT.md`
