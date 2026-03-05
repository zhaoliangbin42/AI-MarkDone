import { describe, expect, it } from 'vitest';
import type { Folder } from '../../../../../src/core/bookmarks/types';
import { buildFolderPickerVm } from '../../../../../src/services/bookmarks/saveDialog/folderPickerModel';

function folder(path: string): Folder {
    const parts = path.split('/');
    return { path, name: parts[parts.length - 1]!, depth: parts.length, createdAt: 1, updatedAt: 1 };
}

function makeFolders(count: number): Folder[] {
    const folders: Folder[] = [];
    const roots = 100;
    for (let i = 0; i < count; i += 1) {
        const r = i % roots;
        const a = `R${r}`;
        const b = `R${r}/S${Math.floor(i / roots)}`;
        const c = `${b}/T${i % 10}`;
        const path = i % 3 === 0 ? a : i % 3 === 1 ? b : c;
        folders.push(folder(path));
    }
    // De-dupe by path (folders must be unique by path)
    const map = new Map<string, Folder>();
    for (const f of folders) map.set(f.path, f);
    return Array.from(map.values());
}

describe('bookmarks/saveDialog folderPickerModel perf', () => {
    it(
        'builds view model for ~5k folders within a reasonable budget',
        { timeout: 10000 },
        () => {
            const folders = makeFolders(5000);
            const start = performance.now();
            const vm = buildFolderPickerVm({ folders, expandedPaths: new Set(), selectedPath: null });
            const elapsed = performance.now() - start;

            expect(vm.nodes.length).toBeGreaterThan(0);
            expect(elapsed).toBeLessThan(1000);
        }
    );
});
