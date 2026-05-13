import { describe, expect, it } from 'vitest';

import { mountPageSystemShowcase } from '../../../../mocks/pages/style-system/main';

describe('page-system showcase mock', () => {
    it('mounts every major page-level surface inside tokenized Shadow DOM', () => {
        const root = document.createElement('section');

        mountPageSystemShowcase(root);

        const host = root.querySelector<HTMLElement>('.aimd-page-system-showcase-host');
        expect(host).toBeTruthy();
        expect(host?.getAttribute('data-aimd-theme')).toBe('light');

        const shadow = host?.shadowRoot;
        expect(shadow).toBeTruthy();
        expect(shadow?.querySelector('style[data-aimd-style-id="aimd-page-system-tokens-light"]')).toBeTruthy();
        expect(shadow?.querySelectorAll('.page-frame')).toHaveLength(8);

        const expectedPageIds = [
            'popup',
            'host-runtime',
            'reader',
            'bookmarks-manager',
            'settings-info',
            'save-dialogs',
            'send-surfaces',
            'progress-transient',
        ];

        for (const id of expectedPageIds) {
            expect(shadow?.querySelector(`[data-page-id="${id}"]`)).toBeTruthy();
        }

        expect(shadow?.querySelector('.unsupported-popup')).toBeTruthy();
        expect(shadow?.querySelector('.chatgpt-snapshot')).toBeTruthy();
        expect(shadow?.querySelector('.reader-panel-window')).toBeTruthy();
        expect(shadow?.querySelector('.mock-bookmarks-window')).toBeTruthy();
        expect(shadow?.querySelector('.mock-dialog-window')).toBeTruthy();
        expect(shadow?.querySelector('.mock-send-popover')).toBeTruthy();
        expect(shadow?.querySelector('.mock-task-progress')).toBeTruthy();
        expect(shadow?.querySelector('.directory-rail-preview')).toBeTruthy();
    });
});
