import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveMessagesAsPdf, type ChatTurn, type ConversationMetadata } from '../save-messages';
import { MarkdownRenderer } from '@/renderer/core/MarkdownRenderer';

describe('saveMessagesAsPdf', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('should no-op when no selected messages', async () => {
        const printSpy = vi.spyOn(window, 'print').mockImplementation(() => { });

        await saveMessagesAsPdf([], [], {
            url: 'https://chatgpt.com',
            exportedAt: new Date().toISOString(),
            title: 'Conversation',
            count: 0,
            platform: 'ChatGPT'
        });

        expect(printSpy).not.toHaveBeenCalled();
        expect(document.getElementById('aimd-pdf-export-container')).toBeNull();
    });

    it('should create print container and cleanup after afterprint', async () => {
        const messages: ChatTurn[] = [{ user: 'u1', assistant: 'a1', index: 0 }];
        const metadata: ConversationMetadata = {
            url: 'https://chatgpt.com',
            exportedAt: new Date().toISOString(),
            title: 'PDF Test',
            count: 1,
            platform: 'ChatGPT'
        };

        vi.spyOn(MarkdownRenderer, 'render').mockResolvedValue({
            success: true,
            html: '<p>rendered</p>',
            processingTime: 1
        });
        const printSpy = vi.spyOn(window, 'print').mockImplementation(() => { });
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback): number => {
            cb(0);
            return 0;
        });

        await saveMessagesAsPdf(messages, [0], metadata);

        const container = document.getElementById('aimd-pdf-export-container');
        expect(container).not.toBeNull();
        expect(printSpy).toHaveBeenCalledTimes(1);

        window.dispatchEvent(new Event('afterprint'));
        expect(document.getElementById('aimd-pdf-export-container')).toBeNull();
    });

    it('should fallback to raw assistant text when renderer fails', async () => {
        const messages: ChatTurn[] = [{ user: 'u1', assistant: 'raw **md** text', index: 0 }];
        const metadata: ConversationMetadata = {
            url: 'https://chatgpt.com',
            exportedAt: new Date().toISOString(),
            title: 'PDF Fallback',
            count: 1,
            platform: 'ChatGPT'
        };

        vi.spyOn(MarkdownRenderer, 'render').mockRejectedValue(new Error('render-fail'));
        vi.spyOn(window, 'print').mockImplementation(() => { });
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback): number => {
            cb(0);
            return 0;
        });

        await saveMessagesAsPdf(messages, [0], metadata);

        const container = document.getElementById('aimd-pdf-export-container');
        expect(container).not.toBeNull();
        expect(container?.textContent || '').toContain('raw **md** text');

        window.dispatchEvent(new Event('afterprint'));
    });

    it('should cleanup container by timeout when afterprint is not fired', async () => {
        vi.useFakeTimers();
        const messages: ChatTurn[] = [{ user: 'u1', assistant: 'a1', index: 0 }];
        const metadata: ConversationMetadata = {
            url: 'https://chatgpt.com',
            exportedAt: new Date().toISOString(),
            title: 'PDF Timeout Cleanup',
            count: 1,
            platform: 'ChatGPT'
        };

        vi.spyOn(MarkdownRenderer, 'render').mockResolvedValue({
            success: true,
            html: '<p>rendered</p>',
            processingTime: 1
        });
        vi.spyOn(window, 'print').mockImplementation(() => { });
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback): number => {
            cb(0);
            return 0;
        });

        await saveMessagesAsPdf(messages, [0], metadata);

        expect(document.getElementById('aimd-pdf-export-container')).not.toBeNull();
        vi.advanceTimersByTime(30000);
        expect(document.getElementById('aimd-pdf-export-container')).toBeNull();
    });

    it('should cleanup container when print throws', async () => {
        const messages: ChatTurn[] = [{ user: 'u1', assistant: 'a1', index: 0 }];
        const metadata: ConversationMetadata = {
            url: 'https://chatgpt.com',
            exportedAt: new Date().toISOString(),
            title: 'PDF Print Error',
            count: 1,
            platform: 'ChatGPT'
        };

        vi.spyOn(MarkdownRenderer, 'render').mockResolvedValue({
            success: true,
            html: '<p>rendered</p>',
            processingTime: 1
        });
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback): number => {
            cb(0);
            return 0;
        });
        vi.spyOn(window, 'print').mockImplementation(() => {
            throw new Error('print-fail');
        });

        await saveMessagesAsPdf(messages, [0], metadata);
        expect(document.getElementById('aimd-pdf-export-container')).toBeNull();
    });
});
