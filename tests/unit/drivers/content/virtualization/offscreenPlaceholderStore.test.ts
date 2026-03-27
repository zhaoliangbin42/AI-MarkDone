import { describe, expect, it } from 'vitest';
import { OffscreenPlaceholderStore } from '@/drivers/content/virtualization/offscreenPlaceholderStore';

describe('OffscreenPlaceholderStore', () => {
    it('trims and restores a grouped subtree without losing order', () => {
        document.body.innerHTML = `
          <main>
            <section id="before">before</section>
            <section id="u1">user</section>
            <div id="bar">bar</div>
            <section id="a1">assistant</section>
            <section id="after">after</section>
          </main>
        `;

        const store = new OffscreenPlaceholderStore();
        const user = document.getElementById('u1') as HTMLElement;
        const bar = document.getElementById('bar') as HTMLElement;
        const assistant = document.getElementById('a1') as HTMLElement;

        const placeholder = store.trim({
            groupId: 'g1',
            nodes: [user, bar, assistant],
            height: 480,
        });

        expect(placeholder.dataset.aimdVirtualizedGroupId).toBe('g1');
        expect(placeholder.style.minHeight).toBe('480px');
        expect(placeholder.querySelector('button')).toBeNull();
        expect(document.getElementById('u1')).toBeNull();
        expect(document.getElementById('a1')).toBeNull();

        store.restore('g1');

        const main = document.querySelector('main')!;
        expect(main.children[1]?.id).toBe('u1');
        expect(main.children[2]?.id).toBe('bar');
        expect(main.children[3]?.id).toBe('a1');
    });
});
