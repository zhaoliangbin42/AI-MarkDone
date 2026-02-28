import { describe, expect, it } from 'vitest';
import { getTokenCss } from '@/style/tokens';

describe('tokens', () => {
    it('emits required token variables', () => {
        const css = getTokenCss('dark');
        expect(css).toContain('--aimd-bg-primary');
        expect(css).toContain('--aimd-text-primary');
        expect(css).toContain('--aimd-border-default');
    });
});

