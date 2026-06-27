import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import type { ReaderCommentRecord } from '../../../services/reader/commentSession';
import type { CommentTemplateSegment, ReaderCommentPrompt, ReaderCommentPromptPosition } from '../../../core/settings/readerCommentExport';
import { SendModal } from './SendModal';
import { createContentSendPort } from './contentSendPort';
import { type SendPort, SendPopover, type SendPopoverPromptAutocompleteController } from './SendPopover';
import type { UserThemeOverrides } from '../../../style/tokens';

export class SendController {
    private modal: SendModal;
    private popover: SendPopover;
    private theme: Theme = 'light';
    private themeOverrides: UserThemeOverrides = {};

    constructor() {
        this.modal = new SendModal();
        this.popover = new SendPopover();
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.modal.setTheme(theme);
        this.popover.setTheme(theme);
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        this.modal.setThemeOverrides(this.themeOverrides);
        this.popover.setThemeOverrides(this.themeOverrides);
    }

    setPromptAutocompleteController(controller: SendPopoverPromptAutocompleteController | null): void {
        this.popover.setPromptAutocompleteController(controller);
    }

    isOpen(): boolean {
        return this.modal.isOpen() || this.popover.isOpen();
    }

    open(params: { adapter: SiteAdapter; initialText?: string }): void {
        this.modal.open({ adapter: params.adapter, theme: this.theme, themeOverrides: this.themeOverrides, initialText: params.initialText });
    }

    close(opts?: { syncBack?: boolean }): void {
        this.modal.close(opts);
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
            comments: ReaderCommentRecord[];
        } | null;
    }): void {
        const sendPort = params.sendPort ?? (params.adapter ? createContentSendPort(params.adapter) : null);
        if (!sendPort) return;
        this.popover.toggle({
            sendPort,
            shadow: params.shadow,
            anchor: params.anchor,
            theme: this.theme,
            initialText: params.initialText,
            commentInsert: params.commentInsert,
        });
    }
}
