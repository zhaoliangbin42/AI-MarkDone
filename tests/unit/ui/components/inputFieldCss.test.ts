import { describe, expect, it } from 'vitest';
import { getBookmarksPanelCss } from '@/ui/content/bookmarks/ui/styles/bookmarksPanelCss';
import { getBookmarkSaveDialogCss } from '@/ui/content/bookmarks/save/bookmarkSaveDialogCss';
import { getModalHostCss } from '@/ui/content/components/styles/modalHostCss';
import { getSendPopoverCss } from '@/ui/content/sending/ui/styles/sendPopoverCss';

describe('shared input field css', () => {
    it('is included by the rebuilt overlay surfaces', () => {
        const bookmarksCss = getBookmarksPanelCss();
        const bookmarkSaveCss = getBookmarkSaveDialogCss('light');
        const modalCss = getModalHostCss();
        const sendPopoverCss = getSendPopoverCss();

        for (const css of [bookmarksCss, bookmarkSaveCss, modalCss, sendPopoverCss]) {
            expect(css).toContain('.aimd-field-control::placeholder');
            expect(css).toContain('.aimd-field-control:focus::placeholder');
        }

        expect(bookmarksCss).toContain('.aimd-field-shell:focus-within');
        expect(bookmarkSaveCss).toContain('.aimd-field-control--standalone:focus');
    });
});
