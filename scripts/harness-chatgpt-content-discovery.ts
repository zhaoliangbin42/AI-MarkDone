import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    ConversationContentRepository,
    type ConversationContentCandidateV1,
} from '../src/services/content/ConversationContentRepository';
import {
    createConversationDocumentKeyV1,
    type ConversationDocumentRefV1,
} from '../src/contracts/conversationContent';

const repeatArg = process.argv.find((arg) => arg.startsWith('--repeat='));
const repeat = Math.max(1, Math.min(100, Number(repeatArg?.split('=')[1] ?? 1)));

function document(conversationId: string): ConversationDocumentRefV1 {
    return {
        key: createConversationDocumentKeyV1('chatgpt', conversationId),
        platformId: 'chatgpt',
        conversationId,
    };
}

function candidate(ref: ConversationDocumentRefV1, count: number): ConversationContentCandidateV1 {
    return {
        document: ref,
        coverage: 'complete',
        turns: Array.from({ length: count }, (_, index) => ({
            key: `turn-${index + 1}`,
            ordinal: index + 1,
            identity: {
                turnId: `turn-${index + 1}`,
                userMessageId: `user-${index + 1}`,
                assistantMessageId: `assistant-${index + 1}`,
            },
            userText: `Question ${index + 1}`,
            assistantMarkdown: `Answer ${index + 1}`,
        })),
    };
}

const failures: Array<{ iteration: number; message: string }> = [];
for (let iteration = 1; iteration <= repeat; iteration += 1) {
    let current = document(`conversation-${iteration}`);
    let count = 0;
    const repository = new ConversationContentRepository({
        resolveDocument: () => current,
        acquire: async (ref) => {
            count = Math.min(2, count + 1);
            return candidate(ref, count);
        },
    });
    try {
        const first = await repository.refresh();
        if (first.kind !== 'ready' || first.snapshot.turns.length !== 1) {
            throw new Error('first complete snapshot was not published');
        }
        const firstToken = first.snapshot.contentToken;
        const second = await repository.refresh();
        if (second.kind !== 'ready' || second.snapshot.turns.length !== 2) {
            throw new Error('successor snapshot was not published');
        }
        if (second.snapshot.contentToken === firstToken) {
            throw new Error('successor did not change content token');
        }
        const stable = await repository.refresh();
        if (stable.kind !== 'ready' || stable.snapshot.contentToken !== second.snapshot.contentToken) {
            throw new Error('unchanged content manufactured a new token');
        }
        current = document(`conversation-${iteration}-other`);
        const switched = await repository.refresh();
        if (switched.kind !== 'ready' || switched.document.key !== current.key) {
            throw new Error('route switch did not publish the new document');
        }
    } catch (error) {
        failures.push({
            iteration,
            message: error instanceof Error ? error.message : String(error),
        });
    } finally {
        repository.dispose();
    }
}

const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repeat,
    passed: repeat - failures.length,
    failures,
};
const outputDir = resolve('output/chatgpt-discovery/latest');
mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report));
if (failures.length > 0) process.exitCode = 1;
