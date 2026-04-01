export type ReaderUserPromptDisplay = {
    truncated: boolean;
    full: string;
    head: string;
    middle: string;
    tail: string;
};

const SEGMENT_LENGTH = 200;
const TRUNCATE_THRESHOLD = SEGMENT_LENGTH * 3;

export function formatReaderUserPromptDisplay(userPrompt: string): ReaderUserPromptDisplay {
    const full = userPrompt ?? '';
    if (full.length <= TRUNCATE_THRESHOLD) {
        return {
            truncated: false,
            full,
            head: '',
            middle: '',
            tail: '',
        };
    }

    const middleStart = Math.floor((full.length - SEGMENT_LENGTH) / 2);
    return {
        truncated: true,
        full,
        head: full.slice(0, SEGMENT_LENGTH),
        middle: full.slice(middleStart, middleStart + SEGMENT_LENGTH),
        tail: full.slice(-SEGMENT_LENGTH),
    };
}
