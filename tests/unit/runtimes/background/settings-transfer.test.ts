import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { DEFAULT_SETTINGS } from '../../../../src/core/settings/types';
import { createSettingsFile } from '../../../../src/core/settings/portableSettings';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../../../../src/contracts/storage';
import type { ExtRequest } from '../../../../src/contracts/protocol';

function storage(state: Record<string, unknown>) {
    return {
        get: vi.fn(async (key: string) => ({ [key]: structuredClone(state[key]) })),
        set: vi.fn(async (patch: Record<string, unknown>) => { Object.assign(state, structuredClone(patch)); }),
    };
}
describe('settings file background authority', () => {
    let current: Record<string, unknown>;
    let library: Record<string, unknown>;
    let sync: ReturnType<typeof storage>;
    let local: ReturnType<typeof storage>;
    let handle: typeof import('../../../../src/runtimes/background/handlers/settings').handleSettingsRequest;
    const fileText = JSON.stringify({ format: 'ai-markdone-settings', formatVersion: 1, appVersion: '6.0.0', exportedAt: '2026-09-30T00:00:00.000Z', settings: { language: 'en', behavior: { showWordCount: false } } });
    const request = async (type: string, payload?: unknown) => (await handle({ v: 1, id: 'test', type, payload } as ExtRequest))!.response as any;
    beforeEach(async () => {
        vi.resetModules();
        vi.stubGlobal('crypto', webcrypto);
        current = { [LEGACY_STORAGE_KEYS.appSettingsKey]: structuredClone(DEFAULT_SETTINGS) };
        library = {
            'bookmark:existing': { markdown: 'keep bookmark', messageId: 'message-1' },
            [STORAGE_KEYS.bookmarksIndexV1]: ['bookmark:existing'],
            [STORAGE_KEYS.readerAnnotationsDocumentPrefixV1 + 'doc']: { notes: ['keep annotation'] },
            'aimd:highlights:document:v1:doc': { highlights: ['keep highlight'] },
            [STORAGE_KEYS.promptLibraryV1]: { prompts: ['keep prompt'] },
            'auth': { accessToken: 'private-token' },
        };
        sync = storage(current); local = storage(library);
        vi.stubGlobal('browser', { runtime: { getManifest: () => ({ version: '6.0.0', manifest_version: 3 }) }, storage: { sync, local } });
        handle = (await import('../../../../src/runtimes/background/handlers/settings')).handleSettingsRequest;
    });
    afterEach(() => { vi.unstubAllGlobals(); });
    it('exports without reading local data or leaking free text and credentials', async () => {
        (current[LEGACY_STORAGE_KEYS.appSettingsKey] as typeof DEFAULT_SETTINGS).reader.commentExport.template = [{ type: 'text', value: 'private-token' }];
        const result = await request('settings:export');
        expect(result.ok).toBe(true);
        expect(JSON.stringify(result)).not.toContain('private-token');
        expect(local.get).not.toHaveBeenCalled();
        expect(sync.set).not.toHaveBeenCalled();
    });
    it('previews without writes, and persists only settings plus one safe recovery point', async () => {
        const libraryBefore = structuredClone(library);
        const before = await request('settings:previewImport', { fileText });
        expect(before.ok).toBe(true);
        expect(before.data.preview.changes).toHaveLength(2);
        expect(sync.set).not.toHaveBeenCalled(); expect(local.set).not.toHaveBeenCalled();
        const result = await request('settings:applyImport', { fileText, expectedFingerprint: before.data.preview.fingerprint, categories: ['behavior', 'language'] });
        expect(result).toMatchObject({ ok: true, data: { applied: true } });
        expect(sync.set).toHaveBeenCalledTimes(1);
        expect(Object.keys(sync.set.mock.calls[0][0])).toEqual([LEGACY_STORAGE_KEYS.appSettingsKey]);
        expect(Object.keys(local.set.mock.calls[0][0])).toEqual([STORAGE_KEYS.settingsRecoveryV1]);
        const { [STORAGE_KEYS.settingsRecoveryV1]: recovery, ...unchanged } = library;
        expect(unchanged).toEqual(libraryBefore);
        expect(JSON.stringify(recovery)).not.toContain('private-token');
        expect((current[LEGACY_STORAGE_KEYS.appSettingsKey] as typeof DEFAULT_SETTINGS).language).toBe('en');
        const read = await request('settings:getRecovery');
        expect(read).toMatchObject({ ok: true, data: { file: { format: 'ai-markdone-settings', settings: { language: 'auto' } } } });
    });
    it('does not overwrite a change made after preview', async () => {
        const preview = (await request('settings:previewImport', { fileText })).data.preview;
        (current[LEGACY_STORAGE_KEYS.appSettingsKey] as typeof DEFAULT_SETTINGS).appearance.fontSizePx = 18;
        expect(await request('settings:applyImport', { fileText, expectedFingerprint: preview.fingerprint, categories: ['language'] })).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
        expect(sync.set).not.toHaveBeenCalled(); expect(local.set).not.toHaveBeenCalled();
    });
    it('treats equal settings and empty selection as a no-op', async () => {
        const identical = JSON.stringify(createSettingsFile(DEFAULT_SETTINGS, '6.0.0'));
        const preview = (await request('settings:previewImport', { fileText: identical })).data.preview;
        expect(await request('settings:applyImport', { fileText: identical, expectedFingerprint: preview.fingerprint, categories: ['behavior'] })).toMatchObject({ ok: true, data: { applied: false } });
        expect(sync.set).not.toHaveBeenCalled(); expect(local.set).not.toHaveBeenCalled();
    });
    it('rejects invalid files before writing anything', async () => {
        expect(await request('settings:applyImport', { fileText: '{', expectedFingerprint: '', categories: [] })).toMatchObject({ ok: false, error: { code: 'INVALID_IMPORT' } });
        expect(sync.set).not.toHaveBeenCalled(); expect(local.set).not.toHaveBeenCalled();
    });
    it('does not write settings if saving the recovery point fails', async () => {
        const preview = (await request('settings:previewImport', { fileText })).data.preview;
        local.set.mockRejectedValueOnce(new Error('storage unavailable'));
        expect((await request('settings:applyImport', { fileText, expectedFingerprint: preview.fingerprint, categories: ['language'] })).ok).toBe(false);
        expect(sync.set).not.toHaveBeenCalled();
    });
    it('rejects browser item quota before even writing recovery', async () => {
        Object.assign(sync, { QUOTA_BYTES_PER_ITEM: 20 });
        const preview = (await request('settings:previewImport', { fileText })).data.preview;
        expect(await request('settings:applyImport', { fileText, expectedFingerprint: preview.fingerprint, categories: ['language'] })).toMatchObject({ ok: false, error: { code: 'QUOTA_EXCEEDED' } });
        expect(sync.set).not.toHaveBeenCalled(); expect(local.set).not.toHaveBeenCalled();
    });
    it('reports write and read-back failures without replaying or destructive rollback', async () => {
        const preview = (await request('settings:previewImport', { fileText })).data.preview;
        sync.set.mockRejectedValueOnce(new Error('write unavailable'));
        expect((await request('settings:applyImport', { fileText, expectedFingerprint: preview.fingerprint, categories: ['language'] })).ok).toBe(false);
        expect(sync.set).toHaveBeenCalledTimes(1);
        expect((current[LEGACY_STORAGE_KEYS.appSettingsKey] as typeof DEFAULT_SETTINGS).language).toBe('auto');
    });
    it('rejects total sync quota before writing recovery or settings',async()=>{
        Object.assign(sync,{QUOTA_BYTES:40,getBytesInUse:vi.fn(async(key:unknown)=>key===null?200:100)});
        const preview=(await request('settings:previewImport',{fileText})).data.preview;
        expect(await request('settings:applyImport',{fileText,expectedFingerprint:preview.fingerprint,categories:['language']})).toMatchObject({ok:false,error:{code:'QUOTA_EXCEEDED'}});expect(sync.set).not.toHaveBeenCalled();expect(local.set).not.toHaveBeenCalled();
    });
    it('reports an inconsistent read-back without a second write or rollback',async()=>{
        const preview=(await request('settings:previewImport',{fileText})).data.preview;
        sync.set.mockImplementationOnce(async(patch)=>{Object.assign(current,structuredClone(patch));(current[LEGACY_STORAGE_KEYS.appSettingsKey] as typeof DEFAULT_SETTINGS).appearance.fontSizePx=18;});
        expect(await request('settings:applyImport',{fileText,expectedFingerprint:preview.fingerprint,categories:['language']})).toMatchObject({ok:false,error:{code:'CONFLICT'}});expect(sync.set).toHaveBeenCalledTimes(1);expect(local.set).toHaveBeenCalledTimes(1);
    });
    it('serializes concurrent imports and rejects the second stale confirmation',async()=>{
        const preview=(await request('settings:previewImport',{fileText})).data.preview;const payload={fileText,expectedFingerprint:preview.fingerprint,categories:['language']};
        const [first,second]=await Promise.all([request('settings:applyImport',payload),request('settings:applyImport',payload)]);expect(first).toMatchObject({ok:true,data:{applied:true}});expect(second).toMatchObject({ok:false,error:{code:'CONFLICT'}});expect(sync.set).toHaveBeenCalledTimes(1);
    });
    it('does not write when every category is deselected',async()=>{
        const preview=(await request('settings:previewImport',{fileText})).data.preview;expect(await request('settings:applyImport',{fileText,expectedFingerprint:preview.fingerprint,categories:[]})).toMatchObject({ok:true,data:{applied:false}});expect(sync.set).not.toHaveBeenCalled();expect(local.set).not.toHaveBeenCalled();
    });

    it('rejects future stored schemas without writing, resetting or exporting defaults',async()=>{
        current[LEGACY_STORAGE_KEYS.appSettingsKey]={version:6,privatePreference:'keep'};const before=structuredClone(current);
        for(const type of ['settings:getAll','settings:export','settings:setCategory','settings:reset'])expect(await request(type,{category:'language',value:'en'})).toMatchObject({ok:false,error:{code:'SCHEMA_UNSUPPORTED'}});expect(current).toEqual(before);expect(sync.set).not.toHaveBeenCalled();expect(local.set).not.toHaveBeenCalled();
    });
    it('declares runtime capabilities and rejects a newer exporter before any writes',async()=>{
        expect(await request('settings:getAll')).toMatchObject({ok:true,data:{capabilities:{appVersion:'6.0.0',settingsVersion:5,settingsFileFormatVersion:1,buttonsPreferences:true}}});
        const file=JSON.parse(fileText);file.appVersion='6.1.0';expect(await request('settings:previewImport',{fileText:JSON.stringify(file)})).toMatchObject({ok:false,error:{code:'SCHEMA_UNSUPPORTED'}});expect(sync.set).not.toHaveBeenCalled();expect(local.set).not.toHaveBeenCalled();
    });

});
