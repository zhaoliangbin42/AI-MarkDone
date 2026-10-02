import {
    coffeeIcon,
    fileTextIcon,
    infoIcon,
    pinIcon,
} from '../../../../assets/icons';
import { bookmarkIcon, bookOpenIcon, messageSquareTextIcon, sendIcon, settingsIcon } from '../../../../assets/workspaceIcons';
import type { BookmarksPanelTabSpec } from '../ui/BookmarksPanelShell';

export type BookmarksPanelTabId = 'bookmarks' | 'settings' | 'features' | 'changelog' | 'about' | 'mappamory' | 'faq' | 'sponsor' | 'feedback';

type BookmarksScrollPort = {
    getTreeScrollTop(): number;
    restoreTreeScroll(scrollTop: number): void;
};

type TabDefinition = {
    id: BookmarksPanelTabId;
    labelKey: string;
    labelFallback: string;
    icon: string;
    panelClassName: string;
    scrollSelector: string;
};

const TAB_DEFINITIONS: readonly TabDefinition[] = [
    { id: 'bookmarks', labelKey: 'libraryTitle', labelFallback: 'Library', icon: bookmarkIcon, panelClassName: 'tab-panel--bookmarks', scrollSelector: '.tree-panel' },
    { id: 'settings', labelKey: 'tabSettings', labelFallback: 'Settings', icon: settingsIcon, panelClassName: 'settings-panel', scrollSelector: '.settings-panel-scroll' },
    { id: 'features', labelKey: 'featureOverviewTitle', labelFallback: 'Feature overview', icon: bookOpenIcon, panelClassName: 'features-panel', scrollSelector: '.features-panel' },
    { id: 'changelog', labelKey: 'tabChangelog', labelFallback: 'Changelog', icon: fileTextIcon, panelClassName: 'changelog-panel', scrollSelector: '.changelog-panel' },
    { id: 'faq', labelKey: 'tabFaq', labelFallback: 'FAQ', icon: messageSquareTextIcon, panelClassName: 'faq-panel', scrollSelector: '.faq-panel' },
    { id: 'about', labelKey: 'tabAbout', labelFallback: 'About the author', icon: infoIcon, panelClassName: 'about-panel', scrollSelector: '.about-panel' },
    { id: 'mappamory', labelKey: 'tabMappamory', labelFallback: 'Mappamory', icon: pinIcon, panelClassName: 'mappamory-panel', scrollSelector: '.mappamory-panel' },
    { id: 'sponsor', labelKey: 'tabSponsor', labelFallback: 'Buy Me Coffee', icon: coffeeIcon, panelClassName: 'sponsor-panel', scrollSelector: '.sponsor-panel' },
    { id: 'feedback', labelKey: 'tabFeedback', labelFallback: 'Feedback', icon: sendIcon, panelClassName: 'feedback-panel', scrollSelector: '.feedback-panel' },
];

const TAB_DEFINITION_BY_ID = new Map(TAB_DEFINITIONS.map((definition) => [definition.id, definition]));

function isTabId(value: string): value is BookmarksPanelTabId {
    return TAB_DEFINITION_BY_ID.has(value as BookmarksPanelTabId);
}

export class BookmarksPanelTabWorkflow {
    private activeTab: BookmarksPanelTabId = 'bookmarks';
    private settingsNavigationScrollTop = 0;
    private readonly scrollTops: Record<BookmarksPanelTabId, number> = {
        bookmarks: 0,
        settings: 0,
        features: 0,
        changelog: 0,
        about: 0,
        mappamory: 0,
        faq: 0,
        sponsor: 0,
        feedback: 0,
    };

    constructor(private readonly options: { sponsorEnabled: boolean }) {}

    getActiveTab(): BookmarksPanelTabId {
        return this.activeTab;
    }

    isEnabled(value: string): value is BookmarksPanelTabId {
        return isTabId(value) && (value !== 'sponsor' || this.options.sponsorEnabled);
    }

    select(value: string): boolean {
        if (!this.isEnabled(value) || this.activeTab === value) return false;
        this.activeTab = value;
        return true;
    }

    createShellModel(params: {
        contents: Record<BookmarksPanelTabId, HTMLElement>;
        translate: (key: string, fallback: string) => string;
    }): { titleText: string; tabs: BookmarksPanelTabSpec[] } {
        const enabledDefinitions = TAB_DEFINITIONS.filter((definition) => this.isEnabled(definition.id));
        const activeDefinition = TAB_DEFINITION_BY_ID.get(this.activeTab) ?? TAB_DEFINITIONS[0];

        return {
            titleText: params.translate(activeDefinition.labelKey, activeDefinition.labelFallback),
            tabs: enabledDefinitions.map((definition) => ({
                id: definition.id,
                label: params.translate(definition.labelKey, definition.labelFallback),
                icon: definition.icon,
                content: params.contents[definition.id],
                panelClassName: definition.panelClassName,
            })),
        };
    }

    captureScrollPositions(surfaceRoot: ParentNode, bookmarksView: BookmarksScrollPort | null): void {
        const settingsNavigation = surfaceRoot.querySelector<HTMLElement>('.settings-navigation-scroll');
        if (settingsNavigation && this.activeTab !== 'bookmarks') this.settingsNavigationScrollTop = settingsNavigation.scrollTop;
        if (this.activeTab === 'bookmarks') {
            if (bookmarksView) this.scrollTops.bookmarks = bookmarksView.getTreeScrollTop();
            return;
        }
        const definition = TAB_DEFINITION_BY_ID.get(this.activeTab);
        const panel = definition && surfaceRoot.querySelector<HTMLElement>(definition.scrollSelector);
        if (panel) this.scrollTops[this.activeTab] = panel.scrollTop;
    }

    restoreActiveScrollPosition(surfaceRoot: ParentNode, bookmarksView: BookmarksScrollPort | null): void {
        const settingsNavigation = surfaceRoot.querySelector<HTMLElement>('.settings-navigation-scroll');
        if (settingsNavigation) settingsNavigation.scrollTop = this.settingsNavigationScrollTop;
        if (this.activeTab === 'bookmarks') {
            bookmarksView?.restoreTreeScroll(this.scrollTops.bookmarks);
            return;
        }

        const definition = TAB_DEFINITION_BY_ID.get(this.activeTab);
        if (!definition) return;
        const panel = surfaceRoot.querySelector<HTMLElement>(definition.scrollSelector);
        if (panel) panel.scrollTop = this.scrollTops[this.activeTab];
    }
}
