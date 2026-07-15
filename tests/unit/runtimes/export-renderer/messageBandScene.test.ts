import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    activateMessageBandScene,
    indexMessageBandScene,
} from '../../../../src/runtimes/export-renderer/messageBandScene';

type Box = { left: number; top: number; width: number; height: number };

function box(element: Element, value: Box): void {
    (element as HTMLElement).dataset.testBox = [value.left, value.top, value.width, value.height].join(',');
}

function installGeometry(): void {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
        const values = (this.dataset.testBox ?? '0,0,1,1').split(',').map(Number);
        const original = {
            left: values[0]!,
            top: values[1]!,
            width: values[2]!,
            height: values[3]!,
        };
        const projected = this.style.position === 'absolute';
        const parentRect = projected ? this.parentElement?.getBoundingClientRect() : null;
        const left = parentRect
            ? parentRect.left + (Number.parseFloat(this.style.left) || 0)
            : original.left;
        const top = parentRect
            ? parentRect.top + (Number.parseFloat(this.style.top) || 0)
            : original.top;
        const width = Number.parseFloat(this.style.width) || original.width;
        const height = Number.parseFloat(this.style.height) || original.height;
        return {
            x: left,
            y: top,
            left,
            top,
            right: left + width,
            bottom: top + height,
            width,
            height,
            toJSON: () => ({}),
        };
    });
}

function createScene(blockTag = 'p'): {
    source: HTMLElement;
    card: HTMLElement;
    first: HTMLElement;
    second: HTMLElement;
} {
    const source = document.createElement('div');
    source.innerHTML = `
        <div class="aimd-png-export-card" style="color: rgb(1, 2, 3)">
            <section class="message-section" style="border-top: 1px solid rgb(10, 20, 30)">
                <div class="message-header">Heading</div>
                <div class="user-prompt">Prompt</div>
                <div class="assistant-response">
                    <div class="assistant-response-label">Assistant</div>
                    <div class="reader-markdown">
                        <${blockTag} data-test-block="first">First block</${blockTag}>
                        <p data-test-block="second">Second block</p>
                    </div>
                </div>
            </section>
        </div>
    `;
    document.body.appendChild(source);
    const card = source.querySelector<HTMLElement>('.aimd-png-export-card')!;
    const section = source.querySelector<HTMLElement>('.message-section')!;
    const header = source.querySelector<HTMLElement>('.message-header')!;
    const prompt = source.querySelector<HTMLElement>('.user-prompt')!;
    const assistant = source.querySelector<HTMLElement>('.assistant-response')!;
    const label = source.querySelector<HTMLElement>('.assistant-response-label')!;
    const markdown = source.querySelector<HTMLElement>('.reader-markdown')!;
    const first = source.querySelector<HTMLElement>('[data-test-block="first"]')!;
    const second = source.querySelector<HTMLElement>('[data-test-block="second"]')!;

    box(source, { left: 0, top: 0, width: 360, height: 1_200 });
    box(card, { left: 0, top: 0, width: 360, height: 1_200 });
    box(section, { left: 0, top: 0, width: 360, height: 1_200 });
    box(header, { left: 20, top: 20, width: 320, height: 40 });
    box(prompt, { left: 20, top: 80, width: 320, height: 120 });
    box(assistant, { left: 20, top: 220, width: 320, height: 980 });
    box(label, { left: 20, top: 220, width: 320, height: 30 });
    box(markdown, { left: 20, top: 260, width: 320, height: 940 });
    box(first, { left: 20, top: 260, width: 320, height: 240 });
    box(second, { left: 20, top: 700, width: 320, height: 300 });
    return { source, card, first, second };
}

describe('messageBandScene', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        document.body.replaceChildren();
    });

    it('projects only the active band and restores the original DOM styles exactly once', () => {
        installGeometry();
        const { source, card, first, second } = createScene();
        const originalCardStyle = card.style.cssText;
        const originalFirstStyle = first.style.cssText;
        const index = indexMessageBandScene(source);

        expect(index).not.toBeNull();
        const active = activateMessageBandScene(index!, 0, 600, 1);

        expect(active).not.toBeNull();
        expect(active!.sourceTopCssPx).toBe(0);
        expect(active!.filter(first)).toBe(true);
        expect(active!.filter(second)).toBe(false);
        expect(card.style.height).toBe('600px');
        expect(card.querySelectorAll('[data-aimd-band-scene-divider="true"]')).toHaveLength(1);

        active!.restore();
        active!.restore();
        expect(card.style.cssText).toBe(originalCardStyle);
        expect(first.style.cssText).toBe(originalFirstStyle);
        expect(card.querySelector('[data-aimd-band-scene-divider="true"]')).toBeNull();
    });

    it('falls back before mutating an oversized structured block', () => {
        installGeometry();
        const { source, card, first } = createScene('ol');
        box(first, { left: 20, top: 260, width: 320, height: 800 });
        const originalCardStyle = card.style.cssText;
        const originalFirstStyle = first.style.cssText;
        const index = indexMessageBandScene(source);

        expect(index).not.toBeNull();
        expect(activateMessageBandScene(index!, 0, 600, 1)).toBeNull();
        expect(card.style.cssText).toBe(originalCardStyle);
        expect(first.style.cssText).toBe(originalFirstStyle);
        expect(card.querySelector('[data-aimd-band-scene-divider="true"]')).toBeNull();
    });
});
