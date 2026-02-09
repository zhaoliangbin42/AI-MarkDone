import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
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
});
