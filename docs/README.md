# AI-MarkDone Documentation Hub (Authoritative)

`docs/` is the long-lived source of truth for architecture, contracts, refactor planning, testing strategy, and governance. It is not the entrypoint for day-to-day editing behavior; use [AGENTS.md](../AGENTS.md) and `.codex/*` for that layer.

## Documentation Layers

- `AGENTS.md`
  - repository entrypoint and minimum repository-wide constraints
- `.codex/rules/*`
  - cross-cutting engineering rules
- `.codex/guides/*`
  - activity guides for development, bug fixing, review, release, and adaptation
- `docs/*`
  - stable system knowledge and contracts

## Authoritative Documents

### Architecture

- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/BLUEPRINT.md`
- `docs/architecture/DEPENDENCY_RULES.md`
- `docs/architecture/RUNTIME_PROTOCOL.md`
- `docs/architecture/BROWSER_COMPATIBILITY.md`

### Refactor And Closeout Records

These documents record bounded refactor execution and closeout evidence. They do not replace the long-lived architecture authority above:

- `docs/refactor/UI_SYSTEM_REFACTOR_PLAN.md`
  - delivered UI-system convergence, phase history, and Phase 7 closeout evidence
- `docs/refactor/REFACTOR_CHECKLIST.md`
- `docs/rewrite/PROGRAM.md`
- `docs/rewrite/FEATURE_PARITY.md`

### Contracts

- `docs/FEATURES.md`
  - product capabilities, acceptance boundaries, and platform support policy
- `CONTEXT.md`
  - concise shared product vocabulary for Input Enhancement and other cross-document terms
- `src/contracts/conversationContent.ts`
  - frozen provider-neutral ChatGPT semantic content port V1
- `src/contracts/conversationMaterialization.ts`
  - content-runtime-only typed DOM materialization port V1
- `src/contracts/conversationSurface.ts`
  - atomic ChatGPT page frame joining obtained content with pending, mounted,
    assistant-only, and unmounted surface facts
- `src/contracts/semanticContent.ts`
  - provider-neutral Semantic Content Module interface, immutable document model, source spans, selectors, and projections
- `src/contracts/contentSurface.ts`
  - platform-neutral rendered-surface evidence; DOM Range and host selectors stay in content drivers
- `src/drivers/content/adapters/base.ts`
  - source-level site adapter contract
- `docs/architecture/CURRENT_STATE.md`
  - active platform runtime inventory and adapter behavior boundaries

### Governance

- `docs/governance/DOCS_GOVERNANCE.md`
- `docs/DEVLOG.md`

### Decisions

- `docs/adr/README.md`
- `docs/adr/ADR-0018-chatgpt-identity-proven-single-content-pool.md`
  - active ChatGPT lifecycle: 5.3-compatible GET seed, stable typed DOM
    batches, one monotonic pool, `get → complete` history status, and one
    atomic Conversation Surface; the former Coordinator, Conversation Index,
    and standalone Materialization projections are retired and deleted
- `docs/adr/ADR-0030-chatgpt-get-seed-dom-completion.md`
  - defines GET admission, DOM precedence, provisional source order, and the
    shared Directory/Reader/Export snapshot contract
- `docs/adr/ADR-0011-semantic-content-and-surface-projection.md`
  - retained semantic/source-span and sole surface-to-source projection rules;
    its source-only body rule is superseded by ADR-0018

ADR-0009 through ADR-0017 are historical inputs where ADR-0018 says they are
superseded. They are not alternate current ChatGPT architectures.

### Style

- `docs/design.md`
  - single authority for product feel, UI tokens, component rules, Shadow DOM style injection, and UI-system governance

### Testing

- `docs/testing/CURRENT_TEST_GATES.md`
- `docs/testing/PERFORMANCE_GATES.md`
- `docs/testing/TESTING_BLUEPRINT.md`
- `docs/testing/E2E_REGRESSION_GUIDE.md`

### Runbooks

- `docs/runbooks/platform-dom-breakage.md`
- `docs/runbooks/build-release-validation.md`
- `docs/runbooks/documentation-drift-check.md`

## Maintenance Rules

- Keep one authoritative location per contract or rule.
- Move repeated behavioral guidance into `.codex/rules/*` or `.codex/guides/*`, not into `docs/`.
- Remove or archive stale documents once their content has been absorbed into a current authoritative file.
- Do not add references to non-existent documents.
- Treat `docs/design.md` as the authority for UI style direction.

## Suggested Reading Order

1. `docs/architecture/CURRENT_STATE.md`
2. `docs/architecture/BLUEPRINT.md`
3. `docs/FEATURES.md`
4. `docs/architecture/RUNTIME_PROTOCOL.md`
5. `docs/testing/CURRENT_TEST_GATES.md`

## Read By Change Type

- Current implementation boundaries
  - `docs/architecture/CURRENT_STATE.md`
- Target architecture or dependency direction
  - `docs/architecture/BLUEPRINT.md`
  - `docs/architecture/DEPENDENCY_RULES.md`
- Content/background messaging
  - `docs/architecture/RUNTIME_PROTOCOL.md`
- Platform adapters and support level
  - `src/drivers/content/adapters/base.ts`
  - `docs/architecture/CURRENT_STATE.md`
  - `docs/FEATURES.md`
- Testing and release gates
  - `docs/testing/CURRENT_TEST_GATES.md`
  - `docs/testing/PERFORMANCE_GATES.md`
  - `docs/testing/TESTING_BLUEPRINT.md`
  - `docs/testing/E2E_REGRESSION_GUIDE.md`
- Style-system and UI workflow changes
  - `docs/design.md`
  - `docs/refactor/UI_SYSTEM_REFACTOR_PLAN.md` for implementation history and closeout evidence
