import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const REQUIRED_ROUND3_FILES = [
    'docs/_legacy/review/round-3/audit-coverage-status.md',
    'docs/_legacy/review/round-3/domain-02-render-parse-execution.md',
    'docs/_legacy/review/round-3/domain-04-import-export-recovery-checklist.md',
    'docs/_legacy/review/round-3/domain-04-import-export-recovery-execution.md',
    'docs/_legacy/review/round-3/domain-06-ui-component-governance-checklist.md',
    'docs/_legacy/review/round-3/domain-06-ui-component-governance-execution.md',
    'docs/_legacy/review/round-3/domain-07-security-logging-execution.md',
    'docs/_legacy/review/round-3/domain-08-performance-checklist.md',
    'docs/_legacy/review/round-3/domain-08-performance-execution.md',
    'docs/_legacy/review/round-3/domain-10-release-checklist.md',
    'docs/_legacy/review/round-3/domain-10-release-execution.md'
];

describe('round-3 review governance', () => {
    it('required round-3 checklist/execution artifacts should exist', () => {
        for (const file of REQUIRED_ROUND3_FILES) {
            expect(existsSync(resolve(process.cwd(), file)), `${file} is missing`).toBe(true);
        }
    });

    it('coverage status should list key in-progress domains', () => {
        const source = readFileSync(
            resolve(process.cwd(), 'docs/_legacy/review/round-3/audit-coverage-status.md'),
            'utf-8'
        );

        expect(source).toContain('| 2. 渲染与解析链路 |');
        expect(source).toContain('| 6. UI 组件与交互状态 |');
        expect(source).toContain('| 7. 安全基线与日志治理 |');
        expect(source).toContain('| 11. 文档与变更治理 |');
    });
});
