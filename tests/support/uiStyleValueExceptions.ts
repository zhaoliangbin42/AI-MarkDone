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
        ],
        "Static export and popup contracts",
        "Static document or render-output values are isolated from product Surface chrome.",
    ),
];
