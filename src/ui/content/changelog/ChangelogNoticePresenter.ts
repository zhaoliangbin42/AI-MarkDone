import type { ModalHost } from '../components/ModalHost';
import { t } from '../components/i18n';
import { bookmarksClient } from '../../../drivers/shared/clients/bookmarksClient';
import { logger } from '../../../core/logger';
import { loadLatestChangelogEntry } from '../bookmarks/content/changelog';
import { renderInfoBlocks } from '../bookmarks/ui/tabs/renderInfoBlocks';
import { renderChangelogSections } from '../bookmarks/ui/tabs/renderChangelogSections';

type ChangelogNoticePresenterParams = {
    modalHost: ModalHost;
    onViewAll?: () => void;
    resolveAssetUrl?: (assetPath: string) => string;
    loggerScope?: string;
};

let activeNoticeVersion: string | null = null;

function tr(key: string, fallback: string, substitutions?: string[]): string {
    const translated = substitutions ? t(key, substitutions) : t(key);
    if (!translated || translated === key) return fallback;
    return translated;
}

export async function showChangelogNoticeIfNeeded(params: ChangelogNoticePresenterParams): Promise<boolean> {
    const noticeResult = await bookmarksClient.getChangelogNotice();
    if (!noticeResult.ok) return false;

    const notice = noticeResult.data;
    if (!notice.pendingVersion || notice.pendingVersion === notice.lastShownVersion) return false;
    if (activeNoticeVersion === notice.pendingVersion) return false;

    const latestEntry = loadLatestChangelogEntry();
    if (!latestEntry) return false;
    if (latestEntry.version !== notice.pendingVersion) {
        logger.warn(`[AI-MarkDone][${params.loggerScope ?? 'ChangelogNotice'}] Pending changelog notice version does not match latest changelog entry.`, {
            pendingVersion: notice.pendingVersion,
            latestVersion: latestEntry.version,
        });
        return false;
    }

    activeNoticeVersion = latestEntry.version;

    let ackStarted = false;
    const acknowledge = async () => {
        if (ackStarted) return true;
        ackStarted = true;
        const result = await bookmarksClient.ackChangelogNotice(latestEntry.version);
        if (!result.ok) {
            logger.warn(`[AI-MarkDone][${params.loggerScope ?? 'ChangelogNotice'}] Failed to acknowledge changelog notice.`, {
                version: latestEntry.version,
                error: result.message,
            });
            ackStarted = false;
            return false;
        }
        activeNoticeVersion = null;
        return true;
    };

    await params.modalHost.showCustom({
        kind: 'info',
        title: tr('changelogNoticeTitle', `What's new in AI-MarkDone ${latestEntry.version}`, [latestEntry.version]),
        body: buildChangelogNoticeBody(latestEntry, params.resolveAssetUrl),
        footer: (footer, close) => {
            if (params.onViewAll) {
                const viewAll = document.createElement('button');
                viewAll.type = 'button';
                viewAll.className = 'mock-modal__button mock-modal__button--secondary';
                viewAll.textContent = tr('changelogNoticeViewAll', 'View full changelog');
                viewAll.addEventListener('click', () => {
                    void (async () => {
                        const acked = await acknowledge();
                        if (!acked) return;
                        close();
                        params.onViewAll?.();
                    })();
                });
                footer.appendChild(viewAll);
            }

            const ok = document.createElement('button');
            ok.type = 'button';
            ok.className = 'mock-modal__button mock-modal__button--primary';
            ok.textContent = tr('btnOk', 'OK');
            ok.addEventListener('click', () => {
                void (async () => {
                    const acked = await acknowledge();
                    if (!acked) return;
                    close();
                })();
            });

            footer.appendChild(ok);
            window.setTimeout(() => ok.focus(), 0);
        },
        onDismiss: () => {
            void acknowledge();
        },
    });

    return true;
}

function buildChangelogNoticeBody(
    latestEntry: NonNullable<ReturnType<typeof loadLatestChangelogEntry>>,
    resolveAssetUrl?: (assetPath: string) => string,
): HTMLElement {
    const body = document.createElement('div');
    body.className = 'changelog-notice-modal';

    const style = document.createElement('style');
    style.textContent = getChangelogNoticeCss();
    body.appendChild(style);

    if (latestEntry.date) {
        const date = document.createElement('p');
        date.className = 'changelog-notice-modal__date';
        date.textContent = latestEntry.date;
        body.appendChild(date);
    }

    const content = document.createElement('div');
    content.className = 'changelog-notice-modal__content';
    content.appendChild(renderInfoBlocks(latestEntry.leadBlocks, { resolveAssetUrl }));
    body.appendChild(content);

    if (latestEntry.sections.length > 0) {
        const sections = document.createElement('div');
        sections.className = 'changelog-notice-modal__sections';
        sections.appendChild(renderChangelogSections(latestEntry.sections, { resolveAssetUrl }));
        body.appendChild(sections);
    }

    return body;
}

function getChangelogNoticeCss(): string {
    return `
.changelog-notice-modal {
  display: grid;
  gap: var(--aimd-space-4);
}

.changelog-notice-modal__date {
  margin: 0;
  color: color-mix(in srgb, var(--aimd-text-tertiary) 92%, transparent);
  font-size: var(--aimd-text-xs);
  line-height: 1.5;
}

.changelog-notice-modal__content,
.changelog-notice-modal__sections {
  display: grid;
  gap: var(--aimd-space-3);
}

.changelog-entry-section {
  display: grid;
  gap: var(--aimd-space-2);
}

.changelog-entry-section__title {
  margin: 0;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-base);
  font-weight: var(--aimd-font-medium);
  line-height: 1.35;
}

.changelog-entry-section__body,
.info-copy-stack {
  display: grid;
  gap: var(--aimd-space-3);
}

.info-copy {
  margin: 0;
  color: color-mix(in srgb, var(--aimd-text-secondary) 92%, transparent);
  font-size: var(--aimd-text-sm);
  line-height: 1.7;
}

.info-copy a,
.info-mark a,
.info-list a {
  color: var(--aimd-interactive-primary);
  text-decoration: none;
  font-weight: var(--aimd-font-semibold);
}

.info-copy a:hover,
.info-mark a:hover,
.info-list a:hover {
  text-decoration: underline;
}

.info-mark {
  color: var(--aimd-interactive-primary);
  font-weight: var(--aimd-font-semibold);
}

.info-media {
  margin: 0;
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-md);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 68%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
}

.info-media__image {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  border-radius: calc(var(--aimd-radius-md) - var(--aimd-space-1));
}

.info-list {
  margin: 0;
  padding-left: var(--aimd-space-5);
  display: grid;
  gap: var(--aimd-space-2);
  color: var(--aimd-text-primary);
}

.info-list li {
  color: color-mix(in srgb, var(--aimd-text-primary) 92%, transparent);
  font-size: var(--aimd-text-sm);
  line-height: 1.65;
}
`;
}
