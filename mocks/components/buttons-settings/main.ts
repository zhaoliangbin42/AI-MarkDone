import { installVisualHarnessBridge, type VisualHarnessVariant } from '../visualHarnessBridge';
import { createAppearanceSnapshot } from '../../../src/style/appearance';
import '../browserExtensionMock';
import { ButtonsSettingsView } from './ButtonsSettingsView';
import { DEFAULT_SETTINGS } from '../../../src/core/settings/types';
import { setLocale } from '../../../src/ui/content/components/i18n';
await setLocale('zh_CN');
const view = new ButtonsSettingsView(async () => true,async options=>(await import('../../../src/runtimes/export-renderer/formulaMathJax')).renderFormulaSvgAsset({...options,fontSizePx:options.fontSizePx??36}));
view.setState(structuredClone(DEFAULT_SETTINGS));
document.getElementById('app')!.append(view.root);
const { SettingsTransferPanel } = await import('./SettingsTransferPanel');
const { createSettingsFile, mergePortableSettings } = await import('../../../src/core/settings/portableSettings');
const { previewSettingsImport } = await import('../../../src/services/settings/settingsTransfer');
let current = structuredClone(DEFAULT_SETTINGS);
let recovery = null as ReturnType<typeof createSettingsFile> | null;
const transfer = new SettingsTransferPanel({ exportSettings: async () => createSettingsFile(current, '6.0.0'), previewImport: async (text) => previewSettingsImport(current, text), applyImport: async (text, fingerprint, categories) => { const preview = await previewSettingsImport(current, text); if (preview.fingerprint !== fingerprint)
        throw new Error('CONFLICT'); recovery = createSettingsFile(current, '6.0.0'); current = mergePortableSettings(current, preview.file.settings, categories); return true; }, getRecovery: async () => recovery, onApplied: async () => { view.setState(current); } });
document.getElementById('app')!.append(transfer.root);
let variant: VisualHarnessVariant = { theme: 'light', locale: 'zh_CN' };
async function applyVariant(next: VisualHarnessVariant) { variant = next; await setLocale(next.locale); view.setAppearance(createAppearanceSnapshot(next.theme)); view.setState(current); transfer.setAppearance(createAppearanceSnapshot(next.theme)); }
installVisualHarnessBridge({ applyVariant, prepareForAudit: async () => undefined, getState: () => ({ ...variant, expectedOpenSurfaces: [{ role: 'settings-buttons', count: 1 }, { role: 'settings-transfer', count: 1 }], localeEvidence: view.root.shadowRoot?.textContent ?? '' }) });
window.addEventListener('pagehide', () => { view.dispose(); transfer.dispose(); }, { once: true });
