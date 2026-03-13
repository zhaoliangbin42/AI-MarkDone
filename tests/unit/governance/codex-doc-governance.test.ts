import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

const activeDocs = [
    'AGENTS.md',
    'README.md',
    'README.zh.md',
    'docs/README.md',
    'docs/governance/DOCS_GOVERNANCE.md',
    'docs/style/STYLE_SYSTEM.md',
    'docs/style/STYLE_ARCHITECTURE.md',
    'docs/architecture/CURRENT_STATE.md',
    'docs/architecture/RUNTIME_PROTOCOL.md',
    '.codex/rules/critical-rules.md',
    '.codex/rules/documentation.md',
    '.codex/guides/development.md',
];

function readRepoFile(file: string): string {
    return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

function collectLocalMarkdownLinks(file: string): string[] {
    const source = readRepoFile(file);
    return Array.from(source.matchAll(/\[.+?\]\((?!https?:\/\/)([^)]+)\)/g)).map((match) => match[1]);
}

describe('codex documentation governance', () => {
    it('active entry and governance docs no longer reference the legacy .agent path', () => {
        const offenders = activeDocs.filter((file) => readRepoFile(file).includes('.agent/'));
        expect(offenders, offenders.join('\n')).toEqual([]);
    });

    it('active entry docs no longer mention legacy artifact workflow terms', () => {
        const bannedPatterns = [
            /\bAntigravity\b/,
            /(^|[^A-Za-z0-9_])implementation_plan\.md([^A-Za-z0-9_]|$)/,
            /(^|[^A-Za-z0-9_])task\.md([^A-Za-z0-9_]|$)/,
            /(^|[^A-Za-z0-9_])walkthrough\.md([^A-Za-z0-9_]|$)/,
            /(^|\s)\/develop(\s|$)/,
            /(^|\s)\/bugfix(\s|$)/,
        ];
        const offenders: string[] = [];

        for (const file of activeDocs) {
            const source = readRepoFile(file);
            if (bannedPatterns.some((pattern) => pattern.test(source))) {
                offenders.push(file);
            }
        }

        expect(offenders, offenders.join('\n')).toEqual([]);
    });

    it('AGENTS.md only links to existing local markdown documents', () => {
        const missing: string[] = [];

        for (const relative of collectLocalMarkdownLinks('AGENTS.md')) {
            const normalized = path.resolve(repoRoot, relative);
            if (!fs.existsSync(normalized)) {
                missing.push(relative);
            }
        }

        expect(missing, missing.join('\n')).toEqual([]);
    });

    it('docs README and documentation rule files only link to existing local markdown documents', () => {
        const files = ['docs/README.md', '.codex/rules/documentation.md', 'docs/governance/DOCS_GOVERNANCE.md'];
        const missing: string[] = [];

        for (const file of files) {
            for (const relative of collectLocalMarkdownLinks(file)) {
                const normalized = path.resolve(repoRoot, path.dirname(file), relative);
                if (!fs.existsSync(normalized)) {
                    missing.push(`${file} -> ${relative}`);
                }
            }
        }

        expect(missing, missing.join('\n')).toEqual([]);
    });

    it('requires the current state and runtime protocol architecture documents', () => {
        const required = [
            'docs/architecture/CURRENT_STATE.md',
            'docs/architecture/BLUEPRINT.md',
            'docs/architecture/RUNTIME_PROTOCOL.md',
        ];
        const missing = required.filter((file) => !fs.existsSync(path.join(repoRoot, file)));
        expect(missing, missing.join('\n')).toEqual([]);
    });

    it('keeps ADR files on the expected naming convention', () => {
        const adrDir = path.join(repoRoot, 'docs/adr');
        const files = fs.readdirSync(adrDir).filter((file) => file.endsWith('.md'));
        const offenders = files.filter((file) => !['README.md', 'ADR_TEMPLATE.md'].includes(file) && !/^ADR-\d{4}-[a-z0-9-]+\.md$/.test(file));
        expect(offenders, offenders.join('\n')).toEqual([]);
    });

    it('AGENTS.md keeps the required self-improvement engineering behaviors', () => {
        const source = readRepoFile('AGENTS.md');

        expect(source).toContain('Treat user corrections as process failures');
        expect(source).toContain('For bug fixes, reproduce the bug with a failing test');
        expect(source).toContain('Before writing code for a materially ambiguous request');
        expect(source).toContain('After any code change, explicitly list important edge cases');
    });
});
