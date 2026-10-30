import '../browserExtensionMock';
import { OverlaySession } from '../../../src/ui/content/overlay/OverlaySession';
import { PageAnnotationManagerPopover } from '../../../src/ui/content/pageAnnotations/PageAnnotationManagerPopover';
import { setLocale } from '../../../src/ui/content/components/i18n';
import type { ReaderCommentRecord } from '../../../src/services/reader/commentSession';

setLocale('zh_CN');
const session = new OverlaySession({ id: 'page-annotation-mock', theme: new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light', surfaceCss: '', lockScroll: true, zIndex: 'var(--aimd-z-tooltip)', surfaceStyleId: 'mock-surface', overlayStyleId: 'mock-overlay' });
const manager = new PageAnnotationManagerPopover();
let records: ReaderCommentRecord[] = [
    ['1', '这一段需要再补充一个具体例子。', '结合前面的研究背景，说明这一假设适用的条件。'],
    ['2', '比较不同方法时，先确定相同的统计范围。', '这里的关键是统一比较口径，避免重复计算共同步骤。'],
    ['3', 'The effective solution depends on the available context.', '记得核对术语，确保和前文一致。'],
].map(([id, quoteText, comment], index) => ({ id, itemId: `assistant-${id}`, quoteText, sourceMarkdown: quoteText, comment, selectors: { textQuote: { exact: quoteText, prefix: '', suffix: '' }, textPosition: { start: 0, end: quoteText.length }, domRange: null, atomicRefs: [] }, createdAt: 1760000000000 + index * 300000, updatedAt: 1760000000000 + index * 300000, target: { assistantMessageId: `assistant-${id}`, position: index }, revision: 1, lastKnownAnchorState: 'anchored' }));
const trigger = document.querySelector<HTMLButtonElement>('#open')!;
const composer = document.querySelector<HTMLTextAreaElement>('textarea')!;
const refreshCount = () => { trigger.textContent = `注释 · ${records.length}`; };
trigger.addEventListener('click', () => {
    const rect = document.querySelector<HTMLElement>('.composer')!.getBoundingClientRect();
    manager.open({
        shadow: session.shadow,
        modalHost: session.modalHost,
        anchorRect: rect,
        getCurrentRecords: () => records,
        loadAll: async () => records,
        onSelect: () => {},
        onDelete: async record => {
            records = records.filter(candidate => candidate.id !== record.id);
            refreshCount();
            return true;
        },
        onInsertAll: (selected, deleteAfter) => {
            const text = selected.map(record => `> ${record.quoteText}\n\n${record.comment}`).join('\n\n');
            composer.value += `${composer.value.trim() ? '\n\n' : ''}${text}`;
            composer.dispatchEvent(new Event('input', { bubbles: true }));
            if (deleteAfter) {
                const ids = new Set(selected.map(record => record.id));
                records = records.filter(record => !ids.has(record.id));
                refreshCount();
            }
        },
    });
});
