import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTStreamingQuarantineController } from '@/ui/content/controllers/ChatGPTStreamingQuarantineController';

describe('ChatGPTStreamingQuarantineController', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('switches to streaming, then cooldown, then idle based on group streaming state', () => {
        const state = { streaming: false };
        const groups = {
            getGroups: () => [{
                id: 'g1',
                title: 'Prompt',
                barEl: document.createElement('div'),
                bodyEls: [],
                assistantRootEl: document.createElement('section'),
                assistantIndex: 0,
                collapsed: false,
                virtualized: false,
                isStreaming: state.streaming,
            }],
            markVirtualized: vi.fn(),
            completeRestore: vi.fn(),
            onRestoreRequested: vi.fn(),
        };
        const toolbar = { setStreamingBudgetMode: vi.fn() };
        const virtualization = { setStreamingBudgetMode: vi.fn() };
        const stablePerformance = { setStreamingBudgetMode: vi.fn() };

        const controller = new ChatGPTStreamingQuarantineController({
            groups: groups as any,
            toolbarOrchestrator: toolbar as any,
            getVirtualizationController: () => virtualization as any,
            getStablePerformanceController: () => stablePerformance as any,
        });

        const states: string[] = [];
        controller.subscribe((next) => states.push(next));
        controller.init();

        state.streaming = true;
        vi.advanceTimersByTime(300);

        expect(controller.getState()).toBe('streaming');
        expect(toolbar.setStreamingBudgetMode).toHaveBeenLastCalledWith('reduced');
        expect(virtualization.setStreamingBudgetMode).toHaveBeenLastCalledWith('reduced');
        expect(stablePerformance.setStreamingBudgetMode).toHaveBeenLastCalledWith('reduced');

        state.streaming = false;
        vi.advanceTimersByTime(300);
        expect(controller.getState()).toBe('cooldown');

        vi.advanceTimersByTime(1749);
        expect(controller.getState()).toBe('cooldown');

        vi.advanceTimersByTime(251);
        expect(controller.getState()).toBe('idle');
        expect(toolbar.setStreamingBudgetMode).toHaveBeenLastCalledWith('normal');
        expect(states).toEqual(expect.arrayContaining(['idle', 'streaming', 'cooldown']));
    });

    it('restores normal budget mode on dispose', () => {
        const groups = {
            getGroups: () => [],
            markVirtualized: vi.fn(),
            completeRestore: vi.fn(),
            onRestoreRequested: vi.fn(),
        };
        const toolbar = { setStreamingBudgetMode: vi.fn() };
        const controller = new ChatGPTStreamingQuarantineController({
            groups: groups as any,
            toolbarOrchestrator: toolbar as any,
            getVirtualizationController: () => null,
            getStablePerformanceController: () => null,
        });

        controller.init();
        controller.dispose();

        expect(toolbar.setStreamingBudgetMode).toHaveBeenLastCalledWith('normal');
    });
});
