import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = process.argv[2] ?? '';
if (!['chrome', 'firefox'].includes(target)) {
    throw new Error('Expected target: chrome or firefox.');
}

const activeSources = [
    'src/runtimes/content/ChatGPTConversationContentRuntime.ts',
    'src/runtimes/content/entry.ts',
    'src/drivers/content/chatgpt/ChatGPTConversationDiscoveryAdapter.ts',
    'src/drivers/content/chatgpt/ChatGPTConversationDiscoveryCoordinator.ts',
    'src/drivers/content/chatgpt/ChatGPTConversationNavigation.ts',
    'src/services/content/ConversationContentRepository.ts',
    'public/page-bridges/chatgpt-conversation-bridge.js',
];
const forbidden = [
    'document.cookie',
    'Authorization',
    'credentials',
    'XMLHttpRequest',
    'EventSource',
    'WebSocket',
    'acquireSnapshot',
    'type: \'acquire\'',
    'type: "acquire"',
    'scrollRoot.scrollTo',
    'probeStepPx',
    'const ratio =',
];

for (const relativePath of activeSources) {
    const path = resolve(relativePath);
    if (!existsSync(path)) throw new Error(`Missing V2 discovery source: ${relativePath}`);
    const source = readFileSync(path, 'utf8');
    for (const marker of forbidden) {
        if (source.includes(marker)) {
        throw new Error(`Forbidden active transport marker in ChatGPT discovery source ${relativePath}: ${marker}`);
        }
    }
}

for (const relativePath of [
    `dist/${target}/manifest.json`,
    `manifest.${target}.json`,
]) {
    const path = resolve(relativePath);
    if (!existsSync(path)) continue;
    const source = readFileSync(path, 'utf8');
    if (!source.includes('page-bridges/chatgpt-conversation-bootstrap.js')) {
        throw new Error(`Shipped manifest is missing the document_start ChatGPT bootstrap: ${relativePath}`);
    }
    if (!source.includes('page-bridges/chatgpt-conversation-bridge.js')) {
        throw new Error(`Shipped manifest is missing the passive ChatGPT bridge resource: ${relativePath}`);
    }
}

const readerSource = readFileSync(resolve('src/services/reader/readerContentSource.ts'), 'utf8');
if (readerSource.includes('collectReaderContent(')) {
    throw new Error('Retired duplicate Reader content entrypoint is still present.');
}

const readerBinding = readFileSync(
    resolve('src/ui/content/controllers/ChatGPTConversationReaderBinding.ts'),
    'utf8',
);
for (const marker of ['collectConversationTurnRefs', 'new MutationObserver', 'fetch(']) {
    if (readerBinding.includes(marker)) {
        throw new Error(`ChatGPT Reader binding must remain source-only: ${marker}`);
    }
}

console.log(`Verified passive ChatGPT graph discovery boundary for ${target}.`);
