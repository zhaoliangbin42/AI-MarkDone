import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { uiSurfaceCoverage } from '../../support/uiSurfaceCoverage';

const repoRoot = path.resolve(__dirname, '../../..');
const explorationMocks = new Set([
    'mocks/components/next-ui-visual-lab',
    'mocks/pages/style-system',
]);
const visualHarnessInfrastructure = [
    'mocks/components/visualHarnessBridge.ts',
    'mocks/components/browserExtensionMock.ts',
] as const;

function exists(relativePath: string): boolean {
    return fs.existsSync(path.join(repoRoot, relativePath));
}

function isIgnored(relativePath: string): boolean {
    try {
        execFileSync('git', ['check-ignore', '--no-index', '--quiet', relativePath], {
            cwd: repoRoot,
            stdio: 'ignore',
        });
        return true;
    } catch {
        return false;
    }
}

describe('UI Surface coverage manifest', () => {
    it('keeps stable unique entries with real owners, entries, and trigger-path tests', () => {
        const ids = uiSurfaceCoverage.map((entry) => entry.id);
        expect(new Set(ids).size).toBe(ids.length);

        for (const entry of uiSurfaceCoverage) {
            expect(entry.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
            expect(entry.family.trim()).not.toBe('');
            expect(entry.userEntry.trim()).not.toBe('');
            expect(exists(entry.ownerModule), `${entry.id}: ${entry.ownerModule}`).toBe(true);
            expect(exists(entry.productionEntry), `${entry.id}: ${entry.productionEntry}`).toBe(true);
            expect(entry.triggerTests.length, `${entry.id}: trigger test`).toBeGreaterThan(0);
            for (const triggerTest of entry.triggerTests) {
                expect(exists(triggerTest), `${entry.id}: ${triggerTest}`).toBe(true);
            }
            if (!entry.documentException) {
                expect(entry.profiles.length, `${entry.id}: profile`).toBeGreaterThan(0);
            }
        }
    });

    it('requires every visual evidence gap to be explicit and every claimed mock to be reproducible', () => {
        expect(new Set(uiSurfaceCoverage.map((entry) => entry.visualEvidence.status)))
            .toEqual(new Set(['direct-mock', 'covered-by-family']));

        for (const entry of uiSurfaceCoverage) {
            const evidence = entry.visualEvidence;
            expect(explorationMocks.has(evidence.mockPath), `${entry.id}: exploration mock`).toBe(false);
            expect(exists(`${evidence.mockPath}/index.html`), `${entry.id}: mock HTML`).toBe(true);
            expect(exists(`${evidence.mockPath}/main.ts`), `${entry.id}: mock entry`).toBe(true);
            expect(isIgnored(`${evidence.mockPath}/index.html`), `${entry.id}: ignored mock HTML`).toBe(false);
            expect(isIgnored(`${evidence.mockPath}/main.ts`), `${entry.id}: ignored mock entry`).toBe(false);

            if (evidence.status === 'covered-by-family') {
                expect(evidence.reason.trim(), `${entry.id}: family evidence reason`).not.toBe('');
            }
        }
    });

    it('tracks shared visual-harness infrastructure used by direct mocks', () => {
        for (const relativePath of visualHarnessInfrastructure) {
            expect(exists(relativePath), relativePath).toBe(true);
            expect(isIgnored(relativePath), relativePath).toBe(false);
        }
    });

    it('covers both target browsers and names each lifecycle owner', () => {
        for (const entry of uiSurfaceCoverage) {
            expect(entry.browsers).toEqual(['chrome', 'firefox']);
            for (const owner of Object.values(entry.lifecycleOwners)) {
                expect(owner.trim(), `${entry.id}: lifecycle owner`).not.toBe('');
            }
        }
    });
});
