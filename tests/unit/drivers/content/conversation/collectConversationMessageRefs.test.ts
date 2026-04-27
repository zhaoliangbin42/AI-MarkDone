import { describe, expect, it } from 'vitest';
import { collectConversationMessageRefs } from '../../../../../src/drivers/content/conversation/collectConversationMessageRefs';
import { collectConversationTurnRefs } from '../../../../../src/drivers/content/conversation/collectConversationTurnRefs';
import { SiteAdapter, type ConversationGroupRef } from '../../../../../src/drivers/content/adapters/base';

class TestAdapter extends SiteAdapter {
    matches(): boolean {
        return true;
    }
    getPlatformId(): any {
        return 'chatgpt';
    }
    getThemeDetector(): any {
        return { detect: () => 'light', getObserveTargets: () => [], hasExplicitTheme: () => false };
    }
    extractUserPrompt(assistantMessageElement: HTMLElement): string | null {
        return assistantMessageElement.getAttribute('data-prompt');
    }
    getMessageSelector(): string {
        return '.assistant';
    }
    getMessageContentSelector(): string {
        return '';
    }
    getActionBarSelector(): string {
        return '';
    }
    isStreamingMessage(): boolean {
        return false;
    }
    getMessageId(messageElement: HTMLElement): string | null {
        return messageElement.getAttribute('data-id');
    }
    getObserverContainer(): HTMLElement | null {
        return document.getElementById('container');
    }
}

class TurnAwareAdapter extends TestAdapter {
    getTurnRootElement(assistantMessageElement: HTMLElement): HTMLElement | null {
        const turn = assistantMessageElement.closest('[data-turn-root]');
        return turn instanceof HTMLElement ? turn : null;
    }
}

class GroupAwareAdapter extends TestAdapter {
    getConversationGroupRefs(): ConversationGroupRef[] {
        const refs: ConversationGroupRef[] = [];
        for (const groupEl of Array.from(document.querySelectorAll('[data-group-root]'))) {
            if (!(groupEl instanceof HTMLElement)) continue;
            const assistantRootEl = groupEl.querySelector('[data-turn="assistant"]');
            const assistantMessageEl = assistantRootEl?.querySelector(':scope > .assistant');
            if (!(assistantRootEl instanceof HTMLElement) || !(assistantMessageEl instanceof HTMLElement)) continue;
            const userRootEl = groupEl.querySelector('[data-turn="user"]');
            refs.push({
                id: `group-${refs.length + 1}`,
                assistantRootEl,
                assistantMessageEl,
                userRootEl: userRootEl instanceof HTMLElement ? userRootEl : null,
                userPromptText: userRootEl?.textContent?.trim() || null,
                barAnchorEl: null,
                groupEls: [groupEl],
                assistantIndex: refs.length,
                isStreaming: false,
            });
        }
        return refs;
    }
}

class BrokenGroupAdapter extends TestAdapter {
    getConversationGroupRefs(): ConversationGroupRef[] {
        throw new Error('group discovery failed');
    }
}

describe('collectConversationMessageRefs', () => {
    it('collects assistant messages, removes nested duplicates, and extracts prompts', () => {
        document.body.innerHTML = `
          <div id="container">
            <div class="assistant" data-id="a1" data-prompt="p1"></div>
            <div class="assistant" data-id="a2" data-prompt="p2">
              <div class="assistant" data-id="nested" data-prompt="pn"></div>
            </div>
          </div>
        `;

        const adapter = new TestAdapter();
        const refs = collectConversationMessageRefs(adapter);

        expect(refs).toHaveLength(2);
        expect(refs[0]?.index).toBe(0);
        expect(refs[0]?.userPrompt).toBe('p1');
        expect(refs[0]?.messageEls).toHaveLength(1);
        expect(refs[1]?.index).toBe(1);
        expect(refs[1]?.userPrompt).toBe('p2');
        expect(refs[1]?.messageEls).toHaveLength(1);
        expect(refs.map((r) => r.messageId)).toEqual(['a1', 'a2']);
    });

    it('groups multiple assistant segments under the same conversation turn', () => {
        document.body.innerHTML = `
          <div id="container">
            <div data-testid="conversation-turn-2">
              <div class="assistant" data-id="a1" data-prompt="p1"></div>
              <div class="assistant" data-id="a2" data-prompt="p1"></div>
            </div>
          </div>
        `;

        const adapter = new TestAdapter();
        const refs = collectConversationMessageRefs(adapter);

        expect(refs).toHaveLength(2);
        expect(refs[0]?.messageEls).toHaveLength(1);
        expect(refs[1]?.messageEls).toHaveLength(1);
    });

    it('groups assistant segments only when the adapter exposes a turn root contract', () => {
        document.body.innerHTML = `
          <div id="container">
            <div data-turn-root="1">
              <div class="assistant" data-id="a1" data-prompt="p1"></div>
              <div class="assistant" data-id="a2" data-prompt="p1"></div>
            </div>
          </div>
        `;

        const adapter = new TurnAwareAdapter();
        const refs = collectConversationMessageRefs(adapter);

        expect(refs).toHaveLength(1);
        expect(refs[0]?.userPrompt).toBe('p1');
        expect(refs[0]?.messageEls).toHaveLength(2);
        expect(refs[0]?.messageId).toBe('a2');
    });

    it('prefers platform-owned conversation groups over global assistant scanning', () => {
        document.body.innerHTML = `
          <div id="container">
            <div data-group-root="1">
              <section data-turn="user">paired prompt 1</section>
              <section data-turn="assistant">
                <div class="assistant" data-id="a1" data-prompt="legacy-p1">
                  <div class="assistant" data-id="nested" data-prompt="nested"></div>
                </div>
              </section>
            </div>
            <div data-group-root="2">
              <section data-turn="user">paired prompt 2</section>
              <section data-turn="assistant">
                <div class="assistant" data-id="a2" data-prompt="legacy-p2"></div>
              </section>
            </div>
            <div id="portal">
              <div class="assistant" data-id="portal" data-prompt="noise"></div>
            </div>
          </div>
        `;

        const refs = collectConversationTurnRefs(new GroupAwareAdapter());

        expect(refs).toHaveLength(2);
        expect(refs.map((ref) => ref.userPrompt)).toEqual(['paired prompt 1', 'paired prompt 2']);
        expect(refs.map((ref) => ref.messageId)).toEqual(['a1', 'a2']);
        expect(refs[0]?.messageEls).toHaveLength(1);
        expect(refs[0]?.messageEls[0]?.getAttribute('data-id')).toBe('a1');
    });

    it('does not expose empty assistant skeleton fallbacks as copyable conversation turns', () => {
        document.body.innerHTML = `
          <div id="container">
            <div data-group-root="1">
              <section data-turn="user">skeleton prompt</section>
              <section data-turn="assistant" id="skeleton-root"></section>
            </div>
            <div data-group-root="2">
              <section data-turn="user">real prompt</section>
              <section data-turn="assistant">
                <div class="assistant" data-id="a2" data-prompt="legacy-p2"></div>
              </section>
            </div>
          </div>
        `;

        class SkeletonAwareAdapter extends TestAdapter {
            getConversationGroupRefs(): ConversationGroupRef[] {
                const skeletonRoot = document.getElementById('skeleton-root') as HTMLElement;
                const skeletonMessage = document.createElement('div');
                skeletonMessage.setAttribute('data-aimd-empty-assistant-message', 'true');
                const realMessage = document.querySelector('[data-id="a2"]') as HTMLElement;
                const realRoot = realMessage.closest('[data-turn="assistant"]') as HTMLElement;
                return [
                    {
                        id: 'skeleton',
                        assistantRootEl: skeletonRoot,
                        assistantMessageEl: skeletonMessage,
                        assistantContentRootEl: null,
                        userRootEl: document.querySelector('[data-group-root="1"] [data-turn="user"]') as HTMLElement,
                        userPromptText: 'skeleton prompt',
                        barAnchorEl: skeletonRoot,
                        groupEls: [skeletonRoot],
                        assistantIndex: 0,
                        isStreaming: false,
                    },
                    {
                        id: 'real',
                        assistantRootEl: realRoot,
                        assistantMessageEl: realMessage,
                        assistantContentRootEl: realMessage,
                        userRootEl: document.querySelector('[data-group-root="2"] [data-turn="user"]') as HTMLElement,
                        userPromptText: 'real prompt',
                        barAnchorEl: realRoot,
                        groupEls: [realRoot],
                        assistantIndex: 1,
                        isStreaming: false,
                    },
                ];
            }
        }

        const refs = collectConversationTurnRefs(new SkeletonAwareAdapter());

        expect(refs).toHaveLength(1);
        expect(refs[0]?.userPrompt).toBe('real prompt');
        expect(refs[0]?.messageId).toBe('a2');
    });

    it('falls back to legacy assistant discovery if platform-owned grouping fails', () => {
        document.body.innerHTML = `
          <div id="container">
            <div class="assistant" data-id="a1" data-prompt="p1"></div>
            <div class="assistant" data-id="a2" data-prompt="p2"></div>
          </div>
        `;

        const refs = collectConversationTurnRefs(new BrokenGroupAdapter());

        expect(refs).toHaveLength(2);
        expect(refs.map((ref) => ref.messageId)).toEqual(['a1', 'a2']);
    });
});
