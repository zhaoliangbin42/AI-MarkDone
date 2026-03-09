import { createIcon } from '../../../components/Icon';
import { t } from '../../../components/i18n';
import { Icons, chevronDownIcon, chatgptIcon } from '../../../../../assets/icons';

export type PlatformDropdownItem = {
    value: string;
    label: string;
    icon?: string;
};

function normalizeSelected(value: string): string {
    const v = value.trim().toLowerCase();
    if (!v || v === 'all') return 'all';
    if (v.includes('chatgpt')) return 'chatgpt';
    if (v.includes('gemini')) return 'gemini';
    if (v.includes('claude')) return 'claude';
    if (v.includes('deepseek')) return 'deepseek';
    return 'other';
}

function iconForValue(value: string): string {
    const v = value.trim().toLowerCase();
    if (v === 'all') return Icons.layers;
    if (v.includes('chatgpt')) return chatgptIcon;
    if (v.includes('gemini')) return Icons.gemini;
    if (v.includes('claude')) return Icons.claude;
    if (v.includes('deepseek')) return Icons.deepseek;
    return Icons.layers;
}

export class PlatformDropdown {
    private root: HTMLElement;
    private button: HTMLButtonElement;
    private labelEl: HTMLElement;
    private iconEl: HTMLElement;
    private menu: HTMLElement;
    private items: PlatformDropdownItem[] = [];
    private value: string = 'All';
    private open: boolean = false;
    private activeIndex: number = 0;
    private onChange: (value: string) => void;

    constructor(params: {
        items?: PlatformDropdownItem[];
        value?: string;
        onChange: (value: string) => void;
    }) {
        this.onChange = params.onChange;

        this.root = document.createElement('div');
        this.root.className = 'aimd-platform';

        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'aimd-platform-btn';
        this.button.setAttribute('aria-haspopup', 'listbox');
        this.button.setAttribute('aria-expanded', 'false');
        this.button.setAttribute('aria-label', t('allPlatforms'));

        this.iconEl = document.createElement('span');
        this.iconEl.className = 'aimd-platform-icon';

        this.labelEl = document.createElement('span');
        this.labelEl.className = 'aimd-platform-label';

        const caret = document.createElement('span');
        caret.className = 'aimd-platform-caret';
        caret.appendChild(createIcon(chevronDownIcon));

        this.button.append(this.iconEl, this.labelEl, caret);

        this.menu = document.createElement('div');
        this.menu.className = 'aimd-platform-menu';
        this.menu.setAttribute('role', 'listbox');
        this.menu.tabIndex = -1;

        this.menu.addEventListener('keydown', (e) => {
            if (!this.open) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.moveActive(1);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.moveActive(-1);
                return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const opts = this.menu.querySelectorAll<HTMLButtonElement>('.aimd-platform-option');
                opts[this.activeIndex]?.click();
            }
        });

        this.root.append(this.button, this.menu);

        this.button.addEventListener('click', (e) => {
            e.preventDefault();
            this.setOpen(!this.open);
        });

        this.root.addEventListener('keydown', (e) => {
            if (!this.open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                this.setOpen(true);
                return;
            }
            if (e.key === 'Escape') {
                if (!this.open) return;
                e.preventDefault();
                e.stopPropagation();
                this.setOpen(false);
            }
        });

        this.setItems(params.items ?? []);
        this.setValue(params.value ?? 'All');
    }

    getElement(): HTMLElement {
        return this.root;
    }

    setItems(items: PlatformDropdownItem[]): void {
        this.items = items;
        this.renderMenu();
        this.updateButton();
    }

    setValue(value: string): void {
        this.value = value;
        this.updateButton();
        this.renderMenu();
    }

    private setOpen(open: boolean): void {
        this.open = open;
        this.root.dataset.open = open ? '1' : '0';
        this.button.setAttribute('aria-expanded', open ? 'true' : 'false');
        this.menu.dataset.open = open ? '1' : '0';

        if (open) {
            window.setTimeout(() => {
                const idx = this.items.findIndex((i) => i.value === this.value);
                this.activeIndex = idx >= 0 ? idx : 0;
                const opts = this.menu.querySelectorAll<HTMLButtonElement>('.aimd-platform-option');
                (opts[this.activeIndex] ?? this.menu).focus();
            }, 0);
            window.addEventListener('mousedown', this.onOutsidePointerDown, { capture: true });
            window.addEventListener('keydown', this.onGlobalKeyDown, { capture: true });
        } else {
            window.removeEventListener('mousedown', this.onOutsidePointerDown, { capture: true } as any);
            window.removeEventListener('keydown', this.onGlobalKeyDown, { capture: true } as any);
            this.button.focus();
        }
    }

    private onOutsidePointerDown = (e: MouseEvent) => {
        const path = (e.composedPath?.() ?? []) as any[];
        if (path.includes(this.root)) return;
        this.setOpen(false);
    };

    private onGlobalKeyDown = (e: KeyboardEvent) => {
        if (!this.open) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.setOpen(false);
        }
    };

    private updateButton(): void {
        const selected = normalizeSelected(this.value);
        this.root.dataset.selected = selected;
        this.button.dataset.selected = selected;

        const label = this.items.find((i) => i.value === this.value)?.label ?? this.value;
        this.labelEl.textContent = label;

        const icon = this.items.find((i) => i.value === this.value)?.icon ?? iconForValue(this.value);
        this.iconEl.replaceChildren(createIcon(icon));
    }

    private renderMenu(): void {
        this.menu.replaceChildren();

        for (const item of this.items) {
            const opt = document.createElement('button');
            opt.type = 'button';
            opt.className = 'aimd-platform-option';
            opt.dataset.value = item.value;
            opt.dataset.selected = item.value === this.value ? '1' : '0';
            opt.setAttribute('role', 'option');
            opt.setAttribute('aria-selected', item.value === this.value ? 'true' : 'false');
            opt.title = item.label;
            opt.setAttribute('aria-label', item.label);

            const icon = document.createElement('span');
            icon.className = 'aimd-platform-option-icon';
            icon.appendChild(createIcon(item.icon ?? iconForValue(item.value)));
            const label = document.createElement('span');
            label.className = 'aimd-platform-option-label';
            label.textContent = item.label;

            opt.append(icon, label);
            opt.addEventListener('click', (e) => {
                e.preventDefault();
                this.value = item.value;
                this.onChange(item.value);
                this.setOpen(false);
                this.updateButton();
            });

            this.menu.appendChild(opt);
        }
    }

    private moveActive(delta: number): void {
        const opts = this.menu.querySelectorAll<HTMLButtonElement>('.aimd-platform-option');
        if (opts.length === 0) return;
        this.activeIndex = (this.activeIndex + delta + opts.length) % opts.length;
        opts[this.activeIndex]?.focus();
    }
}
