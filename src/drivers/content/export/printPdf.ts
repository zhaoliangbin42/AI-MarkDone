import { getKatexCssWithEmbeddedFonts, getKatexStylesheetHref, hasKatexMarkup } from './katexAssets';

export type PdfPrintPlan = {
    html: string;
    containerId?: string;
};

const DEFAULT_CONTAINER_ID = 'aimd-pdf-export-container';
const KATEX_STYLESHEET_TIMEOUT_MS = 1000;
const FONT_READY_TIMEOUT_MS = 1500;

async function waitForDocumentFonts(): Promise<void> {
    try {
        const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
        if (!fonts?.ready) return;
        let timer: number | null = null;
        await Promise.race([
            fonts.ready,
            new Promise<void>((resolve) => {
                timer = window.setTimeout(resolve, FONT_READY_TIMEOUT_MS);
            }),
        ]);
        if (timer !== null) window.clearTimeout(timer);
    } catch {
        // Font readiness is best-effort; the print dialog should still open.
    }
}

function injectKatexStylesheetLink(container: HTMLElement): Promise<void> {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = getKatexStylesheetHref();
    link.dataset.aimdKatexExportCss = '1';

    return new Promise<void>((resolve) => {
        let settled = false;
        let timer: number | null = null;
        const done = () => {
            if (settled) return;
            settled = true;
            link.removeEventListener('load', done);
            link.removeEventListener('error', done);
            if (timer !== null) {
                window.clearTimeout(timer);
                timer = null;
            }
            resolve();
        };

        link.addEventListener('load', done, { once: true });
        link.addEventListener('error', done, { once: true });
        timer = window.setTimeout(done, KATEX_STYLESHEET_TIMEOUT_MS);
        container.prepend(link);
    });
}

async function injectKatexStylesheetIfNeeded(container: HTMLElement, html: string): Promise<void> {
    if (!hasKatexMarkup(html)) return Promise.resolve();

    try {
        const fontEmbed = await getKatexCssWithEmbeddedFonts(html);
        if (fontEmbed.mode === 'data-url' && fontEmbed.css) {
            const style = document.createElement('style');
            style.dataset.aimdKatexExportCss = '1';
            style.textContent = fontEmbed.css;
            container.prepend(style);
            return;
        }
    } catch {
        // Fall back to the local stylesheet URL so export remains best-effort.
    }

    await injectKatexStylesheetLink(container);
}

export async function printPdf(plan: PdfPrintPlan): Promise<void> {
    const html = (plan?.html || '').trim();
    if (!html) return;

    const containerId = plan.containerId || DEFAULT_CONTAINER_ID;

    // Remove any previous container (defensive)
    const existing = document.getElementById(containerId);
    existing?.remove();

    const printContainer = document.createElement('div');
    printContainer.id = containerId;

    const parsed = new DOMParser().parseFromString(`<div id="aimd-pdf-root">${html}</div>`, 'text/html');
    const wrapper = parsed.getElementById('aimd-pdf-root');
    if (wrapper) {
        const fragment = document.createDocumentFragment();
        Array.from(wrapper.childNodes).forEach((node) => fragment.appendChild(document.importNode(node, true)));
        printContainer.replaceChildren(fragment);
    }

    document.body.appendChild(printContainer);
    await injectKatexStylesheetIfNeeded(printContainer, html);
    await waitForDocumentFonts();

    let cleaned = false;
    let cleanupTimer: number | null = null;

    const cleanup = (): void => {
        if (cleaned) return;
        cleaned = true;
        window.removeEventListener('afterprint', cleanup);
        if (cleanupTimer !== null) {
            window.clearTimeout(cleanupTimer);
            cleanupTimer = null;
        }
        printContainer.remove();
    };

    window.addEventListener('afterprint', cleanup);
    cleanupTimer = window.setTimeout(() => cleanup(), 30000);

    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            try {
                window.print();
            } catch {
                cleanup();
            }
        });
    });
}
