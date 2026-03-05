import { PathUtils } from '../../../../core/bookmarks/path';
import type { BookmarkTitleValidationError } from '../../../../core/bookmarks/title';
import type { FolderNameValidationError } from '../../../../core/bookmarks/path';
import type { ProtocolErrorCode } from '../../../../contracts/protocol';
import { t } from '../../components/i18n';

export function titleValidationMessage(reason: BookmarkTitleValidationError): string {
    switch (reason) {
        case 'empty':
            return t('titleRequired');
        case 'tooLong':
            return t('titleTooLong');
        case 'forbiddenChars':
            return t('titleForbiddenChars');
        default:
            return t('titleRequired');
    }
}

export type FolderSegmentValidation = {
    ok: true;
    normalized: string;
    note: string;
} | {
    ok: false;
    message: string;
};

export function validateFolderSegmentName(rawName: string): FolderSegmentValidation {
    const validation = PathUtils.getFolderNameValidation(rawName);
    if (!validation.isValid) {
        return { ok: false, message: folderNameLocalErrorMessage(validation.errors, rawName) };
    }
    const note = validation.normalization.collapsedSpaces ? t('spacesCollapsed') : '';
    return { ok: true, normalized: validation.normalized, note };
}

export function folderNameLocalErrorMessage(errors: FolderNameValidationError[], rawName: string): string {
    if (errors.includes('empty')) return t('folderNameEmpty');
    if (errors.includes('tooLong')) return t('folderNameTooLong', [String(PathUtils.MAX_NAME_LENGTH)]);
    if (errors.includes('traversal')) return t('folderNameTraversal');
    if (errors.includes('forbiddenChars') && rawName.includes('/')) return t('folderNameNoSlash');
    if (errors.includes('forbiddenChars')) return t('folderNameInvalidChars');
    return t('enterFolderName');
}

export function folderCreateBackendErrorMessage(params: { errorCode: ProtocolErrorCode; message: string; rawName: string }): string {
    if (params.errorCode === 'CONFLICT') return t('folderNameExists');
    if (params.errorCode === 'INVALID_PATH') {
        if (params.rawName.includes('/')) return t('folderNameNoSlash');
        return t('enterFolderName');
    }
    if (params.errorCode === 'NOT_FOUND') return t('enterFolderName');
    if (params.errorCode === 'QUOTA_EXCEEDED') return t('storageQuotaExceeded');
    return params.message || t('failedToCreateFolderMessage', [params.rawName]);
}

