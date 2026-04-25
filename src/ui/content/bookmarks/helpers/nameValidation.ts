import { PathUtils, PathValidationError } from '../../../../core/bookmarks/path';
import { BOOKMARK_TITLE_FORBIDDEN_CHARACTERS, getBookmarkTitleForbiddenCharacters } from '../../../../core/bookmarks/title';
import type { BookmarkTitleValidationError } from '../../../../core/bookmarks/title';
import type { FolderNameValidationError } from '../../../../core/bookmarks/path';
import type { ProtocolErrorCode } from '../../../../contracts/protocol';
import { t } from '../../components/i18n';

const CONTROL_CHAR_PATTERN = /[\x00-\x1F\x7F]/;

export function titleValidationMessage(reason: BookmarkTitleValidationError, rawTitle = ''): string {
    switch (reason) {
        case 'empty':
            return t('titleRequired');
        case 'tooLong':
            return t('titleTooLong');
        case 'forbiddenChars': {
            const chars = getBookmarkTitleForbiddenCharacters(rawTitle);
            const display = chars.length ? chars.join(' ') : BOOKMARK_TITLE_FORBIDDEN_CHARACTERS.join(' ');
            return t('titleForbiddenCharsDetailed', [display]);
        }
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

export function validateFolderPathInput(rawPath: string): FolderSegmentValidation {
    let normalized: string;
    try {
        normalized = PathUtils.normalize(rawPath);
        PathUtils.validatePath(normalized);
    } catch (error) {
        if (error instanceof PathValidationError && error.message.includes('traversal')) {
            return { ok: false, message: t('folderNameTraversal') };
        }
        if (!String(rawPath ?? '').trim()) {
            return { ok: false, message: t('folderNameEmpty') };
        }
        normalized = normalizePathForSegmentMessages(rawPath);
    }

    if (!normalized) return { ok: false, message: t('folderNameEmpty') };

    const segments = normalized.split(PathUtils.SEPARATOR);
    for (const segment of segments) {
        const validation = validateFolderSegmentName(segment);
        if (validation.ok) continue;
        return {
            ok: false,
            message: t('folderPathSegmentInvalid', [formatNameForMessage(segment), validation.message]),
        };
    }

    if (PathUtils.getDepth(normalized) > PathUtils.MAX_DEPTH) {
        return { ok: false, message: t('maxDepthMessage') };
    }

    return { ok: true, normalized, note: '' };
}

export function folderNameLocalErrorMessage(errors: FolderNameValidationError[], rawName: string): string {
    if (errors.includes('empty')) return t('folderNameEmpty');
    if (errors.includes('tooLong')) return t('folderNameTooLong', [String(PathUtils.MAX_NAME_LENGTH)]);
    if (errors.includes('traversal')) return t('folderNameTraversal');
    if (errors.includes('forbiddenChars') && rawName.includes('/')) return t('folderNameNoSlash');
    if (errors.includes('forbiddenChars') && CONTROL_CHAR_PATTERN.test(rawName)) return t('folderNameControlChars');
    if (errors.includes('forbiddenChars')) return t('folderNameInvalidChars');
    return t('enterFolderName');
}

export function folderCreateBackendErrorMessage(params: { errorCode: ProtocolErrorCode; message: string; rawName: string }): string {
    if (params.errorCode === 'CONFLICT') return t('folderNameExists');
    if (params.errorCode === 'INVALID_PATH') {
        const local = validateFolderSegmentName(params.rawName);
        return local.ok ? t('enterFolderName') : local.message;
    }
    if (params.errorCode === 'NOT_FOUND') return t('enterFolderName');
    if (params.errorCode === 'QUOTA_EXCEEDED') return t('storageQuotaExceeded');
    return params.message || t('failedToCreateFolderMessage', [params.rawName]);
}

function normalizePathForSegmentMessages(rawPath: string): string {
    return String(rawPath ?? '')
        .replace(/\/+/g, PathUtils.SEPARATOR)
        .replace(new RegExp(`^${PathUtils.SEPARATOR}+|${PathUtils.SEPARATOR}+$`, 'g'), '');
}

function formatNameForMessage(name: string): string {
    return Array.from(name).map((char) => {
        const code = char.charCodeAt(0);
        if (code > 0x1F && code !== 0x7F) return char;
        return `\\u${code.toString(16).toUpperCase().padStart(4, '0')}`;
    }).join('');
}
