export type TargetSurfacePolicy = {
    sponsorTab: boolean;
    socialFollowCard: boolean;
    binaryClipboardCopyActions: boolean;
};

export const TARGET_SURFACE_SPONSOR_TAB_ENABLED =
    typeof __AIMD_ENABLE_SPONSOR_TAB__ === 'undefined' ? true : __AIMD_ENABLE_SPONSOR_TAB__;

export const TARGET_SURFACE_SOCIAL_FOLLOW_CARD_ENABLED =
    typeof __AIMD_ENABLE_SOCIAL_FOLLOW_CARD__ === 'undefined' ? true : __AIMD_ENABLE_SOCIAL_FOLLOW_CARD__;

export const TARGET_SURFACE_BINARY_CLIPBOARD_COPY_ACTIONS_ENABLED =
    typeof __AIMD_ENABLE_BINARY_CLIPBOARD_COPY_ACTIONS__ === 'undefined'
        ? true
        : __AIMD_ENABLE_BINARY_CLIPBOARD_COPY_ACTIONS__;

export const targetSurfacePolicy: TargetSurfacePolicy = {
    sponsorTab: TARGET_SURFACE_SPONSOR_TAB_ENABLED,
    socialFollowCard: TARGET_SURFACE_SOCIAL_FOLLOW_CARD_ENABLED,
    binaryClipboardCopyActions: TARGET_SURFACE_BINARY_CLIPBOARD_COPY_ACTIONS_ENABLED,
};
