import { describe, expect, it } from 'vitest';
import { buildMessageExportDocument } from '../../../../src/services/export/messageExportDocument';
import type { ChatTurn } from '../../../../src/services/export/saveMessagesTypes';

describe('buildMessageExportDocument', () => {
    it('builds one semantic document in source order without duplicated selections', () => {
        const turns: ChatTurn[] = [
            { user: 'first question', assistant: 'first answer', index: 10 },
            { user: 'second question', assistant: 'second answer', index: 11 },
            { user: 'third question', assistant: 'third answer', index: 12 },
        ];

        const document = buildMessageExportDocument(turns, [2, 0, 2], {
            title: 'Conversation title',
            labels: { user: 'You', assistant: 'Assistant' },
            formatHeading: (ordinal) => `Message ${ordinal}`,
        });

        expect(document).toEqual({
            schemaVersion: 1,
            profile: 'message-card-v1',
            title: 'Conversation title',
            labels: { user: 'You', assistant: 'Assistant' },
            sections: [
                {
                    sourceIndex: 10,
                    heading: 'Message 1',
                    userText: 'first question',
                    assistantMarkdown: 'first answer',
                },
                {
                    sourceIndex: 12,
                    heading: 'Message 2',
                    userText: 'third question',
                    assistantMarkdown: 'third answer',
                },
            ],
        });
    });

    it('numbers headings by valid unique selections only', () => {
        const turns: ChatTurn[] = [
            { user: 'first question', assistant: 'first answer', index: 20 },
            { user: 'second question', assistant: 'second answer', index: 21 },
            { user: 'third question', assistant: 'third answer', index: 22 },
        ];

        const document = buildMessageExportDocument(turns, [2, 0, 0, 2, -1, 99], {
            title: 'Conversation title',
            labels: { user: 'You', assistant: 'Assistant' },
            formatHeading: (ordinal) => `Message ${ordinal}`,
        });

        expect(document?.sections.map((section) => section.heading)).toEqual(['Message 1', 'Message 2']);
    });

    it('returns no document when the selection has no valid source position', () => {
        const turns: ChatTurn[] = [{ user: 'question', assistant: 'answer', index: 0 }];

        expect(buildMessageExportDocument(turns, [-1, 1], {
            title: 'Conversation title',
            labels: { user: 'You', assistant: 'Assistant' },
            formatHeading: () => 'should not be called',
        })).toBeNull();
    });
});
