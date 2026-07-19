import { describe, expect, it } from 'vitest';
import {
    presentImageExportProgress,
    retainMonotonicImageExportProgress,
} from '@/ui/content/export/imageExportProgressPresentation';

const translate = (key: string, args?: string[]) => args?.length ? `${key}:${args.join('|')}` : key;

describe('imageExportProgressPresentation', () => {
    it('keeps alternating rasterize and encode progress monotonic and reports the active segment', () => {
        const events = [
            { phase: 'compiling' as const },
            { phase: 'layout' as const },
            { phase: 'rasterizing' as const, completed: 0, total: 2 },
            { phase: 'encoding' as const, completed: 0, total: 2 },
            { phase: 'rasterizing' as const, completed: 1, total: 2 },
            { phase: 'encoding' as const, completed: 1, total: 2 },
            { phase: 'finalizing' as const, completed: 1, total: 1 },
        ];

        const presentations = events.map((event) => presentImageExportProgress(event, translate));
        const values = presentations.map((presentation) => presentation.value);

        expect(values).toEqual([2, 5, 5, 28, 50, 73, 100]);
        expect(values).toEqual([...values].sort((a, b) => a - b));
        expect(presentations[2]?.label).toContain('1/2');
        expect(presentations[3]?.label).toContain('1/2');
        expect(presentations[4]?.label).toContain('2/2');
        expect(presentations[3]?.label).not.toContain('Downloading');
        expect(values.at(-1)).toBe(100);
    });

    it('retains the last visible stage when a renderer retry restarts at preparing', () => {
        const encoding = presentImageExportProgress(
            { phase: 'encoding', completed: 0, total: 2 },
            translate,
        );
        const preparing = presentImageExportProgress({ phase: 'preparing' }, translate);

        expect(retainMonotonicImageExportProgress(encoding, preparing)).toBe(encoding);
    });
});
