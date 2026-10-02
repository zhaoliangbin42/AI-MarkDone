import { afterEach, describe, expect, it, vi } from 'vitest';
import zh from '../../../../public/_locales/zh_CN/messages.json';

vi.mock('@/ui/content/components/i18n', () => ({
    t: (key: string, substitution?: string) => {
        const value = (zh as Record<string, { message: string }>)[key]?.message ?? key;
        return substitution ? value.replaceAll('$1', substitution) : value;
    },
}));

import { FeatureOverviewTabView } from '@/ui/content/bookmarks/ui/tabs/FeatureOverviewTabView';

const views: FeatureOverviewTabView[] = [];
function mount(onOpenSettings = vi.fn()) {
    const view = new FeatureOverviewTabView({ onOpenSettings });
    views.push(view);
    const root = view.getElement();
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(root);
    document.body.append(host);
    return { root, view, shadow, onOpenSettings };
}
afterEach(() => { views.splice(0).forEach(view => view.dispose()); document.body.innerHTML = ''; });

describe('feature overview user paths', () => {
    it('shows the complete guide and filters actual features without replacing the search control', () => {
        const { root } = mount();
        expect(root.querySelectorAll('[data-feature-section]')).toHaveLength(8);
        expect(root.querySelectorAll('[data-feature-id]')).toHaveLength(50);
        const tables = root.querySelectorAll('table');
        expect(tables).toHaveLength(8);
        for (const table of tables) {
            expect(table.querySelectorAll('thead th[scope="col"]')).toHaveLength(2);
            for (const row of table.querySelectorAll('tbody tr')) {
                expect(row.cells).toHaveLength(2);
                expect(row.cells[0]?.getAttribute('scope')).toBe('row');
                expect(row.cells[1]?.querySelector('.feature-overview-entry')).toBeTruthy();
                expect(row.cells[1]?.querySelector('.feature-overview-description')).toBeTruthy();
            }
        }
        expect(root.textContent).toContain('暂存摘录');
        const search = root.querySelector<HTMLInputElement>('[data-role="feature-search"]')!;
        search.value = '{{cursor}}';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        const visible = Array.from(root.querySelectorAll<HTMLElement>('[data-feature-id]')).filter(row => !row.hidden);
        expect(visible.map(row => row.dataset.featureId)).toEqual(['input-prompt-cursor']);
        expect(root.querySelector('[data-role="feature-search"]')).toBe(search);
        expect(root.querySelector('[data-role="feature-count"]')?.textContent).toContain('1');
    });

    it('recovers from an empty search through the visible reset button', () => {
        const { root } = mount();
        const search = root.querySelector<HTMLInputElement>('[data-role="feature-search"]')!;
        search.value = 'no-such-feature-12345';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        const empty = root.querySelector<HTMLElement>('[data-role="feature-empty"]')!;
        expect(empty.hidden).toBe(false);
        empty.querySelector<HTMLButtonElement>('button')!.click();
        expect(search.value).toBe('');
        expect(empty.hidden).toBe(true);
        expect(Array.from(root.querySelectorAll<HTMLElement>('[data-feature-id]')).filter(row => !row.hidden)).toHaveLength(50);
        expect((root.getRootNode() as ShadowRoot).activeElement).toBe(search);
    });

    it('uses real section controls to jump and open the appropriate Settings category', () => {
        const { root, shadow, onOpenSettings } = mount();
        const reader = root.querySelector<HTMLElement>('[data-feature-section="reader"]')!;
        reader.scrollIntoView = vi.fn();
        root.querySelector<HTMLButtonElement>('[data-action="feature-jump"][data-section="reader"]')!.click();
        expect(reader.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
        expect(shadow.activeElement).toBe(reader);
        root.querySelector<HTMLButtonElement>('[data-action="feature-open-settings"][data-category="input"]')!.click();
        expect(onOpenSettings).toHaveBeenCalledOnce();
        expect(onOpenSettings).toHaveBeenCalledWith('input');
    });
});
