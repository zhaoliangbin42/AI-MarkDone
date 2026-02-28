import { logger } from '../../../core/logger';

export async function copyTextToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        logger.warn('[AI-MarkDone][Clipboard] navigator.clipboard failed, trying fallback', error);
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        textarea.remove();
        return ok;
    } catch (fallbackError) {
        logger.error('[AI-MarkDone][Clipboard] Fallback copy failed', fallbackError);
        return false;
    }
}

