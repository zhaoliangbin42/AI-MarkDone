import { markLibraryClient } from '@/drivers/shared/clients/markLibraryClient';
import { emptyMarkCatalog, type MarkCatalog } from '@/contracts/markLibrary';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS } from '@/core/settings/types';
import type { Bookmark } from '@/core/bookmarks/types';
import { BookmarksPanel } from '@/ui/content/bookmarks/BookmarksPanel';
import { BookmarksPanelController } from '@/ui/content/bookmarks/BookmarksPanelController';
import { setLocale } from '@/ui/content/components/i18n';
import { bookmarksClient } from '@/drivers/shared/clients/bookmarksClient';
import { highlightsClient } from '@/drivers/shared/clients/highlightsClient';
import { readerAnnotationsClient } from '@/drivers/shared/clients/readerAnnotationsClient';
import type { ReaderAnnotationListEntry } from '@/contracts/readerAnnotations';
import type { HighlightEntry } from '@/contracts/highlights';
vi.mock('@/drivers/shared/clients/markLibraryClient',()=>({markLibraryClient:{get:vi.fn(),mutate:vi.fn(),subscribe:vi.fn(()=>()=>undefined)}}));
vi.mock('@/drivers/shared/clients/highlightsClient', () => ({highlightsClient: {list: vi.fn(), update: vi.fn(), remove: vi.fn(), subscribe: vi.fn(() => () => undefined)}}));
vi.mock('@/drivers/shared/clients/readerAnnotationsClient', () => ({readerAnnotationsClient:{list:vi.fn(),update:vi.fn(),remove:vi.fn(),navigate:vi.fn()}}));

vi.mock('@/drivers/shared/clients/bookmarksClient', () => ({ bookmarksClient: {
    list: vi.fn(), positions: vi.fn(), pageStatus: vi.fn(), foldersList: vi.fn(), storageUsage: vi.fn(),
    uiStateGetLastSelectedFolderPath: vi.fn(async () => ({ ok: true, data: { value: null } })),
    uiStateSetLastSelectedFolderPath: vi.fn(async () => ({ ok: true, data: {} })),
    getChangelogNotice: vi.fn(async () => ({ ok: true, data: { pendingVersion: null } })),
    bulkMove: vi.fn(), save: vi.fn(), remove: vi.fn(), foldersCreate: vi.fn(), bulkRemove: vi.fn(),
} }));
vi.mock('@/drivers/shared/clients/settingsClientRpc', () => ({ settingsClientRpc: {
    getAll: vi.fn(async () => ({ ok: true, data: { settings: DEFAULT_SETTINGS } })),
    setCategory: vi.fn(async () => ({ ok: true, data: {} })),
} }));
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
let catalog:MarkCatalog;
let records: Bookmark[];
let panel: BookmarksPanel;
let controller: BookmarksPanelController;
let root: ShadowRoot;
let highlights: HighlightEntry[];
let annotations: ReaderAnnotationListEntry[];
const click = (label: string, scope: ParentNode = root) => {
    const el = [...scope.querySelectorAll<HTMLElement>('[aria-label]')].find(el => el.getAttribute('aria-label') === label && !el.closest('[hidden]'));
    expect(el, label).toBeTruthy(); el!.click();
};
const clickAction = (action: string, scope: ParentNode = root) => {
    const el = scope.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
    expect(el, action).toBeTruthy(); el!.click();
};
const menuAction = (label: string) => {
    const row = root.querySelector('.library-record')!;
    click(label, row);
};

describe('Library through the production panel and bookmark controller', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        document.body.replaceChildren();
        vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => JSON.parse(readFileSync(`public/_locales/${String(url).includes('zh_CN') ? 'zh_CN' : 'en'}/messages.json`, 'utf8')) })));
        await setLocale('en');
        highlights = Array.from({length:21}, (_,i)=>({document:{platform:'chatgpt',conversationId:'sample',title:'Source',lastKnownUrl:'https://chatgpt.com/c/sample'},highlight:{id:`h${i}`,itemId:'item',target:{assistantMessageId:'a1'},quoteText:`Highlight ${i}`,sourceMarkdown:`Highlight ${i}`,selectors:{textQuote:{exact:`Highlight ${i}`,prefix:'',suffix:''},textPosition:{start:i,end:i+1},domRange:null,atomicRefs:[]},color:'blue',createdAt:1,updatedAt:21-i,revision:1}}));
        vi.mocked(highlightsClient.list).mockImplementation(async()=>structuredClone(highlights));
        vi.mocked(highlightsClient.update).mockImplementation(async(document,record,revision)=>{ const entry=highlights.find(e=>e.highlight.id===record.id)!; entry.highlight={...record,revision:revision+1}; return structuredClone(entry); });
        vi.mocked(highlightsClient.remove).mockImplementation(async(_document,id)=>{highlights=highlights.filter(e=>e.highlight.id!==id);});
        catalog=emptyMarkCatalog();vi.mocked(markLibraryClient.get).mockImplementation(async()=>structuredClone(catalog));
        vi.mocked(markLibraryClient.mutate).mockImplementation(async(operation,revision)=>{if(revision!==catalog.revision)throw new Error('Conflict');catalog.revision++;if(operation.type==='folder-put')catalog.folders.push({id:operation.id,parentId:operation.parentId,name:operation.name,createdAt:1,updatedAt:1});else if(operation.type==='rename')catalog.conversations=[{document:operation.document,folderId:null,customTitle:operation.title,updatedAt:1}];else if(operation.type==='move')catalog.conversations=operation.documents.map(document=>({document,folderId:operation.folderId,customTitle:catalog.conversations.find(c=>c.document.conversationId===document.conversationId)?.customTitle??null,updatedAt:1}));return structuredClone(catalog);});
        annotations=[];
        vi.mocked(readerAnnotationsClient.list).mockImplementation(async()=>({ok:true,data:{entries:structuredClone(annotations)}}));
        vi.mocked(readerAnnotationsClient.update).mockImplementation(async(document,record,revision)=>{const entry=annotations.find(e=>e.annotation.id===record.id)!;entry.annotation={...record,revision:revision+1};return {ok:true,data:{document,annotation:entry.annotation}};});
        vi.mocked(readerAnnotationsClient.remove).mockImplementation(async(_document,id)=>{annotations=annotations.filter(e=>e.annotation.id!==id);return {ok:true,data:{deleted:true,annotationId:id}};});
        records = Array.from({ length: 25 }, (_, n) => ({ kind: 'message', title: `Note ${n}`, userMessage: 'Question', aiResponse: `Answer ${n}`, url: 'https://chatgpt.com/c/sample', urlWithoutProtocol: 'chatgpt.com/c/sample', position: n, messageId: `m${n}`, folderPath: 'Work', platform: 'ChatGPT', timestamp: 100 - n }));
        vi.mocked(bookmarksClient.list).mockImplementation(async () => ({ ok: true, data: { bookmarks: records.map(record => ({ ...record })) } }));
        vi.mocked(bookmarksClient.positions).mockResolvedValue({ ok: true, data: { positions: [] } });
        vi.mocked(bookmarksClient.pageStatus).mockResolvedValue({ ok: true, data: { saved: false } });
        vi.mocked(bookmarksClient.foldersList).mockResolvedValue({ ok: true, data: { folderPaths: ['Work', 'Archive'], folders: ['Work', 'Archive'].map(path => ({ path, name: path, depth: 1, createdAt: 0, updatedAt: 0 })) } });
        vi.mocked(bookmarksClient.storageUsage).mockResolvedValue({ ok: true, data: { usedBytes: 0, quotaBytes: null, usedPercentage: 0, warningLevel: 'none' } } as any);
        vi.mocked(bookmarksClient.bulkMove).mockImplementation(async ({ items, targetFolderPath }) => {
            let moved = 0;
            for (const item of items) { const record = records.find(record => record.position === ('position' in item ? item.position : -1)); if (record) { record.folderPath = targetFolderPath; moved++; } }
            return { ok: true, data: { moved, missing: items.length - moved } };
        });
        vi.mocked(bookmarksClient.save).mockImplementation(async data => { const record = records.find(record => record.position === data.position)!; record.title = data.title ?? record.title; return { ok: true, data: {} } as any; });
        controller = new BookmarksPanelController({} as any);
        panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.toggle(); await settle();
        root = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
    });
    afterEach(async () => {
        panel?.hide();
        for (const host of [...document.querySelectorAll<HTMLElement>('[id^="aimd-"]')]) host.shadowRoot?.querySelector('.panel-window')?.dispatchEvent(new Event('animationend', { bubbles: true }));
        await settle(); document.body.replaceChildren(); vi.unstubAllGlobals();
    });
    it('keeps navigation mounted across modules and mounts only one page of records', async () => {
        const sidebar = root.querySelector('.bookmarks-sidebar');
        expect(root.querySelector('.library-folder-navigation .library-folder-heading')?.textContent).toContain('Bookmark folders');
        expect(root.querySelectorAll('.library-record')).toHaveLength(20);
        expect(root.querySelector('.library-bookmark-body .library-record time')).not.toBeNull();
        click('Settings'); click('Library'); await settle();
        expect(root.querySelector('.bookmarks-sidebar')).toBe(sidebar);
        click('Next page'); expect(root.querySelectorAll('.library-record')).toHaveLength(5);
    });
    it('keeps rename input on failure, then reflects the successful rename after re-opening', async () => {
        vi.mocked(bookmarksClient.save).mockResolvedValueOnce({ ok: false, message: 'Write failed' } as any);
        menuAction('Rename bookmark'); await settle();
        const input = root.querySelector<HTMLInputElement>('.mock-modal__input')!;
        const original = input.value; input.value = 'Revised';
        root.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')!.click(); await settle();
        expect(input.value).toBe('Revised'); expect(root.querySelector('.mock-modal__error')?.textContent).toBe('Write failed');
        root.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')!.click(); await settle();
        controller.setQuery('Revised');
        expect(root.querySelector('.library-record')?.textContent).toContain('Revised');
        expect(records.find(record => record.title === original)).toBeUndefined();
        await controller.refreshAll(); expect(root.querySelector('.library-record')?.textContent).toContain('Revised');
    });
    it('moves from a scoped folder and finds the record in its target folder', async () => {
        click('Work'); menuAction('Move bookmark'); await settle();
        const picker = document.getElementById('aimd-bookmark-save-dialog-host')!.shadowRoot!;
        expect(picker.querySelector<HTMLButtonElement>('.picker-main[data-path="Work"]')!.disabled).toBe(true);
        picker.querySelector<HTMLButtonElement>('.picker-main[data-path="Archive"]')!.click();
        picker.querySelector<HTMLButtonElement>('[data-action="bookmark-save-submit"]')!.click(); await settle();
        expect(controller.getSnapshot().vm.selectedFolderPath).toBe('Work');
        expect(controller.getSnapshot().vm.bookmarks).toHaveLength(24);
        click('Archive'); expect(root.querySelectorAll('.library-record')).toHaveLength(1);
    });
    it('selects the current page only and retains that selection when paging', async () => {
        click('Manage selection'); click('Select this page'); await settle();
        expect(controller.getSelectedBookmarkItems()).toHaveLength(20);
        click('Next page'); expect(root.querySelectorAll('.library-record input:checked')).toHaveLength(0);
        expect(controller.getSelectedBookmarkItems()).toHaveLength(20);
        click('Work'); expect(controller.getSelectedBookmarkItems()).toHaveLength(0);
    });
    it('opens real highlight records from the type navigation, recolors and clamps the final page after deletion', async () => {
        expect(root.querySelector('.panel-header__meta h2')?.textContent).toBe('Library');
        click('Highlights'); await settle();
        expect(root.querySelector('.library-mark-folders .library-folder-heading')?.textContent).toContain('Highlight folders');
        const marks = root.querySelector('.library-marks')!;
        expect(marks.querySelectorAll('.library-record')).toHaveLength(20);
        expect(marks.querySelector('.library-record time')).not.toBeNull();
        marks.querySelector<HTMLButtonElement>('.library-record')!.click();
        expect(marks.querySelector<HTMLAnchorElement>('.library-detail a')!.href).toBe('https://chatgpt.com/c/sample');
        marks.querySelector<HTMLButtonElement>('.library-detail [data-color="yellow"]')!.click(); await settle();
        expect(highlights[0].highlight.color).toBe('yellow');
        click('Close',marks); click('Next page',marks);
        expect(marks.querySelectorAll('.library-record')).toHaveLength(1);
        marks.querySelector<HTMLButtonElement>('.library-record')!.click(); click('Delete',marks); await settle();
        root.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')!.click(); await settle();
        expect(highlights).toHaveLength(20); expect(marks.querySelectorAll('.library-record')).toHaveLength(20);
        click('Bookmarks'); expect(root.querySelectorAll('.library-bookmark-body .library-record')).toHaveLength(20);
    });
    it('retries only the refresh after a successful highlight write and a failed reload', async () => {
        click('Highlights'); await settle(); const marks=root.querySelector('.library-marks')!;
        marks.querySelector<HTMLButtonElement>('.library-record')!.click();
        vi.mocked(highlightsClient.list).mockRejectedValueOnce(new Error('Read failed'));
        marks.querySelector<HTMLButtonElement>('.library-detail [data-color="red"]')!.click(); await settle();
        expect(marks.querySelector('.library-marks-notice')?.textContent).toContain('Saved. Refresh failed');
        click('Retry',marks); await settle();
        expect(highlightsClient.update).toHaveBeenCalledOnce();
        expect(marks.querySelector('.library-detail [data-color="red"]')?.getAttribute('aria-pressed')).toBe('true');
    });
    it('edits annotations with failure recovery and keeps the existing template settings reachable',async()=>{
        annotations=[{document:highlights[0].document,annotation:{...highlights[0].highlight,id:'note',comment:'Original note',lastKnownAnchorState:'anchored'}}];
        click('Annotations'); await settle(); const marks=root.querySelector('.library-marks')!;
        expect(root.querySelector('.library-mark-folders .library-folder-heading')?.textContent).toContain('Annotation folders');
        marks.querySelector<HTMLButtonElement>('.library-record')!.click(); click('Edit',marks);
        const editor=marks.querySelector<HTMLTextAreaElement>('textarea')!;editor.value='Revised note';
        vi.mocked(readerAnnotationsClient.update).mockResolvedValueOnce({ok:false,message:'Conflict'} as any);
        click('Save',marks); await settle(); expect(editor.value).toBe('Revised note'); expect(editor.isConnected).toBe(true);
        click('Save',marks); await settle(); expect(annotations[0].annotation.comment).toBe('Revised note');
        expect(marks.querySelector('textarea')).toBeNull(); expect(marks.querySelector('.library-annotation-text')?.textContent).toBe('Revised note');
        click('Templates',marks); await settle(); expect(root.querySelector('[data-category="marks"]')?.getAttribute('data-active')).toBe('true');
    });
    it('opens an annotation source when background navigation is unavailable', async () => {
        annotations=[{document:highlights[0].document,annotation:{...highlights[0].highlight,id:'note',comment:'Note',lastKnownAnchorState:'anchored'}}];
        vi.mocked(readerAnnotationsClient.navigate).mockRejectedValueOnce(new Error('Unavailable'));
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        try {
            click('Annotations'); await settle();
            root.querySelector<HTMLButtonElement>('.library-mark-record')!.click();
            root.querySelector<HTMLAnchorElement>('.library-detail a')!.click(); await settle();
            expect(open).toHaveBeenCalledWith('https://chatgpt.com/c/sample', '_blank', 'noopener');
        } finally { open.mockRestore(); }
    });
    it('uses the existing annotation navigation without opening a duplicate source tab', async () => {
        annotations=[{document:highlights[0].document,annotation:{...highlights[0].highlight,id:'note',comment:'Note',lastKnownAnchorState:'anchored'}}];
        vi.mocked(readerAnnotationsClient.navigate).mockResolvedValueOnce({ok:true,data:{tabId:77}} as any);
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        try {
            click('Annotations'); await settle();
            root.querySelector<HTMLButtonElement>('.library-mark-record')!.click();
            root.querySelector<HTMLAnchorElement>('.library-detail a')!.click(); await settle();
            expect(readerAnnotationsClient.navigate).toHaveBeenCalledOnce();
            expect(open).not.toHaveBeenCalled();
        } finally { open.mockRestore(); }
    });
    it('expands same-title conversations independently and clears selection when switching folders', async () => {
        highlights[20].document = {...highlights[20].document, conversationId:'other', lastKnownUrl:'https://chatgpt.com/c/other'};
        click('Highlights'); await settle();
        expect(root.querySelectorAll('.library-conversation-header')).toHaveLength(2);
        root.querySelector<HTMLButtonElement>('[data-conversation-id="other"]')!.click();
        expect(root.querySelectorAll('.library-mark-record')).toHaveLength(1);
        click('Manage selection'); click('Switch to conversations'); click('Select this page');
        expect(root.querySelector('.library-batch')?.textContent).toContain('2 conversations');
        click('Unfiled');
        expect(root.querySelector('.library-batch')?.textContent).toContain('0 conversations');
    });
    it('retains selection across pages and retries only failed batch recolors', async () => {
        click('Highlights'); await settle();
        click('Select items', root.querySelector('.library-conversation-group')!);
        click('Select this page'); click('Next page'); click('Select this page');
        expect(root.querySelector('.library-batch [aria-label="Select this page"]')).not.toBeNull();
        const batch = root.querySelector('.library-batch')!;
        expect(batch.textContent).toContain('21 selected');
        vi.mocked(highlightsClient.update).mockRejectedValueOnce(new Error('Conflict'));
        batch.querySelector<HTMLButtonElement>('[data-color="yellow"]')!.click();
        await vi.waitFor(() => expect(highlightsClient.update).toHaveBeenCalledTimes(21)); await settle();
        expect(batch.textContent).toContain('1 selected');
        expect(root.querySelector('.library-marks-notice')?.textContent).toContain('1 incomplete');
        batch.querySelector<HTMLButtonElement>('[data-color="yellow"]')!.click();
        await vi.waitFor(() => expect(highlightsClient.update).toHaveBeenCalledTimes(22)); await settle();
        expect(batch.textContent).toContain('0 selected');
        expect(highlights.every(entry => entry.highlight.color === 'yellow')).toBe(true);
    });
    it('uses the shared selection bar to select and invert all matching marks across pages', async () => {
        click('Highlights'); await settle();
        click('Manage selection');
        const batch = root.querySelector<HTMLElement>('.library-marks .library-selection-bar')!;

        expect(batch).toBeTruthy();
        for (const action of ['select-page', 'select-all-results', 'invert-selection', 'clear-selection', 'manage-done']) {
            expect(batch.querySelector(`[data-action="${action}"]`), action).toBeTruthy();
        }
        expect(batch.querySelectorAll('.library-selection-controls svg')).toHaveLength(0);
        clickAction('select-all-results', batch);
        expect(batch.querySelector('.library-selection-summary')?.textContent).toContain('21 selected');
        clickAction('invert-selection', batch);
        expect(batch.querySelector('.library-selection-summary')?.textContent).toContain('0 selected');
        clickAction('invert-selection', batch);
        expect(batch.querySelector('.library-selection-summary')?.textContent).toContain('21 selected');
    });
    it('keeps focus on the highlight selection command after the Shadow DOM bar redraws', async () => {
        click('Highlights'); await settle();
        click('Manage selection');
        const bar = root.querySelector<HTMLElement>('.library-marks .library-selection-bar')!;
        const selectAll = bar.querySelector<HTMLButtonElement>('[data-action="select-all-results"]')!;
        selectAll.focus();
        selectAll.click();

        expect(root.activeElement).toBe(bar.querySelector('[data-action="select-all-results"]'));
    });
    it('preserves a selected conversation when switching to item selection', async () => {
        highlights[20].document = {...highlights[20].document, conversationId:'other', lastKnownUrl:'https://chatgpt.com/c/other'};
        click('Highlights'); await settle();
        click('Manage selection');
        const batch = root.querySelector<HTMLElement>('.library-marks .library-selection-bar')!;
        clickAction('selection-scope-toggle', batch);
        clickAction('select-all-results', batch);
        expect(batch.querySelector('.library-selection-summary')?.textContent).toContain('2 conversations');
        clickAction('selection-scope-toggle', batch);
        expect(batch.querySelector('.library-selection-summary')?.textContent).toContain('21 selected');
    });
    it('confirms annotation batch scope, cancels cleanly and preserves failed deletions', async () => {
        annotations = highlights.slice(0,2).map((entry,i)=>({document:{...entry.document,conversationId:`conversation-${i}`},annotation:{...entry.highlight,id:`annotation-${i}`,comment:`Note ${i}`,lastKnownAnchorState:'anchored'}}));
        click('Annotations'); await settle(); click('Manage selection'); click('Switch to conversations'); click('Select this page');
        const batch = root.querySelector('.library-batch')!;
        click('Delete',batch); await settle();
        expect(root.querySelector('.mock-modal__message')?.textContent).toContain('2 conversations');
        root.querySelector<HTMLButtonElement>('[data-action="modal-cancel"]')!.click(); await settle();
        root.querySelector('.mock-modal[data-motion-state="closing"]')?.dispatchEvent(new Event('animationend', {bubbles:true}));
        expect(readerAnnotationsClient.remove).not.toHaveBeenCalled();
        click('Delete',batch); await settle();
        vi.mocked(readerAnnotationsClient.remove).mockResolvedValueOnce({ok:false,message:'Conflict'} as any);
        root.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')!.click();
        await vi.waitFor(() => expect(readerAnnotationsClient.remove).toHaveBeenCalledTimes(2)); await settle();
        expect(annotations).toHaveLength(1);
        expect(batch.textContent).toContain('1 selected');
        expect(root.querySelectorAll('.library-mark-record')).toHaveLength(1);
    });
    it('does not report saved when every batch write and the following refresh fail', async () => {
        click('Highlights'); await settle(); click('Select items', root.querySelector('.library-conversation-group')!); click('Select this page');
        vi.mocked(highlightsClient.update).mockRejectedValue(new Error('Conflict'));
        vi.mocked(highlightsClient.list).mockRejectedValueOnce(new Error('Read failed'));
        root.querySelector<HTMLButtonElement>('.library-batch [data-color="red"]')!.click();
        await vi.waitFor(() => expect(highlightsClient.update).toHaveBeenCalledTimes(20)); await settle();
        expect(root.querySelector('.library-marks-notice')?.textContent).not.toContain('Saved');
        click('Retry'); await settle();
        expect(highlightsClient.update).toHaveBeenCalledTimes(20);
        expect(root.querySelector('.library-batch')?.textContent).toContain('20 selected');
    });
    it('pages 500 conversations and windows 500 folders', async () => {
        const seed = highlights[0]; highlights = Array.from({length:500},(_,i)=>({...seed,document:{...seed.document,conversationId:`thread-${i}`,title:`Thread ${i}`},highlight:{...seed.highlight,id:`entry-${i}`}}));
        catalog.folders=Array.from({length:500},(_,i)=>({id:`f-${i}`,name:`Folder ${i}`,parentId:null,createdAt:1,updatedAt:1}));
        click('Highlights'); await settle();
        expect(root.querySelectorAll('[data-folder-id]')).toHaveLength(40);
        expect(root.querySelectorAll('[data-conversation-id]')).toHaveLength(20);
        expect(root.querySelectorAll('.library-mark-record')).toHaveLength(1);
        const search=root.querySelector<HTMLInputElement>('.library-marks input[type="search"]')!;search.value='Thread 499';search.dispatchEvent(new Event('input'));
        expect(root.querySelectorAll('[data-conversation-id]')).toHaveLength(1);
        expect(root.querySelector('[data-conversation-id]')?.getAttribute('data-conversation-id')).toBe('thread-499');
    });
    it('renames a selected root folder without changing its parent or conversation assignment', async () => {
        catalog.folders=[{id:'research',name:'Research',parentId:null,createdAt:1,updatedAt:1}];
        catalog.conversations=[{document:highlights[0].document,folderId:'research',customTitle:'Study notes',updatedAt:1}];
        click('Highlights');await settle();click('Research');
        click('Rename folder',root.querySelector('.library-folder-actions')!);await settle();
        root.querySelector<HTMLInputElement>('.mock-modal__input')!.value='Archive';
        vi.mocked(markLibraryClient.mutate).mockImplementationOnce(async()=>{
            catalog={...catalog,revision:1,folders:[{...catalog.folders[0],name:'Archive'}]};
            return structuredClone(catalog);
        });
        root.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')!.click();await settle();
        expect(markLibraryClient.mutate).toHaveBeenLastCalledWith({type:'folder-put',create:false,id:'research',parentId:null,name:'Archive'},0);
        expect(root.querySelector('[data-folder-id="research"]')?.textContent).toContain('Archive');
        expect(catalog.conversations[0].folderId).toBe('research');
        expect(root.querySelector('.library-conversation-toggle')?.textContent).toContain('Study notes');
    });
    it('reveals the selected folder under its new parent after moving it', async () => {
        catalog.folders=[
            {id:'research',name:'Research',parentId:null,createdAt:1,updatedAt:1},
            {id:'archive',name:'Archive',parentId:null,createdAt:1,updatedAt:1},
        ];
        click('Highlights');await settle();click('Research');
        click('Move folder',root.querySelector('.library-folder-actions')!);await settle();
        root.querySelector<HTMLButtonElement>('.library-folder-picker__option[data-folder-id="archive"]')!.click();
        vi.mocked(markLibraryClient.mutate).mockImplementationOnce(async()=>{
            catalog={...catalog,revision:1,folders:catalog.folders.map(f=>f.id==='research'?{...f,parentId:'archive'}:f)};
            return structuredClone(catalog);
        });
        click('Confirm',root.querySelector('.mock-modal__footer')!);await settle();
        expect(root.querySelector('[data-folder-id="research"]')?.getAttribute('aria-pressed')).toBe('true');
        expect(root.querySelector('[data-toggle-folder="archive"]')?.getAttribute('aria-expanded')).toBe('true');
    });
    it('renames a conversation with retry and shares its name and folder with annotations', async () => {
        annotations=[{document:highlights[0].document,annotation:{...highlights[0].highlight,id:'annotation',comment:'A note',lastKnownAnchorState:'anchored'}}];
        click('Highlights');await settle();
        click('Rename conversation',root.querySelector('.library-conversation-group')!);await settle();
        const input=root.querySelector<HTMLInputElement>('.mock-modal__input')!;input.value='Research notes';
        vi.mocked(markLibraryClient.mutate).mockRejectedValueOnce(new Error('Conflict'));
        root.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')!.click();await settle();
        expect(input.isConnected).toBe(true);expect(input.value).toBe('Research notes');
        root.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')!.click();await settle();
        root.querySelector('.mock-modal')?.dispatchEvent(new Event('animationend',{bubbles:true}));
        expect(root.querySelector('.library-conversation-toggle')?.textContent).toContain('Research notes');
        const original=structuredClone(highlights);
        catalog.folders=[{id:'research',name:'Research',parentId:null,createdAt:1,updatedAt:1}];
        click('Annotations');await settle();expect(root.querySelector('.library-conversation-toggle')?.textContent).toContain('Research notes');
        click('Move conversations',root.querySelector('.library-conversation-group')!);await settle();
        root.querySelector<HTMLButtonElement>('.library-folder-picker__option[data-folder-id="research"]')!.click();
        click('Confirm',root.querySelector('.mock-modal__footer')!);await settle();
        expect(catalog.conversations[0].folderId).toBe('research');expect(highlights).toEqual(original);
        click('Highlights');await settle();click('Research');expect(root.querySelectorAll('.library-mark-record')).toHaveLength(20);
        click('Unfiled');expect(root.querySelectorAll('.library-mark-record')).toHaveLength(0);
    });
    it('reconciles a delivered rename after its acknowledgement is lost without repeating the write', async () => {
        click('Highlights');await settle();click('Rename conversation',root.querySelector('.library-conversation-group')!);await settle();
        root.querySelector<HTMLInputElement>('.mock-modal__input')!.value='Saved name';
        vi.mocked(markLibraryClient.mutate).mockImplementationOnce(async operation=>{if(operation.type==='rename')catalog={...catalog,revision:1,conversations:[{document:operation.document,folderId:null,customTitle:operation.title,updatedAt:1}]};throw new Error('Response lost');});
        root.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')!.click();await settle();
        expect(markLibraryClient.mutate).toHaveBeenCalledOnce();expect(root.querySelector('.library-conversation-toggle')?.textContent).toContain('Saved name');
    });
    it('returns from information pages by clicking any settings category', async () => {
        click('Settings');await settle();
        for(const info of ['faq','changelog','about']){
            root.querySelector<HTMLButtonElement>(`button[data-tab-id="${info}"]`)!.click();
            root.querySelector<HTMLButtonElement>('.settings-category-navigation [data-category="input"]')!.click();await settle();
            expect(root.querySelector<HTMLElement>('.tab-panel[data-tab-id="settings"]')!.hidden).toBe(false);
            expect(root.querySelector<HTMLElement>(`.tab-panel[data-tab-id="${info}"]`)!.hidden).toBe(true);
            expect(root.querySelector('.aimd-panel-title')?.textContent).toBe('Settings');
            expect(root.querySelector('.settings-catalog-header h2')?.textContent).toBe('Writing & prompts');
        }
    });
    it.each(['Highlights','Annotations'])('keeps %s readable when the folder service is unavailable and retries without writes', async type => {
        annotations=highlights.map(entry=>({document:entry.document,annotation:{...entry.highlight,comment:'Note',lastKnownAnchorState:'anchored'}}));
        vi.mocked(markLibraryClient.get).mockRejectedValueOnce(new Error('Invalid folder response'));
        click(type);await settle();
        expect(root.querySelectorAll('.library-mark-record')).toHaveLength(20);
        expect(root.querySelector<HTMLElement>('.library-marks-notice')!.hidden).toBe(false);
        expect(root.querySelector('.library-mark-folders')?.hasAttribute('inert')).toBe(true);
        expect(root.querySelector<HTMLButtonElement>('[aria-label="Rename conversation"]')!.disabled).toBe(true);
        expect(markLibraryClient.mutate).not.toHaveBeenCalled();
        click('Retry');await settle();
        expect(root.querySelector<HTMLElement>('.library-marks-notice')!.hidden).toBe(true);
        expect(root.querySelector('.library-mark-folders')?.hasAttribute('inert')).toBe(false);
    });
    it('groups project and ordinary URLs for one webpage under its stable conversation identity', async () => {
        highlights[1].document={...highlights[0].document,lastKnownUrl:'https://chatgpt.com/g/project/c/sample?ref=sidebar'};
        click('Highlights');await settle();
        expect(root.querySelectorAll('.library-conversation-group')).toHaveLength(1);
        expect(root.querySelector('.library-conversation-count')?.textContent).toBe('21');
    });
    it('opens settings directly even if the library is already open', async () => {
        await panel.show({tab:'settings'});await settle();
        expect(panel.isVisible()).toBe(true);expect(root.querySelector('[data-tab-id="settings"]')?.getAttribute('aria-pressed')).toBe('true');
        root.querySelector<HTMLButtonElement>('[data-tab-id="about"]')!.click();expect(root.querySelector('.settings-category-navigation [aria-pressed="true"]')).toBeNull();
        click('Settings');expect(root.querySelector('.settings-category-navigation [aria-pressed="true"]')).not.toBeNull();
    });
    it('bounds thousands of records to one page and searches the complete collection',async()=>{
        const seed=highlights[0]; highlights=Array.from({length:3000},(_,i)=>({...seed,highlight:{...seed.highlight,id:`large-${i}`,quoteText:`Passage ${i}`}}));
        click('Highlights'); await settle(); const marks=root.querySelector('.library-marks')!;
        expect(marks.querySelectorAll('.library-record')).toHaveLength(20);
        const search=marks.querySelector<HTMLInputElement>('input')!;search.value='Passage 2999';search.dispatchEvent(new Event('input'));
        expect(marks.querySelectorAll('.library-record')).toHaveLength(1); expect(marks.textContent).toContain('Passage 2999');
    });
});
