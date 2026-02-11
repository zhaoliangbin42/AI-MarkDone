import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';

const GUARDED_FILES = [
    'src/content/utils/TooltipManager.ts',
    'src/content/utils/NavigationButtonsController.ts',
    'src/parser/rules/block/MathBlockRule.ts',
    'src/parser/rules/inline/MathInlineRule.ts',
    'src/parser/adapters/ChatGPTAdapter.ts',
    'src/parser/adapters/ClaudeAdapter.ts',
    'src/parser/adapters/GeminiAdapter.ts'
];

describe('logging guardrails', () => {
    it('guarded files should not use raw console.warn/error', () => {
        for (const file of GUARDED_FILES) {
            const source = readFileSync(resolve(process.cwd(), file), 'utf-8');
            expect(source).not.toMatch(/console\.(warn|error)\(/);
        }
    });

    it('source files should avoid DOMParser image/svg+xml parsing for icon injection', () => {
        const sourceFiles = collectSourceFiles(resolve(process.cwd(), 'src'));
        for (const filePath of sourceFiles) {
            const source = readFileSync(filePath, 'utf-8');
            expect(source).not.toMatch(/parseFromString\([^)]*image\/svg\+xml/);
        }
    });
});

function collectSourceFiles(dir: string): string[] {
    const result: string[] = [];
    const entries = readdirSync(dir);
    for (const entry of entries) {
        const fullPath = resolve(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            result.push(...collectSourceFiles(fullPath));
            continue;
        }
        if (!fullPath.match(/\.(ts|js)$/)) continue;
        if (fullPath.includes('.test.') || fullPath.includes('__tests__')) continue;
        result.push(fullPath);
    }
    return result;
}
