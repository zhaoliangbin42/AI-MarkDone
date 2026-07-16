import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
    buildCssCustomPropertyGraph,
    findCssCustomPropertyCycles,
    findDuplicateCssCustomPropertyOwners,
    findUnconsumedPublicTokens,
    findUnreachableTokenDefinitions,
    findUndefinedCssCustomProperties,
} from '../../support/cssCustomPropertyGraph';
import { collectUiStyleSources } from '../../support/uiStyleInventory';
import { UI_FAMILY_TOKEN_OWNERS } from '../../support/uiFamilyTokenOwners';

const repoRoot = path.resolve(__dirname, '../../..');

describe('UI token graph governance', () => {
    const graph = buildCssCustomPropertyGraph(collectUiStyleSources(repoRoot));

    it('ships no unresolved global token references', () => {
        const actual = [...new Set(findUndefinedCssCustomProperties(graph).map(({ token }) => token))].sort();
        expect(actual).toEqual([]);
    });

    it('rejects global token cycles and duplicate non-isolated owners', () => {
        expect(findCssCustomPropertyCycles(graph)).toEqual([]);
        expect(findDuplicateCssCustomPropertyOwners(
            graph,
            (file) => file === 'src/popup/popup.html'
                || file === 'src/popup/popup.js'
                || file.startsWith('src/services/export/')
                || file.startsWith('src/runtimes/export-renderer/'),
        )).toEqual([]);
    });

    it('ships no unconsumed public aliases', () => {
        expect(findUnconsumedPublicTokens(graph, 'src/style/public-tokens.ts'))
            .toEqual([]);
    });

    it('keeps every Reference, System, and Public token reachable from shipped UI', () => {
        expect(findUnreachableTokenDefinitions(graph, [
            'src/style/reference-tokens.ts',
            'src/style/system-tokens.ts',
            'src/style/public-tokens.ts',
        ])).toEqual([]);
    });

    it('keeps the design SSOT token tables aligned with executable token owners', () => {
        const designSource = fs.readFileSync(path.join(repoRoot, 'docs/design.md'), 'utf8');
        const documentedTokens = [...designSource.matchAll(/`(--aimd-[A-Za-z0-9_-]+)`/g)]
            .map((match) => match[1])
            .filter((token): token is string => Boolean(token));
        const missing = [...new Set(documentedTokens)]
            .filter((token) => !graph.definitions.has(token))
            .sort();

        expect(missing).toEqual([]);
    });

    it('keeps component-owned global tokens in an explicit family registry', () => {
        const tokenLayerFiles = new Set([
            'src/style/reference-tokens.ts',
            'src/style/system-tokens.ts',
            'src/style/public-tokens.ts',
        ]);
        const isolatedFiles = (file: string): boolean => file === 'src/popup/popup.html'
            || file === 'src/popup/popup.js'
            || file.startsWith('src/services/export/')
            || file.startsWith('src/runtimes/export-renderer/');
        const componentTokens = [...graph.definitions.entries()]
            .filter(([, occurrences]) => occurrences.some(({ file }) => !tokenLayerFiles.has(file) && !isolatedFiles(file)))
            .map(([token]) => token)
            .sort();

        expect(componentTokens).toEqual(Object.keys(UI_FAMILY_TOKEN_OWNERS).sort());

        for (const [token, owner] of Object.entries(UI_FAMILY_TOKEN_OWNERS)) {
            const definitionFiles = [...new Set((graph.definitions.get(token) ?? []).map(({ file }) => file))];
            expect(definitionFiles, `${token}: definition owner`).toEqual([owner.definitionFile]);
            for (const reference of graph.references.get(token) ?? []) {
                expect(
                    owner.allowedConsumers.some((prefix) => reference.file === prefix || reference.file.startsWith(prefix)),
                    `${token}: unexpected consumer ${reference.file}`,
                ).toBe(true);
            }
        }
    });

    it('enforces Reference to System to Public dependency direction', () => {
        const referenceTokens = new Set(
            [...graph.definitions.entries()]
                .filter(([, occurrences]) => occurrences.some(({ file }) => file === 'src/style/reference-tokens.ts'))
                .map(([token]) => token),
        );
        const systemTokens = new Set(
            [...graph.definitions.entries()]
                .filter(([, occurrences]) => occurrences.some(({ file }) => file === 'src/style/system-tokens.ts'))
                .map(([token]) => token),
        );
        const publicTokens = new Set(
            [...graph.definitions.entries()]
                .filter(([, occurrences]) => occurrences.some(({ file }) => file === 'src/style/public-tokens.ts'))
                .map(([token]) => token),
        );

        for (const token of referenceTokens) {
            expect([...graph.dependencies.get(token) ?? []], `${token}: Reference dependency`).toEqual([]);
        }
        for (const token of systemTokens) {
            const illegal = [...graph.dependencies.get(token) ?? []]
                .filter((dependency) => !referenceTokens.has(dependency) && !systemTokens.has(dependency));
            expect(illegal, `${token}: System dependency`).toEqual([]);
        }
        for (const token of publicTokens) {
            const illegal = [...graph.dependencies.get(token) ?? []]
                .filter((dependency) => !systemTokens.has(dependency) && !publicTokens.has(dependency));
            expect(illegal, `${token}: Public dependency`).toEqual([]);
        }
    });
});
