/**
 * EventBus - Global event emitter for decoupled module communication
 * 
 * Usage:
 * ```
 * import { eventBus } from './EventBus';
 * 
 * // Subscribe
 * const unsubscribe = eventBus.on('message:new', (data) => {
 *     // handle data.count
 * });
 * 
 * // Emit
 * eventBus.emit('message:new', { count: 10 });
 * 
 * // Unsubscribe
 * unsubscribe();
 * ```
 */

type Callback<T = unknown> = (data: T) => void;

class EventBus {
    private listeners: Map<string, Set<Callback>> = new Map();

    /**
     * Subscribe to an event
     * @returns Unsubscribe function
     */
    on<T = unknown>(event: string, callback: Callback<T>): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback as Callback);

        return () => this.off(event, callback as Callback);
    }

    /**
     * Subscribe to an event, but only once
     */
    once<T = unknown>(event: string, callback: Callback<T>): () => void {
        const wrapper: Callback<T> = (data) => {
            this.off(event, wrapper as Callback);
            callback(data);
        };
        return this.on(event, wrapper);
    }

    /**
     * Unsubscribe from an event
     */
    off(event: string, callback: Callback): void {
        this.listeners.get(event)?.delete(callback);
    }

    /**
     * Emit an event
     */
    emit<T = unknown>(event: string, data?: T): void {
        this.listeners.get(event)?.forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                logger.error(`[EventBus] Error in listener for "${event}":`, e);
            }
        });
    }

    /**
     * Clear all listeners (for cleanup)
     */
    clear(): void {
        this.listeners.clear();
    }
}

// Singleton instance
export const eventBus = new EventBus();

// Event types for type safety
export interface EventTypes {
    'message:new': { count: number };
    'message:updated': { index: number };
}
import { logger } from '../../utils/logger';
