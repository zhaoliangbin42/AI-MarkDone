import type { Plugin } from 'vite';

function isUnicodeNoncharacter(codePoint: number): boolean {
    return (codePoint >= 0xFDD0 && codePoint <= 0xFDEF)
        || (codePoint & 0xFFFF) === 0xFFFE
        || (codePoint & 0xFFFF) === 0xFFFF;
}

function unicodeEscape(codeUnit: number): string {
    return `\\u${codeUnit.toString(16).toUpperCase().padStart(4, '0')}`;
}

function escapeCodePoint(codePoint: number): string {
    if (codePoint <= 0xFFFF) return unicodeEscape(codePoint);
    const offset = codePoint - 0x10000;
    return unicodeEscape(0xD800 + (offset >> 10))
        + unicodeEscape(0xDC00 + (offset & 0x3FF));
}

export function escapeJavaScriptUnicodeNoncharacters(source: string): string {
    let escaped = '';
    for (const character of source) {
        const codePoint = character.codePointAt(0)!;
        escaped += isUnicodeNoncharacter(codePoint)
            ? escapeCodePoint(codePoint)
            : character;
    }
    return escaped;
}

export function escapeUtf8JavaScriptNoncharacters(): Plugin {
    return {
        name: 'aimd-escape-utf8-javascript-noncharacters',
        generateBundle(_options, bundle) {
            for (const output of Object.values(bundle)) {
                if (output.type !== 'chunk') continue;
                output.code = escapeJavaScriptUnicodeNoncharacters(output.code);
            }
        },
    };
}
