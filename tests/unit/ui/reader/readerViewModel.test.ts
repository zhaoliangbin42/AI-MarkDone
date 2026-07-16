import { describe, expect, it } from 'vitest';

import { ReaderWorkflow } from '@/ui/content/reader/ReaderWorkflow';
import { createReaderPanelViewModel } from '@/ui/content/reader/ReaderViewModel';

describe('ReaderViewModel', () => {
    it('projects workflow and display state into the rendering contract without adding behavior flags', () => {
        const workflow = new ReaderWorkflow();
        workflow.open([
            { id: 'a', userPrompt: 'A', content: 'one' },
            { id: 'b', userPrompt: 'B', content: 'two' },
        ], 1, { profile: 'bookmark-preview' });

        const viewModel = createReaderPanelViewModel({
            workflow: workflow.snapshot(),
            display: {
                fullscreen: false,
                panelSizeRatio: { widthRatio: 0.72, heightRatio: 0.82 },
                contentMaxWidthPx: 760,
                bodyFontSizePx: 16,
                stickyOpen: false,
                stickyWidthPx: 320,
                stickyBlocks: [{ id: 'sticky-a', renderedHtml: '<p>Sticky</p>' }],
                renderedHtml: '<h1>Answer</h1>',
                outlineItems: [{ id: 'heading-a', level: 1, text: 'Answer', start: 0, end: 6 }],
                activeOutlineId: 'heading-a',
                showOutlineInReader: true,
                userPromptDisplay: { truncated: false, full: 'B', head: '', middle: '', tail: '' },
                statusText: 'Ready',
            },
            stickyEnabled: false,
            canOpenConversation: true,
        });

        expect(viewModel).toMatchObject({
            items: workflow.items,
            index: 1,
            showCopy: true,
            showOpenConversation: true,
            canOpenConversation: true,
            stickyEnabled: false,
            showOutlineRail: true,
        });
        expect(viewModel).not.toHaveProperty('profile');
        expect(viewModel).not.toHaveProperty('onOpenConversation');
    });
});
