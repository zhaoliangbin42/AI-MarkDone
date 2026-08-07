import type {
    ConversationBodyV2,
    ConversationTurnIdentityV2,
    RenderedContentCompilePolicyV2,
    RenderedContentCompilerV2 as RenderedContentCompilerV2Port,
    RenderedParserCapabilityV2,
    RenderedTurnCompileRequestV2,
    RenderedTurnCompileResultV2,
} from '../../contracts/conversationDiscoveryV2';
import type { MarkdownParserAdapter } from '../../drivers/content/adapters/parser/MarkdownParserAdapter';
import { createMarkdownParser } from '../markdown-parser/createMarkdownParser';

export type RenderedContentCompilerOptionsV2 = Readonly<{
    markdownParserAdapter: MarkdownParserAdapter;
    normalizeDOM?: (root: HTMLElement) => void;
    isNoiseNode?: (node: Node, context: { nextSibling: Element | null }) => boolean;
    getArtifactPlaceholder?: (node: HTMLElement) => string | null;
    cleanMarkdown?: (markdown: string) => string;
}>;

export const DEFAULT_RENDERED_CONTENT_POLICY_V2: RenderedContentCompilePolicyV2 = Object.freeze({
    maxNodes: 50_000,
    maxInputCodeUnits: 4_000_000,
    maxOutputCodeUnits: 4_000_000,
    maxFormulaCodeUnits: 10_000,
    maxSliceMs: 8,
    maxWallTimeMs: 2_000,
});

/**
 * Compiles a pair of stable host-rendered roots exactly once.  The compiler
 * knows semantic HTML and injected parser capabilities; ChatGPT selectors
 * remain in the Adapter that supplies those capabilities.
 */
export class RenderedContentCompilerV2 implements RenderedContentCompilerV2Port {
    constructor(private readonly options: RenderedContentCompilerOptionsV2) {}

    async compile(request: RenderedTurnCompileRequestV2): Promise<RenderedTurnCompileResultV2> {
        const startedAt = performance.now();
        try {
            const preparedUser = await this.prepareRoot(request.userRootClone, request.parser, request.policy, startedAt);
            const preparedAssistant = await this.prepareRoot(request.assistantRootClone, request.parser, request.policy, startedAt);
            if (preparedUser.kind === 'rejected') return preparedUser;
            if (preparedAssistant.kind === 'rejected') return preparedAssistant;
            if (preparedUser.text.length === 0 || preparedAssistant.text.length === 0) {
                return { kind: 'rejected', reason: 'empty-content' };
            }
            if (performance.now() - startedAt > request.policy.maxWallTimeMs) {
                return { kind: 'rejected', reason: 'budget-exceeded' };
            }

            const userMarkdown = this.compileMarkdown(preparedUser.root, request.policy);
            const assistantMarkdown = this.compileMarkdown(preparedAssistant.root, request.policy);
            if (!userMarkdown || !assistantMarkdown) {
                return { kind: 'rejected', reason: 'empty-content' };
            }
            if (!matchesSemanticSignature(preparedUser, userMarkdown)
                || !matchesSemanticSignature(preparedAssistant, assistantMarkdown)) {
                return { kind: 'rejected', reason: 'semantic-mismatch' };
            }
            if (userMarkdown.length > request.policy.maxOutputCodeUnits
                || assistantMarkdown.length > request.policy.maxOutputCodeUnits
                || performance.now() - startedAt > request.policy.maxWallTimeMs) {
                return { kind: 'rejected', reason: 'budget-exceeded' };
            }

            const user = createBody(userMarkdown, preparedUser.text);
            const assistant = createBody(assistantMarkdown, preparedAssistant.text);
            const manifest = Object.freeze({
                nodeCount: preparedUser.nodeCount + preparedAssistant.nodeCount,
                formulaCount: preparedUser.formulaCount + preparedAssistant.formulaCount,
                codeBlockCount: preparedUser.codeBlockCount + preparedAssistant.codeBlockCount,
                tableCount: preparedUser.tableCount + preparedAssistant.tableCount,
                imageCount: preparedUser.imageCount + preparedAssistant.imageCount,
            });
            const semanticDigest = digest({
                identity: request.identity,
                user: user.markdown,
                assistant: assistant.markdown,
                userFormulas: preparedUser.formulaSources,
                assistantFormulas: preparedAssistant.formulaSources,
                userCode: preparedUser.codeSources,
                assistantCode: preparedAssistant.codeSources,
                formulaCount: manifest.formulaCount,
                codeBlockCount: manifest.codeBlockCount,
                tableCount: manifest.tableCount,
                imageCount: manifest.imageCount,
            });
            const surfaceDigest = digest({
                userSurfaceToken: request.userSurfaceToken,
                assistantSurfaceToken: request.assistantSurfaceToken,
                userText: user.text,
                assistantText: assistant.text,
                manifest,
            });
            return Object.freeze({
                kind: 'ready',
                user,
                assistant,
                semanticDigest,
                surfaceDigest,
                manifest,
            });
        } catch {
            return { kind: 'rejected', reason: 'compiler-error' };
        }
    }

    private prepareRoot(
        root: HTMLElement,
        parser: RenderedParserCapabilityV2,
        policy: RenderedContentCompilePolicyV2,
        startedAt: number,
    ): Promise<PreparedRoot | RejectedCompile> {
        return this.prepareRootAsync(root, parser, policy, startedAt);
    }

    private async prepareRootAsync(
        root: HTMLElement,
        parser: RenderedParserCapabilityV2,
        policy: RenderedContentCompilePolicyV2,
        startedAt: number,
    ): Promise<PreparedRoot | RejectedCompile> {
        this.options.normalizeDOM?.(root);
        removeNoiseNodes(root, this.options);

        let nodeCount = 0;
        let formulaCount = 0;
        let codeBlockCount = 0;
        let tableCount = root.querySelectorAll('table').length;
        let imageCount = root.querySelectorAll('img').length;
        const formulaSources: string[] = [];
        const codeSources: string[] = [];
        const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
        const formulaElements: HTMLElement[] = [];
        let sliceStartedAt = performance.now();
        for (const element of elements) {
            if (performance.now() - startedAt > policy.maxWallTimeMs) {
                return { kind: 'rejected', reason: 'budget-exceeded' };
            }
            if (performance.now() - sliceStartedAt >= policy.maxSliceMs) {
                await yieldToHost();
                sliceStartedAt = performance.now();
            }
            nodeCount += 1;
            if (nodeCount > policy.maxNodes) return { kind: 'rejected', reason: 'budget-exceeded' };
            if (parser.isFormula(element)) {
                if (formulaElements.some((ancestor) => ancestor.contains(element))) continue;
                const source = parser.readFormula(element);
                if (!source || !source.latex.trim() || source.latex.length > policy.maxFormulaCodeUnits) {
                    return { kind: 'rejected', reason: 'unsupported-formula' };
                }
                formulaCount += 1;
                formulaSources.push(`${source.display ? 'display' : 'inline'}:${source.latex}`);
                formulaElements.push(element);
            }
            if (parser.isCodeBlock(element)) {
                const source = parser.readCodeBlock(element);
                if (!source || !source.source.trim()) return { kind: 'rejected', reason: 'unsupported-code' };
                codeBlockCount += 1;
                codeSources.push(`${source.language ?? ''}:${source.source}`);
            }
        }

        const text = normalizeText(root.textContent ?? '');
        if (text.length > policy.maxInputCodeUnits) return { kind: 'rejected', reason: 'budget-exceeded' };
        // The structure count is intentionally computed from semantic tags,
        // not classes, so wrapper churn does not alter the contract.
        tableCount += root.tagName.toLowerCase() === 'table' ? 1 : 0;
        imageCount += root.tagName.toLowerCase() === 'img' ? 1 : 0;
        return {
            kind: 'prepared',
            root,
            text,
            nodeCount,
            formulaCount,
            codeBlockCount,
            tableCount,
            imageCount,
            formulaSources,
            codeSources,
            requiredText: collectTextOutsideSpecialNodes(root, parser),
        };
    }

    private compileMarkdown(root: HTMLElement, policy: RenderedContentCompilePolicyV2): string {
        const parsed = createMarkdownParser(this.options.markdownParserAdapter, {
            maxNodeCount: policy.maxNodes,
            maxProcessingTimeMs: policy.maxWallTimeMs,
            enablePerformanceLogging: false,
        }).parse(root);
        const cleaned = this.options.cleanMarkdown?.(parsed) ?? parsed;
        const normalized = cleaned.trim();
        if (!normalized || /Parser (Max nodes|Time budget)/.test(normalized)) return '';
        return normalized;
    }
}

type PreparedRoot = Readonly<{
    kind: 'prepared';
    root: HTMLElement;
    text: string;
    nodeCount: number;
    formulaCount: number;
    codeBlockCount: number;
    tableCount: number;
    imageCount: number;
    formulaSources: readonly string[];
    codeSources: readonly string[];
    requiredText: string;
}>;

type RejectedCompile = Readonly<{
    kind: 'rejected';
    reason: Extract<RenderedTurnCompileResultV2, { kind: 'rejected' }>['reason'];
}>;

function removeNoiseNodes(root: HTMLElement, options: RenderedContentCompilerOptionsV2): void {
    if (!options.isNoiseNode) return;
    const toRemove: Array<{ node: HTMLElement; placeholder: string | null }> = [];
    for (const node of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
        if (options.isNoiseNode(node, { nextSibling: node.nextElementSibling })) {
            toRemove.push({ node, placeholder: options.getArtifactPlaceholder?.(node) ?? null });
        }
    }
    for (const { node, placeholder } of toRemove.reverse()) {
        if (!node.parentNode) continue;
        if (placeholder) {
            const replacement = root.ownerDocument.createElement('p');
            replacement.textContent = placeholder;
            node.parentNode.replaceChild(replacement, node);
        } else {
            node.remove();
        }
    }
}

function createBody(markdown: string, text: string): ConversationBodyV2 {
    return Object.freeze({ markdown, text });
}

function normalizeText(value: string): string {
    return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function collectTextOutsideSpecialNodes(root: HTMLElement, parser: RenderedParserCapabilityV2): string {
    const chunks: string[] = [];
    const visit = (node: Node): void => {
        if (node instanceof HTMLElement && (parser.isFormula(node) || parser.isCodeBlock(node))) return;
        if (node.nodeType === Node.TEXT_NODE) {
            const text = normalizeText(node.textContent ?? '');
            if (text) chunks.push(text);
            return;
        }
        for (const child of Array.from(node.childNodes)) visit(child);
    };
    visit(root);
    return normalizeText(chunks.join(' '));
}

function matchesSemanticSignature(root: PreparedRoot, markdown: string): boolean {
    const searchableMarkdown = normalizeMarkdownForSignature(markdown);
    for (const token of root.requiredText.split(/\s+/).filter((value) => value.length >= 2)) {
        if (!searchableMarkdown.includes(normalizeMarkdownForSignature(token))) return false;
    }
    for (const source of root.formulaSources) {
        const latex = source.slice(source.indexOf(':') + 1).trim();
        if (!latex || !searchableMarkdown.includes(normalizeMarkdownForSignature(latex))) return false;
    }
    for (const source of root.codeSources) {
        const code = source.slice(source.indexOf(':') + 1).trim();
        if (!code || !searchableMarkdown.includes(normalizeMarkdownForSignature(code))) return false;
    }
    if (root.tableCount > 0 && !markdown.includes('|')) return false;
    if (root.imageCount > 0 && !markdown.includes('![')) return false;
    return true;
}

function normalizeMarkdownForSignature(value: string): string {
    return value
        .replace(/[`*_~#>()[\]|!-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLocaleLowerCase();
}

function yieldToHost(): Promise<void> {
    return new Promise((resolve) => {
        if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
            window.setTimeout(resolve, 0);
            return;
        }
        resolve();
    });
}

function digest(value: unknown): string {
    const input = JSON.stringify(value);
    let hashValue = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hashValue ^= input.charCodeAt(index);
        hashValue = Math.imul(hashValue, 16777619);
    }
    return (hashValue >>> 0).toString(16).padStart(8, '0');
}

export function createRenderedParserCapabilityV2(
    parserAdapter: MarkdownParserAdapter,
): RenderedParserCapabilityV2 {
    const extended = parserAdapter as MarkdownParserAdapter & {
        extractCodeBlockText?: (block: HTMLElement) => string | null;
    };
    return Object.freeze({
        isFormula: (element: Element) => parserAdapter.isMathNode(element),
        readFormula: (element: HTMLElement) => {
            const result = parserAdapter.extractLatex(element);
            return result
                ? Object.freeze({ latex: result.latex, display: result.isBlock })
                : null;
        },
        isCodeBlock: (element: Element) => parserAdapter.isCodeBlockNode(element),
        readCodeBlock: (element: HTMLElement) => {
            const source = extended.extractCodeBlockText?.(element)
                ?? (element.querySelector('code')?.textContent ?? '');
            if (!source.trim()) return null;
            return Object.freeze({
                source,
                language: parserAdapter.getCodeLanguage(element) || null,
            });
        },
    });
}

export function createIdentityV2(
    turnId: string | null,
    userMessageId: string | null,
    assistantMessageId: string | null,
): ConversationTurnIdentityV2 | null {
    const normalizedTurn = turnId?.trim();
    const normalizedUser = userMessageId?.trim();
    const normalizedAssistant = assistantMessageId?.trim();
    if (!normalizedTurn || !normalizedUser || !normalizedAssistant) return null;
    return Object.freeze({
        turnId: normalizedTurn,
        userMessageId: normalizedUser,
        assistantMessageId: normalizedAssistant,
    });
}
