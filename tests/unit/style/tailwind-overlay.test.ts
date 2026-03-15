import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

describe('overlay tailwind alias css', () => {
    it('defines a prefixed preflight-free tailwind entry that aliases aimd tokens', () => {
        const source = fs.readFileSync(path.join(repoRoot, 'src/style/tailwind-overlay.css'), 'utf8');

        expect(source).toContain('prefix(tw)');
        expect(source).not.toContain('preflight.css');
        expect(source).toContain('@theme inline');
        expect(source).toContain('--color-surface: var(--aimd-bg-primary);');
        expect(source).toContain('--color-text-primary: var(--aimd-text-primary);');
        expect(source).toContain('--shadow-overlay: var(--aimd-shadow-lg);');
        expect(source).not.toContain('--color-panel');
        expect(source).not.toContain('--color-toolbar');
    });
});
