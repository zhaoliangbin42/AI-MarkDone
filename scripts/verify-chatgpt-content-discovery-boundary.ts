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
    'src/drivers/content/chatgpt/ChatGPTConversationEngine.ts',
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

console.log(`Verified passive ChatGPT content-discovery boundary for ${target}.`);
