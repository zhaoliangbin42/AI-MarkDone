import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

const scannedRoots = ['src', 'public/_locales', 'docs'] as const;

function collectFiles(dir: string, result: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') continue;
        if (entry.name === 'plans') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectFiles(fullPath, result);
        } else {
            result.push(fullPath);
        }
    }
    return result;
}

describe('source panel removal governance', () => {
    it('does not keep the retired standalone source panel surface or entry points', () => {
        const forbiddenPatterns = [
            /SourcePanel/,
            /sourcePanel/,
            /showViewSource/,
            /view_source/,
            /reader-source/,
            /aimd-source-panel-host/,
            /panel-window--source/,
            /source-copy/,
            /source-pre/,
            /btnViewSource/,
            /modalSourceTitle/,
            /viewSourceLabel/,
            /viewSourceDesc/,
        ];

        const offenders = scannedRoots
            .flatMap((root) => collectFiles(path.join(repoRoot, root)))
            .flatMap((filePath) => {
                const content = fs.readFileSync(filePath, 'utf8');
                return forbiddenPatterns
                    .filter((pattern) => pattern.test(content))
                    .map((pattern) => `${path.relative(repoRoot, filePath)} contains ${pattern}`);
            });

        expect(offenders).toEqual([]);
    });
});
