export type UiStyleValueGovernanceEntry = {
    signature: string;
    owner: string;
    reason: string;
};

function entriesFor(
    signatures: readonly string[],
    owner: string,
    reason: string,
): UiStyleValueGovernanceEntry[] {
    return signatures.map((signature) => ({ signature, owner, reason }));
}

/** Static-document/render-output exceptions. Entries must stay exact; directory-wide exceptions are forbidden. */
export const UI_STYLE_VALUE_STATIC_EXCEPTIONS: readonly UiStyleValueGovernanceEntry[] = [
    ...entriesFor(
        [
        "src/popup/popup.html::color::--aimd-bg-primary::\"#171717\"::#1",
        "src/popup/popup.html::color::--aimd-bg-primary::\"#f6f7f9\"::#1",
        "src/popup/popup.html::color::--aimd-bg-surface::\"#262626\"::#1",
        "src/popup/popup.html::color::--aimd-bg-surface::\"#ffffff\"::#1",
        "src/popup/popup.html::color::--aimd-text-primary::\"#f5f5f5\"::#1",
        "src/popup/popup.html::color::--aimd-text-primary::\"#111827\"::#1",
        "src/popup/popup.html::color::--aimd-text-secondary::\"#d4d4d4\"::#1",
        "src/popup/popup.html::color::--aimd-text-secondary::\"#374151\"::#1",
        "src/popup/popup.html::color::--aimd-border-default::\"rgba(255, 255, 255, 0.14)\"::#1",
        "src/popup/popup.html::color::--aimd-border-default::\"rgba(0, 0, 0, 0.12)\"::#1",
        "src/popup/popup.html::color::--aimd-border-strong::\"rgba(255, 255, 255, 0.22)\"::#1",
        "src/popup/popup.html::color::--aimd-border-strong::\"rgba(0, 0, 0, 0.16)\"::#1",
        "src/popup/popup.html::color::--aimd-interactive-primary::\"#2563eb\"::#1",
        "src/popup/popup.html::color::--aimd-interactive-primary-hover::\"#1d4ed8\"::#1",
        "src/popup/popup.html::color::--aimd-interactive-selected::\"rgba(96, 165, 250, 0.16)\"::#1",
        "src/popup/popup.html::color::--aimd-interactive-selected::\"rgba(37, 99, 235, 0.12)\"::#1",
        "src/popup/popup.html::color::--aimd-shadow-lg::\"0 10px 24px rgba(0, 0, 0, 0.34)\"::#1",
        "src/popup/popup.html::color::--aimd-shadow-lg::\"0 10px 24px rgba(0, 0, 0, 0.18)\"::#1",
        "src/popup/popup.html::shadow::--aimd-shadow-lg::\"0 10px 24px rgba(0, 0, 0, 0.34)\"::#1",
        "src/popup/popup.html::shadow::--aimd-shadow-lg::\"0 10px 24px rgba(0, 0, 0, 0.18)\"::#1",
        "src/popup/popup.html::radius::--aimd-radius-lg::\"8px\"::#1",
        "src/popup/popup.html::radius::--aimd-radius-xl::\"12px\"::#1",
        "src/popup/popup.html::radius::--aimd-radius-2xl::\"16px\"::#1",
        "src/popup/popup.html::radius::--aimd-radius-full::\"999px\"::#1",
        ],
        "Static export and popup contracts",
        "Static document or render-output values are isolated from product Surface chrome.",
    ),
    ...entriesFor(
        [
        "src/runtimes/export-renderer/messagePngCapability.ts::color::background::\"#ffffff\"::#1",
        ],
        "Static export and popup contracts",
        "Static document or render-output values are isolated from product Surface chrome.",
    ),
    ...entriesFor(
        [
        "src/services/export/messageCardProfile.ts::color::--aimd-bg-secondary::\"#f6f8fa\"::#1",
        "src/services/export/messageCardProfile.ts::color::--aimd-text-primary::\"#000000\"::#1",
        "src/services/export/messageCardProfile.ts::color::--aimd-text-secondary::\"#333333\"::#1",
        "src/services/export/messageCardProfile.ts::color::--aimd-border-default::\"#d0d7de\"::#1",
        "src/services/export/messageCardProfile.ts::spacing::padding::\"32px\"::#1",
        "src/services/export/messageCardProfile.ts::spacing::margin-top::\"32px\"::#1",
        "src/services/export/messageCardProfile.ts::spacing::padding-top::\"32px\"::#1",
        "src/services/export/messageCardProfile.ts::spacing::margin::\"0 0 16px\"::#1",
        "src/services/export/messageCardProfile.ts::spacing::padding-bottom::\"8px\"::#1",
        "src/services/export/messageCardProfile.ts::spacing::margin-bottom::\"24px\"::#1",
        "src/services/export/messageCardProfile.ts::spacing::padding::\"16px\"::#1",
        "src/services/export/messageCardProfile.ts::radius::border-radius::\"8px\"::#1",
        "src/services/export/messageCardProfile.ts::spacing::margin-bottom::\"8px\"::#1",
        "src/services/export/messageCardProfile.ts::spacing::padding::\"0 16px\"::#1",
        "src/services/export/messageCardProfile.ts::spacing::margin-bottom::\"12px\"::#1",
        "src/services/export/messageCardProfile.ts::spacing::margin::\"0 0 16px\"::#2",
        "src/services/export/messageCardProfile.ts::spacing::margin::\"0 0 16px\"::#3",
        "src/services/export/messageCardProfile.ts::spacing::padding-left::\"24px\"::#1",
        "src/services/export/messageCardProfile.ts::spacing::margin-bottom::\"4px\"::#1",
        "src/services/export/messageCardProfile.ts::spacing::margin::\"24px 0 12px\"::#1",
        "src/services/export/messageCardProfile.ts::spacing::margin::\"16px 0\"::#1",
        "src/services/export/messageCardProfile.ts::spacing::margin::\"16px 0\"::#2",
        "src/services/export/messageCardProfile.ts::spacing::padding-left::\"16px\"::#1",
        "src/services/export/messageCardProfile.ts::spacing::margin::\"16px 0\"::#3",
        "src/services/export/messageCardProfile.ts::spacing::padding::\"18px\"::#1",
        "src/services/export/messageCardProfile.ts::radius::border-radius::\"8px\"::#2",
        ],
        "Static export and popup contracts",
        "Static document or render-output values are isolated from product Surface chrome.",
    ),
    ...entriesFor(
        [
        "src/services/export/saveMessagesDocument.ts::spacing::margin::\"0 0 1em\"::#1",
        "src/services/export/saveMessagesDocument.ts::shadow::box-shadow::\"inset 0 1px 0 color-mix(in srgb, var(--aimd-bg-primary) 60%, transparent)\"::#1",
        "src/services/export/saveMessagesDocument.ts::spacing::padding::\"0 14px\"::#1",
        "src/services/export/saveMessagesDocument.ts::spacing::padding::\"16px\"::#1",
        ],
        "Static export and popup contracts",
        "Static document or render-output values are isolated from product Surface chrome.",
    ),
    ...entriesFor(
        [
        "src/services/export/saveMessagesPdf.ts::color::background::\"#ffffff !important\"::#1",
        "src/services/export/saveMessagesPdf.ts::color::color::\"#000000 !important\"::#1",
        "src/services/export/saveMessagesPdf.ts::color::background::\"#ffffff\"::#1",
        "src/services/export/saveMessagesPdf.ts::spacing::padding::\"20px\"::#1",
        "src/services/export/saveMessagesPdf.ts::spacing::padding::\"90px 20px\"::#1",
        "src/services/export/saveMessagesPdf.ts::spacing::margin::\"0 0 16px 0\"::#1",
        "src/services/export/saveMessagesPdf.ts::spacing::margin::\"0 0 16px 0\"::#2",
        "src/services/export/saveMessagesPdf.ts::spacing::padding-bottom::\"8px\"::#1",
        "src/services/export/saveMessagesPdf.ts::spacing::padding::\"16px\"::#1",
        "src/services/export/saveMessagesPdf.ts::radius::border-radius::\"8px\"::#1",
        "src/services/export/saveMessagesPdf.ts::spacing::margin-bottom::\"24px\"::#1",
        "src/services/export/saveMessagesPdf.ts::spacing::margin-bottom::\"8px\"::#1",
        "src/services/export/saveMessagesPdf.ts::spacing::padding::\"0 16px\"::#1",
        "src/services/export/saveMessagesPdf.ts::spacing::margin-bottom::\"12px\"::#1",
        "src/services/export/saveMessagesPdf.ts::spacing::margin::\"0 0 16px 0\"::#3",
        "src/services/export/saveMessagesPdf.ts::spacing::margin::\"0 0 16px 0\"::#4",
        "src/services/export/saveMessagesPdf.ts::spacing::padding-left::\"24px\"::#1",
        "src/services/export/saveMessagesPdf.ts::spacing::margin-bottom::\"4px\"::#1",
        "src/services/export/saveMessagesPdf.ts::spacing::margin::\"24px 0 12px 0\"::#1",
        "src/services/export/saveMessagesPdf.ts::spacing::margin::\"16px 0\"::#1",
        "src/services/export/saveMessagesPdf.ts::spacing::margin::\"16px 0\"::#2",
        "src/services/export/saveMessagesPdf.ts::spacing::padding-left::\"16px\"::#1",
        ],
        "Static export and popup contracts",
        "Static document or render-output values are isolated from product Surface chrome.",
    ),
];
