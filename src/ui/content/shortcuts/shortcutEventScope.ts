import { getShortcutPlatform as resolveShortcutPlatform } from '../../../core/shortcuts';
import { DIALOG_KEYBOARD_SCOPE_ATTRIBUTE, getTopDialogKeyboardScopeRoot } from '../components/dialogKeyboardScope';
import { TRANSIENT_ROOT_ATTR } from '../components/transientUi';

export function getShortcutPlatform(): 'mac' | 'other' {
    return resolveShortcutPlatform(typeof navigator === 'undefined' ? '' : navigator.platform);
}

function isEditable(element: Element): boolean {
    return element.matches('input, textarea, select, [role="textbox"], [role="combobox"], [contenteditable]:not([contenteditable="false"])')
        || (element instanceof HTMLElement && element.isContentEditable);
}

export function isShortcutEventEligible(event: KeyboardEvent, options: {
    owner?: HTMLElement;
    allowEditable?: boolean;
    allowRepeat?: boolean;
} = {}): boolean {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229
        || (!options.allowRepeat && event.repeat) || ['Dead', 'Process', 'Unidentified'].includes(event.key)) return false;
    // Firefox uses Alt+Shift+letter for host access keys. Respect a declared
    // host action before claiming a configurable composer shortcut.
    if (getShortcutPlatform() === 'other' && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey) {
        const key = event.key.length === 1 ? event.key.toLowerCase() : event.code.replace(/^Key/, '').toLowerCase();
        if (Array.from(document.querySelectorAll('[accesskey]')).some(element =>
            element.getAttribute('accesskey')?.toLowerCase().split(/\s+/).includes(key))) return false;
    }
    const path = event.composedPath();
    const owner = options.owner;
    if (owner) {
        const top = getTopDialogKeyboardScopeRoot();
        if (!owner.isConnected || (top && top !== owner) || !path.includes(owner)) return false;
    } else if (getTopDialogKeyboardScopeRoot() || document.querySelector(`[${DIALOG_KEYBOARD_SCOPE_ATTRIBUTE}]`)) return false;
    for (const node of path) {
        if (!(node instanceof Element)) continue;
        if (node.hasAttribute('data-aimd-shortcut-recording') || node.hasAttribute(TRANSIENT_ROOT_ATTR)) return false;
        if (!options.allowEditable && isEditable(node)) return false;
        if (!owner && (node.hasAttribute('data-aimd-role') || node.id.startsWith('aimd-') || node.classList.contains('aimd-message-toolbar-host'))) return false;
    }
    if (!options.allowEditable) {
        let active: Element | null = document.activeElement;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        if (active && isEditable(active)) return false;
    }
    return true;
}
