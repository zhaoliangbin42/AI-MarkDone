import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type PackageJson = {
    version: string;
};

function readPackageVersion(): string {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8')) as PackageJson;
    return pkg.version;
}

export const extensionMeta = {
    productSlug: 'ai-markdone',
    displayNameMessageKey: 'extName',
    descriptionMessageKey: 'extDescription',
    defaultLocale: 'en',
    version: readPackageVersion(),
} as const;
