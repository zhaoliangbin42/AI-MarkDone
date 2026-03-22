import { chevronDownIcon, chevronUpIcon } from '../../../../../assets/icons';

export function createBookmarksNumberStepperField(params: {
    parent: HTMLElement;
    labelText: string;
    desc: string;
    valueRole: string;
    onStep: (direction: 'up' | 'down') => void;
}): { root: HTMLElement; input: HTMLInputElement } {
    const item = document.createElement('div');
    item.className = 'settings-row settings-item';
    item.dataset.role = params.valueRole;
    item.id = 'chatgpt-folding-count-item';
    const info = document.createElement('div');
    info.className = 'settings-label settings-item-info';
    const label = document.createElement('strong');
    label.textContent = params.labelText;
    const p = document.createElement('p');
    p.textContent = params.desc;
    info.append(label, p);

    const input = document.createElement('input');
    input.className = 'settings-number aimd-field-control';
    input.type = 'number';
    input.dataset.role = params.valueRole;
    const field = document.createElement('div');
    field.className = 'settings-number-field aimd-field-shell';
    const stepper = document.createElement('div');
    stepper.className = 'settings-number-stepper';
    const stepUp = document.createElement('button');
    stepUp.type = 'button';
    stepUp.className = 'settings-number-step';
    stepUp.dataset.action = 'settings-step-count';
    stepUp.dataset.direction = 'up';
    stepUp.setAttribute('aria-label', 'Increase expanded count');
    stepUp.innerHTML = chevronUpIcon;
    stepUp.addEventListener('click', () => params.onStep('up'));

    const stepDown = document.createElement('button');
    stepDown.type = 'button';
    stepDown.className = 'settings-number-step settings-number-step--down';
    stepDown.dataset.action = 'settings-step-count';
    stepDown.dataset.direction = 'down';
    stepDown.setAttribute('aria-label', 'Decrease expanded count');
    stepDown.innerHTML = chevronDownIcon;
    stepDown.addEventListener('click', () => params.onStep('down'));

    stepper.append(stepUp, stepDown);
    field.append(input, stepper);
    item.append(info, field);
    params.parent.appendChild(item);
    return { root: item, input };
}
