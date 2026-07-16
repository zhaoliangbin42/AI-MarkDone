import type { UiStyleSource } from './uiStyleInventory';

export type UiStyleValueKind =
    | 'color'
    | 'spacing'
    | 'radius'
    | 'shadow'
    | 'z-index'
    | 'motion-duration'
    | 'motion-easing'
    | 'important';

export type AuditedUiStyleDeclaration = {
    relativePath: string;
    property: string;
    value: string;
    line: number;
};

export type UiStyleValueViolation = AuditedUiStyleDeclaration & {
    kind: UiStyleValueKind;
    occurrence: number;
    signature: string;
};

export type UiStyleValueAudit = {
    auditedDeclarations: AuditedUiStyleDeclaration[];
    scannedFiles: string[];
    violations: UiStyleValueViolation[];
};

const TOKEN_IMPLEMENTATION_FILES = new Set([
    'src/style/reference-tokens.ts',
    'src/style/system-tokens.ts',
    'src/style/public-tokens.ts',
    'src/style/tokens.ts',
]);

const SPACING_PROPERTY = /^(?:padding|margin)(?:-(?:top|right|bottom|left|block|block-start|block-end|inline|inline-start|inline-end))?$|^(?:gap|row-gap|column-gap)$|^--(?:aimd|_)[\w-]*(?:gap|padding|margin)(?:-[\w-]+)?$/;
const RADIUS_PROPERTY = /^(?:border-radius|border-(?:top|right|bottom|left)-(?:left|right)-radius|border-(?:start|end)-(?:start|end)-radius)$|^--(?:aimd|_)[\w-]*radius(?:-[\w-]+)?$/;
const SHADOW_PROPERTY = /^(?:box-shadow|text-shadow)$|^--(?:aimd|_)[\w-]*shadow(?:-[\w-]+)?$/;
const Z_INDEX_PROPERTY = /^z-index$|^--(?:aimd|_)[\w-]*(?:z|z-index)$/;
const MOTION_PROPERTY = /^(?:transition|animation)(?:-[a-z-]+)?$|^--(?:aimd|_)[\w-]*(?:duration|ease|easing)$/;
const RAW_LENGTH = /(?:^|[\s,(])(-?(?:\d+\.?\d*|\.\d+))(px|r?em|vh|vw|vmin|vmax|ch|ex|%)\b/gi;
const RAW_DURATION = /(?:^|[\s,(])((?:\d+\.?\d*|\.\d+))(ms|s)\b/gi;
const RAW_EASING = /\b(?:ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)\b|cubic-bezier\s*\(|steps\s*\(/i;
const RAW_COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\s*\(/i;
const RAW_NAMED_COLOR = /\b(?:black|white|red|green|blue|gray|grey|orange|yellow|purple|pink|magenta|cyan|rebeccapurple)\b/i;
const DECLARATION = /(^|[;{]\s*)(--_[a-z0-9][\w-]*|--[a-z][\w-]*|[a-z][\w-]*)\s*:\s*([^;{}]+)(?=;|})/gim;
const STYLE_PROPERTY_ASSIGNMENT = /\.style(?:\.([a-z][\w-]*)|\[['"`]([a-z][\w-]*)['"`]\])\s*=\s*(['"`])([^'"`]+)\3/gim;
const STYLE_SET_PROPERTY = /\.style\.setProperty\(\s*['"`]([a-z][\w-]*)['"`]\s*,\s*(['"`])([^'"`]+)\2/gim;

function normalizeValue(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
}

function normalizeProperty(property: string): string {
    return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).toLowerCase();
}

function lineAt(source: string, index: number): number {
    return source.slice(0, index).split('\n').length;
}

function containsNonZeroRawLength(value: string): boolean {
    for (const match of value.matchAll(new RegExp(RAW_LENGTH.source, RAW_LENGTH.flags))) {
        if (Number(match[1]) !== 0) return true;
    }
    return false;
}

function containsNonZeroRawDuration(value: string): boolean {
    const withoutTokenReferences = value.replace(/--(?:aimd|_)[\w-]+/g, '');
    for (const match of withoutTokenReferences.matchAll(new RegExp(RAW_DURATION.source, RAW_DURATION.flags))) {
        if (Number(match[1]) !== 0) return true;
    }
    return false;
}

function containsRawEasing(value: string): boolean {
    return RAW_EASING.test(value.replace(/--(?:aimd|_)[\w-]+/g, ''));
}

function containsRawColor(value: string): boolean {
    const withoutAllowedKeywords = value
        .replace(/\b(?:transparent|currentcolor)\b/gi, '')
        .replace(/--(?:aimd|_)[\w-]+/g, '');
    return RAW_COLOR.test(withoutAllowedKeywords) || RAW_NAMED_COLOR.test(withoutAllowedKeywords);
}

function isRawShadow(value: string): boolean {
    const normalized = normalizeValue(value).toLowerCase();
    if (['none', 'inherit', 'initial', 'unset', 'revert'].includes(normalized)) return false;
    return !/^(?:var\(--(?:aimd|_)[^)]+\))(?:\s*,\s*var\(--(?:aimd|_)[^)]+\))*$/.test(normalized);
}

function isRawZIndex(value: string): boolean {
    const normalized = normalizeValue(value).toLowerCase();
    if (['auto', 'inherit', 'initial', 'unset', 'revert'].includes(normalized)) return false;
    return !/var\(--(?:aimd|_)[^)]+\)/.test(normalized);
}

function findPrintRanges(source: string): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];
    for (const match of source.matchAll(/@media\s+print\b/gi)) {
        if (match.index === undefined) continue;
        const openingBrace = source.indexOf('{', match.index + match[0].length);
        if (openingBrace < 0) continue;
        let depth = 0;
        for (let index = openingBrace; index < source.length; index += 1) {
            if (source[index] === '{') depth += 1;
            if (source[index] !== '}') continue;
            depth -= 1;
            if (depth !== 0) continue;
            ranges.push({ start: match.index, end: index });
            break;
        }
    }
    return ranges;
}

function isInsidePrintRange(index: number, ranges: readonly { start: number; end: number }[]): boolean {
    return ranges.some(({ start, end }) => index >= start && index <= end);
}

type RawDeclaration = AuditedUiStyleDeclaration & { index: number };

function collectDeclarations(source: UiStyleSource): RawDeclaration[] {
    const declarations: RawDeclaration[] = [];
    for (const match of source.source.matchAll(new RegExp(DECLARATION.source, DECLARATION.flags))) {
        if (match.index === undefined || !match[2] || !match[3]) continue;
        if (/[<>]/.test(match[3])) continue;
        const propertyIndex = match.index + (match[1]?.length ?? 0);
        declarations.push({
            relativePath: source.relativePath,
            property: normalizeProperty(match[2]),
            value: normalizeValue(match[3]),
            line: lineAt(source.source, propertyIndex),
            index: propertyIndex,
        });
    }
    for (const match of source.source.matchAll(new RegExp(STYLE_PROPERTY_ASSIGNMENT.source, STYLE_PROPERTY_ASSIGNMENT.flags))) {
        if (match.index === undefined || !match[4]) continue;
        const property = match[1] ?? match[2];
        if (!property) continue;
        declarations.push({
            relativePath: source.relativePath,
            property: normalizeProperty(property),
            value: normalizeValue(match[4]),
            line: lineAt(source.source, match.index),
            index: match.index,
        });
    }
    for (const match of source.source.matchAll(new RegExp(STYLE_SET_PROPERTY.source, STYLE_SET_PROPERTY.flags))) {
        if (match.index === undefined || !match[1] || !match[3]) continue;
        declarations.push({
            relativePath: source.relativePath,
            property: normalizeProperty(match[1]),
            value: normalizeValue(match[3]),
            line: lineAt(source.source, match.index),
            index: match.index,
        });
    }
    return declarations.sort((left, right) => left.index - right.index);
}

function classifyDeclaration(declaration: RawDeclaration, printRanges: readonly { start: number; end: number }[]): UiStyleValueKind[] {
    const { property, value, index } = declaration;
    const kinds: UiStyleValueKind[] = [];
    if (containsRawColor(value)) kinds.push('color');
    if (SPACING_PROPERTY.test(property) && containsNonZeroRawLength(value)) kinds.push('spacing');
    if (RADIUS_PROPERTY.test(property) && containsNonZeroRawLength(value)) kinds.push('radius');
    if (SHADOW_PROPERTY.test(property) && isRawShadow(value)) kinds.push('shadow');
    if (Z_INDEX_PROPERTY.test(property) && isRawZIndex(value)) kinds.push('z-index');
    if (MOTION_PROPERTY.test(property) && containsNonZeroRawDuration(value)) kinds.push('motion-duration');
    if (MOTION_PROPERTY.test(property) && containsRawEasing(value)) kinds.push('motion-easing');
    if (value.includes('!important') && !isInsidePrintRange(index, printRanges)) kinds.push('important');
    return kinds;
}

function signatureFor(violation: Omit<UiStyleValueViolation, 'signature'>): string {
    return [
        violation.relativePath,
        violation.kind,
        violation.property,
        JSON.stringify(violation.value),
        `#${violation.occurrence}`,
    ].join('::');
}

/** Audits every auto-discovered shipped style source while leaving raw value ownership to the token implementation. */
export function auditUiStyleValues(sources: readonly UiStyleSource[]): UiStyleValueAudit {
    const scannedFiles: string[] = [];
    const auditedDeclarations: AuditedUiStyleDeclaration[] = [];
    const candidates: Array<Omit<UiStyleValueViolation, 'occurrence' | 'signature'> & { index: number }> = [];

    for (const source of sources) {
        if (TOKEN_IMPLEMENTATION_FILES.has(source.relativePath)) continue;
        scannedFiles.push(source.relativePath);
        const printRanges = findPrintRanges(source.source);
        for (const declaration of collectDeclarations(source)) {
            const { index, ...audited } = declaration;
            auditedDeclarations.push(audited);
            for (const kind of classifyDeclaration(declaration, printRanges)) {
                candidates.push({ ...audited, kind, index });
            }
        }
    }

    const occurrenceByValue = new Map<string, number>();
    const violations = candidates
        .sort((left, right) => left.relativePath.localeCompare(right.relativePath) || left.index - right.index || left.kind.localeCompare(right.kind))
        .map(({ index: _index, ...candidate }) => {
            const occurrenceKey = [candidate.relativePath, candidate.kind, candidate.property, candidate.value].join('\u0000');
            const occurrence = (occurrenceByValue.get(occurrenceKey) ?? 0) + 1;
            occurrenceByValue.set(occurrenceKey, occurrence);
            const violation = { ...candidate, occurrence };
            return { ...violation, signature: signatureFor(violation) };
        });

    return {
        auditedDeclarations,
        scannedFiles: scannedFiles.sort(),
        violations,
    };
}
