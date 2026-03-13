# Documentation Updates

Documentation changes are required when repository behavior or contracts change in ways future contributors must rely on.

## Update `docs/*` When

- A platform adapter contract changes.
- Platform support status changes.
- Architecture boundaries or dependency direction changes.
- Storage, protocol, or migration semantics change.
- Test gates or release gates change.
- A long-lived style-system rule changes.
- A high-impact architectural decision changes.
- A repeated operational troubleshooting path becomes stable enough to document.

## Update Entry Documents When

- The repository-wide engineering workflow changes.
- The active rules or guides move to a new path.
- The recommended read order changes.

## Path Rules

- Do not add links to missing documents.
- Keep one authoritative path per topic.
- Archive or remove superseded paths once active references have been migrated.
- Treat `docs/antigravity/*` as a historical namespace. It can remain active for stable platform and style contracts, but it does not imply a current dependency on any legacy tooling stack.

## Layer Rules

- `AGENTS.md` is the short repository entrypoint.
- `.codex/rules/*` contains cross-cutting rules.
- `.codex/guides/*` contains process guidance.
- `docs/*` contains stable system knowledge and contracts.

## Canonical Document Roles

- `docs/architecture/CURRENT_STATE.md`
  - current repository reality and active boundaries
- `docs/architecture/BLUEPRINT.md`
  - target architecture and end-state direction
- `docs/architecture/RUNTIME_PROTOCOL.md`
  - content/background message contract
- `docs/adr/*`
  - high-impact architectural decisions and their rationale
- `docs/runbooks/*`
  - stable troubleshooting and validation procedures
