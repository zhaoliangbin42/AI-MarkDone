import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function listTypeScriptFiles(directory: string): string[] {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const absolute = path.join(directory, entry.name);
        return entry.isDirectory()
            ? listTypeScriptFiles(absolute)
            : (entry.isFile() && entry.name.endsWith('.ts') ? [absolute] : []);
    });
}

describe('runtime RPC architecture boundary', () => {
    it('keeps raw RPC transport behind the shared client result projection', () => {
        const sourceRoot = path.resolve(process.cwd(), 'src');
        const rawRpcImporters = listTypeScriptFiles(sourceRoot)
            .filter((file) => /import\s*\{[^}]*\bsendExtRequest\b[^}]*\}\s*from\s*['"][^'"]*rpc['"]/.test(
                fs.readFileSync(file, 'utf8'),
            ))
            .map((file) => path.relative(process.cwd(), file));

        expect(rawRpcImporters).toEqual([
            'src/drivers/shared/clients/clientResult.ts',
        ]);
    });
});
