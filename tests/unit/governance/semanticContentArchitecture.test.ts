import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function read(relativePath: string): string {
    return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

function listTypeScriptFiles(relativeDirectory: string): string[] {
    return readdirSync(join(process.cwd(), relativeDirectory)).flatMap((name) => {
        const relativePath = join(relativeDirectory, name);
        return statSync(join(process.cwd(), relativePath)).isDirectory()
            ? listTypeScriptFiles(relativePath)
            : relativePath.endsWith('.ts') ? [relativePath] : [];
    });
}

describe('Semantic Content architecture', () => {
    it('keeps the semantic Module provider-neutral and browser-independent', () => {
        const source = read('src/services/semantic-content/SemanticContent.ts');

        expect(source).not.toMatch(/from\s+['"][^'"]*(?:drivers|ui|runtimes)\//);
        expect(source).not.toMatch(/\b(?:window|globalThis)\s*\./);
        expect(source).not.toMatch(/\bdocument\.(?:body|head|documentElement|create\w+|querySelector|getElementById)\b/);
        expect(source).not.toMatch(/\b(?:HTMLElement|HTMLDivElement|Range|Selection)\b/);
        expect(source).not.toMatch(/\b(?:chatgpt|claude|gemini|deepseek)\b/i);
    });

    it('keeps DOM adaptation in the driver layer without service imports', () => {
        const source = read('src/drivers/content/adapters/ContentSurfaceAdapter.ts');
        const contract = read('src/contracts/contentSurface.ts');

        expect(source).toContain('export interface ContentSurfaceAdapter');
        expect(source).not.toMatch(/from\s+['"][^'"]*services\//);
        expect(contract).not.toMatch(/:\s*(?:Node|Element|HTMLElement|Range|Selection)\b/);
    });

    it('has one service seam that joins canonical content and surface evidence', () => {
        const files = listTypeScriptFiles('src/services');
        const joinOwners = files.filter((name) => {
            const source = read(name);
            return source.includes("contracts/contentSurface")
                && source.includes("contracts/conversationContent");
        });

        expect(joinOwners).toEqual(['src/services/semantic-content/SurfaceProjection.ts']);
    });

    it('does not leak parser-library trees through the public semantic contract', () => {
        const contract = read('src/contracts/semanticContent.ts');

        expect(contract).not.toMatch(/\b(?:mdast|hast|unist|Root|RootContent)\b/i);
    });

    it('keeps all ChatGPT content consumers on the passive Graph V1 seam', () => {
        const entry = read('src/runtimes/content/entry.ts');
        const runtime = read('src/runtimes/content/ChatGPTConversationContentRuntime.ts');
        const consumerFiles = [
            'src/services/reader/readerContentSource.ts',
            'src/ui/content/controllers/MessageToolbarOrchestrator.ts',
            'src/ui/content/controllers/ChatGPTConversationReaderBinding.ts',
            'src/ui/content/controllers/ChatGPTAtomicSelectionController.ts',
            'src/ui/content/controllers/ChatGPTDirectoryController.ts',
            'src/ui/content/controllers/ChatGPTMessageStepperController.ts',
            'src/ui/content/export/SaveMessagesDialog.ts',
        ].map(read);

        expect(entry).toContain('conversationContentSource');
        expect(entry).toContain('conversationMaterialization');
        expect(runtime).toContain('ConversationContentRepository');
        expect(runtime).not.toContain('ConversationDiscoveryModuleV2');
        expect(runtime).not.toContain('ChatGPTVirtualConversationHostAdapter');
        for (const source of consumerFiles) {
            expect(source).not.toContain('ConversationDiscoveryPortV2');
            expect(source).not.toContain('conversationDiscoveryV2');
        }
    });
});
