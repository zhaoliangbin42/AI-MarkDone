import type { ConversationContentSourceV1 } from '../../contracts/conversationContent';
import type { ConversationMaterializationPortV1 } from '../../contracts/conversationMaterialization';
import type { ConversationTurnReadPortV1 } from '../../contracts/conversationDiscovery';
import type { MarkdownParserAdapter } from '../../drivers/content/adapters/parser/MarkdownParserAdapter';
import type { ConversationDiscoveryPortV2 } from '../../contracts/conversationDiscoveryV2';

export type CanonicalFormulaResolution = Readonly<{
    latex: string;
    isBlock: boolean;
}>;

/** Resolve a rendered formula only when its source is present in the sealed turn. */
export function createCanonicalFormulaResolver(
    source: ConversationContentSourceV1,
    materialization: ConversationMaterializationPortV1,
    parser: Pick<MarkdownParserAdapter, 'isMathNode' | 'extractLatex'>,
): (element: Element) => CanonicalFormulaResolution | null {
    return (element) => {
        if (!(element instanceof HTMLElement)) return null;
        let rendered: ReturnType<typeof parser.extractLatex>;
        try {
            if (!parser.isMathNode(element)) return null;
            rendered = parser.extractLatex(element);
        } catch {
            return null;
        }
        const latex = rendered?.latex?.trim();
        if (!latex) return null;

        const target = materialization.resolveElement(element);
        const readPort = source as Partial<ConversationTurnReadPortV1>;
        if (!target || typeof readPort.readTurn !== 'function') return null;
        const result = readPort.readTurn(target);
        if (result.kind !== 'ready') return null;

        const canonical = findCanonicalFormula(result.turn.assistantMarkdown, latex);
        return canonical ? Object.freeze(canonical) : null;
    };
}

/** Resolve ChatGPT formula clicks directly against the V2 sealed turn. */
export function createCanonicalFormulaResolverV2(
    discovery: ConversationDiscoveryPortV2,
    parser: Pick<MarkdownParserAdapter, 'isMathNode' | 'extractLatex'>,
): (element: Element) => CanonicalFormulaResolution | null {
    return (element) => {
        if (!(element instanceof HTMLElement)) return null;
        let rendered: ReturnType<typeof parser.extractLatex>;
        try {
            if (!parser.isMathNode(element)) return null;
            rendered = parser.extractLatex(element);
        } catch {
            return null;
        }
        const latex = rendered?.latex?.trim();
        if (!latex) return null;

        const ref = discovery.resolveElement(element);
        if (!ref) return null;
        const result = discovery.readTurn({ kind: 'entry', ref });
        if (result.kind !== 'ready') return null;
        const canonical = findCanonicalFormula(result.turn.assistant.markdown, latex);
        return canonical ? Object.freeze(canonical) : null;
    };
}

function findCanonicalFormula(markdown: string, renderedLatex: string): CanonicalFormulaResolution | null {
    const normalizedRendered = normalizeLatex(renderedLatex);
    const candidates: Array<{ latex: string; isBlock: boolean }> = [];
    const patterns: Array<{ pattern: RegExp; isBlock: boolean }> = [
        { pattern: /\\\[([\s\S]*?)\\\]/g, isBlock: true },
        { pattern: /\$\$([\s\S]*?)\$\$/g, isBlock: true },
        { pattern: /\\\(([\s\S]*?)\\\)/g, isBlock: false },
        { pattern: /(?<!\$)\$([^$\n]+)\$(?!\$)/g, isBlock: false },
    ];
    for (const { pattern, isBlock } of patterns) {
        for (const match of markdown.matchAll(pattern)) {
            const latex = match[1]?.trim();
            if (latex) candidates.push({ latex, isBlock });
        }
    }
    return candidates.find((candidate) => normalizeLatex(candidate.latex) === normalizedRendered) ?? null;
}

function normalizeLatex(value: string): string {
    return value.replace(/\s+/g, '');
}
