import { bookmarkIcon, locateIcon, refreshCwIcon, sendIcon } from '../../../assets/icons';
import { resolveContent } from '../../../services/reader/types';
import type { ReaderPanelAction, ReaderPanelActionContext } from './ReaderPanel';
import { t } from '../components/i18n';

export type ReaderBookmarkToggleInput = {
    url: string;
    position: number;
    messageId: string | null;
    userPrompt: string;
    markdown: string;
    alreadyBookmarked: boolean;
};

export type ReaderBookmarkToggleResult =
    | { ok: true; bookmarked: boolean; message: string }
    | { ok: false; message?: string; cancelled?: boolean };

export type ConversationReaderBookmarkPort = {
    resolveUrl: () => string;
    isBookmarked: (url: string, position: number) => boolean;
    toggle: (input: ReaderBookmarkToggleInput) => Promise<ReaderBookmarkToggleResult>;
};

export type ConversationReaderSendPort = {
    open: (ctx: ReaderPanelActionContext) => void;
};

export type ConversationReaderLocatePort = {
    beforeLocate?: () => void;
    locate: (target: { position: number; messageId: string | null }) => Promise<{ ok: boolean; message?: string }>;
};

export type ConversationReaderRefreshPort = {
    refresh: (ctx: ReaderPanelActionContext) => Promise<void>;
};

export function createConversationReaderActions(options: {
    bookmark?: ConversationReaderBookmarkPort | null;
    send?: ConversationReaderSendPort | null;
    locate: ConversationReaderLocatePort;
    refresh?: ConversationReaderRefreshPort | null;
}): ReaderPanelAction[] {
    const actions: ReaderPanelAction[] = [];

    if (options.refresh) {
        actions.push({
            id: 'refresh',
            label: t('detachedReaderRefresh'),
            tooltip: t('detachedReaderRefresh'),
            icon: refreshCwIcon,
            placement: 'header',
            onClick: async (ctx) => options.refresh?.refresh(ctx),
        });
    }

    if (options.bookmark) {
        actions.push({
            id: 'bookmark_toggle',
            label: t('btnBookmark'),
            tooltip: t('btnBookmark'),
            icon: bookmarkIcon,
            placement: 'header',
            toggle: true,
            isActive: (ctx) => Boolean(ctx.item.meta?.bookmarked),
            onClick: async (ctx) => {
                const meta = (ctx.item.meta || {}) as Record<string, unknown>;
                const url = typeof meta.url === 'string' ? meta.url : options.bookmark!.resolveUrl();
                const position = Number(meta.position ?? 0);
                const messageId = typeof meta.messageId === 'string' ? meta.messageId : null;
                const userPrompt = String(ctx.item.userPrompt || '').trim();
                const markdown = await resolveContent(ctx.item.content);
                const result = await options.bookmark!.toggle({
                    url,
                    position,
                    messageId,
                    userPrompt,
                    markdown,
                    alreadyBookmarked: options.bookmark!.isBookmarked(url, position),
                });
                if (!result.ok) {
                    if (!result.cancelled && result.message) ctx.notify(result.message);
                    return;
                }
                ctx.item.meta = { ...(ctx.item.meta || {}), url, position, messageId, bookmarked: result.bookmarked, bookmarkable: true };
                ctx.notify(result.message);
                ctx.rerender();
            },
        });
    }

    if (options.send) {
        actions.push({
            id: 'send',
            label: t('send'),
            tooltip: t('send'),
            icon: sendIcon,
            kind: 'primary',
            placement: 'footer_left',
            toggle: true,
            rerenderOnClick: false,
            onClick: (ctx) => options.send?.open(ctx),
        });
    }

    actions.push({
        id: 'locate',
        label: t('jumpToMessage'),
        tooltip: t('jumpToMessage'),
        icon: locateIcon,
        placement: 'footer_left',
        onClick: async (ctx) => {
            const meta = (ctx.item.meta || {}) as Record<string, unknown>;
            const position = Number(meta.position ?? 0);
            const messageId = typeof meta.messageId === 'string' ? meta.messageId : null;
            if (!position && !messageId) {
                ctx.notify(t('positionNotAvailable'));
                return;
            }

            options.locate.beforeLocate?.();
            const result = await options.locate.locate({ position, messageId });
            if (!result.ok) ctx.notify(result.message || t('positionNotAvailable'));
            else if (result.message) ctx.notify(result.message);
        },
    });

    return actions;
}
