import { describe, expect, it, vi } from 'vitest';

import { SponsorTabView } from '@/ui/content/bookmarks/ui/tabs/SponsorTabView';

describe('SponsorTabView', () => {
    it('renders sponsor assets and exposes the primary GitHub cta as a real external link', () => {
        const actions = {
            githubUrl: 'https://example.com/repo',
            getAssetUrl: vi.fn((asset: string) => `/assets/${asset}`),
        };

        const view = new SponsorTabView({ actions } as any);

        const root = view.getElement();
        const brandMark = root.querySelector<HTMLImageElement>('.sponsor-brand-mark');
        const qrImages = Array.from(root.querySelectorAll<HTMLImageElement>('.sponsor-qr-image'));
        const cta = root.querySelector<HTMLAnchorElement>('.sponsor-cta-button');

        expect(brandMark?.src).toContain('/assets/icons/icon128.png');
        expect(qrImages.map((img) => img.src)).toEqual([
            expect.stringContaining('/assets/icons/bmc_qr.png'),
            expect.stringContaining('/assets/icons/wechat_qr.png'),
        ]);
        expect(cta?.tagName).toBe('A');
        expect(cta?.href).toBe('https://example.com/repo');
        expect(cta?.target).toBe('_blank');
        expect(cta?.rel).toContain('noopener');
        expect(cta?.rel).toContain('noreferrer');
        expect(actions.getAssetUrl).toHaveBeenCalledWith('icons/icon128.png');
        expect(actions.getAssetUrl).toHaveBeenCalledWith('icons/bmc_qr.png');
        expect(actions.getAssetUrl).toHaveBeenCalledWith('icons/wechat_qr.png');
    });
});
