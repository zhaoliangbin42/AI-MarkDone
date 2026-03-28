import type { ConversationGroupRegistryPort } from './ConversationGroupRegistryPort';

export type ChatGPTStreamingQuarantineState = 'idle' | 'streaming' | 'cooldown';

type BudgetMode = 'normal' | 'reduced';
type Listener = (state: ChatGPTStreamingQuarantineState) => void;

type ToolbarBudgetPort = {
    setStreamingBudgetMode(mode: BudgetMode): void;
};

type VirtualizationBudgetPort = {
    setStreamingBudgetMode(mode: BudgetMode): void;
};

type StablePerformanceBudgetPort = {
    setStreamingBudgetMode(mode: BudgetMode): void;
};

const POLL_INTERVAL_MS = 250;
const COOLDOWN_MS = 2000;

export class ChatGPTStreamingQuarantineController {
    private groups: ConversationGroupRegistryPort;
    private toolbarOrchestrator: ToolbarBudgetPort;
    private getVirtualizationController: () => VirtualizationBudgetPort | null;
    private getStablePerformanceController: () => StablePerformanceBudgetPort | null;
    private listeners = new Set<Listener>();
    private state: ChatGPTStreamingQuarantineState = 'idle';
    private intervalId: number | null = null;
    private cooldownTimerId: number | null = null;

    constructor(params: {
        groups: ConversationGroupRegistryPort;
        toolbarOrchestrator: ToolbarBudgetPort;
        getVirtualizationController: () => VirtualizationBudgetPort | null;
        getStablePerformanceController: () => StablePerformanceBudgetPort | null;
    }) {
        this.groups = params.groups;
        this.toolbarOrchestrator = params.toolbarOrchestrator;
        this.getVirtualizationController = params.getVirtualizationController;
        this.getStablePerformanceController = params.getStablePerformanceController;
    }

    init(): void {
        this.applyBudgetMode('normal');
        this.intervalId = window.setInterval(() => this.evaluate(), POLL_INTERVAL_MS);
        this.evaluate();
    }

    dispose(): void {
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.cooldownTimerId !== null) {
            window.clearTimeout(this.cooldownTimerId);
            this.cooldownTimerId = null;
        }
        this.setState('idle');
        this.applyBudgetMode('normal');
        this.listeners.clear();
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    getState(): ChatGPTStreamingQuarantineState {
        return this.state;
    }

    private evaluate(): void {
        const hasStreaming = this.groups.getGroups().some((group) => group.isStreaming);
        if (hasStreaming) {
            if (this.cooldownTimerId !== null) {
                window.clearTimeout(this.cooldownTimerId);
                this.cooldownTimerId = null;
            }
            this.setState('streaming');
            this.applyBudgetMode('reduced');
            return;
        }

        if (this.state === 'streaming') {
            this.setState('cooldown');
            if (this.cooldownTimerId !== null) {
                window.clearTimeout(this.cooldownTimerId);
            }
            this.cooldownTimerId = window.setTimeout(() => {
                this.cooldownTimerId = null;
                this.setState('idle');
                this.applyBudgetMode('normal');
            }, COOLDOWN_MS);
        }
    }

    private setState(next: ChatGPTStreamingQuarantineState): void {
        if (this.state === next) return;
        this.state = next;
        for (const listener of this.listeners) listener(next);
    }

    private applyBudgetMode(mode: BudgetMode): void {
        this.toolbarOrchestrator.setStreamingBudgetMode(mode);
        this.getVirtualizationController()?.setStreamingBudgetMode(mode);
        this.getStablePerformanceController()?.setStreamingBudgetMode(mode);
    }
}
