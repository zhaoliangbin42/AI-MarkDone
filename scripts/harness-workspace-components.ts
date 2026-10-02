import {chromium, firefox, expect, type Locator} from '@playwright/test';
import {createServer} from 'vite';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const output = resolve('output/workspace-components', new Date().toISOString().replace(/[:.]/g,'-'));
mkdirSync(output,{recursive:true});
const server = await createServer({root:process.cwd(),configFile:resolve('vite.config.ts'),logLevel:'error',server:{host:'127.0.0.1',port:0}});
const results: string[] = [];

async function checkFeatureTableGeometry(overview: Locator, sideBySide: boolean): Promise<void> {
    const geometry = await overview.evaluate(el => {
        const bounds = el.getBoundingClientRect();
        const tables = Array.from(el.querySelectorAll<HTMLTableElement>('table'));
        return {
            bounds: { left: bounds.left, right: bounds.right },
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            tables: tables.map(table => ({
                bounds: table.getBoundingClientRect().toJSON(),
                rows: Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr[data-feature-id]')).map(row => {
                    const name = row.querySelector('th[scope="row"]')!;
                    const usage = row.querySelector('td')!;
                    const entry = usage.querySelector<HTMLElement>('.feature-overview-entry')!;
                    return { bounds: row.getBoundingClientRect().toJSON(), name: name.getBoundingClientRect().toJSON(), usage: usage.getBoundingClientRect().toJSON(), entry: entry.getBoundingClientRect().toJSON(),
                        nameFont: parseFloat(getComputedStyle(name).fontSize), entryFont: parseFloat(getComputedStyle(entry).fontSize),
                        entryClientWidth: entry.clientWidth, entryScrollWidth: entry.scrollWidth,
                        nameText: name.textContent?.trim(), entryText: entry.textContent?.trim(),
                    };
                }),
            })),
        };
    });
    expect(geometry.scrollWidth,'Feature overview has no horizontal clipping').toBeLessThanOrEqual(geometry.clientWidth + 1);
    for (const table of geometry.tables) {
        expect(table.bounds.left).toBeGreaterThanOrEqual(geometry.bounds.left - 1);
        expect(table.bounds.right).toBeLessThanOrEqual(geometry.bounds.right + 1);
        for (const row of table.rows) {
            expect(row.nameText).toBeTruthy();
            expect(row.entryText).toBeTruthy();
            expect(row.nameFont,'Function labels remain readable').toBeGreaterThanOrEqual(12);
            expect(row.entryFont,'Entry instructions remain readable').toBeGreaterThanOrEqual(12);
            for (const cell of [row.name,row.usage,row.entry]) {
                expect(cell.width).toBeGreaterThan(0);
                expect(cell.height).toBeGreaterThan(0);
                expect(cell.left).toBeGreaterThanOrEqual(table.bounds.left - 1);
                expect(cell.right).toBeLessThanOrEqual(table.bounds.right + 1);
            }
            expect(row.entryScrollWidth,'Entry instructions wrap within their cell').toBeLessThanOrEqual(row.entryClientWidth + 1);
            if (sideBySide) expect(row.usage.left,'Function and entry occupy separate left/right columns').toBeGreaterThanOrEqual(row.name.right - 1);
        }
        const [first,second] = table.rows;
        if (first && second) expect(second.bounds.top,'Each feature occupies its own vertically ordered row').toBeGreaterThanOrEqual(first.bounds.bottom - 1);
    }
}

await server.listen();
try {
    const address = server.httpServer!.address(); if (!address || typeof address === 'string') throw new Error('Missing server');
    for (const [name,engine] of [['chromium',chromium],['firefox',firefox]] as const) {
        const browser = await engine.launch({headless:true});
        try {
            for (const theme of ['light','dark']) {
                const page = await browser.newPage({viewport:{width:1280,height:900},locale:'en-US'});
                await page.goto(`http://127.0.0.1:${address.port}/mocks/components/bookmarks-workspace/index.html?view=settings&theme=${theme}`);
                const featuredFonts=await page.locator('.library-info-featured').evaluateAll(buttons=>buttons.map(button=>({button:getComputedStyle(button).fontSize,label:getComputedStyle(button.querySelector('span:last-child')!).fontSize})));
                for(const font of featuredFonts)expect(font.label,'Information labels must use their navigation font size').toBe(font.button);
                const featuredSpacing = await page.locator('.library-info-featured-links').evaluate(el => {
                    const buttons = Array.from(el.querySelectorAll('.library-info-featured'));
                    return { gap: parseFloat(getComputedStyle(el).gap), padding: buttons.map(button => parseFloat(getComputedStyle(button).paddingTop)) };
                });
                expect(featuredSpacing.gap).toBeGreaterThanOrEqual(8);
                for (const padding of featuredSpacing.padding) expect(padding).toBeGreaterThanOrEqual(8);
                const navigationStructure = await page.locator('.settings-navigation-scroll').evaluate(el => ({
                    categories: Array.from(el.querySelectorAll<HTMLElement>('.settings-category-navigation [data-category]')).map(button => button.dataset.category),
                    information: Array.from(el.querySelectorAll<HTMLElement>('.library-info-links [data-tab-id]')).map(button => button.dataset.tabId),
                    categoryScrollOwner: el.querySelector('.settings-category-navigation')?.closest('.settings-navigation-scroll') === el,
                    informationScrollOwner: el.querySelector('.library-info-links')?.closest('.settings-navigation-scroll') === el,
                    divider: parseFloat(getComputedStyle(el.querySelector('.library-info-links')!).borderTopWidth),
                    overflowX: getComputedStyle(el).overflowX,
                }));
                expect(navigationStructure.categories).toEqual(['appearance','reading','input','marks','export','controls','data','advanced']);
                expect(navigationStructure.information).toEqual(['features','changelog','faq','about','feedback']);
                expect(navigationStructure.categoryScrollOwner).toBe(true);
                expect(navigationStructure.informationScrollOwner).toBe(true);
                expect(navigationStructure.divider).toBeGreaterThan(0);
                expect(navigationStructure.overflowX).toBe('hidden');
                expect(await page.locator('.library-info-featured-links [data-tab-id]').evaluateAll(buttons => buttons.map(button => (button as HTMLElement).dataset.tabId))).toEqual(['mappamory','sponsor']);
                expect(await page.locator('.library-info-featured-links').evaluate(el => el.closest('.settings-navigation-scroll'))).toBeNull();
                for (const category of ['appearance','reading','input','marks','export','controls','data','advanced']) {
                    const button = page.locator(`.settings-category-navigation [data-category="${category}"]`);
                    await button.click(); await expect(button).toHaveAttribute('aria-pressed','true');
                    expect(await button.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
                    await page.screenshot({path:resolve(output,`${name}-${theme}-${category}.png`)});
                }
                expect(await page.locator('.library-info-links').evaluate(el=>el.tagName)).not.toBe('DETAILS');
                await page.locator('.library-info-links [data-tab-id="about"]').click();
                await expect(page.locator('.settings-category-navigation [aria-pressed="true"]')).toHaveCount(0);
                for(const tab of ['faq','changelog','about']){
                    await page.locator(`.library-info-links [data-tab-id="${tab}"]`).click();
                    await page.locator('.settings-category-navigation [data-category="input"]').click();
                    await expect(page.locator('.tab-panel[data-tab-id="settings"]')).toBeVisible();
                    await expect(page.locator(`.tab-panel[data-tab-id="${tab}"]`)).toBeHidden();
                    await expect(page.locator('.settings-catalog-header h2')).toHaveText('Writing & prompts');
                }
                await page.locator('.library-module-button[data-tab-id="settings"]').click();
                await expect(page.locator('.settings-category-navigation [aria-pressed="true"]')).toHaveCount(1);

                await page.locator('.library-info-links [data-tab-id="features"]').click();
                const overview = page.locator('.aimd-feature-overview');
                const featureSearch = overview.locator('[data-role="feature-search"]');
                await expect(overview.locator('.feature-overview-item:visible')).toHaveCount(50);
                await expect(overview.locator('[data-feature-section]:visible')).toHaveCount(8);
                await expect(overview.locator('table')).toHaveCount(8);
                for (const table of await overview.locator('table').all()) {
                    await expect(table.locator('thead th[scope="col"]')).toHaveCount(2);
                    for (const label of await table.locator('thead th').allTextContents()) expect(label.trim(),'Column headers name their content').not.toBe('');
                    const rows = await table.locator('tbody tr[data-feature-id]').evaluateAll(rows => rows.map(row => ({
                        cells: row.children.length,
                        headers: row.querySelectorAll(':scope > th[scope="row"]').length,
                        entries: row.querySelectorAll(':scope > td').length,
                    })));
                    for (const row of rows) expect(row).toEqual({cells:2,headers:1,entries:1});
                }
                await checkFeatureTableGeometry(overview,true);
                await page.screenshot({path:resolve(output,`${name}-${theme}-feature-overview.png`)});
                await featureSearch.fill('{{cursor}}');
                await expect(overview.locator('.feature-overview-item:visible')).toHaveCount(1);
                await page.locator('.workspace-corner-actions [data-action="workspace-fullscreen"]').click();
                await expect(page.locator('.panel-window--bookmarks')).toHaveAttribute('data-fullscreen','1');
                await expect(page.locator('.workspace-corner-actions [data-action="workspace-fullscreen"]')).toHaveAttribute('aria-label','Exit fullscreen');
                const fullscreenGeometry = await page.locator('.panel-window--bookmarks').boundingBox();
                expect(fullscreenGeometry?.x).toBe(0);
                expect(fullscreenGeometry?.y).toBe(0);
                expect(fullscreenGeometry?.width).toBe(1280);
                expect(fullscreenGeometry?.height).toBe(900);
                await overview.locator('[data-action="feature-open-settings"][data-category="input"]').click();
                await expect(page.locator('.settings-catalog-header h2')).toHaveText('Writing & prompts');
                await expect(page.locator('.settings-category-navigation [data-category="input"]')).toHaveAttribute('aria-pressed','true');
                await page.locator('.library-info-links [data-tab-id="features"]').click();
                await expect(featureSearch).toHaveValue('{{cursor}}');
                await expect(overview.locator('.feature-overview-item:visible')).toHaveCount(1);
                await expect(page.locator('.panel-window--bookmarks')).toHaveAttribute('data-fullscreen','1');
                await featureSearch.fill('');
                await expect(overview.locator('.feature-overview-item:visible')).toHaveCount(50);
                await page.screenshot({path:resolve(output,`${name}-${theme}-feature-overview-fullscreen.png`)});
                await page.locator('.workspace-corner-actions [data-action="workspace-fullscreen"]').click();
                await expect(page.locator('.panel-window--bookmarks')).toHaveAttribute('data-fullscreen','0');
                for (const width of [760,390]) {
                    await page.setViewportSize({width,height:800});
                    await checkFeatureTableGeometry(overview,false);
                    const promotionsBefore = await page.locator('.library-info-featured-links').boundingBox();
                    await page.locator('.library-info-links [data-tab-id="feedback"]').scrollIntoViewIfNeeded();
                    const promotionsAfter = await page.locator('.library-info-featured-links').boundingBox();
                    expect(Math.abs(promotionsAfter!.y - promotionsBefore!.y),'Promotions stay fixed while information links scroll').toBeLessThanOrEqual(1);
                    await expect(page.locator('.settings-navigation-scroll')).toHaveCSS('overflow-x','hidden');
                    await expect(page.locator('.workspace-corner-actions [data-action="workspace-fullscreen"]')).toBeVisible();
                    await expect(page.locator('.workspace-corner-actions [data-action="close"]')).toBeVisible();
                    await page.screenshot({path:resolve(output,`${name}-${theme}-feature-overview-${width}.png`)});
                }
                await page.setViewportSize({width:1280,height:900});
                await expect(page.locator('.panel-window--bookmarks [data-action="close"]')).toHaveCount(1);
                await page.locator('.workspace-corner-actions [data-action="close"]').click();
                await expect(page.locator('.panel-window--bookmarks')).toHaveCount(0);
                const trigger=page.locator('.aimd-chatgpt-message-stepper__trigger');await trigger.hover();
                await expect(trigger).toHaveAttribute('aria-expanded','true');
                await expect(trigger.locator('.aimd-chatgpt-message-stepper__settings')).toBeVisible();
                await expect(page.locator('.aimd-chatgpt-message-stepper__actions [data-action="open-bookmarks-panel"]')).toHaveCount(0);
                await trigger.click();
                await expect(page.locator('.panel-window--bookmarks')).toBeVisible();
                await expect(page.locator('.panel-window--bookmarks')).toHaveAttribute('data-fullscreen','0');
                await expect(page.locator('.library-module-button[data-tab-id="settings"]')).toHaveAttribute('aria-pressed','true');
                await page.goto(`http://127.0.0.1:${address.port}/mocks/components/reader-panel/index.html?theme=${theme}`);
                await page.locator('[data-action="reader-settings"]').click();
                await page.locator('[data-action="reader-settings-comment-template"]').click();
                const dialog = page.locator('.reader-settings-popover--template');
                const primary = dialog.locator('[data-action="save"]');
                const colors = await primary.evaluate(el=>{
                    const canvas = document.createElement('canvas'); canvas.width=canvas.height=1; const context=canvas.getContext('2d');
                    const style=getComputedStyle(el); const pixels:number[][]=[];
                    for(const color of [style.color,style.backgroundColor]) {context!.clearRect(0,0,1,1);context!.fillStyle=color;context!.fillRect(0,0,1,1);pixels.push(Array.from(context!.getImageData(0,0,1,1).data));}
                    return pixels;
                });
                const values=colors.map(p=>p.slice(0,3).map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[0.2126,0.7152,0.0722][i],0));
                const contrast=(Math.max(...values)+0.05)/(Math.min(...values)+0.05);
                expect(contrast,'Template Save button contrast').toBeGreaterThanOrEqual(3);
                await page.screenshot({path:resolve(output,`${name}-${theme}-template.png`)});
                await dialog.locator('[data-action="cancel"]').click(); await expect(dialog).toHaveCount(0);
                await page.goto(`http://127.0.0.1:${address.port}/mocks/components/bookmarks-workspace/index.html?view=library&theme=${theme}`);
                await page.locator('[data-action="set-bookmarks-tab"][data-tab="bookmarks"]').click();
                const firstBookmark=page.locator('.library-bookmark-record').first();
                const moveBookmark=firstBookmark.getByRole('button',{name:'Move bookmark',exact:true});
                await expect(moveBookmark).toBeVisible();
                const geometry=await firstBookmark.locator('.library-record-actions').evaluate(el=>{const box=el.getBoundingClientRect();const panel=el.closest('.aimd-panel')!.getBoundingClientRect();return {right:box.right,panelRight:panel.right,buttons:el.querySelectorAll('button').length};});
                expect(geometry.buttons,'Bookmark actions are laid out inline').toBeGreaterThanOrEqual(3);
                expect(geometry.right).toBeLessThanOrEqual(geometry.panelRight);
                expect(await page.locator('.library-bookmark-body .search-field input').evaluate(el=>getComputedStyle(el).boxShadow)).toBe('none');
                await page.screenshot({path:resolve(output,`${name}-${theme}-bookmark-actions.png`)});
                await moveBookmark.click();
                const picker = page.locator('.panel-window--bookmark-save');
                await expect(picker).toBeVisible();
                await picker.locator('.picker-main[data-path="Projects"]').click();
                await expect(picker.locator('[data-action="bookmark-save-submit"]')).toBeEnabled();
                await page.screenshot({path:resolve(output,`${name}-${theme}-folder-picker.png`)});
                await picker.locator('[data-action="close-panel"]').filter({hasText:'Cancel'}).click();
                await expect(picker).toHaveCount(0);
                await page.goto(`http://127.0.0.1:${address.port}/mocks/components/host-integrated-controls/index.html`);
                await expect(page.locator('.aimd-chatgpt-directory-preview')).toHaveCSS('visibility','hidden');
                if(theme==='dark')await page.getByRole('button',{name:'Toggle light / dark'}).click();
                const capsule=page.locator('.official-actions [data-aimd-variant="capsule"]');
                await capsule.locator('[data-action="toggle-capsule"]').click();
                await expect(capsule.locator('.capsule-actions')).toBeVisible();
                const clipping=await capsule.locator('.group-left').evaluate(el=>{
                    const bounds=el.getBoundingClientRect();
                    return Array.from(el.querySelectorAll('button')).map(button=>button.getBoundingClientRect().right-bounds.right);
                });
                for(const overflow of clipping)expect(overflow,'Expanded toolbar actions must fit when space is available').toBeLessThanOrEqual(1);
                await capsule.locator('[data-action="bookmark_toggle"]').click();
                await page.screenshot({path:resolve(output,`${name}-${theme}-message-capsule.png`)});
                await page.keyboard.press('Escape');
                await expect(capsule.locator('[data-action="toggle-capsule"]')).toHaveAttribute('aria-expanded','false');
                await page.setViewportSize({width:375,height:667});
                await page.screenshot({path:resolve(output,`${name}-${theme}-message-capsule-narrow-closed.png`),animations:'disabled'});
                await capsule.locator('[data-action="toggle-capsule"]').click();
                await capsule.locator('[data-action="copy-markdown"]').click();
                await page.screenshot({path:resolve(output,`${name}-${theme}-message-capsule-narrow.png`)});
                results.push(`${name} ${theme}: settings, shared navigation scroll, feature overview search/return, fullscreen, fixed promotions, Reader annotation template, folder picker and message capsule`); await page.close();
            }
        } finally { await browser.close(); }
    }
} finally { await server.close(); writeFileSync(resolve(output,'summary.json'),JSON.stringify(results,null,2)+'\n'); }
process.stdout.write(`Workspace component evidence: ${output}\n`);
