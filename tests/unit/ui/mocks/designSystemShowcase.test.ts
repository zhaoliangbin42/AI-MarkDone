import { describe, expect, it } from 'vitest';

import { mountDesignSystemShowcase } from '../../../../mocks/components/design-system/main';

describe('design-system showcase mock', () => {
    it('mounts two independent tokenized Shadow DOM showcase instances', () => {
        const root = document.createElement('section');

        mountDesignSystemShowcase(root);

        const hosts = root.querySelectorAll<HTMLElement>('.aimd-design-system-showcase-host');
        expect(hosts).toHaveLength(2);
        expect(hosts[0]?.getAttribute('data-aimd-theme')).toBe('light');
        expect(hosts[1]?.getAttribute('data-aimd-theme')).toBe('dark');

        for (const host of hosts) {
            const shadow = host.shadowRoot;
            expect(shadow).toBeTruthy();
            expect(shadow?.querySelector('style[data-aimd-style-id^="aimd-design-system-tokens-"]')).toBeTruthy();
            expect(shadow?.querySelector('style[data-aimd-style-id="aimd-design-system-showcase-base"]')).toBeTruthy();
            expect(shadow?.querySelectorAll('.swatch')).toHaveLength(10);
            expect(shadow?.querySelector('.toolbar')).toBeTruthy();
            expect(shadow?.querySelector('.panel-demo')).toBeTruthy();
            expect(shadow?.querySelector('.reader-card')).toBeTruthy();
            expect(shadow?.querySelector('.dialog-demo')).toBeTruthy();
            expect(shadow?.querySelector('.popover-demo')).toBeTruthy();
        }
    });
});
