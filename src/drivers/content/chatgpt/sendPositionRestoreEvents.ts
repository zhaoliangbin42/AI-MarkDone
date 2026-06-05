export const CHATGPT_SEND_POSITION_RESTORE_ARM_EVENT = 'aimd:chatgpt-send-position-restore:arm';
export const CHATGPT_SEND_POSITION_RESTORE_RELEASE_EVENT = 'aimd:chatgpt-send-position-restore:release';

export function armChatGPTSendPositionRestore(): void {
    window.dispatchEvent(new CustomEvent(CHATGPT_SEND_POSITION_RESTORE_ARM_EVENT));
}

export function releaseChatGPTSendPositionRestore(): void {
    window.dispatchEvent(new CustomEvent(CHATGPT_SEND_POSITION_RESTORE_RELEASE_EVENT));
}
