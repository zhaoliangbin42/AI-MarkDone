import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { zipBlobs } from '../../../../../src/drivers/content/export/zipBlobs';

function readBlob(blob: Blob): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('Blob read failed.'));
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.readAsArrayBuffer(blob);
    });
}

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

        const files = unzipSync(await readBlob(zip));
        expect(strFromU8(files['one.png']!)).toBe('one');
        expect(strFromU8(files['two.png']!)).toBe('two');
    });

    it('streams already encoded artifact chunks directly into a ZIP entry', async () => {
        const encoder = new TextEncoder();
        const zip = await zipBlobs({
            files: [{
                filename: 'chunked.png',
                chunks: [encoder.encode('part-').buffer, encoder.encode('one').buffer],
            }],
        });

        const files = unzipSync(await readBlob(zip));
        expect(strFromU8(files['chunked.png']!)).toBe('part-one');
    });

    it('returns an empty ZIP blob for no files', async () => {
        const zip = await zipBlobs({ files: [] });

        expect(zip.type).toBe('application/zip');
        expect(zip.size).toBeGreaterThan(0);
    });

    it('rejects before reading files when packaging is already cancelled', async () => {
        const abort = new AbortController();
        abort.abort();

        await expect(zipBlobs({
            files: [{ filename: 'one.png', blob: new Blob(['one'], { type: 'image/png' }) }],
            signal: abort.signal,
        })).rejects.toMatchObject({ name: 'AbortError' });
    });
});
