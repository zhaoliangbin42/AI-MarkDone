/**
 * HTML Sanitizer interface
 */
export interface ISanitizer {
    sanitize(html: string): string;
}
