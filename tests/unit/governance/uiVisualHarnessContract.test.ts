import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { uiSurfaceCoverage } from '../../support/uiSurfaceCoverage';

function readRepoFile(path: string): string {
    return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('UI visual harness contract', () => {
    const source = readRepoFile('scripts/harness-ui-visual.ts');
    const packageJson = JSON.parse(readRepoFile('package.json')) as { scripts?: Record<string, string> };
    const directMockEntries = [...new Set(uiSurfaceCoverage
        .map((entry) => entry.visualEvidence)
        .filter((evidence) => evidence.status === 'direct-mock')
        .map((evidence) => `${evidence.mockPath}/main.ts`))].sort();

    it('exposes a reproducible Playwright and Vite command', () => {
        expect(packageJson.scripts?.['test:ui:visual']).toBe('tsx scripts/harness-ui-visual.ts');
        expect(source).toContain("from '@playwright/test'");
        expect(source).toContain("from 'vite'");
        expect(source).toContain("'output', 'ui-visual'");
        expect(source).toContain("fileURLToPath(import.meta.url)");
        expect(source).not.toContain('import.meta.dirname');
    });

    it('discovers only direct real-component mocks from the surface manifest', () => {
        expect(source).toContain("from '../tests/support/uiSurfaceCoverage'");
        expect(source).toContain("evidence.status === 'direct-mock'");
        expect(source).toContain('Unsafe or unsupported UI mock path');
        expect(source).toContain('realpathSync(MOCKS_ROOT)');
    });

    it('keeps the default smoke run small and makes the full matrix explicit', () => {
        expect(source).toContain("argv.includes('--full')");
        expect(source).toContain("env.AIMD_UI_VISUAL_FULL === '1'");
        expect(source).toContain("mode === 'smoke'");
        expect(source).toContain('SMOKE_MOCK_ORDER');
        expect(source).toContain('FULL_VIEWPORTS');
        expect(source).toContain("['light', 'dark']");
        expect(source).toContain("['en', 'zh_CN']");
        expect(source).toContain("['no-preference', 'reduce']");
        expect(source).toContain("arg.startsWith('--mock=')");
        expect(source).toContain('Requested UI mock is not a direct manifest fixture');
    });

    it('applies visual variants through a programmatic bridge and validates observable state', () => {
        expect(source).toContain('__AIMD_VISUAL_HARNESS__');
        expect(source).toContain('expectedOpenSurfaces');
        expect(source).toContain('localeEvidence');
        expect(source).toContain('did not remain open');
        expect(source).toContain('collectSurfaceElementsAcrossRoots');
        expect(source).toContain('element.shadowRoot');
        expect(source).toContain('did not render Chinese locale evidence');
        expect(source).not.toContain("locator('#theme-toggle')");
        expect(source).not.toContain("locator('#locale-toggle')");
    });

    it('requires every direct mock to register the visual harness bridge', () => {
        for (const entry of directMockEntries) {
            const mockSource = readRepoFile(entry);
            expect(mockSource, entry).toContain('installVisualHarnessBridge');
            expect(mockSource, entry).toContain('applyVariant');
            expect(mockSource, entry).toContain('prepareForAudit');
            expect(mockSource, entry).toContain('getState');
        }
    });

    it('keeps anchored fixtures in the viewport and normalizes mock probe box sizing', () => {
        for (const entry of [
            'mocks/components/formula-composer-assistant/main.ts',
            'mocks/components/input-enhancement/main.ts',
        ]) {
            const mockSource = readRepoFile(entry);
            expect(mockSource, entry).toContain('isElementInViewport');
            expect(mockSource, entry).toContain('scrollIntoView');
            expect(mockSource, entry).toContain('expectedOpenCount');
        }

        const overlaySource = readRepoFile('mocks/components/overlay-host/main.ts');
        expect(overlaySource).toContain('box-sizing: border-box');
    });

    it('drives Formula Asset actions through the production hover controller and settings path', () => {
        const formulaAssetSource = readRepoFile('mocks/components/formula-asset-actions/main.ts');
        expect(formulaAssetSource).toContain("import('../../../src/ui/content/controllers/FormulaAssetHoverController')");
        expect(formulaAssetSource).toContain('new FormulaAssetHoverController');
        expect(formulaAssetSource).toContain('setFormulaSettings');
        expect(formulaAssetSource).toContain('controller.enable');
        expect(formulaAssetSource).toContain("new MouseEvent('mouseenter'");
    });

    it('settles Formula Asset fixture scrolling before opening the scroll-dismissed hover actions', () => {
        const formulaAssetSource = readRepoFile('mocks/components/formula-asset-actions/main.ts');
        const prepareCall = formulaAssetSource.indexOf('await ensureTargetReadyForHover();');
        const hoverDispatch = formulaAssetSource.indexOf("new MouseEvent('mouseenter'");

        expect(formulaAssetSource).toContain('isElementInViewport');
        expect(formulaAssetSource).toContain('if (isElementInViewport(target)) return;');
        expect(formulaAssetSource).toContain('target.scrollIntoView');
        expect(formulaAssetSource).toContain('await nextAnimationFrame();');
        expect(prepareCall).toBeGreaterThan(-1);
        expect(hoverDispatch).toBeGreaterThan(prepareCall);
    });

    it('exposes workflow dialog audit roles on light-DOM hosts and clears the previous surface', () => {
        const workflowSource = readRepoFile('mocks/components/workflow-dialogs/main.ts');
        expect(workflowSource).toContain('async function closeActiveSurface');
        expect(workflowSource).toContain("host.setAttribute('data-aimd-role', 'workflow-dialog')");
        expect(workflowSource).toContain("sendHost.setAttribute('data-aimd-role', 'workflow-dialog')");
        expect(workflowSource).toContain("removeAttribute('data-aimd-role')");
        expect(workflowSource).not.toContain(".panel-window--bookmark-save')\n        ?.setAttribute('data-aimd-role'");
        expect(workflowSource).not.toContain(".panel-window--save')\n        ?.setAttribute('data-aimd-role'");
    });

    it('renders overlay evidence through the production OverlaySession instead of a token probe', () => {
        const overlaySource = readRepoFile('mocks/components/overlay-host/main.ts');
        expect(overlaySource).toContain("import { OverlaySession }");
        expect(overlaySource).toContain('new OverlaySession');
        expect(overlaySource).toContain('setAppearance(createAppearanceSnapshot(');
        expect(overlaySource).not.toContain('OverlayThemeProbe');
        expect(overlaySource).not.toContain('getTokenCss');
    });

    it('bootstraps the Reader Comments mock before extension-dependent imports execute', () => {
        const readerSource = readRepoFile('mocks/components/reader-comments/main.ts');
        const bootstrapImport = "import '../browserExtensionMock';";
        expect(readerSource).toContain(bootstrapImport);
        expect(readerSource.indexOf(bootstrapImport)).toBeLessThan(readerSource.indexOf("from '../../../src/"));

        const bootstrapSource = readRepoFile('mocks/components/browserExtensionMock.ts');
        expect(bootstrapSource).toContain('runtime,');
        expect(bootstrapSource).toContain('getURL:');
        expect(bootstrapSource).toContain('getManifest:');
        expect(bootstrapSource).toContain('globalThis');
    });

    it('opens the production ReaderPanel through production toolbar and page-control triggers', () => {
        const readerSource = readRepoFile('mocks/components/reader-panel/main.ts');
        expect(readerSource).toContain("import { ReaderPanel }");
        expect(readerSource).toContain("import { MessageToolbar }");
        expect(readerSource).toContain("import { ChatGPTMessageStepperController }");
        expect(readerSource).toContain("[data-action=\"reader\"]");
        expect(readerSource).toContain("[data-action=\"open-detached-reader\"]");
        expect(readerSource).toContain("host.setAttribute('data-aimd-role', 'reader-panel')");
        expect(readerSource).not.toContain('getReaderPanelHtml');
    });

    it('keeps the Reader Comments fixture reflowable at its narrow visual viewports', () => {
        const readerHtml = readRepoFile('mocks/components/reader-comments/index.html');
        const readerSource = readRepoFile('mocks/components/reader-comments/main.ts');
        expect(readerHtml).toContain('box-sizing: border-box');
        expect(readerHtml).toContain('.stage { min-width: 0; }');
        expect(readerSource).toContain('@media (max-width: 560px)');
        expect(readerSource).toContain('flex-direction: column');
        expect(readerSource).toContain('min-width: 0');
    });

    it('applies the requested visual theme inside the Reader Comments shadow root', () => {
        const readerSource = readRepoFile('mocks/components/reader-comments/main.ts');
        expect(readerSource).toContain('setTheme(theme: Theme)');
        expect(readerSource).toContain('getTokenCss(theme)');
        expect(readerSource).toContain('readerMocks.forEach');
        expect(readerSource).not.toContain('this.shadow.innerHTML +=');
    });

    it('adds one 200 percent reflow-equivalent case for every direct fixture', () => {
        expect(source).toContain('REFLOW_200_VARIANT');
        expect(source).toContain("layoutMode: 'zoom-reflow-equivalent'");
        expect(source).toContain('zoomPercent: 200');
        expect(source).toContain('physicalWidth: 640');
        expect(source).toContain('physicalHeight: 1136');
        expect(source).not.toContain('variant.mockPaths');
        expect(source).not.toContain('mockPaths?: readonly string[]');
        expect(source).not.toContain('deviceScaleFactor');
    });

    it('fails on page errors, console errors, overflow, or viewport-bound surface escape', () => {
        expect(source).toContain("page.on('pageerror'");
        expect(source).toContain("message.type() === 'error'");
        expect(source).toContain('scrollingElement.scrollWidth - viewportWidth');
        expect(source).toContain('surfaceViolations');
        expect(source).toContain('escapes viewport');
        expect(source).toContain('process.exitCode = 1');
    });

    it('fails when a declared switch thumb is not geometrically centered in its track', () => {
        const inputEnhancementSource = readRepoFile('src/ui/content/components/InputEnhancementPopover.ts');

        expect(inputEnhancementSource).toContain('data-aimd-switch-track');
        expect(source).toContain('switchGeometryViolations');
        expect(source).toContain("getComputedStyle(element, '::after')");
        expect(source).toContain('thumb is not centered');
    });

    it('fails when bookmark filters are clipped or bookmark metadata overlaps', () => {
        expect(source).toContain('bookmarkGeometryViolations');
        expect(source).toContain("element.matches('.bookmark-kind-filter')");
        expect(source).toContain("element.matches('.tree-item--bookmark')");
        expect(source).toContain('bookmark content overlaps');
    });

    it('uses Chromium hit testing to keep an empty overlay host transparent to the host page', () => {
        expect(source).toContain('auditOverlayPointerSafety');
        expect(source).toContain("import('/src/ui/content/overlay/OverlaySurfaceHost.ts')");
        expect(source).toContain('document.elementFromPoint');
        expect(source).toContain('shadow.elementFromPoint');
        expect(source).toContain('overlay pointer safety');
    });
});
