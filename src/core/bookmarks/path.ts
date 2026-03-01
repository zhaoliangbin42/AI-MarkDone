export class PathValidationError extends Error {
    constructor(message: string, public readonly path: string) {
        super(message);
        this.name = 'PathValidationError';
    }
}

export type FolderNameNormalization = {
    value: string;
    trimmed: boolean;
    collapsedSpaces: boolean;
    removedSlash: boolean;
};

export type FolderNameValidationError =
    | 'empty'
    | 'tooLong'
    | 'forbiddenChars'
    | 'traversal';

export type FolderNameValidationResult = {
    normalized: string;
    normalization: FolderNameNormalization;
    errors: FolderNameValidationError[];
    isValid: boolean;
};

export class PathUtils {
    static readonly SEPARATOR = '/';
    static readonly MAX_DEPTH = 4;
    static readonly MAX_NAME_LENGTH = 100;

    private static readonly FORBIDDEN_CHARS = /[\/\x00-\x1F\x7F]/;
    private static readonly TRAVERSAL_PATTERN = /(^|\/)\.\.(\/|$)/;

    static normalize(path: string): string {
        if (!path || typeof path !== 'string') {
            throw new PathValidationError('Path must be a non-empty string', String(path));
        }

        if (this.TRAVERSAL_PATTERN.test(path)) {
            throw new PathValidationError('Path contains directory traversal sequence (..)', path);
        }

        let normalized = path.replace(/\/+/g, this.SEPARATOR);

        if (normalized.length > 1 && normalized.endsWith(this.SEPARATOR)) {
            normalized = normalized.slice(0, -1);
        }

        if (normalized.startsWith(this.SEPARATOR)) {
            normalized = normalized.slice(1);
        }

        return normalized;
    }

    static getParentPath(path: string): string | null {
        if (!path) return null;
        const normalized = this.normalize(path);
        const lastSep = normalized.lastIndexOf(this.SEPARATOR);
        if (lastSep === -1) return null;
        return normalized.substring(0, lastSep);
    }

    static getFolderName(path: string): string {
        if (!path) return '';
        const normalized = this.normalize(path);
        const lastSep = normalized.lastIndexOf(this.SEPARATOR);
        return lastSep === -1 ? normalized : normalized.substring(lastSep + 1);
    }

    static getDepth(path: string): number {
        if (!path) return 0;
        const normalized = this.normalize(path);
        if (!normalized) return 0;
        return normalized.split(this.SEPARATOR).length;
    }

    static isDescendantOf(childPath: string, parentPath: string): boolean {
        if (!childPath || !parentPath) return false;
        const normalizedChild = this.normalize(childPath);
        const normalizedParent = this.normalize(parentPath);
        return normalizedChild.startsWith(normalizedParent + this.SEPARATOR);
    }

    static getAncestors(path: string): string[] {
        if (!path) return [];
        const normalized = this.normalize(path);
        const ancestors: string[] = [];
        let current = this.getParentPath(normalized);
        while (current !== null) {
            ancestors.unshift(current);
            current = this.getParentPath(current);
        }
        return ancestors;
    }

    static updatePathPrefix(oldPrefix: string, newPrefix: string, path: string): string {
        if (!path) return path;

        const normalizedPath = this.normalize(path);
        const normalizedOld = this.normalize(oldPrefix);
        const normalizedNew = this.normalize(newPrefix);

        if (normalizedPath === normalizedOld) return normalizedNew;

        if (normalizedPath.startsWith(normalizedOld + this.SEPARATOR)) {
            return normalizedNew + normalizedPath.substring(normalizedOld.length);
        }

        return normalizedPath;
    }

    private static normalizeFolderName(name: string): FolderNameNormalization {
        let value = String(name ?? '');
        const trimmedValue = value.trim();
        const trimmed = trimmedValue !== value;
        value = trimmedValue;

        const collapsed = value.replace(/\s+/g, ' ');
        const collapsedSpaces = collapsed !== value;
        value = collapsed;

        const removedSlash = value.includes(this.SEPARATOR);
        value = value.replace(/\//g, '');

        return { value, trimmed, collapsedSpaces, removedSlash };
    }

    private static getFolderNameErrors(value: string): FolderNameValidationError[] {
        const errors: FolderNameValidationError[] = [];

        if (!value || value.length === 0) errors.push('empty');
        if (value.length > this.MAX_NAME_LENGTH) errors.push('tooLong');
        if (this.FORBIDDEN_CHARS.test(value)) errors.push('forbiddenChars');
        if (this.TRAVERSAL_PATTERN.test(value)) errors.push('traversal');

        return errors;
    }

    static getFolderNameValidation(name: string): FolderNameValidationResult {
        const normalization = this.normalizeFolderName(name);
        const normalized = normalization.value;
        const errors = this.getFolderNameErrors(normalized);
        return { normalized, normalization, errors, isValid: errors.length === 0 };
    }

    static isValidFolderName(name: string): boolean {
        if (!name || typeof name !== 'string') return false;
        const trimmed = name.trim();
        return this.getFolderNameErrors(trimmed).length === 0;
    }

    static validatePath(path: string): void {
        if (!path || typeof path !== 'string') {
            throw new PathValidationError('Path must be a non-empty string', String(path));
        }

        const normalized = this.normalize(path);
        if (!normalized) {
            throw new PathValidationError('Path must not be empty after normalization', path);
        }

        const depth = this.getDepth(normalized);
        if (depth > this.MAX_DEPTH) {
            throw new PathValidationError(`Path depth ${depth} exceeds maximum ${this.MAX_DEPTH}`, path);
        }

        const segments = normalized.split(this.SEPARATOR);
        for (let i = 0; i < segments.length; i += 1) {
            const segment = segments[i];
            if (!this.isValidFolderName(segment)) {
                throw new PathValidationError(`Invalid folder name at depth ${i + 1}: "${segment}"`, path);
            }
        }
    }

    static hasNameConflict(name: string, existingNames: string[]): boolean {
        const normalized = this.normalizeFolderName(name).value;
        if (!normalized) return false;
        const candidate = normalized.toLocaleLowerCase();
        return existingNames.some((existing) => {
            const existingNormalized = this.normalizeFolderName(existing).value;
            return existingNormalized.toLocaleLowerCase() === candidate;
        });
    }

    static generateAutoRenameName(name: string, existingNames: string[]): string {
        const validation = this.getFolderNameValidation(name);
        if (!validation.isValid) {
            throw new PathValidationError('Invalid folder name for auto rename', name);
        }

        const normalized = validation.normalized;
        const existingSet = new Set(
            existingNames.map((existing) => this.normalizeFolderName(existing).value.toLocaleLowerCase())
        );

        if (!existingSet.has(normalized.toLocaleLowerCase())) {
            return normalized;
        }

        for (let i = 1; i < 10000; i += 1) {
            const suffix = `-${i}`;
            const maxBaseLength = this.MAX_NAME_LENGTH - suffix.length;
            const base = normalized.length > maxBaseLength
                ? normalized.slice(0, maxBaseLength).replace(/ +$/g, '')
                : normalized;
            if (!base) break;

            const candidate = `${base}${suffix}`;
            const candidateLower = candidate.toLocaleLowerCase();
            if (!existingSet.has(candidateLower) && this.getFolderNameErrors(candidate).length === 0) {
                return candidate;
            }
        }

        throw new PathValidationError('Unable to generate unique folder name', name);
    }
}

