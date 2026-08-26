import type { SiteAdapter } from '../../drivers/content/adapters/base';
import type { ChatGPTPageIndex } from '../../drivers/content/chatgpt/ChatGPTPageIndex';
import { collectChatGPTDomHostSlots } from '../../drivers/content/chatgpt/domConversationDiscovery';
import { readChatGPTOfficialNavigation } from '../../drivers/content/chatgpt/ChatGPTOfficialNavigation';
import type { ChatGPTConversationSurface } from '../../drivers/content/chatgpt/ChatGPTConversationSurface';
import type { ConversationContentRepository } from '../../services/content/ConversationContentRepository';

export type ChatGPTFullHistoryDiscoveryStatus = 'idle' | 'running' | 'partial' | 'complete' | 'cancelled';

export type ChatGPTFullHistoryDiscoveryState = Readonly<{
    status: ChatGPTFullHistoryDiscoveryStatus;
    expectedTurnCount: number;
    capturedTurnCount: number;
    passCount: number;
}>;

type FullHistoryDiscoveryOptions = Readonly<{
    adapter: SiteAdapter;
    pageIndex: Pick<ChatGPTPageIndex, 'invalidate' | 'subscribeObservations'>;
    surface: Pick<ChatGPTConversationSurface, 'refreshSurface'>;
    hostMonitor: {
        setCaptureOrigin(origin: 'full-discovery' | 'dom-fallback'): void;
        requestCapture(origin?: 'full-discovery' | 'dom-fallback'): void;
        flushObserved(): Promise<void>;
    };
    repository: ConversationContentRepository;
    timeoutMs?: number;
    maxPasses?: number;
}>;

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_PASSES = 3;

function isExtensionSurfaceElement(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest('[data-aimd-role]'));
}

/**
 * Drives one bounded DOM materialization sweep after ChatGPT's `?message=`
 * trigger has created its full navigation skeleton. It consumes the existing
 * PageIndex/HostMonitor signals and never creates a second observer.
 */
export class ChatGPTFullHistoryDiscoveryController {
    private readonly timeoutMs: number;
    private readonly maxPasses: number;
    private runPromise: Promise<void> | null = null;
    private abortController: AbortController | null = null;
    private disposed = false;
    private userTakeoverBound = false;
    private state: ChatGPTFullHistoryDiscoveryState = Object.freeze({
        status: 'idle',
        expectedTurnCount: 0,
        capturedTurnCount: 0,
        passCount: 0,
    });

    constructor(private readonly options: FullHistoryDiscoveryOptions) {
        this.timeoutMs = Math.max(1, Math.round(options.timeoutMs ?? DEFAULT_TIMEOUT_MS));
        this.maxPasses = Math.max(1, Math.round(options.maxPasses ?? DEFAULT_MAX_PASSES));
    }

    readState(): ChatGPTFullHistoryDiscoveryState {
        return this.state;
    }

    start(): Promise<void> {
        if (this.disposed) return Promise.resolve();
        if (this.runPromise) {
            if (this.abortController?.signal.aborted) {
                return this.runPromise.then(() => this.start());
            }
            return this.runPromise;
        }
        const run = this.runDiscovery();
        this.runPromise = run;
        void run.finally(() => {
            if (this.runPromise === run) this.runPromise = null;
        }).catch(() => undefined);
        return run;
    }

    cancel(): void {
        this.abortController?.abort();
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.cancel();
        this.unbindUserTakeoverListeners();
        this.options.hostMonitor.setCaptureOrigin('dom-fallback');
    }

    private async runDiscovery(): Promise<void> {
        const controller = new AbortController();
        this.abortController = controller;
        const deadline = Date.now() + this.timeoutMs;
        this.setState({ status: 'running', expectedTurnCount: 0, passCount: 0 });
        this.bindUserTakeoverListeners(controller);

        try {
            const navigation = await this.waitForOfficialNavigation(deadline, controller.signal);
            if (!navigation || controller.signal.aborted || this.disposed) {
                this.markPartial(controller.signal.aborted ? 'cancelled' : 'partial');
                return;
            }

            this.options.hostMonitor.setCaptureOrigin('full-discovery');
            this.options.repository.setFullDiscoveryExpectedTurnCount(navigation.expectedTurnCount);
            let lastSlotSignature = '';
            for (let pass = 1; pass <= this.maxPasses && Date.now() < deadline; pass += 1) {
                if (controller.signal.aborted || this.disposed) {
                    this.markPartial('cancelled');
                    return;
                }
                this.setState({
                    status: 'running',
                    expectedTurnCount: navigation.expectedTurnCount,
                    passCount: pass,
                });

                const slots = collectChatGPTDomHostSlots(this.options.adapter);
                const slotSignature = slots.map((slot) => slot.id).join('|');
                if (!slotSignature) break;

                for (const slot of slots) {
                    if (controller.signal.aborted || this.disposed || Date.now() >= deadline) break;
                    if (!slot.element.isConnected) continue;
                    slot.element.scrollIntoView?.({ behavior: 'auto', block: 'start' });
                    this.options.pageIndex.invalidate();
                    this.options.surface.refreshSurface();
                    this.options.hostMonitor.requestCapture('full-discovery');
                    await this.options.hostMonitor.flushObserved();
                }

                const refreshedNavigation = readChatGPTOfficialNavigation();
                if (!refreshedNavigation.ready) break;
                this.options.repository.setFullDiscoveryExpectedTurnCount(refreshedNavigation.expectedTurnCount);
                if (this.options.repository.markFullDiscoveryComplete()) {
                    this.setState({
                        status: 'complete',
                        expectedTurnCount: refreshedNavigation.expectedTurnCount,
                        passCount: pass,
                    });
                    return;
                }
                if (slotSignature === lastSlotSignature) continue;
                lastSlotSignature = slotSignature;
            }

            this.markPartial('partial');
        } finally {
            this.options.hostMonitor.setCaptureOrigin('dom-fallback');
            this.unbindUserTakeoverListeners();
            if (this.abortController === controller) this.abortController = null;
        }
    }

    private waitForOfficialNavigation(
        deadline: number,
        signal: AbortSignal,
    ): Promise<ReturnType<typeof readChatGPTOfficialNavigation> | null> {
        const immediate = readChatGPTOfficialNavigation();
        if (immediate.ready) return Promise.resolve(immediate);
        if (signal.aborted || this.disposed) return Promise.resolve(null);

        return new Promise((resolve) => {
            let settled = false;
            let timeoutId: ReturnType<typeof setTimeout> | null = null;
            let unsubscribe: () => void = () => undefined;
            const finish = (value: ReturnType<typeof readChatGPTOfficialNavigation> | null) => {
                if (settled) return;
                settled = true;
                if (timeoutId !== null) window.clearTimeout(timeoutId);
                unsubscribe();
                signal.removeEventListener('abort', abort);
                resolve(value);
            };
            const check = () => {
                const current = readChatGPTOfficialNavigation();
                if (current.ready) finish(current);
            };
            const abort = () => finish(null);
            unsubscribe = this.options.pageIndex.subscribeObservations(check);
            signal.addEventListener('abort', abort, { once: true });
            timeoutId = window.setTimeout(() => finish(null), Math.max(0, deadline - Date.now()));
            check();
        });
    }

    private markPartial(status: 'partial' | 'cancelled'): void {
        this.options.repository.markFullDiscoveryPartial();
        const current = this.readState();
        this.setState({
            status,
            expectedTurnCount: current.expectedTurnCount,
            passCount: current.passCount,
        });
    }

    private setState(next: {
        status: ChatGPTFullHistoryDiscoveryStatus;
        expectedTurnCount?: number;
        passCount?: number;
    }): void {
        this.state = Object.freeze({
            status: next.status,
            expectedTurnCount: next.expectedTurnCount ?? this.state.expectedTurnCount,
            capturedTurnCount: this.options.repository.read().snapshot?.turns.length ?? 0,
            passCount: next.passCount ?? this.state.passCount,
        });
    }

    private readonly onUserTakeover = (event: Event): void => {
        if (isExtensionSurfaceElement(event.target)) return;
        this.cancel();
    };

    private bindUserTakeoverListeners(controller: AbortController): void {
        if (this.userTakeoverBound) return;
        this.userTakeoverBound = true;
        for (const eventName of ['pointerdown', 'wheel', 'keydown', 'touchstart'] as const) {
            document.addEventListener(eventName, this.onUserTakeover, { capture: true, passive: true });
            controller.signal.addEventListener('abort', () => {
                document.removeEventListener(eventName, this.onUserTakeover, { capture: true });
            }, { once: true });
        }
    }

    private unbindUserTakeoverListeners(): void {
        if (!this.userTakeoverBound) return;
        this.userTakeoverBound = false;
        for (const eventName of ['pointerdown', 'wheel', 'keydown', 'touchstart'] as const) {
            document.removeEventListener(eventName, this.onUserTakeover, { capture: true });
        }
    }
}
