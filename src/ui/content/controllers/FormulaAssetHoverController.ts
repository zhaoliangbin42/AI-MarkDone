import { MathClickHandler, type MathFormulaHoverContext } from '../../../drivers/content/math/math-click';
import { browser } from '../../../drivers/shared/browser';
import { showEphemeralTooltip } from '../../../utils/tooltip';
import { ToolbarHoverActionPortal } from '../components/ToolbarHoverActionPortal';
import { runFormulaAssetAction, type FormulaAssetAction } from '../../../services/math/formulaAssetActions';

export class FormulaAssetHoverController {
    private readonly mathClick: MathClickHandler;
    private hoverActionPortal: ToolbarHoverActionPortal | null = null;
    private hoverActionOpenTimer: number | null = null;
    private hoverActionCloseTimer: number | null = null;
    private hoverActionTriggerInside = false;
    private hoverActionPortalInside = false;
    private activeContext: MathFormulaHoverContext | null = null;
    private actionPending = false;

    constructor() {
        this.mathClick = new MathClickHandler({
            onFormulaHoverEnter: (context) => this.scheduleHoverActionOpen(context),
            onFormulaHoverLeave: () => this.scheduleHoverActionClose(),
            onFormulaDisable: () => this.disposePortal(),
        });
    }

    enable(container: HTMLElement): void {
        this.mathClick.enable(container);
    }

    disable(): void {
        this.mathClick.disable();
    }

    private getHoverActionPortal(): ToolbarHoverActionPortal {
        if (!this.hoverActionPortal) {
            this.hoverActionPortal = new ToolbarHoverActionPortal(this.readTheme());
        }
        return this.hoverActionPortal;
    }

    private readTheme(): 'light' | 'dark' {
        const theme = document.documentElement.getAttribute('data-aimd-theme')
            || document.body?.getAttribute('data-aimd-theme')
            || document.documentElement.dataset.theme
            || '';
        return theme === 'dark' ? 'dark' : 'light';
    }

    private scheduleHoverActionOpen(context: MathFormulaHoverContext): void {
        this.activeContext = context;
        this.hoverActionTriggerInside = true;
        this.clearHoverActionCloseTimer();
        this.clearHoverActionOpenTimer();
        this.hoverActionOpenTimer = window.setTimeout(() => {
            if (!this.activeContext) return;
            this.openHoverAction(this.activeContext);
        }, 100);
    }

    private scheduleHoverActionClose(): void {
        this.hoverActionTriggerInside = false;
        this.clearHoverActionOpenTimer();
        this.clearHoverActionCloseTimer();
        this.hoverActionCloseTimer = window.setTimeout(() => {
            if (this.hoverActionTriggerInside || this.hoverActionPortalInside) return;
            this.closeHoverAction();
        }, 120);
    }

    private clearHoverActionOpenTimer(): void {
        if (this.hoverActionOpenTimer !== null) {
            window.clearTimeout(this.hoverActionOpenTimer);
            this.hoverActionOpenTimer = null;
        }
    }

    private clearHoverActionCloseTimer(): void {
        if (this.hoverActionCloseTimer !== null) {
            window.clearTimeout(this.hoverActionCloseTimer);
            this.hoverActionCloseTimer = null;
        }
    }

    private closeHoverAction(): void {
        this.clearHoverActionOpenTimer();
        this.clearHoverActionCloseTimer();
        this.hoverActionTriggerInside = false;
        this.hoverActionPortalInside = false;
        this.activeContext = null;
        this.hoverActionPortal?.close();
    }

    private disposePortal(): void {
        this.closeHoverAction();
        this.hoverActionPortal?.dispose();
        this.hoverActionPortal = null;
    }

    private openHoverAction(context: MathFormulaHoverContext): void {
        this.clearHoverActionOpenTimer();
        this.clearHoverActionCloseTimer();
        this.getHoverActionPortal().open({
            anchorEl: context.anchor,
            actions: [
                {
                    id: 'copy_formula_png',
                    label: getI18nLabel('formulaCopyAsPng', 'Copy as PNG'),
                    onClick: () => void this.handleFormulaAssetAction(context, 'copy_png'),
                },
                {
                    id: 'copy_formula_svg',
                    label: getI18nLabel('formulaCopyAsSvg', 'Copy as SVG'),
                    onClick: () => void this.handleFormulaAssetAction(context, 'copy_svg'),
                },
                {
                    id: 'save_formula_png',
                    label: getI18nLabel('formulaSaveAsPng', 'Save as PNG'),
                    onClick: () => void this.handleFormulaAssetAction(context, 'save_png'),
                },
                {
                    id: 'save_formula_svg',
                    label: getI18nLabel('formulaSaveAsSvg', 'Save as SVG'),
                    onClick: () => void this.handleFormulaAssetAction(context, 'save_svg'),
                },
            ],
            onPointerEnter: () => {
                this.hoverActionPortalInside = true;
                this.clearHoverActionCloseTimer();
            },
            onPointerLeave: () => {
                this.hoverActionPortalInside = false;
                this.scheduleHoverActionClose();
            },
            onRequestClose: () => this.closeHoverAction(),
        });
    }

    private async handleFormulaAssetAction(context: MathFormulaHoverContext, action: FormulaAssetAction): Promise<void> {
        if (this.actionPending) return;
        this.actionPending = true;
        showEphemeralTooltip({ anchor: context.anchor, text: getI18nLabel('formulaAssetRendering', 'Rendering...') });
        try {
            const result = await runFormulaAssetAction({
                action,
                source: context.source,
                displayMode: context.displayMode,
            });
            const text = result.ok
                ? getI18nLabel(result.status === 'saved' ? 'formulaAssetSaved' : 'btnCopied', result.status === 'saved' ? 'Saved' : 'Copied!')
                : result.message;
            showEphemeralTooltip({ anchor: context.anchor, text });
            this.closeHoverAction();
        } finally {
            this.actionPending = false;
        }
    }
}

function getI18nLabel(key: string, fallback: string): string {
    try {
        return browser.i18n.getMessage(key) || fallback;
    } catch {
        return fallback;
    }
}
