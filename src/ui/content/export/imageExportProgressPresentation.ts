import type { ImageExportProgressEvent } from '../../../services/export/imageExportContracts';

type ProgressTranslate = (key: string, substitutions?: string[]) => string;

export type ImageExportProgressPresentation = {
    label: string;
    value: number;
    segment?: {
        current: number;
        total: number;
    };
};

export function retainMonotonicImageExportProgress(
    previous: ImageExportProgressPresentation | null,
    next: ImageExportProgressPresentation,
): ImageExportProgressPresentation {
    return previous && next.value < previous.value ? previous : next;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function getBandProgress(event: ImageExportProgressEvent): {
    completed: number;
    current: number;
    total: number;
} | null {
    if (!Number.isFinite(event.completed) || !Number.isFinite(event.total) || (event.total ?? 0) <= 0) {
        return null;
    }
    const total = Math.max(1, Math.floor(event.total ?? 1));
    const completed = clamp(Math.floor(event.completed ?? 0), 0, total);
    return {
        completed,
        current: clamp(completed + 1, 1, total),
        total,
    };
}

function localize(
    translate: ProgressTranslate,
    key: string,
    fallback: string,
    substitutions?: string[],
): string {
    const translated = substitutions ? translate(key, substitutions) : translate(key);
    return translated && translated !== key ? translated : fallback;
}

export function presentImageExportProgress(
    event: ImageExportProgressEvent,
    translate: ProgressTranslate,
): ImageExportProgressPresentation {
    const band = getBandProgress(event);
    const segment = band ? `${band.current}/${band.total}` : null;

    switch (event.phase) {
        case 'queued':
        case 'preparing':
            return {
                label: localize(translate, 'pngExportStagePreparing', 'Preparing image'),
                value: 0,
            };
        case 'compiling':
            return {
                label: localize(translate, 'pngExportStageCompiling', 'Compiling Markdown'),
                value: 2,
            };
        case 'layout':
            return {
                label: localize(translate, 'pngExportStageLayout', 'Laying out image'),
                value: 5,
            };
        case 'rasterizing': {
            const ratio = band ? (2 * band.completed) / (2 * band.total) : 0;
            return {
                label: localize(
                    translate,
                    'pngExportStageRasterizing',
                    segment ? `Rendering segment ${segment}` : 'Rendering image',
                    segment ? [segment] : undefined,
                ),
                value: Math.round(5 + (90 * ratio)),
                segment: band ? { current: band.current, total: band.total } : undefined,
            };
        }
        case 'encoding': {
            const ratio = band ? ((2 * band.completed) + 1) / (2 * band.total) : 0.5;
            return {
                label: localize(
                    translate,
                    'pngExportStageEncoding',
                    segment ? `Encoding segment ${segment}` : 'Encoding image',
                    segment ? [segment] : undefined,
                ),
                value: Math.round(5 + (90 * clamp(ratio, 0, 1))),
                segment: band ? { current: band.current, total: band.total } : undefined,
            };
        }
        case 'finalizing':
            return {
                label: localize(translate, 'pngExportStageFinalizing', 'Finalizing image'),
                value: 100,
            };
    }
}
