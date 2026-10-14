import { buildChatGPTMessageUrl } from '../../../contracts/chatgptMessageUrl';
import type { ConversationNavigationResultV1 } from '../../../contracts/conversationNavigation';
import { showToast } from '../../../utils/toast';
import { t } from './i18n';

function translate(key: string, fallback: string): string {
    const value = t(key);
    return value && value !== key ? value : fallback;
}

export function showConversationNavigationFailure(
    result: ConversationNavigationResultV1,
    url: string,
    assistantMessageId?: string | null,
): void {
    if (result.ok || result.reason === 'cancelled' || result.reason === 'stale-target') return;

    const canOfferLink = result.reason === 'slot-missing'
        || result.reason === 'hydration-timeout'
        || result.reason === 'source-unavailable';
    const href = canOfferLink ? buildChatGPTMessageUrl(url, assistantMessageId) : null;
    showToast({
        text: translate('conversationNavigationFailed', 'Could not locate this message on the page.'),
        tone: 'error',
        ...(href ? {
            action: {
                label: translate('conversationNavigationOpenMessage', 'Open message in new tab'),
                href,
            },
            closeLabel: translate('btnClose', 'Close'),
        } : {}),
    });
}
