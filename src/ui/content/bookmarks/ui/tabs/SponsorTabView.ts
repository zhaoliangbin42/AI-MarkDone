import { createIcon } from '../../../components/Icon';

export class SponsorTabView {
    private root: HTMLElement;

    constructor(params: {
        title: string;
        description: string;
        links: Array<{ label: string; href: string; icon?: string }>;
    }) {
        this.root = document.createElement('div');
        this.root.className = 'aimd-sponsor';

        const wrap = document.createElement('div');
        wrap.className = 'aimd-scroll aimd-sponsor-wrap';

        const h = document.createElement('strong');
        h.textContent = params.title;

        const p = document.createElement('div');
        p.style.marginTop = 'var(--aimd-space-2)';
        p.style.fontSize = 'var(--aimd-font-size-xs)';
        p.style.color = 'var(--aimd-text-secondary)';
        p.textContent = params.description;

        const list = document.createElement('div');
        list.style.marginTop = 'calc(var(--aimd-space-4) * 1.5)';
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = 'var(--aimd-space-2)';

        for (const l of params.links) {
            const a = document.createElement('a');
            a.href = l.href;
            a.target = '_blank';
            a.rel = 'noreferrer';
            a.style.display = 'inline-flex';
            a.style.alignItems = 'center';
            a.style.gap = 'var(--aimd-space-2)';
            a.style.color = 'var(--aimd-interactive-primary)';
            a.style.textDecoration = 'none';
            a.style.fontSize = 'var(--aimd-font-size-xs)';
            if (l.icon) a.appendChild(createIcon(l.icon));
            const span = document.createElement('span');
            span.textContent = l.label;
            a.appendChild(span);
            list.appendChild(a);
        }

        wrap.append(h, p, list);
        this.root.appendChild(wrap);
    }

    getElement(): HTMLElement {
        return this.root;
    }
}
