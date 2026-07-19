import type { ReaderItem } from '../../../services/reader/types';
import { resolveReaderReplacementIndex } from '../../../services/reader/readerItemIdentity';
import type {
    ReaderPanelAction,
    ReaderPanelProfile,
    ReaderPanelReplaceItemsOptions,
    ReaderPanelShowOptions,
} from './ReaderPanelContracts';

export type ReaderWorkflowOptions = {
    profile: ReaderPanelProfile;
    showNav: boolean;
    showCopy: boolean;
    showOpenConversation: boolean;
    dotStyle: 'meta' | 'plain';
    actions: ReaderPanelAction[];
    onOpenConversation?: ReaderPanelShowOptions['onOpenConversation'];
    onRequestClose?: ReaderPanelShowOptions['onRequestClose'];
};

export type ReaderWorkflowSnapshot = {
    items: readonly ReaderItem[];
    index: number;
    options: ReaderWorkflowOptions;
};

function resolveProfileOptions(profile: ReaderPanelProfile | undefined): ReaderWorkflowOptions {
    if (profile === 'bookmark-preview') {
        return {
            profile,
            showNav: true,
            showCopy: true,
            showOpenConversation: true,
            dotStyle: 'plain',
            actions: [],
        };
    }

    return {
        profile: 'conversation-reader',
        showNav: true,
        showCopy: true,
        showOpenConversation: false,
        dotStyle: 'meta',
        actions: [],
    };
}

export class ReaderWorkflow {
    private itemList: ReaderItem[] = [];
    private currentIndex = 0;
    private workflowOptions: ReaderWorkflowOptions = resolveProfileOptions(undefined);

    get items(): readonly ReaderItem[] {
        return this.itemList;
    }

    get index(): number {
        return this.currentIndex;
    }

    get currentItem(): ReaderItem | null {
        return this.itemList[this.currentIndex] ?? null;
    }

    get options(): ReaderWorkflowOptions {
        return this.workflowOptions;
    }

    open(items: ReaderItem[], startIndex: number, options?: ReaderPanelShowOptions): void {
        this.itemList = [...items];
        this.currentIndex = this.clampIndex(startIndex);
        this.workflowOptions = {
            ...resolveProfileOptions(options?.profile),
            onOpenConversation: options?.onOpenConversation,
            onRequestClose: options?.onRequestClose,
            actions: [...(options?.actions ?? [])],
        };
    }

    append(item: ReaderItem): void {
        this.itemList = [...this.itemList, item];
    }

    replaceItems(items: ReaderItem[], options?: ReaderPanelReplaceItemsOptions): void {
        const nextIndex = options?.preserveCurrentIdentity
            ? resolveReaderReplacementIndex(this.currentItem, items, this.currentIndex)
            : Math.max(0, Math.min(this.currentIndex, Math.max(0, items.length - 1)));
        this.itemList = [...items];
        this.currentIndex = nextIndex;
    }

    move(delta: number): boolean {
        const next = this.currentIndex + delta;
        if (next < 0 || next >= this.itemList.length || next === this.currentIndex) return false;
        this.currentIndex = next;
        return true;
    }

    jump(index: number): boolean {
        const next = this.clampIndex(index);
        if (next === this.currentIndex) return false;
        this.currentIndex = next;
        return true;
    }

    getItemsSnapshot(): ReaderItem[] {
        return [...this.itemList];
    }

    snapshot(): ReaderWorkflowSnapshot {
        return {
            items: this.itemList,
            index: this.currentIndex,
            options: this.workflowOptions,
        };
    }

    private clampIndex(index: number): number {
        return Math.max(0, Math.min(index, Math.max(0, this.itemList.length - 1)));
    }
}
