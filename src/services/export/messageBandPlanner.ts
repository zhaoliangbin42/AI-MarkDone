export type MessageBandRange = {
    startRow: number;
    endRow: number;
};

export type MessagePartPlan = MessageBandRange & {
    partNumber: number;
    partCount: number;
    bands: MessageBandRange[];
};

export type MessageBandPlanInput = {
    totalPixelHeight: number;
    maxPartPixelHeight: number;
    maxBandPixelHeight: number;
    boundaryPixelRows?: readonly number[];
};

function requirePositiveInteger(value: number, label: string): void {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`INVALID_${label.toUpperCase()}`);
    }
}

function normalizeBoundaries(rows: readonly number[] | undefined, total: number): number[] {
    return Array.from(new Set(rows ?? []))
        .filter((row) => Number.isSafeInteger(row) && row > 0 && row < total)
        .sort((left, right) => left - right);
}

function preferredBreak(
    start: number,
    hardEnd: number,
    minimumEnd: number,
    boundaries: readonly number[],
): number {
    for (let index = boundaries.length - 1; index >= 0; index -= 1) {
        const boundary = boundaries[index]!;
        if (boundary > hardEnd) continue;
        if (boundary >= minimumEnd && boundary > start) return boundary;
        break;
    }
    return hardEnd;
}

function planRanges(
    start: number,
    end: number,
    maxHeight: number,
    boundaries: readonly number[],
): MessageBandRange[] {
    const ranges: MessageBandRange[] = [];
    let cursor = start;
    while (cursor < end) {
        const hardEnd = Math.min(end, cursor + maxHeight);
        const next = hardEnd === end
            ? end
            : preferredBreak(cursor, hardEnd, cursor + 1, boundaries);
        ranges.push({ startRow: cursor, endRow: next });
        cursor = next;
    }
    return ranges;
}

export function planMessageBands(input: MessageBandPlanInput): MessagePartPlan[] {
    requirePositiveInteger(input.totalPixelHeight, 'total_height');
    requirePositiveInteger(input.maxPartPixelHeight, 'part_height');
    requirePositiveInteger(input.maxBandPixelHeight, 'band_height');

    const boundaries = normalizeBoundaries(input.boundaryPixelRows, input.totalPixelHeight);
    const partCount = Math.ceil(input.totalPixelHeight / input.maxPartPixelHeight);
    const parts: MessagePartPlan[] = [];
    let startRow = 0;

    for (let index = 0; index < partCount; index += 1) {
        const remainingParts = partCount - index - 1;
        const hardEnd = Math.min(input.totalPixelHeight, startRow + input.maxPartPixelHeight);
        const minimumEnd = Math.max(
            startRow + 1,
            input.totalPixelHeight - remainingParts * input.maxPartPixelHeight,
        );
        const endRow = remainingParts === 0
            ? input.totalPixelHeight
            : preferredBreak(startRow, hardEnd, minimumEnd, boundaries);
        parts.push({
            startRow,
            endRow,
            partNumber: index + 1,
            partCount,
            bands: planRanges(startRow, endRow, input.maxBandPixelHeight, boundaries),
        });
        startRow = endRow;
    }

    return parts;
}
