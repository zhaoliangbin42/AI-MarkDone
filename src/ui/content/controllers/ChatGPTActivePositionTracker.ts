import type { ConversationSurfacePortV1 } from '../../../contracts/conversationSurface';
import {
    collectChatGPTRoundPositions,
    resolveChatGPTActivePosition,
    type ChatGPTRoundPosition,
} from '../chatgptDirectory/navigation';

export type ChatGPTActivePositionState = Readonly<{
    rounds: ChatGPTRoundPosition[];
    activePosition: number;
}>;

type Listener = (state: ChatGPTActivePositionState) => void;

/**
 * Shared scroll/geometry owner for Directory and Message Stepper. A single
 * rAF performs the round rect scan and both consumers receive the same result.
 */
export class ChatGPTActivePositionTracker {
    private readonly listeners = new Set<Listener>();
    private initialized = false;
    private rafId: number | null = null;
    private dirty = true;
    private lastFrameToken: string | null = null;
    private state: ChatGPTActivePositionState = { rounds: [], activePosition: 0 };

    constructor(private readonly surface: ConversationSurfacePortV1) {}

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        this.ensureInitialized();
        const state = this.refreshNow();
        listener(state);
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0) this.dispose();
        };
    }

    refreshNow(): ChatGPTActivePositionState {
        if (document.documentElement.dataset.aimdViewportResizing === '1') return this.state;
        const frame = this.surface.readFrame();
        if (!this.dirty && this.lastFrameToken === frame.frameToken) return this.state;
        this.lastFrameToken = frame.frameToken;
        this.dirty = false;
        const rounds = collectChatGPTRoundPositions(this.surface);
        const referenceY = Math.round(window.innerHeight * 0.35);
        const activePosition = resolveChatGPTActivePosition(
            rounds,
            referenceY,
            this.state.activePosition || rounds[0]?.position || 0,
        );
        const previous = this.state;
        this.state = Object.freeze({ rounds, activePosition });
        if (previous.activePosition !== activePosition || previous.rounds.length !== rounds.length) {
            this.listeners.forEach((listener) => listener(this.state));
        }
        return this.state;
    }

    invalidate(): void {
        this.dirty = true;
    }

    dispose(): void {
        if (!this.initialized) return;
        this.initialized = false;
        window.removeEventListener('scroll', this.handleScroll, true);
        document.removeEventListener('scroll', this.handleScroll, true);
        if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.dirty = true;
        this.lastFrameToken = null;
    }

    private ensureInitialized(): void {
        if (this.initialized) return;
        this.initialized = true;
        window.addEventListener('scroll', this.handleScroll, { capture: true, passive: true });
        document.addEventListener('scroll', this.handleScroll, { capture: true, passive: true });
    }

    private readonly handleScroll = (): void => {
        this.dirty = true;
        if (document.documentElement.dataset.aimdViewportResizing === '1') return;
        if (this.rafId !== null) return;
        this.rafId = window.requestAnimationFrame(() => {
            this.rafId = null;
            this.refreshNow();
        });
    };
}
