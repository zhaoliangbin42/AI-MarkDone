import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import type { ReaderCommentRecord } from '../../../services/reader/commentSession';
import type { CommentTemplateSegment, ReaderCommentPrompt } from '../../../core/settings/readerCommentExport';
import { SendModal } from './SendModal';
import { SendPopover } from './SendPopover';

export class SendController {
    private modal: SendModal;
    private popover: SendPopover;
    private theme: Theme = 'light';

    constructor() {
        this.modal = new SendModal();
        this.popover = new SendPopover();
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.modal.setTheme(theme);
        this.popover.setTheme(theme);
    }

    isOpen(): boolean {
        return this.modal.isOpen() || this.popover.isOpen();
    }

    open(params: { adapter: SiteAdapter; initialText?: string }): void {
        this.modal.open({ adapter: params.adapter, theme: this.theme, initialText: params.initialText });
    }

    close(opts?: { syncBack?: boolean }): void {
        this.modal.close(opts);
    }

    togglePopover(params: {
        adapter: SiteAdapter;
        shadow: ShadowRoot;
        anchor: HTMLElement;
        initialText?: string;
        commentInsert?: {
            prompts: ReaderCommentPrompt[];
            template: CommentTemplateSegment[];
            comments: ReaderCommentRecord[];
        } | null;
    }): void {
        this.popover.toggle({
            adapter: params.adapter,
            shadow: params.shadow,
            anchor: params.anchor,
            theme: this.theme,
            initialText: params.initialText,
            commentInsert: params.commentInsert,
        });
    }
}
