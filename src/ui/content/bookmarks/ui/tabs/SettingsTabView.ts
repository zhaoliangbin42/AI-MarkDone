import { createIcon } from '../../../components/Icon';

export class SettingsTabView {
    private root: HTMLElement;
    private importFile: HTMLInputElement | null = null;

    constructor(params: {
        title: string;
        description: string;
        actions: Array<{ id: string; icon: string; label: string; onClick?: () => void | Promise<void> }>;
        onImportJsonText?: (jsonText: string) => void | Promise<void>;
    }) {
        this.root = document.createElement('div');
        this.root.className = 'aimd-settings';

        const wrap = document.createElement('div');
        wrap.className = 'aimd-scroll aimd-settings-wrap';

        const h = document.createElement('div');
        h.style.display = 'flex';
        h.style.alignItems = 'center';
        h.style.gap = 'var(--aimd-space-2)';
        const t = document.createElement('strong');
        t.textContent = params.title;
        h.appendChild(t);

        const p = document.createElement('div');
        p.style.marginTop = 'var(--aimd-space-2)';
        p.style.fontSize = 'var(--aimd-font-size-xs)';
        p.style.color = 'var(--aimd-text-secondary)';
        p.textContent = params.description;

        const actions = document.createElement('div');
        actions.style.marginTop = 'calc(var(--aimd-space-4) * 1.5)';
        actions.style.display = 'flex';
        actions.style.flexWrap = 'wrap';
        actions.style.gap = 'var(--aimd-space-2)';

        if (params.onImportJsonText) {
            this.importFile = document.createElement('input');
            this.importFile.type = 'file';
            this.importFile.accept = 'application/json';
            this.importFile.style.display = 'none';
            this.importFile.addEventListener('change', async () => {
                const file = this.importFile?.files?.[0] || null;
                if (!file) return;
                const text = await file.text();
                this.importFile!.value = '';
                await params.onImportJsonText?.(text);
            });
            wrap.appendChild(this.importFile);
        }

        for (const a of params.actions) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'aimd-modal-btn aimd-modal-btn--primary';
            btn.style.display = 'inline-flex';
            btn.style.alignItems = 'center';
            btn.style.gap = 'var(--aimd-space-2)';
            btn.appendChild(createIcon(a.icon));
            const label = document.createElement('span');
            label.textContent = a.label;
            btn.appendChild(label);
            btn.addEventListener('click', () => {
                if (a.id === 'import' && this.importFile) {
                    this.importFile.click();
                    return;
                }
                void a.onClick?.();
            });
            actions.appendChild(btn);
        }

        wrap.append(h, p, actions);
        this.root.appendChild(wrap);
    }

    getElement(): HTMLElement {
        return this.root;
    }
}
