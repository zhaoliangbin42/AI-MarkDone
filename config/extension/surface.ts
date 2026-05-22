import type { ExtensionTarget } from './targets';

export type ExtensionSurfacePolicy = {
    sponsorTab: boolean;
    socialFollowCard: boolean;
    binaryClipboardCopyActions: boolean;
};

export const extensionSurfacePolicies = {
    chrome: {
        sponsorTab: true,
        socialFollowCard: true,
        binaryClipboardCopyActions: true,
    },
    firefox: {
        sponsorTab: true,
        socialFollowCard: true,
        binaryClipboardCopyActions: true,
    },
    safari: {
        sponsorTab: false,
        socialFollowCard: false,
        binaryClipboardCopyActions: false,
    },
} as const satisfies Record<ExtensionTarget, ExtensionSurfacePolicy>;

export const extensionIconFiles = [
    'icon16.png',
    'icon48.png',
    'icon128.png',
    'icon16_gray.png',
    'icon48_gray.png',
    'icon128_gray.png',
    'about_avatar.png',
] as const;

export const safariExcludedIconFiles = [
    'bmc_qr.png',
    'wechat_qr.png',
    'xiaohongshu_card.png',
] as const;

export const safariExcludedLocaleMessageKeys = [
    'supportDevelopment',
    'ifProjectHelps',
    'supportDevDesc',
    'starOnGitHub',
    'supportCoffeeDesc',
    'buyMeCoffee',
    'wechatAppreciationCode',
    'xiaohongshuAccount',
    'findMeOnXiaohongshu',
    'tabSponsor',
    'sponsorTabPlaceholder',
    'sponsorOpenSourceTitle',
    'sponsorOpenSourceNote',
    'sponsorOpenSourceBody',
    'sponsorDonateTitle',
    'sponsorDonateNote',
    'sponsorDonateBody',
    'sponsorBmcNote',
    'sponsorBmcAlt',
    'sponsorWechatNote',
    'sponsorWechatAlt',
    'sponsorThanksTitle',
    'sponsorThanksDesc',
    'sponsorThanksAriaLabel',
] as const;
