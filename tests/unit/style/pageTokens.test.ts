import { afterEach, describe, expect, it } from 'vitest';
import { ensurePageTokens } from '@/style/pageTokens';

describe('ensurePageTokens', () => {
    afterEach(() => {
        document.getElementById('aimd-page-token-vars')?.remove();
    });

    it('does not rewrite the page token sheet for normalized-equivalent overrides', async () => {
        ensurePageTokens({ accentColor: '#0A7' });
        const style = document.getElementById('aimd-page-token-vars');
        expect(style).toBeInstanceOf(HTMLStyleElement);

        const records: MutationRecord[] = [];
        const observer = new MutationObserver((mutations) => records.push(...mutations));
        observer.observe(style!, { childList: true, characterData: true, subtree: true });

        ensurePageTokens({ accentColor: '#00aa77' });
        await Promise.resolve();
        observer.disconnect();

        expect(records).toEqual([]);
    });
});
