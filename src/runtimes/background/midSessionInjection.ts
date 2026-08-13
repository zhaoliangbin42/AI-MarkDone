import { browser } from '../../drivers/shared/browser';
import { logger } from '../../core/logger';
import { SUPPORTED_HOST_PATTERNS } from '../../../config/extension/hosts';
import { PROTOCOL_VERSION, createRequestId } from '../../contracts/protocol';

/**
 * Mid-session injection: when the extension is installed, updated, or the
 * browser starts with supported tabs already open, static manifest content
 * scripts never ran there. This module injects the bridge bootstrap and the
 * content entry into those tabs exactly once per background lifetime.
 *
 * The presence check uses the content runtime's existing `ping` answer, so a
 * tab whose content script is already live (for example after an update that
 * keeps the old script running) is never injected a second time.
 */

export const CONTENT_ENTRY_SCRIPT = 'content.js';
export const BRIDGE_BOOTSTRAP_SCRIPT = 'page-bridges/chatgpt-conversation-bootstrap.js';

export type MidSessionInjectionApis = Readonly<{
    /** Tabs matching the supported host patterns. */
    querySupportedTabs: () => Promise<readonly { id?: number }[]>;
    /** True when the tab's content runtime answers a ping. */
    hasLiveContentRuntime: (tabId: number) => Promise<boolean>;
    /** Inject files in order into the tab. */
    injectFiles: (tabId: number, files: readonly string[]) => Promise<void>;
}>;

export function createProductionMidSessionInjectionApis(): MidSessionInjectionApis | null {
    const tabs = browser?.tabs;
    if (!tabs || typeof tabs.query !== 'function') return null;
    return Object.freeze({
        querySupportedTabs: async () => {
            const matched = await tabs.query({ url: [...SUPPORTED_HOST_PATTERNS] });
            return matched;
        },
        hasLiveContentRuntime: async (tabId: number) => {
            try {
                await tabs.sendMessage(tabId, {
                    v: PROTOCOL_VERSION,
                    id: createRequestId(),
                    type: 'ping',
                });
                return true;
            } catch {
                // "Receiving end does not exist" means the tab has no content
                // runtime yet and is eligible for injection.
                return false;
            }
        },
        injectFiles: async (tabId: number, files: readonly string[]) => {
            // Chrome MV3 exposes chrome.scripting (declared "scripting"
            // permission); Firefox MV2 injects per file through tabs.
            const scripting = (browser as unknown as {
                scripting?: {
                    executeScript: (details: { target: { tabId: number }; files: string[] }) => Promise<unknown>;
                };
            }).scripting;
            if (typeof scripting?.executeScript === 'function') {
                await scripting.executeScript({ target: { tabId }, files: [...files] });
                return;
            }
            for (const file of files) {
                await tabs.executeScript(tabId, { file });
            }
        },
    });
}

let injectionInFlight: Promise<number> | null = null;

/**
 * Inject into every open supported tab that has no live content runtime.
 * Serialized across the background lifetime so an install and a startup
 * event racing each other cannot double-inject a tab.
 */
export function injectIntoOpenSupportedTabs(
    apis: MidSessionInjectionApis | null = createProductionMidSessionInjectionApis(),
): Promise<number> {
    if (!apis) return Promise.resolve(0);
    if (injectionInFlight) return injectionInFlight;
    injectionInFlight = (async () => {
        let injected = 0;
        try {
            const tabs = await apis.querySupportedTabs();
            for (const tab of tabs) {
                if (typeof tab.id !== 'number') continue;
                try {
                    if (await apis.hasLiveContentRuntime(tab.id)) continue;
                    await apis.injectFiles(tab.id, [BRIDGE_BOOTSTRAP_SCRIPT, CONTENT_ENTRY_SCRIPT]);
                    injected += 1;
                } catch (error) {
                    logger.debug(`[AI-MarkDone][Background] Mid-session injection skipped tab ${tab.id}`, error);
                }
            }
        } catch (error) {
            logger.debug('[AI-MarkDone][Background] Mid-session injection failed', error);
        }
        return injected;
    })();
    void injectionInFlight.finally(() => {
        injectionInFlight = null;
    });
    return injectionInFlight;
}
