import { chromium, type Page } from '@playwright/test';
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

import type {
    VisualHarnessState,
    VisualHarnessVariant,
} from '../mocks/components/visualHarnessBridge';
import { uiSurfaceCoverage } from '../tests/support/uiSurfaceCoverage';

type HarnessMode = 'smoke' | 'full';
type Theme = 'light' | 'dark';
type Locale = 'en' | 'zh_CN';
type Motion = 'no-preference' | 'reduce';
type LayoutMode = 'native' | 'zoom-reflow-equivalent';

type VisualVariant = {
    name: string;
    width: number;
    height: number;
    theme: Theme;
    locale: Locale;
    motion: Motion;
    layoutMode: LayoutMode;
    zoomPercent: 100 | 200;
    physicalWidth: number;
    physicalHeight: number;
};

type ViewportAudit = {
    horizontalOverflow: number;
    surfaceViolations: Array<{
        name: string;
        left: number;
        top: number;
        right: number;
        bottom: number;
    }>;
    switchGeometryViolations: Array<{
        name: string;
        checked: boolean;
        left: number;
        right: number;
        top: number;
        bottom: number;
    }>;
    bookmarkGeometryViolations: string[];
};

type CaseResult = {
    mockPath: string;
    variant: VisualVariant;
    screenshot: string;
    title: string;
    errors: string[];
    audit: ViewportAudit;
};

type AppliedVariant = {
    errors: string[];
    state: VisualHarnessState | null;
};

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MOCKS_ROOT = resolve(REPO_ROOT, 'mocks', 'components');
const OUTPUT_ROOT = resolve(REPO_ROOT, 'output', 'ui-visual');

const SMOKE_MOCK_ORDER = [
    'mocks/components/input-enhancement/index.html',
    'mocks/components/formula-composer-assistant/index.html',
    'mocks/components/formula-asset-actions/index.html',
    'mocks/components/workflow-dialogs/index.html',
    'mocks/components/reader-panel/index.html',
    'mocks/components/bookmarks-workspace/index.html',
    'mocks/components/host-integrated-controls/index.html',
    'mocks/components/overlay-host/index.html',
    'mocks/components/unsupported-popup/index.html',
] as const;

const FULL_VIEWPORTS = [
    { name: 'mobile-320', width: 320, height: 568 },
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'tablet-768', width: 768, height: 900 },
    { name: 'desktop-short-1024', width: 1024, height: 568 },
    { name: 'desktop-1440', width: 1440, height: 900 },
] as const;

// A 640x1136 browser viewport at 200% zoom exposes an approximately
// 320x568 CSS layout viewport. One reflow case per direct fixture keeps zoom
// coverage complete without multiplying the entire theme/locale/motion matrix.
const REFLOW_200_VARIANT: VisualVariant = {
    name: 'reflow-200pct-320-equivalent-light-zh_CN-reduce',
    width: 320,
    height: 568,
    physicalWidth: 640,
    physicalHeight: 1136,
    zoomPercent: 200,
    layoutMode: 'zoom-reflow-equivalent',
    theme: 'light',
    locale: 'zh_CN',
    motion: 'reduce',
};

function parseMode(argv: readonly string[], env: NodeJS.ProcessEnv): HarnessMode {
    return argv.includes('--full') || env.AIMD_UI_VISUAL_FULL === '1' ? 'full' : 'smoke';
}

function toSafeMockPath(mockPath: string): string {
    const manifestPath = mockPath.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
    const normalized = /^mocks\/components\/[a-z0-9-]+$/.test(manifestPath)
        ? `${manifestPath}/index.html`
        : manifestPath;
    if (!/^mocks\/components\/[a-z0-9-]+\/index\.html$/.test(normalized)) {
        throw new Error(`Unsafe or unsupported UI mock path: ${mockPath}`);
    }

    const absolutePath = resolve(REPO_ROOT, normalized);
    if (!existsSync(absolutePath)) {
        throw new Error(`UI mock does not exist: ${normalized}`);
    }

    const realMockPath = realpathSync(absolutePath);
    const relativeToMocks = relative(realpathSync(MOCKS_ROOT), realMockPath);
    if (relativeToMocks.startsWith(`..${sep}`) || relativeToMocks === '..') {
        throw new Error(`UI mock escapes the mock root: ${normalized}`);
    }
    return normalized;
}

function discoverManifestMocks(): string[] {
    const mockPaths = uiSurfaceCoverage.flatMap((entry) => {
        const evidence = entry.visualEvidence;
        return evidence.status === 'direct-mock' ? [toSafeMockPath(evidence.mockPath)] : [];
    });
    return [...new Set(mockPaths)].sort();
}

function selectRequestedMock(argv: readonly string[], discovered: readonly string[]): string[] | null {
    const arg = argv.find((arg) => arg.startsWith('--mock='));
    if (!arg) return null;
    const requested = arg.slice('--mock='.length).trim();
    const candidate = requested.startsWith('mocks/components/')
        ? requested
        : `mocks/components/${requested}`;
    const mockPath = toSafeMockPath(candidate);
    if (!discovered.includes(mockPath)) {
        throw new Error(`Requested UI mock is not a direct manifest fixture: ${mockPath}`);
    }
    return [mockPath];
}

function selectMocks(mode: HarnessMode, discovered: readonly string[]): string[] {
    if (discovered.length === 0) {
        throw new Error('The active UI surface manifest has no direct real-component mocks.');
    }
    if (mode === 'full') return [...discovered];

    const discoveredSet = new Set(discovered);
    const preferred = SMOKE_MOCK_ORDER.filter((path) => discoveredSet.has(path));
    return preferred.length > 0 ? preferred : discovered.slice(0, 3);
}

function createVariants(mode: HarnessMode): VisualVariant[] {
    if (mode === 'smoke') {
        return [{
            name: 'desktop-1440-light-en-motion',
            width: 1440,
            height: 900,
            physicalWidth: 1440,
            physicalHeight: 900,
            zoomPercent: 100,
            layoutMode: 'native',
            theme: 'light',
            locale: 'en',
            motion: 'no-preference',
        }];
    }

    const variants: VisualVariant[] = [];
    for (const viewport of FULL_VIEWPORTS) {
        for (const theme of ['light', 'dark'] as const) {
            for (const locale of ['en', 'zh_CN'] as const) {
                for (const motion of ['no-preference', 'reduce'] as const) {
                    variants.push({
                        ...viewport,
                        name: `${viewport.name}-${theme}-${locale}-${motion}`,
                        physicalWidth: viewport.width,
                        physicalHeight: viewport.height,
                        zoomPercent: 100,
                        layoutMode: 'native',
                        theme,
                        locale,
                        motion,
                    });
                }
            }
        }
    }
    return [...variants, REFLOW_200_VARIANT];
}

function slug(value: string): string {
    return value.replace(/^mocks\/components\//, '').replace(/\/index\.html$/, '').replace(/[^a-z0-9-]+/gi, '-');
}

async function applyVariant(page: Page, variant: VisualVariant): Promise<AppliedVariant> {
    await page.emulateMedia({ reducedMotion: variant.motion });
    const requested: VisualHarnessVariant = { theme: variant.theme, locale: variant.locale };
    const bridgeAvailable = await page.evaluate(() => Boolean(window.__AIMD_VISUAL_HARNESS__));
    if (!bridgeAvailable) {
        return { errors: ['harness: programmatic visual bridge is unavailable'], state: null };
    }

    await page.evaluate(async (nextVariant) => {
        await window.__AIMD_VISUAL_HARNESS__?.applyVariant(nextVariant);
        await window.__AIMD_VISUAL_HARNESS__?.prepareForAudit();
    }, requested);
    await page.waitForTimeout(variant.motion === 'reduce' ? 50 : 250);

    const state = await page.evaluate(() => window.__AIMD_VISUAL_HARNESS__?.getState() ?? null);
    if (!state) return { errors: ['harness: programmatic visual bridge returned no state'], state: null };

    const errors: string[] = [];
    if (state.theme !== variant.theme) {
        errors.push(`harness: requested ${variant.theme} theme but mock reported ${state.theme}`);
    }
    if (state.locale !== variant.locale) {
        errors.push(`harness: requested ${variant.locale} locale but mock reported ${state.locale}`);
    }
    if (variant.locale === 'zh_CN' && !/[\u3400-\u9fff]/u.test(state.localeEvidence)) {
        errors.push('harness: mock did not render Chinese locale evidence');
    }

    for (const expectation of state.expectedOpenSurfaces) {
        const openCount = await page.evaluate((role) => {
            const collectSurfaceElementsAcrossRoots: HTMLElement[] = [];
            const pending: ParentNode[] = [document];
            const selector = `[data-aimd-role="${role}"]`;
            while (pending.length > 0) {
                const root = pending.pop();
                if (!root) break;
                collectSurfaceElementsAcrossRoots.push(...root.querySelectorAll<HTMLElement>(selector));
                for (const element of root.querySelectorAll<HTMLElement>('*')) {
                    if (element.shadowRoot) pending.push(element.shadowRoot);
                }
            }

            return collectSurfaceElementsAcrossRoots
                .filter((element) => {
                    const style = getComputedStyle(element);
                    const rect = element.getBoundingClientRect();
                    return !element.hidden
                        && style.display !== 'none'
                        && style.visibility !== 'hidden'
                        && rect.width > 0
                        && rect.height > 0;
                }).length;
        }, expectation.role);
        if (openCount !== expectation.count) {
            errors.push(`harness: ${expectation.role} did not remain open (${openCount}/${expectation.count})`);
        }
    }

    return { errors, state };
}

async function auditViewport(page: Page): Promise<ViewportAudit> {
    return page.evaluate(() => {
        const tolerance = 1;
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        const scrollingElement = document.scrollingElement ?? document.documentElement;
        const horizontalOverflow = Math.max(0, scrollingElement.scrollWidth - viewportWidth);
        const surfaceViolations: ViewportAudit['surfaceViolations'] = [];
        const switchGeometryViolations: ViewportAudit['switchGeometryViolations'] = [];
        const bookmarkGeometryViolations: ViewportAudit['bookmarkGeometryViolations'] = [];
        const surfaceSelector = [
            '[data-aimd-role]',
            '[aria-modal="true"]',
            '[role="dialog"]',
            '[role="listbox"]',
            '[role="menu"]',
            '[role="tooltip"]',
        ].join(',');

        const pending: Array<{ element: Element; hasFixedAncestor: boolean }> = [];
        for (const child of document.children) pending.push({ element: child, hasFixedAncestor: false });

        while (pending.length > 0) {
            const next = pending.pop();
            if (!next) break;
            const { element, hasFixedAncestor } = next;
            const style = getComputedStyle(element);
            const isFixed = hasFixedAncestor || style.position === 'fixed';
            const rect = element.getBoundingClientRect();
            const isVisible = !element.hasAttribute('hidden')
                && style.display !== 'none'
                && style.visibility !== 'hidden'
                && rect.width > 0
                && rect.height > 0;

            if (isVisible && isFixed && element.matches(surfaceSelector)) {
                const outsideViewport = rect.left < -tolerance
                    || rect.top < -tolerance
                    || rect.right > viewportWidth + tolerance
                    || rect.bottom > viewportHeight + tolerance;
                if (outsideViewport) {
                    const htmlElement = element as HTMLElement;
                    surfaceViolations.push({
                        name: htmlElement.dataset.aimdRole
                            || element.getAttribute('role')
                            || element.tagName.toLowerCase(),
                        left: Math.round(rect.left),
                        top: Math.round(rect.top),
                        right: Math.round(rect.right),
                        bottom: Math.round(rect.bottom),
                    });
                }
            }

            if (isVisible && element.hasAttribute('data-aimd-switch-track')) {
                const input = element.previousElementSibling;
                const thumbStyle = getComputedStyle(element, '::after');
                const thumbWidth = Number.parseFloat(thumbStyle.width);
                const thumbHeight = Number.parseFloat(thumbStyle.height);
                const transform = thumbStyle.transform === 'none'
                    ? new DOMMatrixReadOnly()
                    : new DOMMatrixReadOnly(thumbStyle.transform);
                const left = Number.parseFloat(style.borderLeftWidth)
                    + Number.parseFloat(style.paddingLeft)
                    + transform.m41;
                const top = Number.parseFloat(style.borderTopWidth)
                    + Number.parseFloat(style.paddingTop)
                    + transform.m42;
                const right = rect.width - left - thumbWidth;
                const bottom = rect.height - top - thumbHeight;
                const checked = input instanceof HTMLInputElement && input.checked;
                const activeEdge = checked ? right : left;
                const tolerancePx = 0.5;
                if (Math.abs(top - bottom) > tolerancePx || Math.abs(activeEdge - top) > tolerancePx) {
                    switchGeometryViolations.push({
                        name: input?.getAttribute('aria-label') || 'switch',
                        checked,
                        left: Math.round(left * 100) / 100,
                        right: Math.round(right * 100) / 100,
                        top: Math.round(top * 100) / 100,
                        bottom: Math.round(bottom * 100) / 100,
                    });
                }
            }

            if (isVisible && element.matches('.bookmark-kind-filter')) {
                const toolbar = element.closest('.toolbar-row--bookmarks');
                const toolbarRect = toolbar?.getBoundingClientRect();
                if (toolbarRect && (rect.left < toolbarRect.left - tolerance || rect.right > toolbarRect.right + tolerance)) {
                    bookmarkGeometryViolations.push('bookmark filter is clipped by its toolbar');
                }
            }

            if (isVisible && element.matches('.tree-item--bookmark')) {
                const metadata = [
                    element.querySelector('.tree-kind-badge'),
                    element.querySelector('.tree-label--bookmark'),
                    element.querySelector('.tree-subtitle'),
                ].filter((candidate): candidate is Element => {
                    if (!candidate) return false;
                    const candidateStyle = getComputedStyle(candidate);
                    const candidateRect = candidate.getBoundingClientRect();
                    return candidateStyle.display !== 'none'
                        && candidateStyle.visibility !== 'hidden'
                        && Number.parseFloat(candidateStyle.opacity || '1') > 0
                        && candidateRect.width > 0
                        && candidateRect.height > 0;
                });

                for (let index = 0; index < metadata.length; index += 1) {
                    const first = metadata[index]!.getBoundingClientRect();
                    for (let otherIndex = index + 1; otherIndex < metadata.length; otherIndex += 1) {
                        const second = metadata[otherIndex]!.getBoundingClientRect();
                        const overlaps = first.left < second.right - tolerance
                            && first.right > second.left + tolerance
                            && first.top < second.bottom - tolerance
                            && first.bottom > second.top + tolerance;
                        if (overlaps) {
                            bookmarkGeometryViolations.push('bookmark content overlaps within a tree row');
                        }
                    }
                }
            }

            for (const child of element.children) pending.push({ element: child, hasFixedAncestor: isFixed });
            if (element.shadowRoot) {
                for (const child of element.shadowRoot.children) pending.push({ element: child, hasFixedAncestor: isFixed });
            }
        }
        return { horizontalOverflow, surfaceViolations, switchGeometryViolations, bookmarkGeometryViolations };
    });
}

async function runCase(params: {
    baseUrl: string;
    browser: Awaited<ReturnType<typeof chromium.launch>>;
    mockPath: string;
    outputDir: string;
    variant: VisualVariant;
}): Promise<CaseResult> {
    const locale = params.variant.locale === 'zh_CN' ? 'zh-CN' : 'en-US';
    const context = await params.browser.newContext({
        locale,
        viewport: { width: params.variant.width, height: params.variant.height },
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
    });

    const screenshotName = `${slug(params.mockPath)}--${params.variant.name}.png`;
    const screenshotPath = resolve(params.outputDir, screenshotName);
    try {
        const response = await page.goto(`${params.baseUrl}/${params.mockPath}`, { waitUntil: 'networkidle' });
        if (!response?.ok()) errors.push(`navigation: HTTP ${response?.status() ?? 'no response'}`);
        await page.waitForFunction(() => document.readyState === 'complete');
        const appliedVariant = await applyVariant(page, params.variant);
        errors.push(...appliedVariant.errors);

        const identity = await page.evaluate(() => ({
            title: document.title.trim(),
            textLength: document.body.innerText.trim().length,
            viteOverlay: Boolean(document.querySelector('vite-error-overlay')),
        }));
        if (!identity.title) errors.push('identity: document title is empty');
        if (identity.textLength < 20) errors.push('identity: page has no meaningful visible content');
        if (identity.viteOverlay) errors.push('runtime: Vite error overlay is visible');

        const audit = await auditViewport(page);
        if (audit.horizontalOverflow > 1) {
            errors.push(`layout: page overflows horizontally by ${audit.horizontalOverflow}px`);
        }
        for (const surface of audit.surfaceViolations) {
            errors.push(`layout: ${surface.name} escapes viewport (${surface.left},${surface.top})-(${surface.right},${surface.bottom})`);
        }
        for (const control of audit.switchGeometryViolations) {
            errors.push(`layout: ${control.name} switch thumb is not centered (left ${control.left}, right ${control.right}, top ${control.top}, bottom ${control.bottom})`);
        }
        for (const violation of audit.bookmarkGeometryViolations) {
            errors.push(`layout: ${violation}`);
        }

        await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
        return {
            mockPath: params.mockPath,
            variant: params.variant,
            screenshot: relative(REPO_ROOT, screenshotPath),
            title: identity.title,
            errors,
            audit,
        };
    } finally {
        await context.close();
    }
}

async function auditOverlayPointerSafety(params: {
    baseUrl: string;
    browser: Awaited<ReturnType<typeof chromium.launch>>;
}): Promise<void> {
    const context = await params.browser.newContext({ viewport: { width: 800, height: 600 } });
    const page = await context.newPage();
    try {
        await page.goto(`${params.baseUrl}/mocks/components/unsupported-popup/index.html`, { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            document.body.replaceChildren();
            const pageProbe = document.createElement('button');
            pageProbe.id = 'aimd-overlay-pointer-page-probe';
            pageProbe.style.cssText = 'position:fixed;left:20px;top:20px;width:120px;height:48px;';
            document.body.appendChild(pageProbe);

            const { mountOverlaySurfaceHost } = await import('/src/ui/content/overlay/OverlaySurfaceHost.ts');
            const handle = mountOverlaySurfaceHost({
                id: 'aimd-overlay-pointer-audit-host',
                surfaceCss: '',
                lockScroll: false,
            });
            const surfaceProbe = document.createElement('button');
            surfaceProbe.id = 'aimd-overlay-pointer-surface-probe';
            surfaceProbe.style.cssText = 'position:fixed;left:300px;top:250px;width:200px;height:80px;';
            handle.surfaceRoot.appendChild(surfaceProbe);

            (window as any).__AIMD_OVERLAY_POINTER_AUDIT__ = {
                handle,
                pageClicks: 0,
                surfaceClicks: 0,
            };
            pageProbe.addEventListener('click', () => {
                (window as any).__AIMD_OVERLAY_POINTER_AUDIT__.pageClicks += 1;
            });
            surfaceProbe.addEventListener('click', () => {
                (window as any).__AIMD_OVERLAY_POINTER_AUDIT__.surfaceClicks += 1;
            });
        });

        const hitTest = await page.evaluate(() => {
            const audit = (window as any).__AIMD_OVERLAY_POINTER_AUDIT__;
            const pageHit = document.elementFromPoint(80, 44);
            const surfaceDocumentHit = document.elementFromPoint(400, 290);
            const surfaceShadowHit = audit.handle.shadow.elementFromPoint(400, 290);
            return {
                pageHitId: pageHit?.id ?? '',
                surfaceDocumentHitIsHost: surfaceDocumentHit === audit.handle.host,
                surfaceShadowHitId: surfaceShadowHit?.id ?? '',
            };
        });
        await page.mouse.click(80, 44);
        await page.mouse.click(400, 290);
        const clicks = await page.evaluate(() => {
            const audit = (window as any).__AIMD_OVERLAY_POINTER_AUDIT__;
            return { pageClicks: audit.pageClicks, surfaceClicks: audit.surfaceClicks };
        });

        if (
            hitTest.pageHitId !== 'aimd-overlay-pointer-page-probe'
            || !hitTest.surfaceDocumentHitIsHost
            || hitTest.surfaceShadowHitId !== 'aimd-overlay-pointer-surface-probe'
            || clicks.pageClicks !== 1
            || clicks.surfaceClicks !== 1
        ) {
            throw new Error(`overlay pointer safety failed: ${JSON.stringify({ hitTest, clicks })}`);
        }
        process.stdout.write('PASS overlay pointer safety\n');
    } finally {
        await page.evaluate(() => {
            (window as any).__AIMD_OVERLAY_POINTER_AUDIT__?.handle?.unmount?.();
            delete (window as any).__AIMD_OVERLAY_POINTER_AUDIT__;
        }).catch(() => undefined);
        await context.close();
    }
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2);
    const mode = parseMode(argv, process.env);
    const discovered = discoverManifestMocks();
    const mockPaths = selectRequestedMock(argv, discovered) ?? selectMocks(mode, discovered);
    const variants = createVariants(mode);
    const runId = `${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const outputDir = resolve(OUTPUT_ROOT, runId);
    mkdirSync(outputDir, { recursive: true });

    const server = await createServer({
        configFile: resolve(REPO_ROOT, 'vite.config.ts'),
        root: REPO_ROOT,
        clearScreen: false,
        logLevel: 'error',
        server: { host: '127.0.0.1', port: 0, strictPort: false },
    });
    let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
    const results: CaseResult[] = [];

    try {
        await server.listen();
        const address = server.httpServer?.address();
        if (!address || typeof address === 'string') throw new Error('Vite did not expose a local TCP port.');
        const baseUrl = `http://127.0.0.1:${address.port}`;
        browser = await chromium.launch({ headless: process.env.AIMD_UI_VISUAL_HEADED !== '1' });
        await auditOverlayPointerSafety({ baseUrl, browser });

        for (const mockPath of mockPaths) {
            for (const variant of variants) {
                const result = await runCase({ baseUrl, browser, mockPath, outputDir, variant });
                results.push(result);
                const status = result.errors.length === 0 ? 'PASS' : 'FAIL';
                process.stdout.write(`${status} ${mockPath} ${variant.name}\n`);
            }
        }
    } finally {
        await browser?.close();
        await server.close();
    }

    const failures = results.filter((result) => result.errors.length > 0);
    const summaryPath = resolve(outputDir, 'summary.json');
    writeFileSync(summaryPath, `${JSON.stringify({ mode, mockPaths, variants, results }, null, 2)}\n`, 'utf8');
    process.stdout.write(`UI visual evidence: ${relative(REPO_ROOT, outputDir)}\n`);
    process.stdout.write(`Cases: ${results.length}; failures: ${failures.length}\n`);
    if (failures.length > 0) process.exitCode = 1;
}

void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`UI visual harness failed: ${message}\n`);
    process.stderr.write('If Chromium is unavailable, run: npx playwright install chromium\n');
    process.exitCode = 1;
});
