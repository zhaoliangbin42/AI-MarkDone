import { describe, expect, it, vi } from 'vitest';

import { SponsorTabView } from '@/ui/content/bookmarks/ui/tabs/SponsorTabView';

describe('SponsorTabView', () => {
    it('renders payment QR cards first, then GitHub support, then sponsor thanks', () => {
        const actions = {
            githubUrl: 'https://example.com/repo',
            getAssetUrl: vi.fn((asset: string) => `/assets/${asset}`),
        };

        const view = new SponsorTabView({ actions } as any);

        const root = view.getElement();
        const brandMark = root.querySelector<HTMLImageElement>('.sponsor-brand-mark');
        const qrImages = Array.from(root.querySelectorAll<HTMLImageElement>('.sponsor-qr-image'));
        const cta = root.querySelector<HTMLAnchorElement>('.sponsor-cta-button');
        const sections = Array.from(root.querySelectorAll<HTMLElement>('.sponsor-card'));

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
        expect(sections[0]?.classList.contains('sponsor-card--secondary')).toBe(true);
        expect(sections[0]?.querySelectorAll('.sponsor-qr-card').length).toBe(2);
        expect(sections[1]?.querySelector('[data-action="sponsor-github"]')).toBe(cta);
        const thanksList = sections[2]?.querySelector('.sponsor-thanks-list');
        expect(thanksList).toBeTruthy();
        expect(thanksList?.querySelectorAll('.sponsor-thanks-item').length).toBe(6);
        expect(root.textContent).toContain('sponsorThanksTitle');
        expect(root.textContent).toContain('@匿名（Danke!）');
        expect(root.textContent).toContain('@Kayka.Z（很有用的软件，节省了我大量的时间）');
        expect(actions.getAssetUrl).toHaveBeenCalledWith('icons/icon128.png');
        expect(actions.getAssetUrl).toHaveBeenCalledWith('icons/bmc_qr.png');
        expect(actions.getAssetUrl).toHaveBeenCalledWith('icons/wechat_qr.png');
    });
});
