import type { FormulaSvgAsset } from '../../../core/math/formulaAssetTypes';

export type FormulaPngRasterizeOptions = {
    pixelRatio?: number;
    backgroundColor?: string;
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

export async function rasterizeFormulaSvgToPngBlob(
    asset: FormulaSvgAsset,
    options: FormulaPngRasterizeOptions = {},
): Promise<Blob> {
    const pixelRatio = Number.isFinite(options.pixelRatio) && (options.pixelRatio ?? 0) > 0
        ? Math.min(4, Math.max(1, options.pixelRatio!))
        : 2;
    const width = Math.max(1, Math.ceil(asset.width * pixelRatio));
    const height = Math.max(1, Math.ceil(asset.height * pixelRatio));
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
        return await canvasToPngBlob(canvas);
    } finally {
        URL.revokeObjectURL(url);
    }
}
