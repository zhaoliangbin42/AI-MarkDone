import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RichBlockV1 } from '@/contracts/richContent';
import { prepareRichOutput } from '@/services/export/prepareRichOutput';
import { prepareRichContentAssets } from '@/drivers/content/export/richContentAssets';

vi.mock('@/drivers/content/export/richContentAssets', () => ({ prepareRichContentAssets: vi.fn() }));
const block: RichBlockV1 = { id: 'chart', kind: 'html', label: 'Chart', visualDigest: 'v1',
    fallbackMarkdown: '> [Chart unavailable]\n\n| Value |\n| --- |\n| 51.3% |', source: { kind: 'dom-capture', surface: 'html' } };
const body = 'Before\n\n![Chart](aimd-rich:chart)\n\nAfter';

describe('prepareRichOutput', () => {
    beforeEach(() => vi.mocked(prepareRichContentAssets).mockReset());

    it('omits ordinary inline and reference images from both roles without removing code examples', async () => {
        const markdown = 'Before ![Photo](https://example.com/photo.png) after\n\n![Reference][photo]\n\n[photo]: https://example.com/ref.png\n\n`![Code](https://example.com/code.png)`';
        const result = await prepareRichOutput([{ user: markdown, assistant: markdown, index: 0 }], [0], { target: 'visual', visuals: 'placeholder' });
        expect(prepareRichContentAssets).not.toHaveBeenCalled();
        for (const content of [result.turns[0].user, result.turns[0].assistant]) {
            expect(content).toContain('Before Photo after');
            expect(content).not.toContain('![Reference]');
            expect(content).toContain('`![Code](https://example.com/code.png)`');
        }
        result.release();
    });

    it('placeholder policy keeps readable data and starts no visual work', async () => {
        const result = await prepareRichOutput([{ user: '', assistant: body, richBlocks: [block], index: 7 }], [0, 0], { target: 'visual', visuals: 'placeholder' });
        expect(prepareRichContentAssets).not.toHaveBeenCalled();
        expect(result.turns[0]!.assistant).toContain('51.3%');
        expect(result.turns[0]!.assistant).not.toContain('aimd-rich:');
        expect(result.manifest.blocks).toHaveLength(1);
        expect(result.manifest.blocks[0]).toMatchObject({ sourceIndex: 7, outcome: 'placeholder', reason: 'policy-placeholder' });
        result.release();
    });

    it('offline projection includes real bytes, retains selection order and never mutates the source', async () => {
        const release = vi.fn();
        const blob = new Blob(['png-bytes'], { type: 'image/png' });
        vi.mocked(prepareRichContentAssets).mockResolvedValue({
            assets: [{ assetId: 'a1', blockId: 'chart', visualDigest: 'v1', mimeType: 'image/png', blob,
                objectUrl: `blob:${window.location.origin}/asset-1`, widthPx: 100, heightPx: 80, filename: 'a1.png' }],
            failures: [], release,
        });
        const turns = [{ user: '', assistant: body, richBlocks: [block], index: 7 }];
        const result = await prepareRichOutput(turns, [0, 0, 50, -1], { target: 'archive', visuals: 'include' });
        expect(result.turns[0]!.assistant).toContain('](assets/');
        expect(result.turns[0]!.assistant).not.toContain('blob:');
        expect(result.turns[0]!.assistant).not.toContain('aimd-rich:');
        expect(result.files).toHaveLength(1);
        expect(result.files[0]!.blob).toBe(blob);
        expect(turns[0]!.assistant).toBe(body);
        expect(release).not.toHaveBeenCalled();
        result.release(); result.release();
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('cancellation discards prepared resources instead of delivering a partial archive', async () => {
        const controller = new AbortController();
        const release = vi.fn();
        vi.mocked(prepareRichContentAssets).mockImplementation(async () => {
            controller.abort();
            return { assets: [], failures: [], release };
        });
        await expect(prepareRichOutput([{ user: '', assistant: body, richBlocks: [block], index: 0 }], [0], {
            target: 'archive', visuals: 'include', signal: controller.signal,
        })).rejects.toMatchObject({ name: 'AbortError' });
        expect(release).toHaveBeenCalledTimes(1);
    });
});
