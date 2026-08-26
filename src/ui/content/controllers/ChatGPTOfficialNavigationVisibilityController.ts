import {
    CHATGPT_OFFICIAL_NAV_FIXED_CHILD_CSS_SELECTOR,
    CHATGPT_OFFICIAL_NAV_ROOT_SELECTOR,
} from '../../../drivers/content/chatgpt/ChatGPTOfficialNavigation';

const STYLE_ID = 'aimd-official-conversation-nav-visibility-style';
const OFFICIAL_NAV_ROOT_AT_END_SELECTOR = CHATGPT_OFFICIAL_NAV_ROOT_SELECTOR.split(',')[0]!;
const OFFICIAL_NAV_ROOT_BEFORE_SPACE_SELECTOR = CHATGPT_OFFICIAL_NAV_ROOT_SELECTOR.split(',')[1]!;
const OFFICIAL_NAV_FIXED_CHILD_SELECTOR = `> ${CHATGPT_OFFICIAL_NAV_FIXED_CHILD_CSS_SELECTOR}:not([data-aimd-role])`;

export class ChatGPTOfficialNavigationVisibilityController {
    private enabled = false;

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (enabled) this.ensureStyle();
        else this.removeStyle();
    }

    dispose(): void {
        this.enabled = false;
        this.removeStyle();
    }

    private ensureStyle(): void {
        if (!this.enabled || document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
${OFFICIAL_NAV_ROOT_AT_END_SELECTOR} ${OFFICIAL_NAV_FIXED_CHILD_SELECTOR},
${OFFICIAL_NAV_ROOT_BEFORE_SPACE_SELECTOR} ${OFFICIAL_NAV_FIXED_CHILD_SELECTOR} {
  display: none;
}
`;
        document.head.appendChild(style);
    }

    private removeStyle(): void {
        document.getElementById(STYLE_ID)?.remove();
    }
}
