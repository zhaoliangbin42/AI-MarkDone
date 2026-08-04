import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatGPTConversationDiscoveryCoordinator } from '@/drivers/content/chatgpt/ChatGPTConversationDiscoveryCoordinator';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';

describe('ChatGPTConversationDiscoveryCoordinator', () => {
    let adapter: ChatGPTAdapter;

    beforeEach(() => {
        vi.useFakeTimers();
        history.replaceState({}, '', '/c/695499b7-464c-8323-a998-119f661ac953');
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        adapter = new ChatGPTAdapter();
    });

    afterEach(() => {
        adapter.dispose();
        vi.useRealTimers();
    });

    it('routes bootstrap, PageIndex, bridge, pageshow, and route signals through reconcile', async () => {
        let pageIndexListener: (() => void) | null = null;
        let bridgeListener: (() => void) | null = null;
        const repository = {
            reconcile: vi.fn(async () => ({ kind: 'idle', document: null, snapshot: null })),
            refresh: vi.fn(async () => ({ kind: 'idle', document: null, snapshot: null })),
            scheduleReconcile: vi.fn(),
            read: vi.fn(() => ({ kind: 'idle', document: null, snapshot: null })),
            subscribe: vi.fn(() => () => undefined),
            isCurrent: vi.fn(() => false),
        };
        const pageIndex = {
            subscribeMutations: (listener: () => void) => {
                pageIndexListener = listener;
                return () => { pageIndexListener = null; };
            },
            dispose: vi.fn(),
        };
        const discoveryAdapter = {
            subscribeSignals: (listener: () => void) => {
                bridgeListener = listener;
                return () => { bridgeListener = null; };
            },
        };
        const coordinator = new ChatGPTConversationDiscoveryCoordinator({
            adapter,
            discoveryAdapter: discoveryAdapter as any,
            repository: repository as any,
            pageIndex: pageIndex as any,
        });

        coordinator.init();
        await Promise.resolve();
        expect(repository.reconcile).toHaveBeenCalledTimes(1);
        pageIndexListener?.();
        bridgeListener?.();
        expect(repository.scheduleReconcile).toHaveBeenCalledTimes(2);
        window.dispatchEvent(new PageTransitionEvent('pageshow'));
        expect(repository.reconcile).toHaveBeenCalledTimes(2);
        coordinator.dispose();
        expect(pageIndex.dispose).toHaveBeenCalledTimes(1);
    });
});
