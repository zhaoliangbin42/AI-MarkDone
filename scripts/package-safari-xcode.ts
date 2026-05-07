import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { extensionTargets } from '../config/extension/targets';

type PackageJson = {
    version: string;
};

function run(command: string, args: string[]): void {
    const result = spawnSync(command, args, {
        stdio: 'inherit',
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

async function readPackageVersion(): Promise<string> {
    const packageJson = JSON.parse(
        await readFile(resolve(process.cwd(), 'package.json'), 'utf-8'),
    ) as PackageJson;
    return packageJson.version;
}

function buildNumberFromVersion(version: string): string {
    const parts = version.split('.').map((part) => Number.parseInt(part, 10));
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
        throw new Error(`Unsupported package version for Safari build number: ${version}`);
    }
    const [major, minor, patch] = parts;
    return String(major * 100 + minor * 10 + patch);
}

async function patchXcodeProject(version: string, buildNumber: string): Promise<void> {
    const projectPath = resolve(
        process.cwd(),
        'safari-build/AI-MarkDone/AI-MarkDone.xcodeproj/project.pbxproj',
    );
    const developmentTeam = process.env.SAFARI_DEVELOPMENT_TEAM?.trim();
    const source = await readFile(projectPath, 'utf-8');
    const next = source
        .replaceAll(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
        .replaceAll(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${buildNumber};`)
        .replaceAll(
            /CODE_SIGN_STYLE = Automatic;\n/g,
            developmentTeam
                ? `CODE_SIGN_STYLE = Automatic;\n\t\t\t\tDEVELOPMENT_TEAM = ${developmentTeam};\n`
                : 'CODE_SIGN_STYLE = Automatic;\n',
        );
    await writeFile(projectPath, next);
}

function setMacAppCategory(): void {
    const plistPath = 'safari-build/AI-MarkDone/macOS (App)/Info.plist';
    const category = 'public.app-category.productivity';
    const setResult = spawnSync('/usr/libexec/PlistBuddy', [
        '-c',
        `Set :LSApplicationCategoryType ${category}`,
        plistPath,
    ]);
    if (setResult.status === 0) {
        return;
    }
    run('/usr/libexec/PlistBuddy', [
        '-c',
        `Add :LSApplicationCategoryType string ${category}`,
        plistPath,
    ]);
}

async function main(): Promise<void> {
    const version = await readPackageVersion();
    const buildNumber = buildNumberFromVersion(version);
    const safariBundle = extensionTargets.safari.bundle;

    run('npm', ['run', 'build:safari:webext']);
    run('xcrun', [
        'safari-web-extension-converter',
        'dist-safari',
        '--project-location',
        'safari-build',
        '--bundle-identifier',
        safariBundle.bundleIdentifier,
        '--app-name',
        safariBundle.productName,
        '--copy-resources',
        '--no-open',
        '--no-prompt',
        '--force',
    ]);
    await patchXcodeProject(version, buildNumber);
    setMacAppCategory();
    console.log(
        `Safari Xcode wrapper ready: ${safariBundle.bundleIdentifier}, version ${version} (${buildNumber})`,
    );
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
