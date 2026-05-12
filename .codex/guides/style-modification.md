# Style Modification Guide

## Applies To

- UI restyling
- Token usage changes
- Shadow DOM style adjustments

## Start Here

- Read `.codex/rules/style-guide.md`
- Read `docs/design.md`

## Workflow

1. Search current token and selector usage before editing.
2. Reuse semantic tokens and shared style entrypoints where possible.
3. Keep host-page concerns out of component CSS.
4. When a visual bug appears as clipping, overflow, or crowding, identify the layout responsibility before changing sizes. Prefer fixing the sizing model, shrink behavior, stacking context, or overflow boundary over compensating with one-off width, padding, or z-index values.
5. Validate that style changes stay inside the owned UI surface.
6. Update style docs if the change alters long-lived token or layering policy.
7. Finish with `npm run build`.

## References

- `.codex/rules/critical-rules.md`
- `.codex/rules/style-guide.md`
- `docs/design.md`

## Done When

- No hardcoded UI values replaced an existing tokenized pattern.
- No new host-page styling leakage was introduced.
- `npm run build` succeeds.
