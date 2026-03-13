# Style Guide

This rule set covers shipped extension UI, not host-page styling.

## Core Rules

- Use `--aimd-*` tokens for colors, spacing, radius, z-index, and motion.
- Render extension UI inside Shadow DOM unless the scenario is explicitly documented as an exception.
- Keep selector scope inside the owned UI surface.
- Do not use `!important` outside print-specific rules.
- Treat host-platform theme detection as a driver concern, not a component concern.

## Practical Checks

- Prefer semantic tokens over primitive values.
- Prefer shared style entrypoints such as `src/style/tokens.ts` and `src/style/pageTokens.ts`.
- Reuse existing UI style patterns before inventing new component-scoped token layers.

## References

- `src/style/reference-tokens.ts`
- `src/style/system-tokens.ts`
- `src/style/tokens.ts`
- `docs/style/STYLE_SYSTEM.md`
- `docs/style/STYLE_ARCHITECTURE.md`
