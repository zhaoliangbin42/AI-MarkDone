import { describe, expect, it, vi } from 'vitest';

import { createBookmarksTabActions } from '@/ui/content/bookmarks/ui/tabs/bookmarksTabActions';

vi.mock('@/ui/content/components/i18n', () => ({
    t: (key: string, args: string[] = []) => `${key}${args.length ? `:${args.join('|')}` : ''}`,
}));

function createActionHarness() {
    const prompt = vi.fn(async (options: any) => {
        const invalid = options.validate?.(options.testValue ?? '');
        return invalid?.ok ? options.testValue : null;
    });
    const modal = {
        alert: vi.fn(),
        confirm: vi.fn(),
        prompt,
        showCustom: vi.fn(),
    } as any;
    const readerPanel = {
        show: vi.fn(),
        hide: vi.fn(),
    } as any;

    return {
        actions: createBookmarksTabActions({ modal, readerPanel }),
        prompt,
    };
}

describe('bookmarks tab actions name prompts', () => {
    it('allows slash-separated folder paths for root folder creation', async () => {
        const { actions, prompt } = createActionHarness();

        prompt.mockImplementationOnce(async (options: any) => {
            expect(options.validate('Work/Project')).toEqual({ ok: true });
            return 'Work/Project';
        });

        await expect(actions.promptCreateFolderPath()).resolves.toBe('Work/Project');
    });

    it('rejects slash-separated names for single folder rename prompts', async () => {
        const { actions, prompt } = createActionHarness();

        prompt.mockImplementationOnce(async (options: any) => {
            expect(options.validate('Work/Project')).toEqual({
                ok: false,
                message: 'folderNameNoSlash',
            });
            return null;
        });

        await expect(actions.promptFolderName('Rename folder')).resolves.toBeNull();
    });

    it('returns detailed forbidden character messages for bookmark title prompts', async () => {
        const { actions, prompt } = createActionHarness();

        prompt.mockImplementationOnce(async (options: any) => {
            expect(options.validate('Alpha/Beta?')).toEqual({
                ok: false,
                message: 'titleForbiddenCharsDetailed:/ ?',
            });
            return null;
        });

        await expect(actions.promptBookmarkTitle('Alpha')).resolves.toBeNull();
    });
});
