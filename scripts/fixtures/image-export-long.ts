export type ImageExportLongFixture = {
    name: string;
    widthCssPx: number;
    heightCssPx: number;
    requestedPixelRatio: number;
};

export const IMAGE_EXPORT_LONG_FIXTURES: readonly ImageExportLongFixture[] = [
    { name: 'long-12k', widthCssPx: 800, heightCssPx: 12_000, requestedPixelRatio: 3 },
    { name: 'long-30k', widthCssPx: 800, heightCssPx: 30_000, requestedPixelRatio: 3 },
    { name: 'long-60k', widthCssPx: 800, heightCssPx: 60_000, requestedPixelRatio: 3 },
];
