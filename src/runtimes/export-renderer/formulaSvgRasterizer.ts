import type { FormulaSvgAsset } from '../../core/math/formulaAssetTypes';

export type FormulaPngRasterizeOptions = {
    pixelRatio?: number;
    backgroundColor?: string;
};

export type FormulaPngRasterizeResult = {
    blob: Blob;
    widthPx: number;
    heightPx: number;
    effectivePixelRatio: number;
};

const DEFAULT_PIXEL_RATIO = 2;
const MAX_REQUESTED_PIXEL_RATIO = 4;
const SAFE_CANVAS_DIMENSION_LIMIT = 16384;
const SAFE_CANVAS_PIXEL_AREA_LIMIT = 24_000_000;

type RasterSize = {
    width: number;
    height: number;
};

function imageFromBlobUrl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Formula SVG image failed to load.'));
        image.src = url;
    });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Formula PNG renderer returned an empty blob.'));
        }, 'image/png');
    });
}

function requestedPixelRatio(value: number | undefined): number {
    return Number.isFinite(value) && (value ?? 0) > 0
        ? Math.min(MAX_REQUESTED_PIXEL_RATIO, Math.max(1, value!))
        : DEFAULT_PIXEL_RATIO;
}

function fitCanvasSize(width: number, height: number): RasterSize {
    let nextWidth = Math.min(SAFE_CANVAS_DIMENSION_LIMIT, Math.max(1, width));
    let nextHeight = Math.min(SAFE_CANVAS_DIMENSION_LIMIT, Math.max(1, height));
    const area = nextWidth * nextHeight;
    if (area <= SAFE_CANVAS_PIXEL_AREA_LIMIT) return { width: nextWidth, height: nextHeight };

    const scale = Math.sqrt(SAFE_CANVAS_PIXEL_AREA_LIMIT / area);
    nextWidth = Math.max(1, Math.floor(nextWidth * scale));
    nextHeight = Math.max(1, Math.floor(nextHeight * scale));
    return { width: nextWidth, height: nextHeight };
}

function resolveRasterSize(width: number, height: number, pixelRatio: number): RasterSize {
    const sourceWidth = Math.max(1, width);
    const sourceHeight = Math.max(1, height);
    const dimensionRatio = SAFE_CANVAS_DIMENSION_LIMIT / Math.max(sourceWidth, sourceHeight);
    const areaRatio = Math.sqrt(SAFE_CANVAS_PIXEL_AREA_LIMIT / Math.max(1, sourceWidth * sourceHeight));
    const effectivePixelRatio = Math.min(pixelRatio, dimensionRatio, areaRatio);
    return fitCanvasSize(
        Math.ceil(sourceWidth * effectivePixelRatio),
        Math.ceil(sourceHeight * effectivePixelRatio),
    );
}

export async function rasterizeFormulaSvgToPng(
    asset: FormulaSvgAsset,
    options: FormulaPngRasterizeOptions = {},
): Promise<FormulaPngRasterizeResult> {
    const { width, height } = resolveRasterSize(
        asset.width,
        asset.height,
        requestedPixelRatio(options.pixelRatio),
    );
    const svgBlob = new Blob([asset.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);

    try {
        const image = await imageFromBlobUrl(url);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Formula PNG canvas context unavailable.');
        if (options.backgroundColor) {
            context.fillStyle = options.backgroundColor;
            context.fillRect(0, 0, width, height);
        } else {
            context.clearRect(0, 0, width, height);
        }
        context.drawImage(image, 0, 0, width, height);
        return {
            blob: await canvasToPngBlob(canvas),
            widthPx: width,
            heightPx: height,
            effectivePixelRatio: Math.min(width / Math.max(1, asset.width), height / Math.max(1, asset.height)),
        };
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function rasterizeFormulaSvgToPngBlob(
    asset: FormulaSvgAsset,
    options: FormulaPngRasterizeOptions = {},
): Promise<Blob> {
    return (await rasterizeFormulaSvgToPng(asset, options)).blob;
}
