import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

type Target = 'chrome' | 'firefox' | 'safari';

type BundleBudget = {
    file: string;
    maxRawBytes: number;
    maxGzipBytes: number;
};

const BUDGETS: BundleBudget[] = [
    { file: 'content.js', maxRawBytes: 1_900_000, maxGzipBytes: 500_000 },
    { file: 'reader.js', maxRawBytes: 1_200_000, maxGzipBytes: 350_000 },
    { file: 'background.js', maxRawBytes: 150_000, maxGzipBytes: 40_000 },
    { file: 'formula-renderer.js', maxRawBytes: 1_700_000, maxGzipBytes: 600_000 },
];

function parseTargets(args: string[]): Target[] {
    if (args.length === 0) {
        throw new Error('Usage: verify-extension-bundle-size.ts <chrome|firefox|safari> [...]');
    }
    return args.map((arg) => {
        if (arg === 'chrome' || arg === 'firefox' || arg === 'safari') return arg;
        throw new Error(`Unknown extension target: ${arg}`);
    });
}

function formatBytes(bytes: number): string {
    return `${(bytes / 1_000).toFixed(2)} kB`;
}

async function verifyTarget(target: Target): Promise<string[]> {
    const failures: string[] = [];
    const rows: string[] = [];

    for (const budget of BUDGETS) {
        const path = resolve(`dist-${target}`, budget.file);
        const content = await readFile(path);
        const rawBytes = content.byteLength;
        const gzipBytes = gzipSync(content).byteLength;
        const rawOk = rawBytes <= budget.maxRawBytes;
        const gzipOk = gzipBytes <= budget.maxGzipBytes;

        rows.push(
            `${target}/${budget.file}: raw ${formatBytes(rawBytes)} / ${formatBytes(budget.maxRawBytes)}, gzip ${formatBytes(gzipBytes)} / ${formatBytes(budget.maxGzipBytes)}`,
        );
        if (!rawOk || !gzipOk) {
            failures.push(
                `${target}/${budget.file} exceeded its bundle budget (raw ${rawBytes}/${budget.maxRawBytes}, gzip ${gzipBytes}/${budget.maxGzipBytes})`,
            );
        }
    }

    for (const row of rows) console.log(row);
    return failures;
}

async function main(): Promise<void> {
    const targets = parseTargets(process.argv.slice(2));
    const failures = (await Promise.all(targets.map(verifyTarget))).flat();
    if (failures.length > 0) {
        throw new Error(`Bundle size verification failed:\n${failures.join('\n')}`);
    }
    console.log(`Bundle size verification passed for ${targets.join(', ')}.`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
