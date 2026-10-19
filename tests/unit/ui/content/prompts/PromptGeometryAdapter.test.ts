import { afterEach, describe, expect, it, vi } from 'vitest';
import { PromptGeometryAdapter } from '@/ui/content/prompts/PromptGeometryAdapter';

function rect(left: number, top: number, width: number, height: number): DOMRect {
    return { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({}) } as DOMRect;
}

describe('PromptGeometryAdapter', () => {
    it.each([{ top: 0, height: 400, caretTop: 200 }, { top: 200, height: 160, caretTop: 280 }, { top: 0, height: 600, caretTop: 40 }])('fits candidates beside the caret without covering it in viewport $top/$height', frame => {
        const visualViewport = new EventTarget() as VisualViewport;
        Object.assign(visualViewport, { offsetLeft: 20, offsetTop: frame.top, width: 320, height: frame.height });
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });
        const composer = document.createElement('textarea'), host = document.createElement('div'), root = document.createElement('div');
        document.body.append(composer, host); host.append(root);
        vi.spyOn(composer, 'getBoundingClientRect').mockReturnValue(rect(60, frame.caretTop, 260, 80));
        vi.spyOn(root, 'getBoundingClientRect').mockImplementation(() => rect(0, 0, 288, Math.min(240, Number.parseFloat(host.style.getPropertyValue('--_prompt-popover-max-height')) || 240)));
        const geometry = new PromptGeometryAdapter(() => composer);
        geometry.position({ mode: 'autocomplete', host, root, anchor: composer, promptCount: 10, hasStatus: false });
        const popupTop = Number.parseFloat(host.style.top), popupHeight = root.getBoundingClientRect().height;
        expect(popupTop).toBeGreaterThanOrEqual(frame.top);
        expect(popupTop + popupHeight).toBeLessThanOrEqual(frame.top + frame.height);
        expect(popupTop + popupHeight <= frame.caretTop || popupTop >= frame.caretTop + 16).toBe(true);
        expect(Number.parseFloat(host.style.left) + Number.parseFloat(host.style.width)).toBeLessThanOrEqual(340);
    });

    it('follows composer scroll inside a shadow root and removes that listener when destroyed', () => {
        const host = document.createElement('div'); document.body.append(host);
        const composer = document.createElement('textarea'); host.attachShadow({ mode: 'open' }).append(composer);
        const geometry = new PromptGeometryAdapter(() => composer);
        const readLayout = vi.fn(() => null);
        const positioner = geometry.createPositioner(readLayout);
        composer.dispatchEvent(new Event('scroll', { bubbles: false, composed: false }));
        expect(readLayout).toHaveBeenCalledTimes(1);
        positioner.destroy();
        composer.dispatchEvent(new Event('scroll', { bubbles: false, composed: false }));
        expect(readLayout).toHaveBeenCalledTimes(1);
    });

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

    it('owns panel drag listeners and removes them on teardown', () => {
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
        const placement = geometry.managerPlacement;
        expect(placement).not.toBeNull();
        geometry.destroyTransient();
        document.dispatchEvent(new MouseEvent('pointermove', { clientX: 700, clientY: 100 }));
        expect(geometry.managerPlacement).toEqual(placement);
    });
});
