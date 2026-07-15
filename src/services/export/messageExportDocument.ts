import type { ChatTurn } from './saveMessagesTypes';
import type { ExportDocumentV1 } from './imageExportContracts';

export type BuildMessageExportDocumentOptions = {
    title: string;
    labels: ExportDocumentV1['labels'];
    formatHeading: (ordinal: number, turn: ChatTurn) => string;
};

export function buildMessageExportDocument(
    turns: readonly ChatTurn[],
    selectedIndices: readonly number[],
    options: BuildMessageExportDocumentOptions,
): ExportDocumentV1 | null {
    const selectedPositions = Array.from(new Set(selectedIndices))
        .filter((index) => Number.isInteger(index) && index >= 0 && index < turns.length)
        .sort((left, right) => left - right);
    const sections = selectedPositions.map((sourcePosition, ordinalIndex) => {
        const turn = turns[sourcePosition];
        return {
            sourceIndex: turn.index,
            heading: options.formatHeading(ordinalIndex + 1, turn),
            userText: turn.user,
            assistantMarkdown: turn.assistant,
        };
    });

    if (sections.length === 0) return null;

    return {
        schemaVersion: 1,
        profile: 'message-card-v1',
        title: options.title,
        labels: { ...options.labels },
        sections,
    };
}
