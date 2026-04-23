import { describe, expect, it } from 'vitest';
import { zipBlobs } from '../../../../../src/drivers/content/export/zipBlobs';

describe('zipBlobs', () => {
    it('packages multiple blobs into a ZIP blob', async () => {
        const zip = await zipBlobs({
            files: [
                { filename: 'one.png', blob: new Blob(['one'], { type: 'image/png' }) },
                { filename: 'two.png', blob: new Blob(['two'], { type: 'image/png' }) },
            ],
        });

        expect(zip.type).toBe('application/zip');
        expect(zip.size).toBeGreaterThan(0);
    });

    it('returns an empty ZIP blob for no files', async () => {
        const zip = await zipBlobs({ files: [] });

        expect(zip.type).toBe('application/zip');
        expect(zip.size).toBeGreaterThan(0);
    });
});
