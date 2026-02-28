import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { ChatGPTAdapter } from '../src/drivers/content/adapters/sites/chatgpt';
import { ClaudeAdapter } from '../src/drivers/content/adapters/sites/claude';
import { DeepseekAdapter } from '../src/drivers/content/adapters/sites/deepseek';
import { GeminiAdapter } from '../src/drivers/content/adapters/sites/gemini';
import { copyMarkdownFromMessage } from '../src/services/copy/copy-markdown';

type GoldenCase = {
    platform: 'chatgpt' | 'gemini' | 'claude' | 'deepseek';
    fixturePath: string;
    url: string;
};

const cases: GoldenCase[] = [
    { platform: 'chatgpt', fixturePath: 'mocks/ChatGPT/ChatGPT-Code.html', url: 'https://chatgpt.com/c/mock' },
    { platform: 'gemini', fixturePath: 'mocks/Gemini/Gemini-DeepResearch.html', url: 'https://gemini.google.com/app' },
    { platform: 'claude', fixturePath: 'mocks/Claude/Claude-Artifact.html', url: 'https://claude.ai/chat/mock' },
    { platform: 'deepseek', fixturePath: 'mocks/DeepSeek/Deepseek-code.html', url: 'https://chat.deepseek.com/c/mock' },
];

function withDom<T>(html: string, url: string, fn: () => T): T {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalNode = globalThis.Node;
    const originalNodeFilter = globalThis.NodeFilter;
    const originalHTMLElement = globalThis.HTMLElement;
    const originalNavigator = globalThis.navigator;

    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', () => {});
    const dom = new JSDOM(html, { url, virtualConsole });

    globalThis.window = dom.window as any;
    globalThis.document = dom.window.document;
    globalThis.Node = dom.window.Node;
    globalThis.NodeFilter = dom.window.NodeFilter;
    globalThis.HTMLElement = dom.window.HTMLElement;
    Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

    try {
        return fn();
    } finally {
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
        globalThis.Node = originalNode;
        globalThis.NodeFilter = originalNodeFilter;
        globalThis.HTMLElement = originalHTMLElement;
        Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
    }
}

function getAdapter(platform: GoldenCase['platform']) {
    switch (platform) {
        case 'chatgpt':
            return new ChatGPTAdapter();
        case 'gemini':
            return new GeminiAdapter();
        case 'claude':
            return new ClaudeAdapter();
        case 'deepseek':
            return new DeepseekAdapter();
    }
}

function fileStem(path: string): string {
    const base = path.split('/').pop() || path;
    return base.replace(/\.html$/i, '');
}

function updateOne(c: GoldenCase): void {
    const html = readFileSync(c.fixturePath, 'utf-8');
    withDom(html, c.url, () => {
        const adapter = getAdapter(c.platform);
        const messages = Array.from(document.querySelectorAll(adapter.getMessageSelector())).filter(
            (n): n is HTMLElement => n instanceof HTMLElement
        );
        if (messages.length === 0) {
            throw new Error(`[copy-goldens] No messages found for ${c.platform} in ${c.fixturePath}`);
        }

        const message = messages[messages.length - 1];
        const res = copyMarkdownFromMessage(adapter, message);
        if (!res.ok) {
            throw new Error(`[copy-goldens] Copy failed for ${c.platform}: ${res.error.message}`);
        }

        const expectedPath = join('tests/fixtures/expected/copy', c.platform, `${fileStem(c.fixturePath)}.md`);
        mkdirSync(dirname(expectedPath), { recursive: true });
        writeFileSync(expectedPath, res.markdown, 'utf-8');
        // eslint-disable-next-line no-console
        console.log(`[copy-goldens] Updated ${expectedPath}`);
    });
}

for (const c of cases) {
    updateOne(c);
}
