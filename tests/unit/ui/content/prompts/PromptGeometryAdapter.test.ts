import { afterEach, describe, expect, it, vi } from 'vitest';
import { PromptGeometryAdapter } from '@/ui/content/prompts/PromptGeometryAdapter';

function rect(left: number, top: number, width: number, height: number): DOMRect {
    return { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({}) } as DOMRect;
}

describe('PromptGeometryAdapter', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
        document.body.innerHTML = '';
    });

    it('clamps a manager to an offset visual viewport and retains its page-session placement', () => {
        const visualViewport = new EventTarget() as VisualViewport;
        Object.defineProperties(visualViewport, {
            offsetLeft: { configurable: true, value: 40 },
            offsetTop: { configurable: true, value: 20 },
            width: { configurable: true, value: 320 },
            height: { configurable: true, value: 568 },
        });
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });
        const composer = document.createElement('textarea');
        const host = document.createElement('div');
        const root = document.createElement('div');
        document.body.append(composer, host);
        host.appendChild(root);
        vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 288, 420));
        vi.spyOn(composer, 'getBoundingClientRect').mockReturnValue(rect(280, 520, 40, 32));
        const geometry = new PromptGeometryAdapter(() => composer);

        geometry.position({ mode: 'manager', host, root, anchor: composer, promptCount: 4, hasStatus: false });
        expect(Number.parseFloat(host.style.left)).toBeGreaterThanOrEqual(56);
        expect(Number.parseFloat(host.style.top)).toBeGreaterThanOrEqual(36);
        expect(Number.parseFloat(host.style.left) + 288).toBeLessThanOrEqual(344);
        expect(host.style.getPropertyValue('--_prompt-popover-max-height')).toBe('536px');
        expect(host.style.getPropertyValue('--aimd-prompt-popover-max-height')).toBe('');

        geometry.setManagerPlacement({ left: 999, top: 999 });
        geometry.position({ mode: 'manager', host, root, anchor: composer, promptCount: 4, hasStatus: false });
        expect(geometry.managerPlacement).toEqual({ left: 56, top: 152 });
    });

    it('owns panel and list drag listeners and returns one cleanup path', () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
        const host = document.createElement('div');
        const root = document.createElement('div');
        document.body.appendChild(host);
        host.appendChild(root);
        vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 520, 300));
        const geometry = new PromptGeometryAdapter(() => null);

        geometry.startPanelDrag(new MouseEvent('pointerdown', { button: 0, clientX: 100, clientY: 100 }) as PointerEvent, {
            mode: 'manager', host, root, promptCount: 2, hasStatus: false,
        });
        document.dispatchEvent(new MouseEvent('pointermove', { clientX: 400, clientY: 400 }));
        document.dispatchEvent(new MouseEvent('pointerup'));
        expect(geometry.managerPlacement).not.toBeNull();

        const onTarget = vi.fn();
        const onEnd = vi.fn();
        geometry.startListDrag(new MouseEvent('pointerdown') as PointerEvent, {
            sourceId: 'one',
            getTargetIdAt: () => 'two',
            onTarget,
            onEnd,
        });
        document.dispatchEvent(new MouseEvent('pointermove', { clientY: 200 }));
        document.dispatchEvent(new MouseEvent('pointerup'));
        expect(onTarget).toHaveBeenCalledWith('two');
        expect(onEnd).toHaveBeenCalledWith(true);
        geometry.destroyTransient();
    });
});
