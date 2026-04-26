import { existsSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
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

async function readVersion(): Promise<string> {
    const packageJson = JSON.parse(
        await readFile(resolve(process.cwd(), 'package.json'), 'utf-8'),
    ) as PackageJson;
    return packageJson.version;
}

function resolveAppPath(): string {
    const appPath = process.env.SAFARI_APP_PATH?.trim();
    if (!appPath) {
        console.error([
            'SAFARI_APP_PATH is required.',
            'Export the signed Safari wrapper app from Xcode first, then run:',
            'SAFARI_APP_PATH="/path/to/AI-MarkDone.app" npm run package:safari:dmg',
        ].join('\n'));
        process.exit(1);
    }

    const resolved = resolve(process.cwd(), appPath);
    if (!existsSync(resolved) || !resolved.endsWith('.app')) {
        console.error(`SAFARI_APP_PATH must point to an existing .app bundle: ${resolved}`);
        process.exit(1);
    }
    return resolved;
}

function notarizeIfRequested(dmgPath: string): void {
    if (process.env.SAFARI_NOTARIZE !== '1') {
        console.log('Safari DMG notarization skipped. Set SAFARI_NOTARIZE=1 to submit and staple.');
        return;
    }

    const keychainProfile = process.env.SAFARI_NOTARY_PROFILE?.trim();
    if (keychainProfile) {
        run('xcrun', [
            'notarytool',
            'submit',
            dmgPath,
            '--keychain-profile',
            keychainProfile,
            '--wait',
        ]);
        run('xcrun', ['stapler', 'staple', dmgPath]);
        return;
    }

    const appleId = process.env.APPLE_ID?.trim();
    const teamId = process.env.APPLE_TEAM_ID?.trim();
    const password = process.env.APPLE_APP_SPECIFIC_PASSWORD?.trim();
    if (!appleId || !teamId || !password) {
        console.error([
            'Safari notarization requested, but credentials are missing.',
            'Provide SAFARI_NOTARY_PROFILE, or APPLE_ID + APPLE_TEAM_ID + APPLE_APP_SPECIFIC_PASSWORD.',
        ].join('\n'));
        process.exit(1);
    }

    run('xcrun', [
        'notarytool',
        'submit',
        dmgPath,
        '--apple-id',
        appleId,
        '--team-id',
        teamId,
        '--password',
        password,
        '--wait',
    ]);
    run('xcrun', ['stapler', 'staple', dmgPath]);
}

async function main(): Promise<void> {
    const version = await readVersion();
    const productName = extensionTargets.safari.bundle.productName;
    const appPath = resolveAppPath();
    const outputPath = resolve(
        process.cwd(),
        process.env.SAFARI_DMG_OUTPUT?.trim() || `release-artifacts/safari/${productName}-${version}-free.dmg`,
    );

    mkdirSync(dirname(outputPath), { recursive: true });
    run('hdiutil', [
        'create',
        '-volname',
        productName,
        '-srcfolder',
        appPath,
        '-ov',
        '-format',
        'UDZO',
        outputPath,
    ]);

    notarizeIfRequested(outputPath);
    console.log(`Safari DMG ready: ${outputPath} (source app: ${basename(appPath)})`);
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
