import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function listFilesRecursive(dir: string, filter: (path: string) => boolean): string[] {
    const out: string[] = [];
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...listFilesRecursive(full, filter));
            continue;
        }
        if (filter(full)) out.push(full);
    }
    return out;
}

function extractModuleSpecifiers(source: string): string[] {
    const specs: string[] = [];
    const lines = source.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('import') && !trimmed.startsWith('export')) continue;

        // import ... from 'x' / export ... from 'x'
        const fromMatch = trimmed.match(/\sfrom\s+['"]([^'"]+)['"]/);
        if (fromMatch?.[1]) {
            specs.push(fromMatch[1]);
            continue;
        }

        // import 'x'
        const sideEffectMatch = trimmed.match(/^import\s+['"]([^'"]+)['"]/);
        if (sideEffectMatch?.[1]) {
            specs.push(sideEffectMatch[1]);
        }
    }

    return specs;
}

function isForbiddenDriverImport(spec: string): boolean {
    if (spec.startsWith('@/ui') || spec.startsWith('@/services')) return true;
    if (spec.startsWith('./') || spec.startsWith('../')) {
        const parts = spec.split('/').filter(Boolean);
        if (parts.includes('ui') || parts.includes('services')) return true;
    }
    return false;
}

function isForbiddenServiceImport(spec: string): boolean {
    if (spec.startsWith('@/ui')) return true;
    if (spec.startsWith('@/drivers/shared/rpc')) return true;
    if (spec.startsWith('@/drivers/shared/clients')) return true;
    if (spec.startsWith('./') || spec.startsWith('../')) {
        const parts = spec.split('/').filter(Boolean);
        if (parts.includes('ui')) return true;
        const joined = parts.join('/');
        if (joined.includes('drivers/shared/rpc')) return true;
        if (joined.includes('drivers/shared/clients')) return true;
    }
    return false;
}

describe('Dependency boundaries (UI / Service / Driver)', () => {
    it('drivers must not import ui or services', () => {
        const files = listFilesRecursive('src/drivers', (p) => p.endsWith('.ts'));
        const violations: string[] = [];

        for (const file of files) {
            const src = readFileSync(file, 'utf-8');
            const specs = extractModuleSpecifiers(src);
            for (const spec of specs) {
                if (!isForbiddenDriverImport(spec)) continue;
                violations.push(`${file} -> ${spec}`);
            }
        }

        expect(violations, violations.join('\n')).toEqual([]);
    });

    it('services must not import ui', () => {
        const files = listFilesRecursive('src/services', (p) => p.endsWith('.ts'));
        const violations: string[] = [];

        for (const file of files) {
            const src = readFileSync(file, 'utf-8');
            const specs = extractModuleSpecifiers(src);
            for (const spec of specs) {
                if (!isForbiddenServiceImport(spec)) continue;
                violations.push(`${file} -> ${spec}`);
            }
        }

        expect(violations, violations.join('\n')).toEqual([]);
    });
});
