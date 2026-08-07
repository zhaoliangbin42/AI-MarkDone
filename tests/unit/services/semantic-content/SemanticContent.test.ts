import { describe, expect, it } from 'vitest';

import type { SemanticDocumentV1, SemanticNodeV1 } from '@/contracts/semanticContent';
import { SemanticContent } from '@/services/semantic-content/SemanticContent';

function compile(markdown: string, revision = 'content-token-1'): {
    module: SemanticContent;
    document: SemanticDocumentV1;
} {
    const module = new SemanticContent();
    const result = module.compile({
        key: 'message:assistant-1',
        revision,
        mediaType: 'text/markdown',
        syntaxProfile: 'commonmark-gfm-math',
        text: markdown,
        coverage: 'complete',
        provenance: {
            authority: 'primary',
            fidelity: 'exact',
            producer: 'test-source',
        },
    });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Semantic compile failed');
    return { module, document: result.document };
}

function flattenNodes(nodes: readonly SemanticNodeV1[]): SemanticNodeV1[] {
    return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

describe('SemanticContent', () => {
    it('compiles an immutable project-owned model without leaking mdast nodes', () => {
        const { document } = compile('# Title\n\nText with $x+y$.');
        const nodes = flattenNodes(document.nodes);

        expect(Object.isFrozen(document)).toBe(true);
        expect(Object.isFrozen(document.source)).toBe(true);
        expect(Object.isFrozen(document.nodes)).toBe(true);
        expect(nodes.every((node) => Object.isFrozen(node))).toBe(true);
        expect(nodes.some((node) => node.kind === 'heading')).toBe(true);
        expect(nodes).toContainEqual(expect.objectContaining({
            kind: 'inline-formula',
            attributes: expect.objectContaining({
                tex: 'x+y',
                authority: 'primary',
                fidelity: 'exact',
            }),
        }));
        expect(nodes.some((node) => 'position' in node || 'type' in node)).toBe(false);
    });

    it('projects the exact original Markdown by default', () => {
        const markdown = '- item\n\n```ts\nconst x = 1;\n```';
        const { module, document } = compile(markdown);

        expect(module.project(document, { kind: 'canonical-markdown' })).toMatchObject({
            status: 'ready',
            kind: 'canonical-markdown',
            markdown,
        });
    });

    it('resolves a text quote and closes a fully selected Markdown wrapper', () => {
        const { module, document } = compile('Before **clean Markdown** after.');
        const resolved = module.resolve(document, {
            kind: 'text-quote',
            exact: 'clean Markdown',
            prefix: 'Before ',
            suffix: ' after.',
        });
        expect(resolved.status).toBe('ready');
        if (resolved.status !== 'ready') return;

        expect(module.project(document, {
            kind: 'markdown-fragment',
            selection: resolved.selection,
        })).toMatchObject({
            status: 'ready',
            kind: 'markdown-fragment',
            markdown: '**clean Markdown**',
        });
    });

    it('uses context to disambiguate repeated text and otherwise fails closed', () => {
        const { module, document } = compile('first same value, then second same value');

        expect(module.resolve(document, {
            kind: 'text-quote',
            exact: 'same value',
        })).toMatchObject({ status: 'ambiguous' });

        const resolved = module.resolve(document, {
            kind: 'text-quote',
            exact: 'same value',
            prefix: 'then second ',
        });
        expect(resolved.status).toBe('ready');
        if (resolved.status !== 'ready') return;
        const projected = module.project(document, {
            kind: 'markdown-fragment',
            selection: resolved.selection,
        });
        expect(projected).toMatchObject({ status: 'ready', markdown: 'same value' });
    });

    it('uses UTF-16 half-open source spans for emoji and CJK text', () => {
        const { module, document } = compile('A 😀 中文 B');
        const resolved = module.resolve(document, {
            kind: 'text-quote',
            exact: '😀 中文',
        });
        expect(resolved.status).toBe('ready');
        if (resolved.status !== 'ready') return;

        expect(resolved.selection.spans).toEqual([{
            revision: document.revision,
            start: 2,
            end: 7,
        }]);
        expect(document.source.text.slice(2, 7)).toBe('😀 中文');
    });

    it('uses parser node spans for decoded entities and rejects unproven partial offsets', () => {
        const { module, document } = compile('A &amp; B');
        const whole = module.resolve(document, {
            kind: 'text-quote',
            exact: 'A & B',
        });
        expect(whole.status).toBe('ready');
        if (whole.status !== 'ready') return;
        expect(module.project(document, {
            kind: 'markdown-fragment',
            selection: whole.selection,
        })).toMatchObject({ status: 'ready', markdown: 'A &amp; B' });

        expect(module.resolve(document, {
            kind: 'text-quote',
            exact: '&',
            prefix: 'A',
            suffix: 'B',
        })).toMatchObject({
            status: 'rejected',
            diagnostics: [expect.objectContaining({ code: 'SEMANTIC_SOURCE_MAP_UNPROVEN' })],
        });
    });

    it('isolates cache entries by revision and source digest', () => {
        const module = new SemanticContent(2);
        const source = {
            key: 'message:assistant-1',
            revision: 'revision-1',
            mediaType: 'text/markdown' as const,
            syntaxProfile: 'commonmark-gfm-math' as const,
            coverage: 'complete' as const,
            provenance: {
                authority: 'primary' as const,
                fidelity: 'exact' as const,
                producer: 'test-source',
            },
        };
        const first = module.compile({ ...source, text: 'first' });
        const same = module.compile({ ...source, text: 'first' });
        const changed = module.compile({ ...source, text: 'changed' });

        expect(first.status).toBe('ready');
        expect(same.status).toBe('ready');
        expect(changed.status).toBe('ready');
        if (first.status !== 'ready' || same.status !== 'ready' || changed.status !== 'ready') return;
        expect(same.document).toBe(first.document);
        expect(changed.document).not.toBe(first.document);
        expect(changed.document.fingerprint).not.toBe(first.document.fingerprint);
    });

    it('isolates cache entries by the complete source provenance and coverage contract', () => {
        const module = new SemanticContent();
        const source = {
            key: 'message:assistant-1',
            revision: 'revision-1',
            mediaType: 'text/markdown' as const,
            syntaxProfile: 'commonmark-gfm-math' as const,
            text: 'same source',
            provenance: {
                authority: 'verified-derived' as const,
                fidelity: 'normalized' as const,
                producer: 'provider-a',
            },
        };
        const complete = module.compile({ ...source, coverage: 'complete' });
        const partial = module.compile({ ...source, coverage: 'partial' });
        const otherProducer = module.compile({
            ...source,
            coverage: 'complete',
            provenance: { ...source.provenance, producer: 'provider-b' },
        });

        expect(complete.status).toBe('ready');
        expect(partial.status).toBe('ready');
        expect(otherProducer.status).toBe('ready');
        if (complete.status !== 'ready' || partial.status !== 'ready' || otherProducer.status !== 'ready') return;
        expect(partial.document).not.toBe(complete.document);
        expect(partial.document.source.coverage).toBe('partial');
        expect(otherProducer.document).not.toBe(complete.document);
        expect(otherProducer.document.source.provenance.producer).toBe('provider-b');
    });

    it('keeps structured cache identity collision-free when source ids contain delimiters', () => {
        const module = new SemanticContent();
        const base = {
            mediaType: 'text/markdown' as const,
            syntaxProfile: 'commonmark-gfm-math' as const,
            text: 'same source',
            coverage: 'complete' as const,
            provenance: {
                authority: 'primary' as const,
                fidelity: 'exact' as const,
                producer: 'test-source',
            },
        };
        const first = module.compile({ ...base, key: 'message:a:b', revision: 'c' });
        const second = module.compile({ ...base, key: 'message:a', revision: 'b:c' });

        expect(first.status).toBe('ready');
        expect(second.status).toBe('ready');
        if (first.status !== 'ready' || second.status !== 'ready') return;
        expect(second.document).not.toBe(first.document);
        expect(second.document.key).toBe('message:a');
        expect(second.document.revision).toBe('b:c');
    });
});
