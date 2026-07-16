export type UiSurfaceProfile = 'panel' | 'modal' | 'anchored' | 'inline';
export type UiDomScope = 'shadow-root' | 'page-portal' | 'light-dom-host' | 'extension-page';
export type UiTargetBrowser = 'chrome' | 'firefox';

export type UiVisualEvidence =
    | { status: 'direct-mock'; mockPath: string }
    | { status: 'covered-by-family'; mockPath: string; reason: string };

export type UiSurfaceCoverageEntry = {
    id: string;
    family: string;
    userEntry: string;
    ownerModule: string;
    productionEntry: string;
    profiles: readonly UiSurfaceProfile[];
    domScopes: readonly UiDomScope[];
    documentException?: boolean;
    lifecycleOwners: {
        appearance: string;
        locale: string;
        focusAndDismiss: string;
        motion: string;
        overflowAndResponsive: string;
    };
    responsive: string;
    browsers: readonly [UiTargetBrowser, UiTargetBrowser];
    triggerTests: readonly string[];
    visualEvidence: UiVisualEvidence;
};

const browsers = ['chrome', 'firefox'] as const;

function owners(owner: string): UiSurfaceCoverageEntry['lifecycleOwners'] {
    return {
        appearance: owner,
        locale: owner,
        focusAndDismiss: owner,
        motion: owner,
        overflowAndResponsive: owner,
    };
}

/** Executable mirror of the user-visible catalog in docs/design.md. */
export const uiSurfaceCoverage = [
    {
        id: 'message-toolbar', family: 'message-toolbar', userEntry: 'Official message action row',
        ownerModule: 'src/ui/content/MessageToolbar.ts', productionEntry: 'src/ui/content/controllers/MessageToolbarOrchestrator.ts',
        profiles: ['inline'], domScopes: ['shadow-root'], lifecycleOwners: owners('MessageToolbar'),
        responsive: 'Preserve the host action row and stable hit targets', browsers,
        triggerTests: ['tests/unit/ui/content/messageToolbarOrchestrator.official-anchor.test.ts'],
        visualEvidence: { status: 'direct-mock', mockPath: 'mocks/components/host-integrated-controls' },
    },
    {
        id: 'toolbar-transients', family: 'message-toolbar', userEntry: 'Toolbar hover action and progress action',
        ownerModule: 'src/ui/content/components/ToolbarHoverActionPortal.ts', productionEntry: 'src/ui/content/controllers/MessageToolbarOrchestrator.ts',
        profiles: ['anchored'], domScopes: ['page-portal', 'shadow-root'], lifecycleOwners: owners('MessageToolbar transients'),
        responsive: 'Flip and clamp without resizing the toolbar', browsers,
        triggerTests: ['tests/unit/ui/content/messageToolbarOrchestrator.copy-png.test.ts'],
        visualEvidence: { status: 'covered-by-family', mockPath: 'mocks/components/host-integrated-controls', reason: 'The real toolbar fixture opens the production hover portal and progress panel through the toolbar family' },
    },
    {
        id: 'page-controls', family: 'page-controls', userEntry: 'Fixed lower-right ChatGPT controls',
        ownerModule: 'src/ui/content/controllers/ChatGPTMessageStepperController.ts', productionEntry: 'src/runtimes/content/entry.ts',
        profiles: ['inline'], domScopes: ['light-dom-host'], lifecycleOwners: owners('ChatGPTMessageStepperController'),
        responsive: 'Use compact icon-only controls at 560px without covering the composer', browsers,
        triggerTests: ['tests/unit/ui/content/controllers/ChatGPTMessageStepperController.test.ts'],
        visualEvidence: { status: 'covered-by-family', mockPath: 'mocks/components/host-integrated-controls', reason: 'The production stepper controller is mounted against a structural ChatGPT conversation fixture' },
    },
    {
        id: 'chatgpt-directory', family: 'directory', userEntry: 'ChatGPT directory rail and prompt preview',
        ownerModule: 'src/ui/content/controllers/ChatGPTDirectoryController.ts', productionEntry: 'src/runtimes/content/entry.ts',
        profiles: ['inline', 'anchored'], domScopes: ['shadow-root', 'page-portal'], lifecycleOwners: owners('ChatGPTDirectoryController'),
        responsive: 'Close preview, compact rail, then hide locally if conversation width is unsafe', browsers,
        triggerTests: ['tests/unit/ui/content/controllers/ChatGPTDirectoryController.test.ts'],
        visualEvidence: { status: 'covered-by-family', mockPath: 'mocks/components/host-integrated-controls', reason: 'The real directory rail renders active, bookmarked, hover, preview, and narrow-screen states' },
    },
    {
        id: 'input-enhancement', family: 'composer', userEntry: 'Plus-adjacent Input Enhancement button',
        ownerModule: 'src/ui/content/controllers/ChatGPTComposerEditingController.ts', productionEntry: 'src/runtimes/content/entry.ts',
        profiles: ['anchored', 'modal'], domScopes: ['shadow-root', 'page-portal'], lifecycleOwners: owners('ChatGPTComposerEditingController'),
        responsive: 'Clamp to the visual viewport and collapse to one readable column', browsers,
        triggerTests: ['tests/unit/ui/content/controllers/ChatGPTComposerEditingController.test.ts'],
        visualEvidence: { status: 'direct-mock', mockPath: 'mocks/components/input-enhancement' },
    },
    {
        id: 'formula-composer-assistant', family: 'composer', userEntry: 'Formula caret inside the official composer',
        ownerModule: 'src/ui/content/components/FormulaComposerAssistantPopover.ts', productionEntry: 'src/ui/content/controllers/ChatGPTComposerEditingController.ts',
        profiles: ['anchored'], domScopes: ['shadow-root', 'page-portal'], lifecycleOwners: owners('FormulaComposerAssistantPopover'),
        responsive: 'Follow the caret or fall back to composer geometry with internal max height', browsers,
        triggerTests: ['tests/unit/ui/content/controllers/ChatGPTComposerEditingController.test.ts'],
        visualEvidence: { status: 'direct-mock', mockPath: 'mocks/components/formula-composer-assistant' },
    },
    {
        id: 'prompt-autocomplete', family: 'prompt', userEntry: 'Backslash token in a supported composer',
        ownerModule: 'src/ui/content/controllers/ChatGPTPromptAutocompleteController.ts', productionEntry: 'src/runtimes/content/entry.ts',
        profiles: ['anchored'], domScopes: ['page-portal'], lifecycleOwners: owners('ChatGPTPromptAutocompleteController'),
        responsive: 'Use caret geometry with composer fallback and viewport clamp', browsers,
        triggerTests: ['tests/unit/ui/content/controllers/ChatGPTPromptAutocompleteController.test.ts'],
        visualEvidence: { status: 'direct-mock', mockPath: 'mocks/components/prompt-family' },
    },
    {
        id: 'prompt-manager', family: 'prompt', userEntry: 'Prompts action from page controls, Settings, or Reader',
        ownerModule: 'src/ui/content/controllers/ChatGPTPromptAutocompleteController.ts', productionEntry: 'src/runtimes/content/entry.ts',
        profiles: ['anchored'], domScopes: ['page-portal', 'shadow-root'], lifecycleOwners: owners('ChatGPTPromptAutocompleteController'),
        responsive: 'Clamp after drag and viewport changes with one body scroll owner', browsers,
        triggerTests: ['tests/unit/ui/content/controllers/ChatGPTPromptAutocompleteController.test.ts'],
        visualEvidence: { status: 'covered-by-family', mockPath: 'mocks/components/prompt-family', reason: 'The Prompt family fixture opens real autocomplete at narrow widths and the real draggable manager at workspace widths' },
    },
    {
        id: 'formula-asset-actions', family: 'formula-asset', userEntry: 'Formula hover action or formula settings entry',
        ownerModule: 'src/ui/content/controllers/FormulaAssetHoverController.ts', productionEntry: 'src/runtimes/content/formulaOnlyRuntime.ts',
        profiles: ['anchored'], domScopes: ['page-portal', 'shadow-root'], lifecycleOwners: owners('FormulaAssetHoverController'),
        responsive: 'Clamp actions and settings without covering the source formula when possible', browsers,
        triggerTests: ['tests/unit/ui/content/FormulaAssetHoverController.test.ts'],
        visualEvidence: { status: 'direct-mock', mockPath: 'mocks/components/formula-asset-actions' },
    },
    {
        id: 'reader-panel', family: 'reader', userEntry: 'Message toolbar or bookmark preview Reader action',
        ownerModule: 'src/ui/content/reader/ReaderPanel.ts', productionEntry: 'src/runtimes/content/contentFeatures.ts',
        profiles: ['panel'], domScopes: ['shadow-root'], lifecycleOwners: owners('ReaderPanel'),
        responsive: 'One body scroll owner; collapse auxiliary layout at 900px and one column at 560px', browsers,
        triggerTests: [
            'tests/unit/ui/content/messageToolbarOrchestrator.official-anchor.test.ts',
            'tests/unit/ui/reader/readerPanel.presentation.test.ts',
        ],
        visualEvidence: { status: 'direct-mock', mockPath: 'mocks/components/reader-panel' },
    },
    {
        id: 'detached-reader', family: 'reader', userEntry: 'Lower-right Split View action',
        ownerModule: 'src/ui/content/reader/ReaderPanel.ts', productionEntry: 'src/runtimes/reader/entry.ts',
        profiles: ['panel'], domScopes: ['extension-page', 'shadow-root'], lifecycleOwners: owners('Reader runtime and ReaderPanel'),
        responsive: 'Use the same short-height and narrow-width rules as the in-page Reader', browsers,
        triggerTests: ['tests/unit/runtimes/reader/entry.test.ts'],
        visualEvidence: { status: 'covered-by-family', mockPath: 'mocks/components/reader-panel', reason: 'The production page-control trigger opens the same production ReaderPanel family; detached runtime wiring remains covered by its entry test' },
    },
    {
        id: 'reader-contextual-surfaces', family: 'reader', userEntry: 'Reader settings, comments, export, template, Prompt, and Send actions',
        ownerModule: 'src/ui/content/reader/ReaderCommentPopover.ts', productionEntry: 'src/ui/content/reader/ReaderPanel.ts',
        profiles: ['modal', 'anchored'], domScopes: ['shadow-root', 'page-portal'], lifecycleOwners: owners('Reader family contextual surfaces'),
        responsive: 'Keep one internal scroll owner and reachable actions at 320x568', browsers,
        triggerTests: ['tests/unit/ui/reader/readerPanel.footerActions.test.ts'],
        visualEvidence: { status: 'direct-mock', mockPath: 'mocks/components/reader-comments' },
    },
    {
        id: 'bookmarks-workspace', family: 'bookmarks', userEntry: 'Extension action or page bookmark entry',
        ownerModule: 'src/ui/content/bookmarks/BookmarksPanel.ts', productionEntry: 'src/runtimes/content/contentFeatures.ts',
        profiles: ['panel'], domScopes: ['shadow-root'], lifecycleOwners: owners('BookmarksPanel'),
        responsive: 'Progressively reduce columns and chrome at 980, 720, and 560px', browsers,
        triggerTests: ['tests/unit/ui/bookmarks/bookmarksPanel.overlay.test.ts'],
        visualEvidence: { status: 'direct-mock', mockPath: 'mocks/components/bookmarks-workspace' },
    },
    {
        id: 'settings-workspace', family: 'bookmarks-settings', userEntry: 'Settings and data-management tabs inside Bookmarks',
        ownerModule: 'src/ui/content/bookmarks/ui/tabs/SettingsTabView.ts', productionEntry: 'src/ui/content/bookmarks/BookmarksPanel.ts',
        profiles: ['panel', 'anchored'], domScopes: ['shadow-root'], lifecycleOwners: owners('SettingsTabView'),
        responsive: 'Stack rows at narrow widths while separating destructive actions', browsers,
        triggerTests: ['tests/unit/ui/bookmarks/settingsTabView.test.ts'],
        visualEvidence: { status: 'covered-by-family', mockPath: 'mocks/components/bookmarks-workspace', reason: 'The real Bookmarks page-control trigger opens the panel and the production Settings tab exposes data management and Cloud Backup states' },
    },
    {
        id: 'bookmark-save-dialog', family: 'save', userEntry: 'Toolbar or page bookmark action',
        ownerModule: 'src/ui/content/bookmarks/save/BookmarkSaveDialog.ts', productionEntry: 'src/runtimes/content/contentFeatures.ts',
        profiles: ['modal'], domScopes: ['shadow-root'], lifecycleOwners: owners('BookmarkSaveDialog'),
        responsive: 'Keep actions visible while the body scrolls at narrow or short viewports', browsers,
        triggerTests: [
            'tests/unit/ui/content/messageToolbarOrchestrator.fold-action.test.ts',
            'tests/unit/ui/bookmarks/save/bookmarkSaveDialog.test.ts',
        ],
        visualEvidence: { status: 'direct-mock', mockPath: 'mocks/components/workflow-dialogs' },
    },
    {
        id: 'save-messages-dialog', family: 'export-save', userEntry: 'Save Messages toolbar action',
        ownerModule: 'src/ui/content/export/SaveMessagesDialog.ts', productionEntry: 'src/runtimes/content/contentFeatures.ts',
        profiles: ['modal'], domScopes: ['shadow-root'], lifecycleOwners: owners('SaveMessagesDialog'),
        responsive: 'Keep selection state and footer visible while the body owns scroll', browsers,
        triggerTests: [
            'tests/unit/ui/content/messageToolbarOrchestrator.fold-action.test.ts',
            'tests/unit/ui/export/saveMessagesDialog.test.ts',
        ],
        visualEvidence: { status: 'direct-mock', mockPath: 'mocks/components/workflow-dialogs' },
    },
    {
        id: 'send-surfaces', family: 'sending', userEntry: 'Reader or detached Reader send action',
        ownerModule: 'src/ui/content/sending/SendController.ts', productionEntry: 'src/runtimes/content/entry.ts',
        profiles: ['anchored'], domScopes: ['shadow-root'], lifecycleOwners: owners('SendController'),
        responsive: 'Keep draft and actions reachable under short viewport and virtual keyboard pressure', browsers,
        triggerTests: [
            'tests/unit/ui/reader/readerPanel.footerActions.test.ts',
            'tests/unit/ui/sending/sendPopover.test.ts',
        ],
        visualEvidence: { status: 'direct-mock', mockPath: 'mocks/components/workflow-dialogs' },
    },
    {
        id: 'shared-overlay-dialogs', family: 'overlay', userEntry: 'Workflow notice, confirmation, prompt, or import review',
        ownerModule: 'src/ui/content/overlay/OverlaySession.ts', productionEntry: 'src/ui/content/changelog/ChangelogNoticePresenter.ts',
        profiles: ['modal'], domScopes: ['shadow-root'], lifecycleOwners: owners('OverlaySession'),
        responsive: 'Use viewport gutters with one dialog-body scroll owner', browsers,
        triggerTests: ['tests/unit/ui/overlay/overlaySession.test.ts'],
        visualEvidence: { status: 'direct-mock', mockPath: 'mocks/components/overlay-host' },
    },
    {
        id: 'feedback-surfaces', family: 'feedback', userEntry: 'Control hover/focus or operation result',
        ownerModule: 'src/utils/tooltip.ts', productionEntry: 'src/ui/content/MessageToolbar.ts',
        profiles: ['anchored'], domScopes: ['page-portal', 'shadow-root'], lifecycleOwners: owners('Tooltip and Toast utilities'),
        responsive: 'Clamp without capturing focus or blocking host interaction', browsers,
        triggerTests: ['tests/unit/ui/infra/tooltipDelegate.test.ts', 'tests/unit/ui/infra/toast.test.ts'],
        visualEvidence: { status: 'covered-by-family', mockPath: 'mocks/components/host-integrated-controls', reason: 'The production toolbar fixture opens the real Tooltip delegate and Toast viewport while utility tests cover teardown' },
    },
    {
        id: 'unsupported-page-popup', family: 'popup', userEntry: 'Extension toolbar icon on an unsupported page',
        ownerModule: 'src/popup/popup.html', productionEntry: 'src/popup/popup.html',
        profiles: [], domScopes: ['extension-page'], documentException: true, lifecycleOwners: owners('Popup document'),
        responsive: 'Remain usable at 320px with no horizontal overflow', browsers,
        triggerTests: ['tests/unit/governance/popup-fallback-ui.test.ts'],
        visualEvidence: { status: 'direct-mock', mockPath: 'mocks/components/unsupported-popup' },
    },
] as const satisfies readonly UiSurfaceCoverageEntry[];
