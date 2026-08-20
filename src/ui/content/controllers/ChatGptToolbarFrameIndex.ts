import type { ConversationTurnV1 } from '../../../contracts/conversationContent';
import type { ConversationSurfaceFrameV1 } from '../../../contracts/conversationSurface';

export type ChatGptToolbarFrameEntry = Readonly<{
    turn: ConversationTurnV1;
    position: number;
    turnKey: string;
}>;

/**
 * A per-frame consumer index. It accelerates toolbar lookups without taking
 * ownership of canonical conversation state or changing the Surface contract.
 */
export class ChatGptToolbarFrameIndex {
    private byMessage = new WeakMap<HTMLElement, ChatGptToolbarFrameEntry>();
    private token: string | null = null;

    setFrame(frame: ConversationSurfaceFrameV1): void {
        this.byMessage = new WeakMap<HTMLElement, ChatGptToolbarFrameEntry>();
        this.token = frame.frameToken;
        for (const entry of frame.obtainedTurns) {
            const message = entry.materialization?.messageElement;
            if (!message) continue;
            this.byMessage.set(message, {
                turn: entry.turn,
                position: entry.turn.ordinal,
                turnKey: `${entry.turn.key}:${frame.contentToken ?? ''}`,
            });
        }
    }

    read(message: HTMLElement): ChatGptToolbarFrameEntry | null {
        return this.byMessage.get(message) ?? null;
    }

    getFrameToken(): string | null {
        return this.token;
    }

    clear(): void {
        this.byMessage = new WeakMap<HTMLElement, ChatGptToolbarFrameEntry>();
        this.token = null;
    }
}
