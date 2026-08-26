import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = process.argv[2] ?? '';
if (!['chrome', 'firefox'].includes(target)) {
    throw new Error('Expected target: chrome or firefox.');
}

const activeSources = [
    'src/runtimes/content/ChatGPTConversationContentRuntime.ts',
    'src/runtimes/content/entry.ts',
    'src/drivers/content/chatgpt/ChatGPTConversationHostMonitor.ts',
    'src/drivers/content/chatgpt/ChatGPTPageIndex.ts',
    'src/drivers/content/chatgpt/ChatGPTConversationSurface.ts',
    'src/drivers/content/chatgpt/chatgptRoute.ts',
    'src/drivers/content/chatgpt/ChatGPTConversationDiscoveryAdapter.ts',
    'src/drivers/content/chatgpt/ChatGPTConversationNavigation.ts',
    'src/services/content/ConversationContentRepository.ts',
];
const retiredSources = [
    'src/drivers/content/chatgpt/ChatGPTConversationDiscoveryCoordinator.ts',
    'src/drivers/content/chatgpt/ChatGPTConversationIndex.ts',
    'src/drivers/content/chatgpt/ChatGPTConversationMaterialization.ts',
];
const forbidden = [
    'document.cookie',
    'Authorization',
    'credentials',
    'XMLHttpRequest',
    'EventSource',
    'WebSocket',
    'fetch(',
    'PerformanceObserver',
    "'POST'",
    '"POST"',
    'acquireSnapshot',
    'type: \'acquire\'',
    'type: "acquire"',
    'scrollRoot.scrollTo',
    'probeStepPx',
    'const ratio =',
];

for (const relativePath of activeSources) {
    const path = resolve(relativePath);
    if (!existsSync(path)) throw new Error(`Missing active ChatGPT discovery source: ${relativePath}`);
    const source = readFileSync(path, 'utf8');
    for (const marker of forbidden) {
        if (source.includes(marker)) {
        throw new Error(`Forbidden active transport marker in ChatGPT discovery source ${relativePath}: ${marker}`);
        }
    }
}

for (const relativePath of retiredSources) {
    if (existsSync(resolve(relativePath))) {
        throw new Error(`Retired ChatGPT discovery source is still present: ${relativePath}`);
    }
}

const runtimeSource = readFileSync(
    resolve('src/runtimes/content/ChatGPTConversationContentRuntime.ts'),
    'utf8',
);
for (const marker of [
    'new ChatGPTConversationMaterialization',
    'getChatGPTConversationIndex',
    'RouteWatcher',
    'setInterval(',
]) {
    if (runtimeSource.includes(marker)) {
        throw new Error(`Runtime must keep one content lifecycle and one Surface projection: ${marker}`);
    }
}
if (!runtimeSource.includes('new ChatGPTConversationSurface')) {
    throw new Error('Runtime is missing the single ChatGPT Conversation Surface owner.');
}

const surfaceSource = readFileSync(
    resolve('src/drivers/content/chatgpt/ChatGPTConversationSurface.ts'),
    'utf8',
);
if (surfaceSource.includes('new MutationObserver')) {
    throw new Error('Conversation Surface must project the shared PageIndex instead of creating another observer.');
}

for (const relativePath of [
    'src/ui/content/controllers/MessageToolbarOrchestrator.ts',
    'src/ui/content/controllers/ChatGPTDirectoryController.ts',
    'src/ui/content/controllers/ChatGPTMessageStepperController.ts',
]) {
    const source = readFileSync(resolve(relativePath), 'utf8');
    if (!source.includes('subscribeFrame')) {
        throw new Error(`ChatGPT production consumer is missing the Surface frame seam: ${relativePath}`);
    }
}

for (const relativePath of [
    'public/page-bridges/chatgpt-conversation-bootstrap.js',
    'public/page-bridges/chatgpt-conversation-bridge.js',
]) {
    if (!existsSync(resolve(relativePath))) {
        throw new Error(`Missing active ChatGPT GET seed bridge source: ${relativePath}`);
    }
}

for (const relativePath of [
    'src/runtimes/content/entry.ts',
    'src/ui/content/controllers/MessageToolbarOrchestrator.ts',
    'src/ui/content/controllers/ChatGPTDirectoryController.ts',
    'src/ui/content/controllers/ChatGPTMessageStepperController.ts',
    'src/ui/content/chatgptDirectory/navigation.ts',
    'src/drivers/content/chatgpt/ChatGPTConversationNavigation.ts',
]) {
    const source = readFileSync(resolve(relativePath), 'utf8');
    for (const marker of ['ChatGPTConversationIndex', 'ChatGPTConversationMaterialization']) {
        if (source.includes(marker)) {
            throw new Error(`ChatGPT consumer reintroduced a retired projection in ${relativePath}: ${marker}`);
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
    if (!source.includes('page-bridges/chatgpt-conversation-bootstrap.js')
        || !source.includes('page-bridges/chatgpt-conversation-bridge.js')) {
        throw new Error(`Shipped manifest is missing the 5.3 GET seed bridge: ${relativePath}`);
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

console.log(`Verified the single-pool ChatGPT content and Surface boundary for ${target}.`);
