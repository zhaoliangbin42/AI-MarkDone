import { chromium, type BrowserContext, type CDPSession, type Page } from '@playwright/test';
import { gzipSync } from 'node:zlib';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

type PhaseMetrics = {
    durationMs: number;
    longTaskCount: number;
    longTaskTotalMs: number;
    maxLongTaskMs: number;
    mutationRecords: number;
    mutationBreakdown: Record<string, number>;
};

type RuntimeMetrics = {
    toolbarReadyMs: number;
    toolbarRecoveryMs: number;
    featureLoadMs: number;
    featureModuleRequestCount: number;
    toolbarCount: number;
    duplicateActionRows: number;
    shadowRootCount: number;
    shadowDescendantCount: number;
    usedJsHeapBytes: number | null;
    cold: PhaseMetrics;
    idle: PhaseMetrics;
    streaming: PhaseMetrics;
    recovery: PhaseMetrics;
};

type HarnessState = {
    phaseStartedAt: number;
    longTasks: number[];
    mutationRecords: number;
    mutationBreakdown: Record<string, number>;
};

const DEFAULT_ROUNDS = 200;
const DEFAULT_MUTATIONS = 200;
const TOOLBAR_TIMEOUT_MS = 15_000;
const RECOVERY_TIMEOUT_MS = 8_000;
const FEATURE_LOAD_TIMEOUT_MS = 8_000;

function isContentFeatureModuleUrl(url: string): boolean {
    return url.includes('/content-features.js') || url.includes('/content-feature-chunks/');
}

function readPositiveIntegerArg(name: string, fallback: number): number {
    const prefix = `--${name}=`;
    const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Invalid --${name} value: ${raw}`);
    }
    return value;
}

function createFixtureHtml(rounds: number): string {
    const turns = Array.from({ length: rounds }, (_, index) => `
      <div data-testid="conversation-turn-${index * 2 + 1}" data-turn="user">
        <div data-message-author-role="user"><div class="whitespace-pre-wrap">Prompt ${index + 1}</div></div>
      </div>
      <div data-testid="conversation-turn-${index * 2 + 2}" data-turn="assistant">
        <div data-message-author-role="assistant" data-message-id="assistant-${index + 1}">
          <div class="markdown prose"><p>Answer ${index + 1}</p></div>
        </div>
        <div class="z-0 flex"><div><button data-testid="copy-turn-action-button">Copy</button></div></div>
      </div>
    `).join('');

    return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>AI-MarkDone performance fixture</title></head>
  <body>
    <main>
      <div class="fixture_convSearchResultHighlightRoot">
        <div class="fixed inset-e-4 top-1/2 z-20 -translate-y-1/2">Official navigation</div>
        ${turns}
      </div>
    </main>
    <form>
      <div id="prompt-textarea" class="ProseMirror" contenteditable="true"></div>
      <button data-testid="send-button" type="button">Send</button>
    </form>
  </body>
</html>`;
}

async function installHarness(page: Page): Promise<void> {
    await page.addInitScript(() => {
        const state: HarnessState = {
            phaseStartedAt: performance.now(),
            longTasks: [],
            mutationRecords: 0,
            mutationBreakdown: {},
        };
        (window as unknown as { __AIMD_PERF_HARNESS__: HarnessState }).__AIMD_PERF_HARNESS__ = state;

        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) state.longTasks.push(entry.duration);
        }).observe({ type: 'longtask', buffered: true });

        new MutationObserver((records) => {
            state.mutationRecords += records.length;
            for (const record of records) {
                const key = record.type === 'attributes'
                    ? `attributes:${record.attributeName ?? 'unknown'}`
                    : record.type;
                state.mutationBreakdown[key] = (state.mutationBreakdown[key] ?? 0) + 1;
            }
        }).observe(document, {
            attributes: true,
            childList: true,
            characterData: true,
            subtree: true,
        });
    });
}

async function resetPhase(page: Page): Promise<void> {
    await page.evaluate(() => {
        const state = (window as unknown as { __AIMD_PERF_HARNESS__: HarnessState }).__AIMD_PERF_HARNESS__;
        state.phaseStartedAt = performance.now();
        state.longTasks = [];
        state.mutationRecords = 0;
        state.mutationBreakdown = {};
    });
}

async function collectPhase(page: Page): Promise<PhaseMetrics> {
    return page.evaluate(() => {
        const state = (window as unknown as { __AIMD_PERF_HARNESS__: HarnessState }).__AIMD_PERF_HARNESS__;
        return {
            durationMs: performance.now() - state.phaseStartedAt,
            longTaskCount: state.longTasks.length,
            longTaskTotalMs: state.longTasks.reduce((sum, duration) => sum + duration, 0),
            maxLongTaskMs: Math.max(0, ...state.longTasks),
            mutationRecords: state.mutationRecords,
            mutationBreakdown: { ...state.mutationBreakdown },
        };
    });
}

async function preparePage(context: BrowserContext, rounds: number): Promise<Page> {
    const page = context.pages()[0] ?? await context.newPage();
    await installHarness(page);
    await page.route('https://chatgpt.com/**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: createFixtureHtml(rounds),
        });
    });
    return page;
}

async function collectUsedJsHeapAfterGc(context: BrowserContext, page: Page): Promise<number | null> {
    const session = await context.newCDPSession(page);
    try {
        await session.send('HeapProfiler.collectGarbage');
        return page.evaluate(() => {
            const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
            return typeof memory?.usedJSHeapSize === 'number' ? memory.usedJSHeapSize : null;
        });
    } finally {
        await session.detach();
    }
}

async function runRuntimeBenchmark(extensionPath: string, rounds: number, mutations: number): Promise<RuntimeMetrics> {
    const userDataDir = await mkdtemp(join(tmpdir(), 'aimd-perf-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--enable-precise-memory-info',
            '--no-default-browser-check',
            '--no-first-run',
        ],
    });

    let featureNetworkSession: CDPSession | null = null;
    try {
        const page = await preparePage(context, rounds);
        const featureModuleRequests = new Set<string>();
        featureNetworkSession = await context.newCDPSession(page);
        featureNetworkSession.on('Network.requestWillBeSent', (event) => {
            const url = event.request.url;
            if (isContentFeatureModuleUrl(url)) featureModuleRequests.add(url);
        });
        await featureNetworkSession.send('Network.enable');
        page.on('pageerror', (error) => console.error(`[perf:pageerror] ${error.stack ?? error.message}`));
        console.error('[perf] loading fixture');
        await page.goto('https://chatgpt.com/c/aimd-performance-fixture', { waitUntil: 'domcontentloaded' });
        console.error('[perf] waiting for toolbars');
        await page.waitForFunction(
            (expected) => document.querySelectorAll('[data-aimd-role="message-toolbar"]').length === expected,
            rounds,
            { timeout: TOOLBAR_TIMEOUT_MS },
        );
        console.error('[perf] toolbars ready');
        const toolbarReadyMs = await page.evaluate(() => {
            const state = (window as unknown as { __AIMD_PERF_HARNESS__: HarnessState }).__AIMD_PERF_HARNESS__;
            return performance.now() - state.phaseStartedAt;
        });
        await page.waitForTimeout(500);
        const cold = await collectPhase(page);

        await resetPhase(page);
        await page.waitForTimeout(2_000);
        const idle = await collectPhase(page);
        console.error('[perf] idle phase complete');

        await resetPhase(page);
        await page.evaluate(async (mutationCount) => {
            const target = document.querySelector<HTMLElement>('[data-message-id="assistant-1"] .markdown p');
            if (!target) throw new Error('Streaming target is missing');
            for (let index = 0; index < mutationCount; index += 1) {
                target.textContent = `Answer 1 streaming token ${index + 1}`;
                await new Promise<void>((resolveTick) => window.setTimeout(resolveTick, 16));
            }
        }, mutations);
        await page.waitForTimeout(500);
        const streaming = await collectPhase(page);
        console.error('[perf] streaming phase complete');

        await resetPhase(page);
        const recoveryStartedAt = await page.evaluate(() => performance.now());
        const replacedRows = await page.evaluate(() => {
            const turns = Array.from(document.querySelectorAll<HTMLElement>('[data-turn="assistant"]'));
            const selected = turns.filter((_turn, index) => index % 10 === 0);
            for (const turn of selected) {
                const oldRow = turn.querySelector<HTMLElement>('div.z-0.flex');
                if (!oldRow) throw new Error('Official action row is missing');
                const nextRow = document.createElement('div');
                nextRow.className = 'z-0 flex';
                const group = document.createElement('div');
                const copyButton = document.createElement('button');
                copyButton.dataset.testid = 'copy-turn-action-button';
                copyButton.textContent = 'Copy';
                group.appendChild(copyButton);
                nextRow.appendChild(group);
                oldRow.replaceWith(nextRow);
            }
            return selected.length;
        });
        await page.waitForFunction(
            ({ expectedRows, expectedToolbars }) => {
                const allRows = Array.from(document.querySelectorAll<HTMLElement>('[data-turn="assistant"] div.z-0.flex'));
                const rowsWithOneToolbar = allRows.filter(
                    (row) => row.querySelectorAll('[data-aimd-role="message-toolbar"]').length === 1,
                ).length;
                return expectedRows > 0
                    && allRows.length === expectedToolbars
                    && rowsWithOneToolbar === expectedToolbars;
            },
            { expectedRows: replacedRows, expectedToolbars: rounds },
            { timeout: RECOVERY_TIMEOUT_MS },
        );
        console.error('[perf] toolbar recovery complete');
        const toolbarRecoveryMs = await page.evaluate((startedAt) => performance.now() - startedAt, recoveryStartedAt);
        await page.waitForTimeout(500);
        const recovery = await collectPhase(page);

        const finalDomMetrics = await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll<HTMLElement>('*'));
            const actionRows = Array.from(document.querySelectorAll<HTMLElement>('[data-turn="assistant"] div.z-0.flex'));
            return {
                toolbarCount: document.querySelectorAll('[data-aimd-role="message-toolbar"]').length,
                duplicateActionRows: actionRows.filter(
                    (row) => row.querySelectorAll('[data-aimd-role="message-toolbar"]').length !== 1,
                ).length,
                shadowRootCount: allElements.filter((element) => Boolean(element.shadowRoot)).length,
                shadowDescendantCount: allElements.reduce(
                    (sum, element) => sum + (element.shadowRoot?.querySelectorAll('*').length ?? 0),
                    0,
                ),
            };
        });
        const usedJsHeapBytes = await collectUsedJsHeapAfterGc(context, page);
        const finalMetrics = { ...finalDomMetrics, usedJsHeapBytes };

        if (finalMetrics.toolbarCount !== rounds || finalMetrics.duplicateActionRows !== 0) {
            throw new Error(
                `Toolbar reliability gate failed: ${finalMetrics.toolbarCount}/${rounds} toolbars, ${finalMetrics.duplicateActionRows} invalid action rows`,
            );
        }

        if (featureModuleRequests.size > 0) {
            throw new Error(`Feature module loaded before an explicit user trigger: ${Array.from(featureModuleRequests).join(', ')}`);
        }

        const featureLoadStartedAt = await page.evaluate(() => performance.now());
        await page.evaluate(() => {
            const trigger = document.querySelector<HTMLButtonElement>('[data-action="open-bookmarks-panel"]');
            if (!trigger) throw new Error('Bookmarks panel trigger is missing');
            trigger.click();
        });
        await page.waitForSelector('#aimd-bookmarks-panel-host', {
            state: 'attached',
            timeout: FEATURE_LOAD_TIMEOUT_MS,
        });
        const featureLoadMs = await page.evaluate((startedAt) => performance.now() - startedAt, featureLoadStartedAt);
        const requestedFeatureUrls = Array.from(featureModuleRequests);
        const hostOriginFeatureRequests = requestedFeatureUrls.filter((url) => /^https?:\/\//.test(url));
        if (hostOriginFeatureRequests.length > 0) {
            throw new Error(`Feature chunk resolved against the host page origin: ${hostOriginFeatureRequests.join(', ')}`);
        }
        if (!requestedFeatureUrls.some((url) => url.includes('/content-features.js'))) {
            throw new Error('Explicit user trigger did not request content-features.js');
        }

        return {
            toolbarReadyMs,
            toolbarRecoveryMs,
            featureLoadMs,
            featureModuleRequestCount: featureModuleRequests.size,
            ...finalMetrics,
            cold,
            idle,
            streaming,
            recovery,
        };
    } finally {
        console.error('[perf] closing browser');
        await featureNetworkSession?.detach().catch(() => undefined);
        await context.close();
        await rm(userDataDir, { recursive: true, force: true });
    }
}

async function main(): Promise<void> {
    const rounds = readPositiveIntegerArg('rounds', DEFAULT_ROUNDS);
    const mutations = readPositiveIntegerArg('mutations', DEFAULT_MUTATIONS);
    const extensionPath = resolve('dist-chrome');
    const contentBytes = await readFile(join(extensionPath, 'content.js'));
    const metrics = await runRuntimeBenchmark(extensionPath, rounds, mutations);

    process.stdout.write(`${JSON.stringify({
        capturedAt: new Date().toISOString(),
        platform: `${process.platform}-${process.arch}`,
        rounds,
        mutations,
        bundle: {
            contentBytes: contentBytes.byteLength,
            contentGzipBytes: gzipSync(contentBytes).byteLength,
        },
        runtime: metrics,
    }, null, 2)}\n`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
});
