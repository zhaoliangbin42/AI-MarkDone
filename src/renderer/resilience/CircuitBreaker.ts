/**
 * Circuit Breaker pattern implementation
 * Prevents cascading failures by opening circuit after threshold failures
 */
import { logger } from '../../utils/logger';

export class CircuitBreaker {
    private failures = 0;
    private lastFailure = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    private readonly threshold = 3;       // Open after 3 failures
    private readonly timeout = 60000;     // Try Half-Open after 1 minute

    /**
     * Execute function with circuit breaker protection
     */
    async execute<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
        // OPEN state: directly use fallback
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailure > this.timeout) {
                this.state = 'HALF_OPEN';
                logger.info('[CircuitBreaker] Trying HALF_OPEN');
            } else {
                logger.warn('[CircuitBreaker] Circuit is OPEN, using fallback');
                return fallback;
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            logger.error('[CircuitBreaker] Execution failed:', error);
            return fallback;
        }
    }

    private onSuccess(): void {
        this.failures = 0;
        if (this.state === 'HALF_OPEN') {
            logger.info('[CircuitBreaker] Recovered, closing circuit');
        }
        this.state = 'CLOSED';
    }

    private onFailure(): void {
        this.failures++;
        this.lastFailure = Date.now();

        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
            logger.error(`[CircuitBreaker] Threshold reached (${this.failures}), OPENING circuit`);
        }
    }

    // Health check
    getState(): { state: string; failures: number } {
        return {
            state: this.state,
            failures: this.failures,
        };
    }

    reset(): void {
        this.failures = 0;
        this.state = 'CLOSED';
    }
}
