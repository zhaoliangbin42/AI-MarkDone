import { describe, expect, it } from 'vitest';
import { chatgptMarkdownParserAdapter } from '@/drivers/content/adapters/parser/chatgpt';
import {
    createRenderedParserCapabilityV2,
    RenderedContentCompilerV2,
} from '@/services/content/RenderedContentCompilerV2';

function createCompiler() {
    return new RenderedContentCompilerV2({
        markdownParserAdapter: chatgptMarkdownParserAdapter,
        isNoiseNode: (node) => node instanceof HTMLElement && node.matches('button, [aria-hidden="true"]'),
    });
}

function request(userHtml: string, assistantHtml: string) {
    const user = document.createElement('div');
    const assistant = document.createElement('div');
    user.innerHTML = userHtml;
    assistant.innerHTML = assistantHtml;
    return {
        identity: { turnId: 'turn-1', userMessageId: 'user-1', assistantMessageId: 'assistant-1' },
        userRootClone: user,
        assistantRootClone: assistant,
        userSurfaceToken: 'surface-user',
        assistantSurfaceToken: 'surface-assistant',
        parser: createRenderedParserCapabilityV2(chatgptMarkdownParserAdapter),
        policy: {
            maxNodes: 50_000,
            maxInputCodeUnits: 4_000_000,
            maxOutputCodeUnits: 4_000_000,
            maxFormulaCodeUnits: 10_000,
            maxSliceMs: 8,
            maxWallTimeMs: 2_000,
        },
    } as const;
}

describe('RenderedContentCompilerV2', () => {
    it('compiles semantic structure and removes UI chrome', async () => {
        const result = await createCompiler().compile(request(
            '<p>Hello <strong>world</strong></p><button>copy</button>',
            '<h2>Answer</h2><ul><li>One</li><li>Two</li></ul>',
        ));

        expect(result.kind).toBe('ready');
        if (result.kind !== 'ready') return;
        expect(result.user.markdown).toContain('**world**');
        expect(result.user.markdown).not.toContain('copy');
        expect(result.assistant.markdown).toContain('- One');
        expect(result.manifest.nodeCount).toBeGreaterThan(0);
    });

    it('uses the formula source carrier and never accepts a formula without source', async () => {
        const ready = await createCompiler().compile(request(
            '<p>Question</p>',
            '<p>Value <span class="katex" data-math-source="x^2">x²</span></p>',
        ));
        expect(ready.kind).toBe('ready');
        if (ready.kind === 'ready') {
            expect(ready.assistant.markdown).toContain('x^2');
            expect(ready.manifest.formulaCount).toBe(1);
        }

        const rejected = await createCompiler().compile(request(
            '<p>Question</p>',
            '<p><span class="katex">x²</span></p>',
        ));
        expect(rejected).toEqual({ kind: 'rejected', reason: 'unsupported-formula' });
    });

    it('rejects oversized input before publishing any Markdown', async () => {
        const result = await createCompiler().compile({
            ...request('<p>Question</p>', '<p>Answer</p>'),
            policy: {
                maxNodes: 50_000,
                maxInputCodeUnits: 2,
                maxOutputCodeUnits: 4_000_000,
                maxFormulaCodeUnits: 10_000,
                maxSliceMs: 8,
                maxWallTimeMs: 2_000,
            },
        });
        expect(result).toEqual({ kind: 'rejected', reason: 'budget-exceeded' });
    });

    it('rejects a parser result whose semantic text no longer matches the rendered roots', async () => {
        const compiler = new RenderedContentCompilerV2({
            markdownParserAdapter: chatgptMarkdownParserAdapter,
            cleanMarkdown: () => 'unrelated output',
        });
        const result = await compiler.compile(request(
            '<p>Question with a stable identity</p>',
            '<p>Answer with a stable body</p>',
        ));
        expect(result).toEqual({ kind: 'rejected', reason: 'semantic-mismatch' });
    });
});
