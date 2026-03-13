# Platform Adaptation Guide

## Applies To

- Adding a new supported platform
- Extending adapter capabilities for an existing platform

## Start Here

- Read `docs/antigravity/platform/ADAPTER_CONTRACT.md`
- Read `docs/antigravity/platform/CAPABILITY_MATRIX.md`
- Read `docs/architecture/CURRENT_STATE.md`
- Read `docs/architecture/BROWSER_COMPATIBILITY.md`
- Inspect current adapters in `src/drivers/content/adapters/sites/*`

## Workflow

1. Define the exact support target before coding.
   - new platform support
   - partial capability expansion on an existing platform
   - bug fix for an existing adapter
2. Identify stable DOM anchors, lifecycle constraints, and theme signals on the host platform.
3. Search for existing selectors, parser adapters, and runtime wiring before editing.
4. Implement or extend the adapter without leaking platform selectors into service or UI layers.
5. Register the adapter and update host permissions or runtime gating only if the new platform truly needs them.
6. Verify the minimum platform flows:
   - assistant message discovery
   - toolbar injection idempotency
   - copy path
   - reader path
   - theme sync
   - sending, only if the platform supports it
7. Update the authoritative docs:
   - `ADAPTER_CONTRACT.md` if method semantics changed
   - `CAPABILITY_MATRIX.md` if support level changed
   - `CURRENT_STATE.md` if runtime boundaries or active adapter inventory changed
8. Finish with `npm run build`.

## References

- `.codex/rules/critical-rules.md`
- `.codex/rules/documentation.md`
- `docs/architecture/BLUEPRINT.md`
- `docs/antigravity/platform/ADAPTER_CONTRACT.md`
- `docs/antigravity/platform/CAPABILITY_MATRIX.md`

## Done When

- Platform-specific logic stays inside driver-level adapter code.
- The support matrix reflects the new support level.
- Critical platform flows were checked explicitly instead of assumed.
- `npm run build` succeeds.
