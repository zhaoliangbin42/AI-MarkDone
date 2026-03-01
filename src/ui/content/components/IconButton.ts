import { createIcon } from './Icon';

export function createIconButton(params: {
    icon: string;
    label: string;
    title?: string;
    kind?: 'default' | 'primary' | 'danger';
    disabled?: boolean;
    onClick: () => void | Promise<void>;
}): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `aimd-icon-btn aimd-icon-btn--${params.kind ?? 'default'}`;
    btn.title = params.title ?? params.label;
    btn.setAttribute('aria-label', params.label);
    btn.disabled = Boolean(params.disabled);
    btn.appendChild(createIcon(params.icon));
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        void params.onClick();
    });
    return btn;
}

