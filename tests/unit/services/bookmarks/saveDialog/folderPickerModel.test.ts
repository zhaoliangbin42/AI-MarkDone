import { describe, expect, it } from 'vitest';
import type { Folder } from '../../../../../src/core/bookmarks/types';
import { buildFolderPickerVm, canCreateSubfolder } from '../../../../../src/services/bookmarks/saveDialog/folderPickerModel';

function folder(path: string): Folder {
    const parts = path.split('/');
    return { path, name: parts[parts.length - 1]!, depth: parts.length, createdAt: 1, updatedAt: 1 };
}

describe('bookmarks/saveDialog folderPickerModel', () => {
    it('builds a tree view model with selected/expanded flags', () => {
        const folders = [folder('A'), folder('A/B'), folder('Import')];
        const expanded = new Set<string>(['A']);
        const vm = buildFolderPickerVm({ folders, expandedPaths: expanded, selectedPath: 'A/B' });

        const a = vm.nodes.find((n) => n.path === 'A');
        expect(a?.isExpanded).toBe(true);
        expect(a?.children.some((c) => c.path === 'A/B')).toBe(true);

        const ab = a?.children.find((c) => c.path === 'A/B');
        expect(ab?.isSelected).toBe(true);
    });

    it('canCreateSubfolder enforces MAX_DEPTH=4', () => {
        expect(canCreateSubfolder('a')).toBe(true);
        expect(canCreateSubfolder('a/b/c')).toBe(true);
        expect(canCreateSubfolder('a/b/c/d')).toBe(false);
    });
});

