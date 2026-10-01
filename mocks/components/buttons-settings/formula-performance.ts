import '../browserExtensionMock';
import { ChatGPTComposerEditingController } from '../../../src/ui/content/controllers/ChatGPTComposerEditingController';
import type { SiteAdapter } from '../../../src/drivers/content/adapters/base';
import { FormulaPreviewPipeline } from '../../../src/services/math/formulaPreviewPipeline';
import { renderFormulaSvgAsset } from '../../../src/runtimes/export-renderer/formulaMathJax';
import { runFormulaAssetAction } from '../../../src/services/math/formulaAssetActions';
import { setLocale } from '../../../src/ui/content/components/i18n';
await setLocale('zh_CN');
const composer = document.querySelector<HTMLTextAreaElement>('#composer')!;
const metrics = document.querySelector<HTMLElement>('#metrics')!;
const benchmark = document.querySelector<HTMLButtonElement>('#benchmark')!;
let renderCount = 0;
const controller = new ChatGPTComposerEditingController({ getComposerInputElement: () => composer } as SiteAdapter, {
    renderFormula: async options => { renderCount++; return renderFormulaSvgAsset({ ...options, fontSizePx: options.fontSizePx ?? 36 }); },
    prewarmFormula: () => undefined,
    runFormulaAssetAction,
});
controller.setFormulaAssetActions({ copyPng: false, copySvg: false, copyMathml: false, savePng: false, saveSvg: true });
controller.init();
const pause = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));
const writeInput = (value: string) => {
    composer.value = value;
    composer.focus();
    composer.setSelectionRange(value.length - 1, value.length - 1);
    composer.dispatchEvent(new Event('input', { bubbles: true }));
};
benchmark.addEventListener('click', async () => {
    benchmark.disabled = true;
    metrics.textContent = 'Running';
    try {
        const before = renderCount;
        for (let index = 0; index < 100; index++) { writeInput(`$x+${index}$`); await pause(5); }
        await pause(200);
        const burstRenders = renderCount - before;
        const host = document.querySelector<HTMLElement>('[data-aimd-role="formula-composer-assistant"]')!;
        const beforeSvg = host.shadowRoot!.querySelector('.formula-preview svg');
        const caretBefore = renderCount;
        for (let index = 0; index < 100; index++) composer.dispatchEvent(new Event('keyup', { bubbles: true }));
        await pause(200);
        const sameSvgAfter100CaretEvents = beforeSvg === host.shadowRoot!.querySelector('.formula-preview svg');
        const pipeline = new FormulaPreviewPipeline(options => renderFormulaSvgAsset({ ...options, fontSizePx: options.fontSizePx ?? 36 }));
        await Promise.all(Array.from({ length: 100 }, (_, index) => pipeline.request({ source: `y+${index}`, displayMode: false }).catch(() => null)));
        await pause(0);
        const queue = pipeline.getStats();
        const warmMs: number[] = [];
        for (let index = 0; index < 100; index++) {
            const started = performance.now();
            await pipeline.request({ source: 'y+99', displayMode: false });
            warmMs.push(performance.now() - started);
        }
        warmMs.sort((left, right) => left - right);
        metrics.textContent = JSON.stringify({ samples: 100, burstRenders, caretRenders: renderCount - caretBefore, sameSvgAfter100CaretEvents, latestOnly: queue, warmCacheP95Ms: warmMs[94], cacheAfterWarm: pipeline.getStats() }, null, 2);
        pipeline.clear();
        writeInput('$E=mc^2$');
    } catch (error) { metrics.textContent = String(error); }
    finally { benchmark.disabled = false; }
});
window.addEventListener('pagehide', () => controller.dispose(), { once: true });
