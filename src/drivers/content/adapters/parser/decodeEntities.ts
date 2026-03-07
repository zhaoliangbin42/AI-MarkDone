const ENTITIES: Readonly<Record<string, string>> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
};

export function decodeEntities(text: string): string {
    return text.replace(/&[^;]+;/g, (entity) => ENTITIES[entity] || entity);
}
