/**
 * Path manipulation utilities for folder operations
 * 
 * Based on best practices from:
 * - Node.js path module
 * - fs-extra patterns
 * - OWASP path traversal prevention guidelines
 * 
 * Security features:
 * - Path normalization to prevent directory traversal
 * - Strict validation against malicious inputs
 * - Whitelist-based character validation
 * - Maximum depth enforcement
 */

/**
 * Error thrown when path validation fails
 */
export class PathValidationError extends Error {
    constructor(message: string, public readonly path: string) {
        super(message);
        this.name = 'PathValidationError';
    }
}

/**
 * Path manipulation utilities with security-first design
 */
export class PathUtils {
    /** Path separator (forward slash for cross-platform compatibility) */
    static readonly SEPARATOR = '/';

    /** Maximum allowed folder depth */
    static readonly MAX_DEPTH = 2;

    /** Maximum folder name length */
    static readonly MAX_NAME_LENGTH = 50;

    /** Forbidden characters in folder names (includes separator and control chars) */
    private static readonly FORBIDDEN_CHARS = /[/\x00-\x1F\x7F<>:"|?*\\]/;

    /** Pattern to detect directory traversal attempts */
    private static readonly TRAVERSAL_PATTERN = /\.\./;

    /**
     * Normalize path to prevent directory traversal attacks
     * 
     * Security measures:
     * - Removes redundant separators (// -> /)
     * - Removes trailing separators
     * - Validates no directory traversal sequences (..)
     * - Ensures consistent separator usage
     * 
     * @throws {PathValidationError} if path contains traversal sequences
     */
    static normalize(path: string): string {
        if (!path || typeof path !== 'string') {
            throw new PathValidationError('Path must be a non-empty string', path);
        }

        // Check for directory traversal attempts BEFORE normalization
        if (this.TRAVERSAL_PATTERN.test(path)) {
            throw new PathValidationError(
                'Path contains directory traversal sequence (..)',
                path
            );
        }

        // Replace multiple separators with single separator
        let normalized = path.replace(/\/+/g, this.SEPARATOR);

        // Remove trailing separator (except for root)
        if (normalized.length > 1 && normalized.endsWith(this.SEPARATOR)) {
            normalized = normalized.slice(0, -1);
        }

        // Remove leading separator (we don't use absolute paths)
        if (normalized.startsWith(this.SEPARATOR)) {
            normalized = normalized.slice(1);
        }

        return normalized;
    }

    /**
     * Get parent path from full path
     * 
     * Examples:
     * - "Work/AI Research" → "Work"
     * - "Work" → null (root level)
     * - "" → null
     * 
     * @returns Parent path or null if at root level
     */
    static getParentPath(path: string): string | null {
        if (!path) return null;

        const normalized = this.normalize(path);
        const lastSep = normalized.lastIndexOf(this.SEPARATOR);

        if (lastSep === -1) {
            // Root level folder, no parent
            return null;
        }

        return normalized.substring(0, lastSep);
    }

    /**
     * Get folder name from path (last segment)
     * 
     * Examples:
     * - "Work/AI Research" → "AI Research"
     * - "Work" → "Work"
     * - "" → ""
     */
    static getFolderName(path: string): string {
        if (!path) return '';

        const normalized = this.normalize(path);
        const lastSep = normalized.lastIndexOf(this.SEPARATOR);

        return lastSep === -1 ? normalized : normalized.substring(lastSep + 1);
    }

    /**
     * Calculate depth from path
     * 
     * Examples:
     * - "Work" → 1
     * - "Work/AI Research" → 2
     * - "Work/AI Research/ChatGPT" → 3
     * - "" → 0
     */
    static getDepth(path: string): number {
        if (!path) return 0;

        const normalized = this.normalize(path);
        if (!normalized) return 0;

        return normalized.split(this.SEPARATOR).length;
    }

    /**
     * Check if childPath is descendant of parentPath
     * 
     * Examples:
     * - isDescendantOf("Work/AI Research", "Work") → true
     * - isDescendantOf("Work", "Personal") → false
     * - isDescendantOf("Work", "Work") → false (not descendant of itself)
     */
    static isDescendantOf(childPath: string, parentPath: string): boolean {
        if (!childPath || !parentPath) return false;

        const normalizedChild = this.normalize(childPath);
        const normalizedParent = this.normalize(parentPath);

        // Must start with parent path + separator
        return normalizedChild.startsWith(normalizedParent + this.SEPARATOR);
    }

    /**
     * Join path segments safely
     * 
     * Examples:
     * - join("Work", "AI Research") → "Work/AI Research"
     * - join("Work", "", "AI Research") → "Work/AI Research" (empty segments ignored)
     * 
     * @throws {PathValidationError} if any segment is invalid
     */
    static join(...segments: string[]): string {
        // Filter out empty segments
        const validSegments = segments.filter(s => s && s.trim());

        if (validSegments.length === 0) {
            return '';
        }

        // Validate each segment
        for (const segment of validSegments) {
            if (this.TRAVERSAL_PATTERN.test(segment)) {
                throw new PathValidationError(
                    'Path segment contains directory traversal sequence (..)',
                    segment
                );
            }
            if (segment.includes(this.SEPARATOR)) {
                throw new PathValidationError(
                    'Path segment cannot contain separator',
                    segment
                );
            }
        }

        const joined = validSegments.join(this.SEPARATOR);
        return this.normalize(joined);
    }

    /**
     * Update path prefix for rename/move operations
     * 
     * Used for recursive updates when renaming or moving folders.
     * 
     * Examples:
     * - updatePathPrefix("Work", "Projects", "Work/AI Research") 
     *   → "Projects/AI Research"
     * - updatePathPrefix("Work", "Projects", "Work") 
     *   → "Projects"
     * - updatePathPrefix("Work", "Projects", "Personal/Research")
     *   → "Personal/Research" (unchanged, not a match)
     */
    static updatePathPrefix(
        oldPrefix: string,
        newPrefix: string,
        path: string
    ): string {
        if (!path) return path;

        const normalizedPath = this.normalize(path);
        const normalizedOld = this.normalize(oldPrefix);
        const normalizedNew = this.normalize(newPrefix);

        // Exact match
        if (normalizedPath === normalizedOld) {
            return normalizedNew;
        }

        // Descendant match
        if (normalizedPath.startsWith(normalizedOld + this.SEPARATOR)) {
            return normalizedNew + normalizedPath.substring(normalizedOld.length);
        }

        // No match, return unchanged
        return normalizedPath;
    }

    /**
     * Validate folder name against security and business rules
     * 
     * Validation rules:
     * - Non-empty after trimming
     * - No forbidden characters (/, \, :, *, ?, ", <, >, |, control chars)
     * - No directory traversal sequences (..)
     * - Length <= MAX_NAME_LENGTH
     * 
     * @returns true if valid, false otherwise
     */
    static isValidFolderName(name: string): boolean {
        if (!name || typeof name !== 'string') {
            return false;
        }

        const trimmed = name.trim();

        // Empty after trim
        if (trimmed.length === 0) {
            return false;
        }

        // Too long
        if (trimmed.length > this.MAX_NAME_LENGTH) {
            return false;
        }

        // Contains forbidden characters
        if (this.FORBIDDEN_CHARS.test(trimmed)) {
            return false;
        }

        // Contains directory traversal
        if (this.TRAVERSAL_PATTERN.test(trimmed)) {
            return false;
        }

        return true;
    }

    /**
     * Validate complete folder path
     * 
     * Validates:
     * - Path structure is valid
     * - Each segment is a valid folder name
     * - Depth does not exceed MAX_DEPTH
     * - No directory traversal attempts
     * 
     * @throws {PathValidationError} with detailed error message
     */
    static validatePath(path: string): void {
        if (!path || typeof path !== 'string') {
            throw new PathValidationError('Path must be a non-empty string', path);
        }

        // Normalize first to catch traversal attempts
        const normalized = this.normalize(path);

        // Check depth
        const depth = this.getDepth(normalized);
        if (depth > this.MAX_DEPTH) {
            throw new PathValidationError(
                `Path depth ${depth} exceeds maximum ${this.MAX_DEPTH}`,
                path
            );
        }

        // Validate each segment
        const segments = normalized.split(this.SEPARATOR);
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            if (!this.isValidFolderName(segment)) {
                throw new PathValidationError(
                    `Invalid folder name at depth ${i + 1}: "${segment}"`,
                    path
                );
            }
        }
    }

    /**
     * Get all ancestor paths for a given path
     * 
     * Example:
     * - getAncestors("Work/AI Research/ChatGPT") 
     *   → ["Work", "Work/AI Research"]
     * - getAncestors("Work")
     *   → []
     */
    static getAncestors(path: string): string[] {
        if (!path) return [];

        const normalized = this.normalize(path);
        const ancestors: string[] = [];
        let current = this.getParentPath(normalized);

        while (current !== null) {
            ancestors.unshift(current); // Add to beginning
            current = this.getParentPath(current);
        }

        return ancestors;
    }

    /**
     * Check if two paths are equal (after normalization)
     */
    static areEqual(path1: string, path2: string): boolean {
        if (!path1 && !path2) return true;
        if (!path1 || !path2) return false;

        return this.normalize(path1) === this.normalize(path2);
    }

    /**
     * Get level/depth of a path (1-indexed)
     * Same as getDepth but 1-indexed for user-facing display
     * 
     * Examples:
     * - "Work" → Level 1
     * - "Work/AI Research" → Level 2
     */
    static getLevel(path: string): number {
        return this.getDepth(path);
    }
}
