import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTFoldingController } from '@/ui/content/controllers/ChatGPTFoldingController';
import { SiteAdapter, type ConversationGroupRef, type ThemeDetector } from '@/drivers/content/adapters/base';

const detector: ThemeDetector = {
    detect: () => 'light',
    getObserveTargets: () => [],
    hasExplicitTheme: () => true,
};

class FakeChatGPTAdapter extends SiteAdapter {
    matches(): boolean { return true; }
    getPlatformId(): string { return 'chatgpt'; }
    getThemeDetector(): ThemeDetector { return detector; }
    extractUserPrompt(): string | null { return null; }
    getMessageSelector(): string { return '[data-message-author-role="assistant"]'; }
    getMessageContentSelector(): string { return '[data-message-author-role="assistant"]'; }
    getActionBarSelector(): string { return '[aria-label="Response actions"]'; }
    getToolbarAnchorElement(): HTMLElement | null { return null; }
    isStreamingMessage(): boolean { return false; }
    getMessageId(messageElement: HTMLElement): string | null { return messageElement.getAttribute('data-message-id'); }
    getObserverContainer(): HTMLElement | null { return document.body; }
    getConversationGroupRefs(): ConversationGroupRef[] {
        const assistantRootEl = document.querySelector('section[data-turn="assistant"][data-turn-id="a1"]') as HTMLElement | null;
        const userRootEl = document.querySelector('section[data-turn="user"][data-turn-id="u1"]') as HTMLElement | null;
        const assistantMessageEl = document.querySelector('[data-message-author-role="assistant"][data-message-id="a1"]') as HTMLElement | null;
        if (!assistantRootEl || !assistantMessageEl) return [];
        return [{
            id: 'group-a1',
            assistantRootEl,
            assistantMessageEl,
            userRootEl,
            groupEls: [userRootEl, assistantRootEl].filter(Boolean) as HTMLElement[],
            assistantIndex: 0,
            isStreaming: false,
        }];
    }
}

function buildConversationDom(): void {
    document.body.innerHTML = `
      <main>
        <section data-turn="user" data-turn-id="u1">
          <div class="thread-shell">
            <div data-message-author-role="user" data-message-id="u1">Prompt</div>
          </div>
          <div aria-label="Your message actions">copy/edit</div>
        </section>
        <section data-turn="assistant" data-turn-id="a1">
          <div class="thought">Thought for 28s</div>
          <div data-message-author-role="assistant" data-message-id="a1">Answer</div>
          <div class="sources">Sources</div>
          <div aria-label="Response actions">copy/good/bad</div>
        </section>
      </main>
    `;
}

describe('ChatGPTFoldingController', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('folds entire conversation turn sections instead of only inner message roots', () => {
        buildConversationDom();

        const controller = new ChatGPTFoldingController() as any;
        controller.adapter = new FakeChatGPTAdapter();
        controller.theme = 'light';
        controller.mode = 'all';
        controller.ensureHostStyles();
        controller.applyToExisting();

        const userSection = document.querySelector('section[data-turn="user"][data-turn-id="u1"]');
        const assistantSection = document.querySelector('section[data-turn="assistant"][data-turn-id="a1"]');
        const userActions = document.querySelector('[aria-label="Your message actions"]');
        const assistantActions = document.querySelector('[aria-label="Response actions"]');
        const thought = document.querySelector('.thought');
        const sources = document.querySelector('.sources');

        expect(userSection?.getAttribute('data-aimd-folded')).toBe('1');
        expect(assistantSection?.getAttribute('data-aimd-folded')).toBe('1');
        expect(userActions?.closest('[data-aimd-folded="1"]')).toBe(userSection);
        expect(assistantActions?.closest('[data-aimd-folded="1"]')).toBe(assistantSection);
        expect(thought?.closest('[data-aimd-folded="1"]')).toBe(assistantSection);
        expect(sources?.closest('[data-aimd-folded="1"]')).toBe(assistantSection);
        expect(document.querySelectorAll('.aimd-chatgpt-foldbar')).toHaveLength(1);
    });

    it('does not add guide markers when groups are expanded', () => {
        buildConversationDom();

        const controller = new ChatGPTFoldingController() as any;
        controller.adapter = new FakeChatGPTAdapter();
        controller.theme = 'light';
        controller.mode = 'all';
        controller.ensureHostStyles();
        controller.applyToExisting();
        controller.expandAll();

        expect(document.querySelector('[data-aimd-fold-guide="1"]')).toBeNull();
        expect(document.querySelector('section[data-turn="assistant"]')?.hasAttribute('data-aimd-fold-guide')).toBe(false);
    });

    it('collapses the current group for a specific assistant message', () => {
        buildConversationDom();

        const controller = new ChatGPTFoldingController() as any;
        controller.adapter = new FakeChatGPTAdapter();
        controller.theme = 'light';
        controller.mode = 'all';
        controller.ensureHostStyles();
        controller.applyToExisting();
        controller.expandAll();

        const assistantMessage = document.querySelector('[data-message-author-role="assistant"][data-message-id="a1"]') as HTMLElement;
        const userSection = document.querySelector('section[data-turn="user"][data-turn-id="u1"]') as HTMLElement;
        const assistantSection = document.querySelector('section[data-turn="assistant"][data-turn-id="a1"]') as HTMLElement;

        expect(controller.canCollapseMessage(assistantMessage)).toBe(true);
        expect(controller.collapseGroupForMessage(assistantMessage)).toBe(true);
        expect(userSection.getAttribute('data-aimd-folded')).toBe('1');
        expect(assistantSection.getAttribute('data-aimd-folded')).toBe('1');
    });

    it('keeps the fold bar mounted and requests restore when a virtualized group is toggled', () => {
        buildConversationDom();

        const onRestoreVirtualizedGroup = vi.fn();
        const controller = new ChatGPTFoldingController() as any;
        controller.adapter = new FakeChatGPTAdapter();
        controller.theme = 'light';
        controller.mode = 'all';
        controller.ensureHostStyles();
        controller.applyToExisting();
        controller.setVirtualizationCallbacks({ onRestoreVirtualizedGroup });

        const [group] = controller.getVirtualizationGroups();
        expect(group).toBeTruthy();

        controller.setGroupVirtualized(group.id, true);
        const barHost = document.querySelector('.aimd-chatgpt-foldbar') as HTMLElement | null;
        const barButton = barHost?.shadowRoot?.querySelector('.bar') as HTMLElement | null;

        expect(barHost).toBeTruthy();
        expect(barHost?.dataset.virtualized).toBe('1');

        barButton?.click();
        expect(onRestoreVirtualizedGroup).toHaveBeenCalledWith(group.id);
    });

    it('preserves a virtualized group across DOM resync so the fold bar stays mounted', () => {
        buildConversationDom();

        const controller = new ChatGPTFoldingController() as any;
        controller.adapter = new FakeChatGPTAdapter();
        controller.theme = 'light';
        controller.mode = 'all';
        controller.ensureHostStyles();
        controller.applyToExisting();

        const [group] = controller.getVirtualizationGroups();
        expect(group).toBeTruthy();

        const placeholder = document.createElement('div');
        placeholder.setAttribute('data-aimd-fold-group-id', group.id);
        group.barEl.parentElement?.insertBefore(placeholder, group.barEl.nextSibling);
        for (const el of group.bodyEls) el.remove();

        controller.setGroupVirtualized(group.id, true);

        const groupsAfter = controller.getVirtualizationGroups();
        const barHost = document.querySelector('.aimd-chatgpt-foldbar') as HTMLElement | null;

        expect(groupsAfter).toHaveLength(1);
        expect(groupsAfter[0]?.id).toBe(group.id);
        expect(barHost).toBeTruthy();
        expect(barHost?.dataset.virtualized).toBe('1');
    });

    it('clearing virtualization keeps the group folded for hidden-mode fallback', () => {
        buildConversationDom();

        const controller = new ChatGPTFoldingController() as any;
        controller.adapter = new FakeChatGPTAdapter();
        controller.theme = 'light';
        controller.mode = 'all';
        controller.ensureHostStyles();
        controller.applyToExisting();

        const [group] = controller.getVirtualizationGroups();
        expect(group).toBeTruthy();

        controller.setGroupVirtualized(group.id, true);
        controller.setGroupVirtualized(group.id, false);

        const assistantSection = document.querySelector('section[data-turn="assistant"][data-turn-id="a1"]') as HTMLElement | null;
        expect(assistantSection?.getAttribute('data-aimd-folded')).toBe('1');
    });

    it('cleanup keeps a registry-owned fold bar even when the body is currently missing', () => {
        buildConversationDom();

        const controller = new ChatGPTFoldingController() as any;
        controller.adapter = new FakeChatGPTAdapter();
        controller.theme = 'light';
        controller.mode = 'all';
        controller.ensureHostStyles();
        controller.applyToExisting();

        const [group] = controller.getVirtualizationGroups();
        controller.setGroupVirtualized(group.id, true);
        for (const el of group.bodyEls) el.remove();

        controller.cleanupOrphanBars();

        expect(document.querySelector('.aimd-chatgpt-foldbar')).toBeTruthy();
    });

    it('reattaches a virtualized fold bar before its placeholder when the host DOM drops the bar node', () => {
        buildConversationDom();

        const controller = new ChatGPTFoldingController() as any;
        controller.adapter = new FakeChatGPTAdapter();
        controller.theme = 'light';
        controller.mode = 'all';
        controller.ensureHostStyles();
        controller.applyToExisting();

        const [group] = controller.getVirtualizationGroups();
        const placeholder = document.createElement('div');
        placeholder.className = 'aimd-conversation-placeholder';
        placeholder.setAttribute('data-aimd-fold-group-id', group.id);
        group.barEl.parentElement?.insertBefore(placeholder, group.barEl.nextSibling);

        controller.setGroupVirtualized(group.id, true, placeholder);
        group.barEl.remove();

        const groupsAfter = controller.getVirtualizationGroups();
        const restoredBar = document.querySelector('.aimd-chatgpt-foldbar') as HTMLElement | null;

        expect(groupsAfter).toHaveLength(1);
        expect(restoredBar).toBeTruthy();
        expect(restoredBar?.nextElementSibling).toBe(placeholder);
        expect(restoredBar?.dataset.virtualized).toBe('1');
    });
});
