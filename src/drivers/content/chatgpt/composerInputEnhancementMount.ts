export type ChatGPTComposerInputEnhancementMount = {
    container: HTMLElement;
    anchor: HTMLElement;
    officialContainer: HTMLElement;
    plusButton: HTMLButtonElement;
};

const MOUNT_STYLE_ID = 'aimd-chatgpt-input-enhancement-mount-style';
const MOUNT_DATASET = 'aimdInputEnhancementMount';

export function activateChatGPTComposerInputEnhancementMount(
    mount: ChatGPTComposerInputEnhancementMount,
): () => void {
    if (mount.container === mount.officialContainer) return () => undefined;

    mount.container.dataset[MOUNT_DATASET] = '1';
    if (!document.getElementById(MOUNT_STYLE_ID)) {
        const style = document.createElement('style');
        style.id = MOUNT_STYLE_ID;
        style.textContent = `
[data-aimd-input-enhancement-mount="1"] {
  display: flex;
  align-items: center;
}
`;
        document.head.appendChild(style);
    }

    return () => {
        delete mount.container.dataset[MOUNT_DATASET];
        if (!document.querySelector('[data-aimd-input-enhancement-mount="1"]')) {
            document.getElementById(MOUNT_STYLE_ID)?.remove();
        }
    };
}

export function findChatGPTComposerInputEnhancementMount(
    composer: HTMLElement,
): ChatGPTComposerInputEnhancementMount | null {
    const form = composer.closest('form');
    if (!form) return null;
    const plusButton = form.querySelector<HTMLButtonElement>(
        'button[data-testid="composer-plus-btn"], button#composer-plus-btn',
    );
    if (!plusButton?.parentElement) return null;
    const officialContainer = plusButton.parentElement;
    const parentContainer = officialContainer.parentElement;
    const canMountBesideOfficialContainer = Boolean(
        parentContainer
        && parentContainer !== form
        && form.contains(parentContainer),
    );
    const container = canMountBesideOfficialContainer ? parentContainer! : officialContainer;
    return {
        container,
        anchor: canMountBesideOfficialContainer ? officialContainer : plusButton,
        officialContainer,
        plusButton,
    };
}
