import fs from 'node:fs';
import path from 'node:path';

export type UiStyleSource = {
    relativePath: string;
    source: string;
};

const SOURCE_EXTENSIONS = new Set(['.css', '.html', '.js', '.ts', '.tsx']);
const STYLE_SIGNAL = /--aimd-|<style\b|\.style\.|\.style\[|cssText|adoptedStyleSheets|ensureStyle\s*\(/;
const CSS_DECLARATION_SIGNAL = /(^|[;{]\s*)(?:color|background(?:-color)?|border(?:-radius)?|padding(?:-[a-z-]+)?|margin(?:-[a-z-]+)?|gap|row-gap|column-gap|box-shadow|text-shadow|z-index|transition(?:-[a-z-]+)?|animation(?:-[a-z-]+)?)\s*:/im;

function walk(directory: string): string[] {
    return fs.readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) => {
            const absolutePath = path.join(directory, entry.name);
            return entry.isDirectory() ? walk(absolutePath) : [absolutePath];
        });
}

/** Discovers shipped style-bearing sources instead of maintaining a file allowlist. */
export function collectUiStyleSources(repoRoot: string): UiStyleSource[] {
    const sourceRoot = path.join(repoRoot, 'src');
    return walk(sourceRoot)
        .filter((absolutePath) => SOURCE_EXTENSIONS.has(path.extname(absolutePath)))
        .map((absolutePath) => ({
            relativePath: path.relative(repoRoot, absolutePath).split(path.sep).join('/'),
            source: fs.readFileSync(absolutePath, 'utf8'),
        }))
        .filter(({ relativePath, source }) => isUiStyleSource(relativePath, source))
        .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function isUiStyleSource(relativePath: string, source: string): boolean {
    return path.extname(relativePath) === '.css' || STYLE_SIGNAL.test(source) || CSS_DECLARATION_SIGNAL.test(source);
}

export function isTokenLayerSource(relativePath: string): boolean {
    return relativePath === 'src/style/reference-tokens.ts'
        || relativePath === 'src/style/system-tokens.ts'
        || relativePath === 'src/style/public-tokens.ts';
}
