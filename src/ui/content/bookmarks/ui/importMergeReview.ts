import { t } from '../../components/i18n';

export type ImportMergeReviewResult = {
    imported?: number;
    skippedDuplicates?: number;
    renamed?: number;
    warnings?: string[];
    folderCreateFailures?: number;
};

export type ImportMergeReviewModal = {
    body: HTMLElement;
    kind: 'info' | 'warning';
};

export function buildImportMergeReviewModalBody(result: ImportMergeReviewResult): ImportMergeReviewModal {
    const body = document.createElement('div');
    const summarySection = document.createElement('section');
    summarySection.className = 'merge-section merge-section--summary';
    const summaryHeading = document.createElement('div');
    summaryHeading.className = 'merge-section__heading';
    summaryHeading.textContent = t('importMergeSummaryHeading');
    const summary = document.createElement('div');
    summary.className = 'merge-summary';

    const items = [
        { label: t('importMergeSummaryImported'), value: String(result.imported ?? 0) },
        { label: t('importMergeSummarySkippedDuplicates'), value: String(result.skippedDuplicates ?? 0) },
        { label: t('importMergeSummaryRenamedTitles'), value: String(result.renamed ?? 0) },
        { label: t('importMergeSummaryFolderFallbacks'), value: String(result.folderCreateFailures ?? 0) },
    ];

    for (const item of items) {
        const article = document.createElement('article');
        article.className = 'merge-summary-item';
        const label = document.createElement('span');
        label.className = 'merge-summary-item__label';
        label.textContent = item.label;
        const value = document.createElement('strong');
        value.textContent = item.value;
        article.append(label, value);
        summary.appendChild(article);
    }

    summarySection.append(summaryHeading, summary);
    body.appendChild(summarySection);

    const detailSection = document.createElement('section');
    detailSection.className = 'merge-section merge-section--detail';
    const detailHeading = document.createElement('div');
    detailHeading.className = 'merge-section__heading';
    detailHeading.textContent = t('importMergeDetailsHeading');
    const entries = document.createElement('div');
    entries.className = 'merge-entry-list';
    const warningMessages = Array.isArray(result.warnings) ? result.warnings : [];
    const rows = [
        {
            title: t('importMergeImportedBookmarksTitle'),
            detail: t('importMergeImportedBookmarksDetail', String(result.imported ?? 0)),
            status: 'import',
        },
        {
            title: t('importMergeDuplicateBookmarksTitle'),
            detail: t('importMergeDuplicateBookmarksDetail', String(result.skippedDuplicates ?? 0)),
            status: 'duplicate',
        },
        {
            title: t('importMergeRenamedTitlesTitle'),
            detail: t('importMergeRenamedTitlesDetail', String(result.renamed ?? 0)),
            status: 'rename',
        },
        ...warningMessages.map((warning) => ({ title: t('importMergeWarningTitle'), detail: warning, status: 'normal' as const })),
    ];

    for (const row of rows) {
        const article = document.createElement('article');
        article.className = 'merge-entry';
        const top = document.createElement('div');
        top.className = 'merge-entry__top';
        const title = document.createElement('strong');
        title.textContent = row.title;
        const status = document.createElement('span');
        status.className = 'merge-entry-status';
        status.dataset.status = row.status;
        status.textContent = row.status === 'import' ? t('importedStatus')
            : row.status === 'duplicate' ? t('importMergeStatusDuplicate')
                : row.status === 'rename' ? t('renamedStatus')
                    : t('importMergeStatusInfo');
        top.append(title, status);
        const detail = document.createElement('p');
        detail.textContent = row.detail;
        article.append(top, detail);
        entries.appendChild(article);
    }

    detailSection.append(detailHeading, entries);
    body.appendChild(detailSection);

    return {
        body,
        kind: warningMessages.length > 0 || (result.folderCreateFailures ?? 0) > 0 ? 'warning' : 'info',
    };
}
