export type TabId = string;

export type TabSpec = {
    id: TabId;
    label: string;
    icon: string;
    content: HTMLElement;
};

export class Tabs {
    private root: HTMLElement;
    private buttons: Map<TabId, HTMLButtonElement> = new Map();
    private contentMap: Map<TabId, HTMLElement> = new Map();
    private active: TabId;

    constructor(tabs: TabSpec[], defaultTabId: TabId) {
        this.root = document.createElement('div');
        this.root.className = 'aimd-tabs';

        const sidebar = document.createElement('div');
        sidebar.className = 'aimd-tabs-sidebar';

        const body = document.createElement('div');
        body.className = 'aimd-tabs-body';

        for (const tab of tabs) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'aimd-tab-btn';
            // Use explicit attribute to avoid dataset/casing edge cases.
            btn.setAttribute('data-tab-id', tab.id);
            btn.title = tab.label;
            btn.setAttribute('aria-label', tab.label);
            btn.innerHTML = `<span class="aimd-tab-icon">${tab.icon}</span><span class="aimd-tab-label">${tab.label}</span>`;
            sidebar.appendChild(btn);
            this.buttons.set(tab.id, btn);

            tab.content.classList.add('aimd-tab-content');
            tab.content.setAttribute('data-tab-id', tab.id);
            body.appendChild(tab.content);
            this.contentMap.set(tab.id, tab.content);
        }

        // Why: event delegation is more robust against innerHTML updates and nested SVG clicks.
        sidebar.addEventListener('click', (e) => {
            const target = e.target as HTMLElement | null;
            const btn = target?.closest?.('[data-tab-id]') as HTMLButtonElement | null;
            const id = btn?.getAttribute('data-tab-id') ?? null;
            if (!id) return;
            this.setActive(id);
            // Ensure keyboard shortcuts (like ESC) continue to work reliably after tab switches.
            btn?.focus?.({ preventScroll: true } as any);
        });

        this.root.append(sidebar, body);
        this.active = defaultTabId;
        this.setActive(defaultTabId);
    }

    getElement(): HTMLElement {
        return this.root;
    }

    getActive(): TabId {
        return this.active;
    }

    setActive(id: TabId): void {
        this.active = id;
        this.buttons.forEach((btn, tabId) => {
            btn.dataset.active = tabId === id ? '1' : '0';
        });
        this.contentMap.forEach((el, tabId) => {
            el.dataset.active = tabId === id ? '1' : '0';
        });
        this.root.dispatchEvent(new CustomEvent('aimd:tabs-change', { detail: { id } }));
    }
}
