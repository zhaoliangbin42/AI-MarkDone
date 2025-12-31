/**
 * HTML Entity Decoder
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Rule 5: Entity Decoding MUST Use Exact Map
 * @see Syntax-Mapping-Spec.md - HTML Entities & Special Characters
 */

/**
 * MANDATORY entity map - DO NOT modify without documentation
 * 
 * These entities are verified against mock files:
 * - &amp; is CRITICAL for katex-error (DeepResearch L1202)
 */
export const ENTITIES: Readonly<Record<string, string>> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
} as const;

/**
 * Decode HTML entities in text
 * 
 * @param text - Text containing HTML entities
 * @returns Text with entities decoded
 * 
 * @example
 * decodeEntities('&amp;&lt;') // returns '&<'
 * decodeEntities('unknown &unknown;') // returns 'unknown &unknown;' (preserved)
 */
export function decodeEntities(text: string): string {
    return text.replace(/&[^;]+;/g, (entity) => {
        return ENTITIES[entity] || entity; // Unknown entities preserved
    });
}

/**
 * Encode special characters for HTML
 * (Inverse operation, used for testing)
 */
export function encodeEntities(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
