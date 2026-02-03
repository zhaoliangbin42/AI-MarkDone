import { describe, test, expect } from 'vitest';
import { CircuitBreaker } from '../CircuitBreaker';

describe('CircuitBreaker', () => {
    test('executes successfully', async () => {
        const cb = new CircuitBreaker();
        const result = await cb.execute(
            () => Promise.resolve('success'),
            'fallback'
        );
        expect(result).toBe('success');
    });

    test('opens circuit after 3 failures', async () => {
        const cb = new CircuitBreaker();

        // 3 failures
        await cb.execute(() => Promise.reject('fail'), 'fallback');
        await cb.execute(() => Promise.reject('fail'), 'fallback');
        await cb.execute(() => Promise.reject('fail'), 'fallback');

        const state = cb.getState();
        expect(state.state).toBe('OPEN');
        expect(state.failures).toBe(3);
    });

    test('returns fallback immediately in OPEN state', async () => {
        const cb = new CircuitBreaker();

        // Trigger 3 failures
        for (let i = 0; i < 3; i++) {
            await cb.execute(() => Promise.reject(), 'fallback');
        }

        // 4th call should return fallback and not execute fn
        let executed = false;
        const result = await cb.execute(() => {
            executed = true;
            return Promise.resolve('ok');
        }, 'fallback');

        expect(executed).toBe(false);
        expect(result).toBe('fallback');
    });

    test('reset clears state', () => {
        const cb = new CircuitBreaker();
        cb.execute(() => Promise.reject(), 'fallback');
        cb.reset();

        const state = cb.getState();
        expect(state.state).toBe('CLOSED');
        expect(state.failures).toBe(0);
    });
});
