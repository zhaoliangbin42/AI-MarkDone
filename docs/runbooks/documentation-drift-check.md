# Documentation Drift Check Runbook

适用场景：修改代码后不确定应该更新哪份文档，或怀疑当前文档已经与实现漂移。

## Checks

1. 如果改的是“当前已落地事实”，更新 `docs/architecture/CURRENT_STATE.md`
2. 如果改的是“目标方向或未来约束”，更新 `docs/architecture/BLUEPRINT.md`
3. 如果改的是 content/background 协议或错误码，更新 `docs/architecture/RUNTIME_PROTOCOL.md`
4. 如果改的是高影响长期决策，新增或更新 `docs/adr/*`
5. 如果改的是重复出现的排查步骤，考虑补到 `docs/runbooks/*`
6. 如果改的是平台语义，检查 `ADAPTER_CONTRACT.md` 与 `CAPABILITY_MATRIX.md`

## Related Documents

- `.codex/rules/documentation.md`
- `docs/governance/DOCS_GOVERNANCE.md`
- `docs/README.md`

## Exit Criteria

- 每个高影响变化都能落到唯一权威文档
- 不再出现同一事实在多个文档重复定义
