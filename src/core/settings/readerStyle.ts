export const READER_READING_STYLES = ['modern', 'book', 'document', 'solarized-dark', 'nord', 'dracula'] as const;
export type ReaderReadingStyle = typeof READER_READING_STYLES[number];

export function normalizeReaderReadingStyle(value: unknown): ReaderReadingStyle {
    return READER_READING_STYLES.includes(value as ReaderReadingStyle) ? value as ReaderReadingStyle : 'modern';
}
