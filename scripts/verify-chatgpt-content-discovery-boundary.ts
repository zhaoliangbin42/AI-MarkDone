import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type ExtensionTarget, extensionTargets } from '../config/extension/targets';

function isTarget(value: string): value is ExtensionTarget {
    return value === 'chrome' || value === 'firefox' || value === 'safari';
}

const target = process.argv[2] ?? '';
if (!isTarget(target)) {
    throw new Error('Expected target: chrome, firefox, or safari.');
}

const relativePaths = [
    'public/page-bridges/chatgpt-conversation-bridge.js',
    'public/page-bridges/chatgpt-conversation-bootstrap.js',
    'src/drivers/content/chatgpt/ChatGPTConversationDiscoveryAdapter.ts',
    'src/drivers/content/chatgpt/ChatGPTConversationDiscoveryCoordinator.ts',
    'src/drivers/content/chatgpt/ChatGPTConversationMaterialization.ts',
    'src/services/content/ConversationContentRepository.ts',
    `${extensionTargets[target].distDir}/page-bridges/chatgpt-conversation-bridge.js`,
];
const forbidden = [
    ['', 'api', 'auth', 'session'].join('/'),
    ['access', 'Token'].join(''),
    ['Author', 'ization'].join(''),
    ['document', 'cookie'].join('.'),
    'credentials',
];

for (const relativePath of relativePaths) {
    const path = resolve(relativePath);
    if (!existsSync(path)) throw new Error(`Missing ChatGPT discovery artifact: ${relativePath}`);
    const source = readFileSync(path, 'utf8');
    for (const marker of forbidden) {
        if (source.includes(marker)) {
            throw new Error(`Forbidden authentication marker in ChatGPT discovery artifact ${relativePath}: ${marker}`);
        }
    }
}

const activeReadSource = readFileSync(
    resolve('public/page-bridges/chatgpt-conversation-bridge.js'),
    'utf8',
);
for (const marker of [
    'XMLHttpRequest',
    'EventSource',
    'WebSocket',
    'Authorization',
    'credentials',
    'document.cookie',
]) {
    if (activeReadSource.includes(marker)) {
        throw new Error(`ChatGPT bridge crosses the active-read safety boundary: ${marker}`);
    }
}
if (!activeReadSource.includes("method: 'GET'")) {
    throw new Error('ChatGPT bridge must keep the bounded active acquisition as an explicit GET.');
}

const consumerPaths = [
    'src/drivers/content/chatgpt/ChatGPTConversationIndex.ts',
    'src/ui/content/controllers/ChatGPTConversationReaderBinding.ts',
    'src/ui/content/controllers/MessageToolbarOrchestrator.ts',
    'src/ui/content/export/SaveMessagesDialog.ts',
];
const consumerForbidden = [
    '.ensureReady(',
    '.setSnapshot(',
    'buildChatGPTReaderItems(',
];
for (const relativePath of consumerPaths) {
    const source = readFileSync(resolve(relativePath), 'utf8');
    for (const marker of consumerForbidden) {
        if (source.includes(marker)) {
            throw new Error(`ChatGPT consumer bypasses the canonical content source in ${relativePath}: ${marker}`);
        }
    }
}

const readerSource = readFileSync(resolve('src/services/reader/readerContentSource.ts'), 'utf8');
const refreshCount = readerSource.split('await source.refresh(').length - 1;
const readerContentBuildCount = readerSource.split('const content = buildConversationReaderContent(').length - 1;
if (refreshCount !== 1 || readerContentBuildCount !== 1) {
    throw new Error(
        `Expected one fresh V1 confirmation and one Reader projection boundary; found refresh=${refreshCount}, contentBuild=${readerContentBuildCount}.`,
    );
}
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

console.log(`Verified ChatGPT content-discovery boundary for ${target} (passive graph + metadata-only generation lifecycle + bounded GET acquire).`);
