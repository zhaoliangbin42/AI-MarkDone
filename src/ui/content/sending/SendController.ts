import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import type { ReaderCommentRecord } from '../../../services/reader/commentSession';
import type {
    CommentTemplateSegment,
    ReaderCommentPrompt,
    ReaderCommentPromptPosition,
    ReaderCommentSortMode,
} from '../../../core/settings/readerCommentExport';
import { createContentSendPort } from './contentSendPort';
import { type SendPort, SendPopover, type SendPopoverPromptAutocompleteController } from './SendPopover';
import {
    areAppearanceSnapshotsEqual,
    type AppearanceSnapshot,
} from '../../../style/appearance';

export class SendController {
    private readonly popover = new SendPopover();
    private appearance: AppearanceSnapshot | null = null;

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (this.appearance && areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.popover.setAppearance(snapshot);
    }

    setPromptAutocompleteController(controller: SendPopoverPromptAutocompleteController | null): void {
        this.popover.setPromptAutocompleteController(controller);
    }

    togglePopover(params: {
        adapter?: SiteAdapter;
        sendPort?: SendPort;
        shadow: ShadowRoot;
        anchor: HTMLElement;
        initialText?: string;
        commentInsert?: {
            listReaderPrompts: () => Promise<ReaderCommentPrompt[]> | ReaderCommentPrompt[];
            template: CommentTemplateSegment[];
            promptPosition: ReaderCommentPromptPosition;
            sortMode?: ReaderCommentSortMode;
            comments: ReaderCommentRecord[];
        } | null;
    }): void {
        const sendPort = params.sendPort ?? (params.adapter ? createContentSendPort(params.adapter) : null);
        if (!sendPort) return;
        this.popover.toggle({
            sendPort,
            shadow: params.shadow,
            anchor: params.anchor,
            theme: this.appearance?.theme ?? 'light',
            initialText: params.initialText,
            commentInsert: params.commentInsert,
        });
    }
}
