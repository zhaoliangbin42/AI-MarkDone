/**
 * Test-only diagnostics for the content consumer performance fixture.
 *
 * The marker is opt-in and lives on the host document so the page-world
 * benchmark can observe work performed in Chrome's isolated content-script
 * world. No event is emitted during normal product use and this is not a
 * runtime protocol or a discovery signal.
 */
export type ContentPerformanceEvent = Readonly<{
    kind: 'selection-frame' | 'materialize' | 'formula-evidence' | 'markdown-projection';
    phase: string;
    durationMs?: number;
    locateCalls?: number;
    rangeToStringCalls?: number;
    formulaScans?: number;
}>;

const PERFORMANCE_EVENT = 'aimd-content-consumer-performance';
const PERFORMANCE_MARKER = 'data-aimd-perf-phase';

export function emitContentPerformanceEvent(
    event: Omit<ContentPerformanceEvent, 'phase'>,
): void {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const phase = document.documentElement.getAttribute(PERFORMANCE_MARKER);
    if (!phase) return;
    document.dispatchEvent(new CustomEvent(PERFORMANCE_EVENT, {
        detail: JSON.stringify({ ...event, phase }),
    }));
}

export const contentPerformanceDiagnostics = Object.freeze({
    eventName: PERFORMANCE_EVENT,
    phaseAttribute: PERFORMANCE_MARKER,
});
