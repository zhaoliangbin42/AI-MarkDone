import { browser } from '../../../drivers/shared/browser';

export type I18nKey = string;

export function t(key: I18nKey, substitutions?: string | string[]): string {
    try {
        const value = browser.i18n.getMessage(key, substitutions as any);
        return value || key;
    } catch {
        return key;
    }
}

