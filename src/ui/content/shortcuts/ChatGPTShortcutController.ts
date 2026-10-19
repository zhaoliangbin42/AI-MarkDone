import { SHORTCUT_COMMANDS, getEffectiveBinding, normalizeShortcutSettings, chordMatchesEvent, type ShortcutCommandId, type ShortcutSettings } from '../../../core/shortcuts';
import { getShortcutPlatform, isShortcutEventEligible } from './shortcutEventScope';

export class ChatGPTShortcutController {
    private settings = normalizeShortcutSettings(undefined);
    private active = false;
    private initialized = false;

    constructor(private readonly actions: {
        copy(event: KeyboardEvent): boolean;
        selection(command: ShortcutCommandId): boolean;
        navigate(delta: -1 | 1): boolean;
        prompts: {
            canOpenSuggestions(event?: KeyboardEvent): boolean;
            openSuggestions(): Promise<boolean>;
            openManager(): Promise<void>;
        } | null;
    }) {}

    setSettings(settings: ShortcutSettings): void { this.settings = normalizeShortcutSettings(settings); }
    setActive(active: boolean): void { this.active = active; }
    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        window.addEventListener('keydown', this.onKeyDown, true);
    }
    dispose(): void {
        this.initialized = false;
        window.removeEventListener('keydown', this.onKeyDown, true);
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (!this.active || !this.settings.enabled) return;
        const platform = getShortcutPlatform();
        for (const command of SHORTCUT_COMMANDS) {
            const binding = getEffectiveBinding(this.settings, command.id, platform);
            if (!binding || !chordMatchesEvent(binding, event, platform)) continue;
            if (command.scope === 'composer') {
                const readerOwner = event.composedPath().find((node): node is HTMLElement => node instanceof HTMLElement && node.id === 'aimd-reader-panel-host');
                if (!this.actions.prompts?.canOpenSuggestions(event)
                    || !isShortcutEventEligible(event, { owner: readerOwner, allowEditable: true })) continue;
                event.preventDefault(); event.stopPropagation();
                // Managers and candidates retain their own loading/error UI.
                const operation = command.id === 'prompts.openLibrary'
                    ? this.actions.prompts.openManager()
                    : this.actions.prompts.openSuggestions();
                void operation.catch(() => undefined);
                return;
            }
            if (!isShortcutEventEligible(event)) continue;
            if (command.id === 'selection.copyMarkdown') {
                // Native Mod+C must reach the copy event, whose final clipboard
                // writer lives in the existing atomic-selection owner.
                if (this.actions.copy(event)) {
                    if (event.defaultPrevented) event.stopPropagation();
                    return;
                }
                continue;
            }
            const handled = command.scope === 'navigation'
                ? this.actions.navigate(command.id === 'navigation.previous' ? -1 : 1)
                : this.actions.selection(command.id);
            if (!handled) continue;
            event.preventDefault(); event.stopPropagation();
            return;
        }
    };
}
