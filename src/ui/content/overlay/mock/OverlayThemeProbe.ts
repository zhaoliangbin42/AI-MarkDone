import type { Theme } from '../../../../core/types/theme';
import { ensureStyle } from '../../../../style/shadow';
import { getTokenCss } from '../../../../style/tokens';
import overlayCssText from '../../../../style/tailwind-overlay.css?inline';

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
}

.aimd-overlay-probe__eyebrow {
  font-size: var(--aimd-font-size-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
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
}
`;
}

function createCard(theme: Theme): HTMLElement {
    const card = document.createElement('section');
    card.className = 'aimd-overlay-probe tw:bg-surface tw:text-text-primary tw:border tw:border-border-default tw:shadow-overlay tw:rounded-panel tw:p-overlay-4';
    card.innerHTML = `
        <div class="aimd-overlay-probe__eyebrow tw:text-text-secondary">Overlay Tailwind Alias</div>
        <div class="tw:flex tw:items-start tw:justify-between tw:gap-overlay-3">
            <div class="tw:grid tw:gap-overlay-2">
                <h2 class="tw:text-lg tw:font-semibold">Theme probe (${theme})</h2>
                <p class="tw:text-text-secondary">This mock validates canonical AIMD tokens flowing through Tailwind aliases inside Shadow DOM.</p>
            </div>
            <span class="aimd-overlay-probe__chip tw:bg-surface-secondary tw:text-text-secondary tw:rounded-control tw:px-overlay-3 tw:py-overlay-2">
                live shadow root
            </span>
        </div>
        <div class="aimd-overlay-probe__meta">
            <span class="aimd-overlay-probe__chip tw:bg-surface-secondary tw:text-text-secondary tw:rounded-control tw:px-overlay-3 tw:py-overlay-2">surface</span>
            <span class="aimd-overlay-probe__chip tw:border tw:border-border-strong tw:text-text-secondary tw:rounded-control tw:px-overlay-3 tw:py-overlay-2">border</span>
        </div>
        <div class="aimd-overlay-probe__actions">
            <button class="tw:bg-interactive tw:text-on-interactive hover:tw:bg-interactive-hover tw:rounded-control tw:px-overlay-4 tw:py-overlay-2">Primary</button>
            <button class="tw:bg-surface-secondary tw:text-text-primary tw:border tw:border-border-default tw:rounded-control tw:px-overlay-4 tw:py-overlay-2">Secondary</button>
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
        ensureStyle(shadow, overlayCssText, { id: 'aimd-overlay-tailwind', cache: 'shared' });
        ensureStyle(shadow, getProbeCss(), { id: 'aimd-overlay-probe-base', cache: 'shared' });
        mount.className = 'tw:bg-transparent';
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
