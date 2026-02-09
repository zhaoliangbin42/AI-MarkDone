import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('save-messages sanitization guard', () => {
    it('keeps markdown sanitize=true and metadata escape before HTML injection', () => {
        const source = readFileSync(
            resolve(process.cwd(), 'src/content/features/save-messages.ts'),
            'utf-8'
        );

        // Assistant markdown must be sanitized at render stage.
        expect(source).toContain('MarkdownRenderer.render(msg.assistant, { sanitize: true })');

        // Metadata and user content should be escaped before template interpolation.
        expect(source).toContain('${escapeHtml(metadata.title)}');
        expect(source).toContain('${escapeHtml(msg.user)}');

        // Keep explicit escape utility available in the file.
        expect(source).toContain('function escapeHtml(text: string): string');
    });
});
