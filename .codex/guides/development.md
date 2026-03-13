# Development Guide

## Applies To

- New features
- Behavior changes
- Refactors that alter user-facing flows or architectural boundaries

## Start Here

- Read [AGENTS.md](../../AGENTS.md)
- Read `.codex/rules/critical-rules.md`
- Read the relevant contract or architecture document in `docs/`

## Workflow

1. Clarify the goal, scope, and success criteria.
   - If the request is materially ambiguous, stop and ask before coding.
2. Search the existing code paths before editing.
3. Identify affected contracts, runtime surfaces, and browser targets.
4. Implement the smallest coherent change.
5. Update authoritative docs when the change affects contracts, support matrices, or architecture boundaries.
6. Verify with tests as needed and finish with `npm run build`.
7. Close by listing edge cases and any missing or recommended follow-up tests.

## References

- `.codex/rules/commenting.md`
- `.codex/rules/logging.md`
- `.codex/rules/documentation.md`
- `docs/architecture/BLUEPRINT.md`
- `docs/architecture/DEPENDENCY_RULES.md`

## Done When

- The behavior works across the intended runtime surfaces.
- Required docs are updated.
- `npm run build` succeeds.
- Edge cases and test coverage gaps are made explicit.
