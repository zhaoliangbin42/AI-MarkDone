import type { Theme } from '../../../../core/types/theme';
import { ensureStyle } from '../../../../style/shadow';
import { getTokenCss } from '../../../../style/tokens';

type OverlayThemeProbeHandle = {
    host: HTMLElement;
    setTheme(theme: Theme): void;
};

function getProbeCss(): string {
    return `
:host {
  display: block;
}

.aimd-overlay-probe {
  display: grid;
  gap: var(--aimd-space-3);
  width: min(100%, 420px);
  padding: var(--aimd-space-4);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-2xl);
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  box-shadow: var(--aimd-shadow-lg);
}

.aimd-overlay-probe__eyebrow {
  font-size: var(--aimd-font-size-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--aimd-text-secondary);
}

.aimd-overlay-probe__body {
  display: flex;
  gap: var(--aimd-space-3);
  align-items: flex-start;
  justify-content: space-between;
}

.aimd-overlay-probe__copy {
  display: grid;
  gap: var(--aimd-space-2);
}

.aimd-overlay-probe__title {
  margin: 0;
  font-size: var(--aimd-text-lg);
  font-weight: var(--aimd-font-semibold);
  line-height: var(--aimd-leading-normal);
}

.aimd-overlay-probe__description {
  margin: 0;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-leading-normal);
}

.aimd-overlay-probe__actions {
  display: flex;
  gap: var(--aimd-space-2);
  align-items: center;
  justify-content: space-between;
}

.aimd-overlay-probe__meta {
  display: flex;
  gap: var(--aimd-space-2);
  align-items: center;
  flex-wrap: wrap;
}

.aimd-overlay-probe__chip {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--aimd-space-1) / 2);
  padding: var(--aimd-space-2) var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
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
  padding: 0 var(--aimd-space-4);
  border: 1px solid transparent;
  border-radius: var(--aimd-radius-lg);
  font: inherit;
  font-weight: var(--aimd-font-medium);
  cursor: default;
}

.aimd-overlay-probe__button--primary {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
}

.aimd-overlay-probe__button--primary:hover {
  background: var(--aimd-interactive-primary-hover);
}

.aimd-overlay-probe__button--secondary {
  border-color: var(--aimd-border-default);
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-primary);
}
`;
}

function createCard(theme: Theme): HTMLElement {
    const card = document.createElement('section');
    card.className = 'aimd-overlay-probe';
    card.innerHTML = `
        <div class="aimd-overlay-probe__eyebrow">Overlay CSS Probe</div>
        <div class="aimd-overlay-probe__body">
            <div class="aimd-overlay-probe__copy">
                <h2 class="aimd-overlay-probe__title">Theme probe (${theme})</h2>
                <p class="aimd-overlay-probe__description">This mock validates canonical AIMD tokens flowing through pure CSS inside Shadow DOM.</p>
            </div>
            <span class="aimd-overlay-probe__chip">live shadow root</span>
        </div>
        <div class="aimd-overlay-probe__meta">
            <span class="aimd-overlay-probe__chip">surface</span>
            <span class="aimd-overlay-probe__chip aimd-overlay-probe__chip--border">border</span>
        </div>
        <div class="aimd-overlay-probe__actions">
            <button class="aimd-overlay-probe__button aimd-overlay-probe__button--primary">Primary</button>
            <button class="aimd-overlay-probe__button aimd-overlay-probe__button--secondary">Secondary</button>
        </div>
    `;
    return card;
}

export function mountOverlayThemeProbe(parent: HTMLElement, theme: Theme): OverlayThemeProbeHandle {
    const host = document.createElement('div');
    host.className = 'aimd-overlay-theme-probe-host';
    host.setAttribute('data-aimd-theme', theme);
    const shadow = host.attachShadow({ mode: 'open' });
    const mount = document.createElement('div');

    const render = (nextTheme: Theme) => {
        host.setAttribute('data-aimd-theme', nextTheme);
        ensureStyle(shadow, getTokenCss(nextTheme), { id: 'aimd-overlay-probe-tokens' });
        ensureStyle(shadow, getProbeCss(), { id: 'aimd-overlay-probe-base', cache: 'shared' });
        mount.className = 'aimd-overlay-probe-mount';
        mount.replaceChildren(createCard(nextTheme));
        if (!mount.isConnected) {
            shadow.appendChild(mount);
        }
    };

    render(theme);
    parent.appendChild(host);

    return {
        host,
        setTheme(nextTheme) {
            render(nextTheme);
        },
    };
}
