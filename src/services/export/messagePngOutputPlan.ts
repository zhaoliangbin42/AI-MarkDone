import type { ImageExportErrorCode } from './imageExportContracts';

export const MESSAGE_PNG_LIMITS = {
    minWidthCssPx: 360,
    maxWidthCssPx: 1_200,
    maxBandPixels: 8_000_000,
    maxBandSidePx: 8_192,
    maxFileHeightPx: 65_535,
    maxFilePixels: 64_000_000,
    maxJobPixels: 128_000_000,
    minPixelRatio: 1,
    maxPixelRatio: 3,
    pixelRatioStep: 0.5,
} as const;

export type MessagePngOutputPlanInput = {
    widthCssPx: number;
    heightCssPx: number;
    requestedPixelRatio: number;
};

export type MessagePngOutputPlan = {
    effectivePixelRatio: number;
    pixelWidth: number;
    pixelHeight: number;
    partCount: number;
    multipart: boolean;
    maxPartPixelHeight: number;
    maxBandPixelHeight: number;
};

export class ImageExportPlanningError extends Error {
    readonly code: ImageExportErrorCode;

    constructor(code: ImageExportErrorCode, message: string) {
        super(message);
        this.name = 'ImageExportPlanningError';
        this.code = code;
    }
}

function assertValidInput(input: MessagePngOutputPlanInput): void {
    const ratioStep = (input.requestedPixelRatio - MESSAGE_PNG_LIMITS.minPixelRatio)
        / MESSAGE_PNG_LIMITS.pixelRatioStep;
    const isValid = Number.isFinite(input.widthCssPx)
        && input.widthCssPx >= MESSAGE_PNG_LIMITS.minWidthCssPx
        && input.widthCssPx <= MESSAGE_PNG_LIMITS.maxWidthCssPx
        && Number.isFinite(input.heightCssPx)
        && input.heightCssPx > 0
        && Number.isFinite(input.requestedPixelRatio)
        && input.requestedPixelRatio >= MESSAGE_PNG_LIMITS.minPixelRatio
        && input.requestedPixelRatio <= MESSAGE_PNG_LIMITS.maxPixelRatio
        && Number.isInteger(ratioStep);
    if (!isValid) {
        throw new ImageExportPlanningError(
            'INVALID_REQUEST',
            'Message PNG dimensions or pixel ratio are outside the supported range.',
        );
    }
}

function dimensionsAtRatio(input: MessagePngOutputPlanInput, ratio: number) {
    return {
        pixelWidth: Math.ceil(input.widthCssPx * ratio),
        pixelHeight: Math.ceil(input.heightCssPx * ratio),
    };
}

function fitsSingleFile(pixelWidth: number, pixelHeight: number): boolean {
    return pixelWidth <= MESSAGE_PNG_LIMITS.maxBandSidePx
        && pixelHeight <= MESSAGE_PNG_LIMITS.maxFileHeightPx
        && pixelWidth * pixelHeight <= MESSAGE_PNG_LIMITS.maxFilePixels;
}

export function planMessagePngOutput(input: MessagePngOutputPlanInput): MessagePngOutputPlan {
    assertValidInput(input);

    for (
        let ratio = input.requestedPixelRatio;
        ratio >= MESSAGE_PNG_LIMITS.minPixelRatio;
        ratio -= MESSAGE_PNG_LIMITS.pixelRatioStep
    ) {
        const { pixelWidth, pixelHeight } = dimensionsAtRatio(input, ratio);
        if (!fitsSingleFile(pixelWidth, pixelHeight)) continue;

        return {
            effectivePixelRatio: ratio,
            pixelWidth,
            pixelHeight,
            partCount: 1,
            multipart: false,
            maxPartPixelHeight: Math.min(
                MESSAGE_PNG_LIMITS.maxFileHeightPx,
                Math.floor(MESSAGE_PNG_LIMITS.maxFilePixels / pixelWidth),
            ),
            maxBandPixelHeight: Math.min(
                MESSAGE_PNG_LIMITS.maxBandSidePx,
                Math.floor(MESSAGE_PNG_LIMITS.maxBandPixels / pixelWidth),
            ),
        };
    }

    const effectivePixelRatio = MESSAGE_PNG_LIMITS.minPixelRatio;
    const { pixelWidth, pixelHeight } = dimensionsAtRatio(input, effectivePixelRatio);
    const totalPixels = pixelWidth * pixelHeight;
    if (!Number.isSafeInteger(pixelWidth)
        || !Number.isSafeInteger(pixelHeight)
        || !Number.isSafeInteger(totalPixels)
        || totalPixels > MESSAGE_PNG_LIMITS.maxJobPixels) {
        throw new ImageExportPlanningError(
            'LIMIT_EXCEEDED',
            'Message PNG exceeds the aggregate export budget.',
        );
    }
    const maxPartPixelHeight = Math.min(
        MESSAGE_PNG_LIMITS.maxFileHeightPx,
        Math.floor(MESSAGE_PNG_LIMITS.maxFilePixels / pixelWidth),
    );
    const maxBandPixelHeight = Math.min(
        MESSAGE_PNG_LIMITS.maxBandSidePx,
        Math.floor(MESSAGE_PNG_LIMITS.maxBandPixels / pixelWidth),
    );

    return {
        effectivePixelRatio,
        pixelWidth,
        pixelHeight,
        partCount: Math.ceil(pixelHeight / maxPartPixelHeight),
        multipart: true,
        maxPartPixelHeight,
        maxBandPixelHeight,
    };
}
