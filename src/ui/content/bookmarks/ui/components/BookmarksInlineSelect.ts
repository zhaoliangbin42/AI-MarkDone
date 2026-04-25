import { checkIcon, chevronDownIcon } from '../../../../../assets/icons';
import { markTransientRoot } from '../../../components/transientUi';

export type BookmarksInlineSelectRef = {
    root: HTMLElement;
    shell: HTMLElement;
    trigger: HTMLButtonElement;
    triggerLabel: HTMLElement;
    menu: HTMLElement;
    getValue: () => string;
    setValue: (value: string) => void;
    close: () => void;
    onChange: (listener: (value: string) => void) => void;
};

export function createBookmarksInlineSelectControl(params: {
    options: Array<{ value: string; label: string }>;
    menuName: string;
    onBeforeOpen?: () => void;
}): BookmarksInlineSelectRef {
    const shell = markTransientRoot(document.createElement('div'));
    shell.className = 'settings-select-shell';
    shell.dataset.open = '0';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'settings-select-trigger';
    trigger.dataset.action = 'toggle-settings-menu';
    trigger.dataset.menu = params.menuName;
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const triggerLabel = document.createElement('span');
    triggerLabel.className = 'settings-select-trigger__label';
    const triggerCaret = document.createElement('span');
    triggerCaret.className = 'settings-select-trigger__caret';
    triggerCaret.innerHTML = chevronDownIcon;
    trigger.append(triggerLabel, triggerCaret);

    const menu = document.createElement('div');
    menu.className = 'settings-select-menu';
    menu.dataset.open = '0';
    menu.setAttribute('role', 'listbox');
    menu.tabIndex = -1;

    const listeners = new Set<(value: string) => void>();
    let currentValue = params.options[0]?.value ?? '';

    const optionButtons = params.options.map((opt) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'settings-select-option';
        button.dataset.action = 'settings-select-option';
        button.dataset.menu = params.menuName;
        button.dataset.value = opt.value;
        button.setAttribute('role', 'option');
        const optionLabel = document.createElement('span');
        optionLabel.textContent = opt.label;
        const optionCheck = document.createElement('span');
        optionCheck.className = 'settings-option-check';
        optionCheck.innerHTML = checkIcon;
        button.append(optionLabel, optionCheck);
        button.addEventListener('click', (event) => {
            event.preventDefault();
            currentValue = opt.value;
            syncValue();
            listeners.forEach((listener) => listener(currentValue));
            close();
        });
        menu.appendChild(button);
        return button;
    });

    const syncValue = (): void => {
        const selectedOption = params.options.find((opt) => opt.value === currentValue) ?? params.options[0] ?? { value: '', label: '' };
        currentValue = selectedOption.value;
        triggerLabel.textContent = selectedOption.label;
        trigger.setAttribute('aria-label', selectedOption.label);
        for (const button of optionButtons) {
            const isSelected = button.dataset.value === currentValue;
            button.dataset.selected = isSelected ? '1' : '0';
            button.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        }
    };
    const close = (): void => {
        shell.dataset.open = '0';
        menu.dataset.open = '0';
        trigger.setAttribute('aria-expanded', 'false');
    };
    const open = (): void => {
        params.onBeforeOpen?.();
        shell.dataset.open = '1';
        menu.dataset.open = '1';
        trigger.setAttribute('aria-expanded', 'true');
    };
    trigger.addEventListener('click', (event) => {
        event.preventDefault();
        if (shell.dataset.open === '1') {
            close();
            return;
        }
        open();
    });

    syncValue();
    shell.append(trigger, menu);
    return {
        root: shell,
        shell,
        trigger,
        triggerLabel,
        menu,
        getValue: () => currentValue,
        setValue: (value: string) => {
            currentValue = value;
            syncValue();
        },
        close,
        onChange: (listener) => listeners.add(listener),
    };
}

export function createBookmarksInlineSelect(params: {
    parent: HTMLElement;
    labelText: string;
    desc: string;
    options: Array<{ value: string; label: string }>;
    menuName: string;
    onBeforeOpen?: () => void;
}): BookmarksInlineSelectRef {
    const item = document.createElement('div');
    item.className = 'settings-row settings-item';
    const info = document.createElement('div');
    info.className = 'settings-label settings-item-info';
    const label = document.createElement('strong');
    label.textContent = params.labelText;
    const p = document.createElement('p');
    p.textContent = params.desc;
    info.append(label, p);

    const control = createBookmarksInlineSelectControl({
        options: params.options,
        menuName: params.menuName,
        onBeforeOpen: params.onBeforeOpen,
    });
    item.append(info, control.shell);
    params.parent.appendChild(item);
    return {
        root: item,
        shell: control.shell,
        trigger: control.trigger,
        triggerLabel: control.triggerLabel,
        menu: control.menu,
        getValue: control.getValue,
        setValue: control.setValue,
        close: control.close,
        onChange: control.onChange,
    };
}
