export type PdfPrintPlan = {
    html: string;
    containerId?: string;
};

const DEFAULT_CONTAINER_ID = 'aimd-pdf-export-container';

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
