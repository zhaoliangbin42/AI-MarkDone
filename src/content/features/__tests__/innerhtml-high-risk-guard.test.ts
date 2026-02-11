import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('innerHTML high-risk guard', () => {
    it('avoids direct innerHTML assignment on high-risk paths', () => {
        const messageSender = readFileSync(
            resolve(process.cwd(), 'src/content/features/MessageSender.ts'),
            'utf-8'
        );
        const saveMessages = readFileSync(
            resolve(process.cwd(), 'src/content/features/save-messages.ts'),
            'utf-8'
        );
        const mathExtractor = readFileSync(
            resolve(process.cwd(), 'src/content/parsers/math-extractor.ts'),
            'utf-8'
        );
        const codeExtractor = readFileSync(
            resolve(process.cwd(), 'src/content/parsers/code-extractor.ts'),
            'utf-8'
        );
        const tableParser = readFileSync(
            resolve(process.cwd(), 'src/content/parsers/table-parser.ts'),
            'utf-8'
        );
        const tooltipManager = readFileSync(
            resolve(process.cwd(), 'src/content/utils/TooltipManager.ts'),
            'utf-8'
        );
        const modal = readFileSync(
            resolve(process.cwd(), 'src/content/components/modal.ts'),
            'utf-8'
        );
        const saveMessagesDialog = readFileSync(
            resolve(process.cwd(), 'src/content/features/SaveMessagesDialog.ts'),
            'utf-8'
        );
        const toolbar = readFileSync(
            resolve(process.cwd(), 'src/content/components/toolbar.ts'),
            'utf-8'
        );
        const dialogHost = readFileSync(
            resolve(process.cwd(), 'src/components/DialogHost.ts'),
            'utf-8'
        );
        const floatingInput = readFileSync(
            resolve(process.cwd(), 'src/content/components/FloatingInput.ts'),
            'utf-8'
        );
        const bookmarkSaveModal = readFileSync(
            resolve(process.cwd(), 'src/bookmarks/components/BookmarkSaveModal.ts'),
            'utf-8'
        );
        const simpleBookmarkPanel = readFileSync(
            resolve(process.cwd(), 'src/bookmarks/components/SimpleBookmarkPanel.ts'),
            'utf-8'
        );
        const reRender = readFileSync(
            resolve(process.cwd(), 'src/content/features/re-render.ts'),
            'utf-8'
        );
        const inputComponent = readFileSync(
            resolve(process.cwd(), 'src/components/Input.ts'),
            'utf-8'
        );
        const checkboxComponent = readFileSync(
            resolve(process.cwd(), 'src/components/Checkbox.ts'),
            'utf-8'
        );
        const buttonComponent = readFileSync(
            resolve(process.cwd(), 'src/components/Button.ts'),
            'utf-8'
        );

        expect(messageSender).not.toContain('input.innerHTML =');
        expect(saveMessages).not.toContain('printContainer.innerHTML =');
        expect(mathExtractor).not.toContain('block.innerHTML = result;');
        expect(mathExtractor).not.toContain('tempDiv.innerHTML = html;');
        expect(codeExtractor).not.toContain('tempDiv.innerHTML = html;');
        expect(tableParser).not.toContain('tempDiv.innerHTML = html;');
        expect(tooltipManager).not.toContain('this.tooltip.innerHTML =');
        expect(modal).not.toContain('header.innerHTML =');
        expect(modal).not.toContain('footer.innerHTML =');
        expect(saveMessagesDialog).not.toContain('header.innerHTML =');
        expect(saveMessagesDialog).not.toContain('selectorSection.innerHTML =');
        expect(saveMessagesDialog).not.toContain('closeBtn.innerHTML =');
        expect(saveMessagesDialog).not.toContain('formatSection.innerHTML =');
        expect(toolbar).not.toContain('stats.innerHTML =');
        expect(toolbar).not.toContain('button.innerHTML = icon;');
        expect(toolbar).not.toContain('btn.innerHTML = Icons.check;');
        expect(dialogHost).not.toContain('dialog.innerHTML =');
        expect(floatingInput).not.toContain('collapseBtn.innerHTML =');
        expect(floatingInput).not.toContain('this.sendBtn.innerHTML =');
        expect(reRender).not.toContain("leftBtn.innerHTML = '◀';");
        expect(reRender).not.toContain("rightBtn.innerHTML = '▶';");
        expect(reRender).not.toContain('this.triggerBtn.innerHTML = Icons.messageSquareText;');
        expect(reRender).not.toContain('this.triggerBtn.innerHTML = Icons.hourglass;');
        expect(reRender).not.toContain('jumpBtn.innerHTML = Icons.locate;');
        expect(reRender).not.toContain('copyBtn.innerHTML = Icons.check;');
        expect(reRender).not.toContain('header.innerHTML = `');
        expect(reRender).not.toContain('body.innerHTML = `');
        expect(bookmarkSaveModal).not.toContain('treeBody.innerHTML = `');
        expect(bookmarkSaveModal).not.toContain('icon.innerHTML = Icons.folder;');
        expect(simpleBookmarkPanel).not.toContain('header.innerHTML = `${Icons.bookmark}');
        expect(simpleBookmarkPanel).not.toContain('icon.innerHTML = Icons.bookmark;');
        expect(simpleBookmarkPanel).not.toContain('icon.innerHTML = isExpanded ? Icons.folderOpen : Icons.folder;');
        expect(simpleBookmarkPanel).not.toContain('icon.innerHTML = Icons.folder;');
        expect(simpleBookmarkPanel).not.toContain('timeBtn.innerHTML =');
        expect(simpleBookmarkPanel).not.toContain('alphaBtn.innerHTML =');
        expect(simpleBookmarkPanel).not.toContain('confirmBtn.innerHTML =');
        expect(simpleBookmarkPanel).not.toContain('cancelBtn.innerHTML =');
        expect(inputComponent).not.toContain('iconSpan.innerHTML =');
        expect(checkboxComponent).not.toContain('checkmark.innerHTML =');
        expect(checkboxComponent).not.toContain('this.checkmark.innerHTML =');
        expect(buttonComponent).not.toContain('button.innerHTML = this.getContent();');
        expect(buttonComponent).not.toContain('this.element.innerHTML = this.getContent();');
    });
});
