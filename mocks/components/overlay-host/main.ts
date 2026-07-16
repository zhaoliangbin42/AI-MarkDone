import '../browserExtensionMock';
import { createAppearanceSnapshot } from '../../../src/style/appearance';
import { OverlaySession } from '../../../src/ui/content/overlay/OverlaySession';
import {
    installVisualHarnessBridge,
    type VisualHarnessLocale,
    type VisualHarnessTheme,
    type VisualHarnessVariant,
} from '../visualHarnessBridge';

type ProbeHandle = {
    session: OverlaySession;
    card: HTMLElement;
};

const stage = document.getElementById('overlay-mock-stage');
const probes: ProbeHandle[] = [];
let visualVariant: VisualHarnessVariant = { theme: 'light', locale: 'en' };

function getProbeCss(): string {
    return `
:host {
  pointer-events: none;
}

*, *::before, *::after {
  box-sizing: border-box;
}

[data-role="overlay-root"],
[data-role="overlay-surface-root"] {
  position: absolute;
  inset: 0;
}

[data-role="overlay-surface-root"] {
  display: flex;
  align-items: center;
  padding: var(--aimd-space-6);
}

:host([data-visual-slot="left"]) [data-role="overlay-surface-root"] {
  justify-content: flex-start;
}

:host([data-visual-slot="right"]) [data-role="overlay-surface-root"] {
  justify-content: flex-end;
}

.aimd-overlay-probe {
  display: grid;
  gap: var(--aimd-space-3);
  width: min(420px, calc(100vw - (var(--aimd-space-6) * 2)));
  padding: var(--aimd-space-4);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-2xl);
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  box-shadow: var(--aimd-shadow-lg);
  font-family: var(--aimd-font-family-sans);
  pointer-events: auto;
}

.aimd-overlay-probe__eyebrow {
  font-size: var(--aimd-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--aimd-text-secondary);
}

.aimd-overlay-probe__body,
.aimd-overlay-probe__copy {
  display: grid;
  gap: var(--aimd-space-2);
  min-width: 0;
}

.aimd-overlay-probe__title,
.aimd-overlay-probe__description {
  margin: 0;
}

.aimd-overlay-probe__title {
  font-size: var(--aimd-text-lg);
  font-weight: var(--aimd-font-semibold);
  line-height: var(--aimd-leading-label);
}

.aimd-overlay-probe__description {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-leading-normal);
}

.aimd-overlay-probe__meta,
.aimd-overlay-probe__actions {
  display: flex;
  gap: var(--aimd-space-2);
  align-items: center;
  flex-wrap: wrap;
}

.aimd-overlay-probe__actions {
  justify-content: flex-end;
}

.aimd-overlay-probe__chip {
  padding: var(--aimd-space-1) var(--aimd-space-2);
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
}

.aimd-overlay-probe__chip--border {
  border: 1px solid var(--aimd-border-strong);
  background: transparent;
}

.aimd-overlay-probe__button {
  min-height: var(--aimd-size-control-action-panel);
  padding: 0 var(--aimd-space-3);
  border: 1px solid transparent;
  border-radius: var(--aimd-radius-lg);
  font: inherit;
  font-weight: var(--aimd-font-medium);
}

.aimd-overlay-probe__button--primary {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
}

.aimd-overlay-probe__button--secondary {
  border-color: var(--aimd-border-default);
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-primary);
}

@media (max-width: 560px) {
  [data-role="overlay-surface-root"] {
    justify-content: center;
    padding: var(--aimd-space-2);
  }

  :host([data-visual-slot="left"]) [data-role="overlay-surface-root"] {
    align-items: flex-start;
    justify-content: center;
  }

  :host([data-visual-slot="right"]) [data-role="overlay-surface-root"] {
    align-items: flex-end;
    justify-content: center;
  }

  .aimd-overlay-probe {
    width: 100%;
    max-height: calc(50vh - var(--aimd-space-3));
    padding: var(--aimd-space-3);
    overflow: auto;
  }

  .aimd-overlay-probe__description,
  .aimd-overlay-probe__meta {
    display: none;
  }
}
`;
}

function createCard(): HTMLElement {
    const card = document.createElement('section');
    card.className = 'aimd-overlay-probe';
    card.setAttribute('role', 'dialog');
    card.innerHTML = `
        <div class="aimd-overlay-probe__eyebrow">Overlay session</div>
        <div class="aimd-overlay-probe__body">
            <div class="aimd-overlay-probe__copy">
                <h2 class="aimd-overlay-probe__title">Shared overlay</h2>
                <p class="aimd-overlay-probe__description">Production OverlaySession with shared appearance, lifecycle, and Shadow DOM tokens.</p>
            </div>
        </div>
        <div class="aimd-overlay-probe__meta">
            <span class="aimd-overlay-probe__chip">AppearanceScope</span>
            <span class="aimd-overlay-probe__chip aimd-overlay-probe__chip--border">SurfaceSession</span>
        </div>
        <div class="aimd-overlay-probe__actions">
            <button class="aimd-overlay-probe__button aimd-overlay-probe__button--secondary">Cancel</button>
            <button class="aimd-overlay-probe__button aimd-overlay-probe__button--primary">Continue</button>
        </div>
    `;
    return card;
}

function mountProbe(slot: 'left' | 'right'): ProbeHandle {
    const session = new OverlaySession({
        id: `aimd-overlay-visual-${slot}`,
        theme: 'light',
        surfaceCss: getProbeCss(),
        surfaceStyleId: 'aimd-overlay-visual-structure',
        overlayStyleId: 'aimd-overlay-visual-extra',
        lockScroll: false,
        profile: 'modal',
    });
    session.host.dataset.visualSlot = slot;
    session.host.dataset.aimdRole = 'overlay-session';
    const card = createCard();
    session.replaceSurface(card);
    session.openSurface({ surface: card });
    return { session, card };
}

if (stage) {
    probes.push(mountProbe('left'), mountProbe('right'));
}

function localizeProbe(theme: VisualHarnessTheme, locale: VisualHarnessLocale): void {
    const copy = locale === 'zh_CN' ? {
        eyebrow: '共享浮层会话',
        title: `生产浮层（${theme === 'dark' ? '深色' : '浅色'}）`,
        description: '真实 OverlaySession 统一外观、生命周期与 Shadow DOM Token。',
        cancel: '取消',
        confirm: '继续',
    } : {
        eyebrow: 'Shared overlay session',
        title: `Production overlay (${theme})`,
        description: 'Production OverlaySession with shared appearance, lifecycle, and Shadow DOM tokens.',
        cancel: 'Cancel',
        confirm: 'Continue',
    };

    for (const { card } of probes) {
        const eyebrow = card.querySelector<HTMLElement>('.aimd-overlay-probe__eyebrow');
        const title = card.querySelector<HTMLElement>('.aimd-overlay-probe__title');
        const description = card.querySelector<HTMLElement>('.aimd-overlay-probe__description');
        const buttons = card.querySelectorAll<HTMLButtonElement>('.aimd-overlay-probe__button');
        if (eyebrow) eyebrow.textContent = copy.eyebrow;
        if (title) title.textContent = copy.title;
        if (description) description.textContent = copy.description;
        if (buttons[0]) buttons[0].textContent = copy.cancel;
        if (buttons[1]) buttons[1].textContent = copy.confirm;
    }
}

function applyVisualVariant(variant: VisualHarnessVariant): void {
    visualVariant = variant;
    document.documentElement.dataset.aimdTheme = variant.theme;
    document.documentElement.dataset.theme = variant.theme;
    document.documentElement.lang = variant.locale === 'zh_CN' ? 'zh-CN' : 'en';
    document.body.dataset.theme = variant.theme;
    for (const { session } of probes) {
        session.setAppearance(createAppearanceSnapshot(variant.theme));
    }
    localizeProbe(variant.theme, variant.locale);
}

installVisualHarnessBridge({
    applyVariant: applyVisualVariant,
    prepareForAudit: () => undefined,
    getState: () => ({
        ...visualVariant,
        expectedOpenSurfaces: [{ role: 'overlay-session', count: probes.length }],
        localeEvidence: probes
            .map(({ card }) => card.querySelector('.aimd-overlay-probe__title')?.textContent ?? '')
            .join(' '),
    }),
});
