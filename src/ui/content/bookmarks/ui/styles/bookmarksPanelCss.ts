import type { Theme } from '../../../../../core/types/theme';
import { browser } from '../../../../../drivers/shared/browser';
import { getTokenCss } from '../../../../../style/tokens';

export function getBookmarksPanelCss(theme: Theme): string {
    const isDark = theme === 'dark';
    const katexUrl = (() => {
        try {
            return browser.runtime.getURL('vendor/katex/katex.min.css');
        } catch {
            return '';
        }
    })();

    // Legacy-style semantic tokens (scoped to this panel only).
    const overlayHeavy = isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)';
    const overlayBackdrop = 'blur(8px) saturate(150%)';
    const borderSubtle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const borderStrong = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)';
    const interactiveHover = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
    const interactiveActive = isDark ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.08)';
    const shadowXs = isDark ? '0 1px 2px rgba(0,0,0,0.55)' : '0 1px 2px rgba(0,0,0,0.12)';
    const shadowSm = isDark ? '0 4px 12px rgba(0,0,0,0.45)' : '0 4px 12px rgba(0,0,0,0.12)';
    const shadowLg = isDark ? '0 18px 50px rgba(0,0,0,0.60)' : '0 18px 50px rgba(0,0,0,0.22)';
    const shadowXl = isDark ? '0 26px 80px rgba(0,0,0,0.65)' : '0 26px 80px rgba(0,0,0,0.24)';
    const shadowFocus = isDark ? '0 0 0 2px rgba(37,99,235,0.32)' : '0 0 0 2px rgba(37,99,235,0.22)';
    const scrollbarThumb = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.16)';
    const scrollbarThumbHover = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.24)';

    const space6 = 'calc(var(--aimd-space-4) * 1.5)';
    const space8 = 'calc(var(--aimd-space-4) * 2)';
    const iconHit = 'calc(var(--aimd-size-icon-md) + var(--aimd-space-2))';
    const tabsWidth = 'calc(var(--aimd-space-4) * 10)'; /* 160px */
    const selectMinWidth = 'calc(var(--aimd-space-4) * 9)'; /* 144px */

    return `
${getTokenCss(theme)}
${katexUrl ? `@import url("${katexUrl}");` : ''}

:host {
  --aimd-font-sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  --aimd-text-xs: var(--aimd-font-size-xs);
  --aimd-text-sm: var(--aimd-font-size-sm);
  --aimd-text-base: 14px;
  --aimd-text-lg: 16px;
  --aimd-text-xl: 18px;
  --aimd-leading-normal: 1.5;
  --aimd-font-medium: 500;
  --aimd-font-semibold: 600;
  --aimd-radius-xs: 4px;
  --aimd-radius-sm: 6px;
  --aimd-radius-xl: 12px;
  --aimd-radius-2xl: 16px;
  --aimd-duration-fast: 150ms;
  --aimd-duration-base: 200ms;
  --aimd-duration-slow: 300ms;
  --aimd-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --aimd-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out: var(--aimd-ease-out);

  --aimd-bg-overlay-heavy: ${overlayHeavy};
  --aimd-overlay-backdrop: ${overlayBackdrop};
  --aimd-border-subtle: ${borderSubtle};
  --aimd-border-strong: ${borderStrong};
  --aimd-border-focus: var(--aimd-interactive-primary);
  --aimd-shadow-xs: ${shadowXs};
  --aimd-shadow-sm: ${shadowSm};
  --aimd-shadow-lg: ${shadowLg};
  --aimd-shadow-xl: ${shadowXl};
  --aimd-shadow-focus: ${shadowFocus};

  --aimd-interactive-hover: ${interactiveHover};
  --aimd-interactive-active: ${interactiveActive};
  --aimd-interactive-selected: var(--aimd-interactive-highlight);
  --aimd-interactive-danger: #ef4444;

  /* Legacy-aligned semantic aliases (panel-scoped; do not depend on global token completeness) */
  --aimd-bg-tertiary: color-mix(in srgb, var(--aimd-bg-secondary) 82%, var(--aimd-bg-primary));
  --aimd-bg-surface: var(--aimd-bg-primary);
  --aimd-text-tertiary: color-mix(in srgb, var(--aimd-text-secondary) 72%, transparent);
  --aimd-text-warning: ${isDark ? '#fbbf24' : '#b45309'};
  --aimd-text-link: var(--aimd-interactive-primary);
  --aimd-text-link-hover: var(--aimd-interactive-primary-hover);

  --aimd-button-primary-bg: var(--aimd-interactive-primary);
  --aimd-button-primary-hover: var(--aimd-interactive-primary-hover);
  --aimd-button-primary-text: var(--aimd-text-on-primary);
  --aimd-button-secondary-bg: var(--aimd-bg-secondary);
  --aimd-button-secondary-hover: color-mix(in srgb, var(--aimd-bg-secondary) 70%, var(--aimd-interactive-hover));
  --aimd-button-secondary-text: var(--aimd-text-primary);

  --aimd-shadow-md: ${isDark ? '0 8px 20px rgba(0,0,0,0.50)' : '0 8px 20px rgba(0,0,0,0.14)'};
  --aimd-feedback-danger-bg: color-mix(in srgb, #ef4444 14%, transparent);
  --aimd-color-warning: ${isDark ? '#fbbf24' : '#f59e0b'};
  --aimd-color-danger: #ef4444;

  --aimd-button-icon-bg: transparent;
  --aimd-button-icon-text: var(--aimd-text-secondary);
  --aimd-button-icon-hover: var(--aimd-interactive-hover);
  --aimd-button-icon-text-hover: var(--aimd-text-primary);
  --aimd-button-icon-active: var(--aimd-interactive-selected);

  --aimd-scrollbar-thumb: ${scrollbarThumb};
  --aimd-scrollbar-thumb-hover: ${scrollbarThumbHover};

  --aimd-tree-indent-base: 10px;
  --aimd-tree-indent-step: 28px;
}

/* Reset (Shadow DOM scoped) */
* { box-sizing: border-box; }
button, input, select, textarea { font-family: inherit; font-size: inherit; line-height: inherit; color: inherit; }
button { cursor: pointer; }
input::placeholder { opacity: 1; }

.aimd-icon { display: inline-flex; align-items: center; justify-content: center; }
.aimd-icon svg { width: 16px; height: 16px; display: block; }

.aimd-icon-btn {
  all: unset;
  cursor: pointer;
  user-select: none;
  width: ${iconHit};
  height: ${iconHit};
  border-radius: var(--aimd-radius-md);
  display: grid;
  place-items: center;
  color: var(--aimd-button-icon-text);
  border: 1px solid transparent;
  background: var(--aimd-button-icon-bg);
  transition: all var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.aimd-icon-btn:hover { background: var(--aimd-button-icon-hover); color: var(--aimd-button-icon-text-hover); }
.aimd-icon-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.aimd-icon-btn:active { background: var(--aimd-button-icon-active); transform: translateY(0) scale(0.96); }
.aimd-icon-btn:focus-visible { outline: 2px solid var(--aimd-border-focus); outline-offset: 2px; }
.aimd-icon-btn[data-active="1"] { background: var(--aimd-bg-secondary); color: var(--aimd-text-primary); border-color: var(--aimd-border-default); }
.aimd-icon-btn--primary { color: var(--aimd-text-on-primary); background: var(--aimd-interactive-primary); }
.aimd-icon-btn--primary:hover { background: var(--aimd-interactive-primary-hover); }
.aimd-icon-btn--danger { color: var(--aimd-text-primary); border-color: var(--aimd-state-error-border); }

.aimd-panel-overlay {
  position: fixed;
  inset: 0;
  background: var(--aimd-bg-overlay-heavy);
  z-index: 0;
  backdrop-filter: var(--aimd-overlay-backdrop);
  -webkit-backdrop-filter: var(--aimd-overlay-backdrop);
}

.aimd-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  width: var(--aimd-panel-width);
  max-width: min(var(--aimd-panel-max-width), 860px);
  height: var(--aimd-panel-height);
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-2xl);
  box-shadow: var(--aimd-shadow-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  overscroll-behavior: contain;
  font-family: var(--aimd-font-sans);
}

.aimd-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-4) ${space6};
  background: var(--aimd-bg-secondary);
  border-bottom: 1px solid var(--aimd-border-subtle);
}
.aimd-panel-title {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
  font-size: var(--aimd-text-lg);
  font-weight: var(--aimd-font-semibold);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.aimd-tabs {
  display: grid;
  grid-template-columns: ${tabsWidth} 1fr;
  min-height: 0;
  flex: 1;
}

.aimd-tabs-sidebar {
  border-right: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-secondary);
  padding: var(--aimd-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--aimd-space-1);
  overflow: auto;
  min-height: 0;
  overscroll-behavior: contain;
}

.aimd-tab-btn {
  all: unset;
  cursor: pointer;
  user-select: none;
  border-radius: var(--aimd-radius-md);
  padding: var(--aimd-space-3);
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
  color: var(--aimd-text-secondary);
  border: 1px solid transparent;
  position: relative;
  transition: all var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.aimd-tab-btn:hover { background: var(--aimd-interactive-hover); color: var(--aimd-text-primary); }
.aimd-tab-btn[data-active="1"] {
  background: var(--aimd-interactive-selected);
  color: var(--aimd-text-primary);
  border-color: transparent;
  box-shadow: inset 3px 0 0 var(--aimd-interactive-primary);
}
.aimd-tab-icon svg { width: 18px; height: 18px; }
.aimd-tab-label { font-size: var(--aimd-text-xs); font-weight: var(--aimd-font-semibold); }

.aimd-tabs-body { min-height: 0; overflow: hidden; overscroll-behavior: contain; }
.aimd-tab-content { display: none; height: 100%; }
.aimd-tab-content[data-active="1"] { display: block; }

/* Bookmarks tab layout */
/* IMPORTANT: tab visibility must be controlled only by [data-active] to prevent "tabs do nothing". */
.aimd-tab-content.aimd-bookmarks { display: none; }
.aimd-tab-content[data-active="1"].aimd-bookmarks {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* Settings/Sponsor tabs (simple content views) */
.aimd-tab-content.aimd-settings,
.aimd-tab-content.aimd-sponsor { display: none; }
.aimd-tab-content[data-active="1"].aimd-settings,
.aimd-tab-content[data-active="1"].aimd-sponsor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.aimd-settings-wrap,
.aimd-sponsor-wrap {
  padding: ${space6};
}

.aimd-bookmarks-toolbar {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-3) ${space6};
  border-bottom: 1px solid var(--aimd-border-subtle);
  background: var(--aimd-bg-primary);
  flex-wrap: wrap;
  --aimd-toolbar-control-height: 40px;
}

.aimd-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
  border: 1.5px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  padding: 0 var(--aimd-space-3);
  background: var(--aimd-bg-primary);
  height: var(--aimd-toolbar-control-height);
  box-sizing: border-box;
  transition: all var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.aimd-search:hover { border-color: var(--aimd-border-strong); }
.aimd-search:focus-within {
  border-color: var(--aimd-interactive-primary);
  box-shadow: var(--aimd-shadow-focus);
}
.aimd-search input {
  all: unset;
  flex: 1;
  min-width: 0;
  font-size: var(--aimd-text-base);
  color: var(--aimd-text-primary);
}
.aimd-search .aimd-icon { color: var(--aimd-text-secondary); }

/* Platform dropdown (custom; legacy-like) */
.aimd-platform { position: relative; min-width: ${selectMinWidth}; height: var(--aimd-toolbar-control-height); }
.aimd-platform-btn {
  all: unset;
  cursor: pointer;
  user-select: none;
  border: 1.5px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  padding: 0 var(--aimd-space-3);
  font-size: var(--aimd-text-sm);
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  height: 100%;
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  box-sizing: border-box;
  transition: border-color var(--aimd-duration-fast) var(--aimd-ease-in-out),
              box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out),
              background var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.aimd-platform-btn:hover { background: var(--aimd-interactive-hover); border-color: var(--aimd-border-strong); }
.aimd-platform-btn:focus-visible { outline: none; border-color: var(--aimd-border-focus); box-shadow: var(--aimd-shadow-focus); }
.aimd-platform-icon { display: inline-flex; align-items: center; color: var(--aimd-text-secondary); }
.aimd-platform-icon svg { width: 16px; height: 16px; }
.aimd-platform-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aimd-platform-caret { display: inline-flex; align-items: center; color: var(--aimd-text-secondary); transition: transform var(--aimd-duration-fast) var(--aimd-ease-in-out); }
.aimd-platform[data-open="1"] .aimd-platform-caret { transform: rotate(180deg); }
.aimd-platform-btn[data-selected="chatgpt"] { background: rgba(16,163,127,0.14); border-color: rgba(16,163,127,0.22); }
.aimd-platform-btn[data-selected="all"] { background: var(--aimd-bg-primary); }
.aimd-platform-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--aimd-bg-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  box-shadow: var(--aimd-shadow-sm);
  overflow: hidden;
  padding: 6px;
  display: none;
  z-index: var(--aimd-z-tooltip);
}
.aimd-platform-menu[data-open="1"] { display: block; }
.aimd-platform-option {
  all: unset;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
  padding: 8px 10px;
  border-radius: var(--aimd-radius-md);
  color: var(--aimd-text-primary);
}
.aimd-platform-option:hover { background: var(--aimd-interactive-hover); }
.aimd-platform-option:focus-visible { outline: none; box-shadow: var(--aimd-shadow-focus); }
.aimd-platform-option-icon { display: inline-flex; align-items: center; color: var(--aimd-text-secondary); }
.aimd-platform-option-icon svg { width: 16px; height: 16px; }
.aimd-platform-option-label { font-size: var(--aimd-text-sm); font-weight: var(--aimd-font-medium); }

.aimd-toolbar-right {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
}
.aimd-toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-secondary);
  height: var(--aimd-toolbar-control-height);
  box-sizing: border-box;
}
.aimd-toolbar-group .aimd-icon-btn {
  width: 34px;
  height: 34px;
  border-radius: var(--aimd-radius-md);
}
.aimd-toolbar-group .aimd-icon-btn:hover {
  background: var(--aimd-interactive-hover);
  color: var(--aimd-text-primary);
}
.aimd-toolbar-group .aimd-icon-btn[data-active="1"] {
  background: var(--aimd-interactive-active);
  border-color: transparent;
}

.aimd-scroll {
  flex: 1;
  overflow: auto;
  padding: var(--aimd-space-2);
}

/* Settings/Sponsor manage their own inner padding like legacy */
.aimd-settings .aimd-scroll,
.aimd-sponsor .aimd-scroll { padding: 0; }

.aimd-batch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-2) ${space6};
  background: var(--aimd-bg-secondary);
  border-bottom: 1px solid var(--aimd-border-default);
  font-size: var(--aimd-font-size-xs);
  color: var(--aimd-text-secondary);
}
.aimd-batch[data-active="0"] { display: none; }
.aimd-batch-actions { display: flex; gap: var(--aimd-space-1); }

.aimd-tree { padding: var(--aimd-space-2) ${space6}; }
.aimd-tree::-webkit-scrollbar { width: 10px; height: 10px; }
.aimd-tree::-webkit-scrollbar-track { background: transparent; }
.aimd-tree::-webkit-scrollbar-thumb {
  background: var(--aimd-scrollbar-thumb);
  border-radius: var(--aimd-radius-sm);
  border: 2px solid transparent;
  background-clip: padding-box;
}
.aimd-tree::-webkit-scrollbar-thumb:hover { background: var(--aimd-scrollbar-thumb-hover); }
.aimd-tree-node { display: block; }
.aimd-tree-children { display: block; }
.aimd-tree-children[data-expanded="0"] { display: none; }

.aimd-tree-item {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
  min-height: 34px;
  padding: var(--aimd-space-2) var(--aimd-space-3);
  padding-right: 132px;
  border-radius: var(--aimd-radius-lg);
  cursor: pointer;
  user-select: none;
  font-size: var(--aimd-text-sm);
  color: var(--aimd-text-primary);
  margin-bottom: var(--aimd-space-1);
  background: transparent;
  border: none;
  border-bottom: none;
  position: relative;
  transition: all var(--aimd-duration-base) var(--aimd-ease-out);
}
.aimd-tree-item:hover { background: var(--aimd-interactive-hover); }
.aimd-tree-item:focus { outline: none; }
.aimd-tree-item:focus-visible { box-shadow: var(--aimd-shadow-focus); }
.aimd-tree-item[data-selected="1"] {
  background: var(--aimd-interactive-selected);
  box-shadow: inset 3px 0 0 var(--aimd-interactive-primary);
  font-weight: var(--aimd-font-medium);
}

.aimd-tree-caret {
  all: unset;
  width: var(--aimd-size-icon-md);
  height: var(--aimd-size-icon-md);
  display: grid;
  place-items: center;
  border-radius: var(--aimd-radius-md);
  color: var(--aimd-text-secondary);
  cursor: pointer;
  flex: 0 0 auto;
}
.aimd-tree-caret:hover { background: var(--aimd-interactive-hover); color: var(--aimd-text-primary); }
.aimd-tree-caret:disabled { opacity: 0.35; cursor: default; }
.aimd-tree-check { width: 14px; height: 14px; flex: 0 0 auto; }

.aimd-tree-folder-icon { display: inline-flex; align-items: center; color: var(--aimd-text-secondary); flex: 0 0 auto; }
.aimd-tree-folder-icon svg { width: 16px; height: 16px; }

.aimd-tree-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aimd-tree-count { color: var(--aimd-text-secondary); flex: 0 0 auto; }

.aimd-tree-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.aimd-tree-title { font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aimd-tree-subtitle { color: var(--aimd-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.aimd-tree-actions {
  display: inline-flex;
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  gap: var(--aimd-space-1);
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
  flex: 0 0 auto;
}
.aimd-tree-item:hover .aimd-tree-actions,
.aimd-tree-item:focus-within .aimd-tree-actions {
  opacity: 1;
  pointer-events: auto;
}

.aimd-tree-action-btn { width: ${iconHit}; height: ${iconHit}; }
.aimd-tree-action-btn {
  background: var(--aimd-button-icon-bg);
  color: var(--aimd-button-icon-text);
  border-radius: var(--aimd-radius-sm);
}
.aimd-tree-action-btn:hover { background: var(--aimd-button-icon-hover); color: var(--aimd-button-icon-text-hover); }
.aimd-tree-action-btn:active { background: var(--aimd-button-icon-active); transform: translateY(0) scale(0.96); }

/* Folder filter bar */
.aimd-tree-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-2) ${space6};
  border-bottom: 1px solid var(--aimd-border-subtle);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
}
.aimd-tree-filter-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aimd-tree-filter-clear { width: 32px; height: 32px; }

/* Empty state */
.aimd-empty {
  margin: ${space8} ${space6};
  border: 1px dashed var(--aimd-border-default);
  border-radius: var(--aimd-radius-xl);
  padding: ${space8};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--aimd-space-3);
  color: var(--aimd-text-secondary);
  text-align: center;
}
.aimd-empty-icon { color: var(--aimd-text-secondary); opacity: 0.8; }
.aimd-empty-icon svg { width: 28px; height: 28px; }
.aimd-empty-title { font-size: var(--aimd-text-sm); font-weight: var(--aimd-font-semibold); color: var(--aimd-text-primary); }
.aimd-empty-desc { font-size: var(--aimd-font-size-xs); color: var(--aimd-text-secondary); max-width: 520px; line-height: var(--aimd-leading-normal); }
.aimd-empty-actions { display: inline-flex; gap: var(--aimd-space-2); flex-wrap: wrap; justify-content: center; }
.aimd-empty-primary,
.aimd-empty-secondary {
  all: unset;
  cursor: pointer;
  user-select: none;
  padding: 9px 14px;
  border-radius: var(--aimd-radius-lg);
  border: 1px solid var(--aimd-border-default);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
}
.aimd-empty-primary { background: var(--aimd-interactive-primary); color: var(--aimd-text-on-primary); border-color: transparent; }
.aimd-empty-primary:hover { background: var(--aimd-interactive-primary-hover); }
.aimd-empty-secondary:hover { background: var(--aimd-interactive-hover); }
.aimd-empty-primary:focus-visible,
.aimd-empty-secondary:focus-visible { outline: none; box-shadow: var(--aimd-shadow-focus); }

/* Detail modal */
.aimd-detail { display: flex; flex-direction: column; gap: var(--aimd-space-3); }
.aimd-detail-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  padding: 10px 12px;
  border: 1px solid var(--aimd-border-subtle);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-secondary);
}
.aimd-detail-meta-left { display: inline-flex; align-items: center; gap: var(--aimd-space-2); min-width: 0; }
.aimd-platform-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: var(--aimd-font-size-xs);
  font-weight: var(--aimd-font-semibold);
  background: var(--aimd-interactive-selected);
  color: var(--aimd-text-primary);
  flex: 0 0 auto;
}
.aimd-platform-badge svg { width: 14px; height: 14px; }
.aimd-platform-badge--chatgpt { background: rgba(16,163,127,0.18); color: var(--aimd-text-primary); }
.aimd-platform-badge--gemini { background: rgba(37,99,235,0.14); color: var(--aimd-text-primary); }
.aimd-detail-folder { color: var(--aimd-text-secondary); font-size: var(--aimd-font-size-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aimd-detail-meta-right { color: var(--aimd-text-secondary); font-size: var(--aimd-font-size-xs); flex: 0 0 auto; }
.aimd-detail-sections { display: flex; flex-direction: column; gap: var(--aimd-space-3); }
.aimd-detail-section { border: 1px solid var(--aimd-border-subtle); border-radius: var(--aimd-radius-xl); overflow: hidden; }
.aimd-detail-section-title {
  padding: 10px 12px;
  font-size: var(--aimd-font-size-xs);
  font-weight: var(--aimd-font-semibold);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--aimd-text-secondary);
  background: var(--aimd-bg-secondary);
  border-bottom: 1px solid var(--aimd-border-subtle);
}
.aimd-detail-text { padding: 12px; color: var(--aimd-text-primary); white-space: pre-wrap; line-height: var(--aimd-leading-normal); }
.aimd-detail-markdown { padding: 12px; }
.aimd-detail-markdown :where(p) { margin: 0 0 10px 0; }
.aimd-detail-markdown :where(ul, ol) { margin: 0 0 10px 18px; padding: 0; }
.aimd-detail-markdown :where(li) { margin: 4px 0; }
.aimd-detail-markdown :where(h1, h2, h3) { margin: 14px 0 8px; font-weight: var(--aimd-font-semibold); }
.aimd-detail-markdown :where(h1) { font-size: 18px; }
.aimd-detail-markdown :where(h2) { font-size: 16px; }
.aimd-detail-markdown :where(h3) { font-size: 14px; }
.aimd-detail-markdown :where(code) { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
.aimd-detail-markdown :where(pre) {
  margin: 10px 0;
  padding: 10px 12px;
  border-radius: var(--aimd-radius-lg);
  border: 1px solid var(--aimd-border-subtle);
  background: var(--aimd-bg-secondary);
  overflow: auto;
}
.aimd-detail-markdown :where(pre code) { background: transparent; padding: 0; border: none; }
.aimd-detail-markdown :where(blockquote) {
  margin: 10px 0;
  padding: 10px 12px;
  border-left: 3px solid var(--aimd-border-strong);
  background: var(--aimd-bg-secondary);
  border-radius: var(--aimd-radius-lg);
  color: var(--aimd-text-secondary);
}

.aimd-panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-3);
  border-top: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-secondary);
}
.aimd-status { font-size: var(--aimd-font-size-xs); color: var(--aimd-text-secondary); min-height: 1em; }
.aimd-meta { font-size: var(--aimd-font-size-xs); color: var(--aimd-text-secondary); }

/* Modal */
.aimd-modal-host { position: fixed; inset: 0; z-index: var(--aimd-z-tooltip); pointer-events: none; }
.aimd-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--aimd-bg-overlay-heavy);
  backdrop-filter: var(--aimd-overlay-backdrop);
  -webkit-backdrop-filter: var(--aimd-overlay-backdrop);
  pointer-events: auto;
  display: grid;
  place-items: center;
  padding: ${space8};
}
.aimd-modal {
  width: min(520px, 100%);
  background: var(--aimd-bg-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-xl);
  box-shadow: var(--aimd-shadow-xl);
  overflow: hidden;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
}
.aimd-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-4) ${space6};
  background: var(--aimd-bg-secondary);
  border-bottom: 1px solid var(--aimd-border-subtle);
}
.aimd-modal-title { font-size: var(--aimd-text-lg); font-weight: var(--aimd-font-semibold); }
.aimd-modal-close {
  all: unset;
  cursor: pointer;
  width: ${iconHit};
  height: ${iconHit};
  display: grid;
  place-items: center;
  border-radius: var(--aimd-radius-md);
  color: var(--aimd-text-secondary);
}
.aimd-modal-close:hover { background: var(--aimd-interactive-hover); color: var(--aimd-text-primary); }
.aimd-modal-close svg { width: 16px; height: 16px; }

.aimd-modal-content {
  padding: var(--aimd-space-4) ${space6};
  display: flex;
  flex-direction: column;
  gap: var(--aimd-space-2);
  overflow: auto;
}
.aimd-modal-message { font-size: var(--aimd-text-base); color: var(--aimd-text-secondary); white-space: pre-wrap; line-height: var(--aimd-leading-normal); }
.aimd-modal-input-wrap { display: flex; }
.aimd-modal-input {
  all: unset;
  width: 100%;
  border: 1.5px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-md);
  padding: var(--aimd-space-2) var(--aimd-space-3);
  font-size: var(--aimd-text-base);
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  transition: border-color var(--aimd-duration-fast) var(--aimd-ease-in-out),
              box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.aimd-modal-input::placeholder { color: var(--aimd-text-secondary); }
.aimd-modal-input:focus { outline: none; border-color: var(--aimd-border-focus); box-shadow: var(--aimd-shadow-focus); }
.aimd-modal-error { color: var(--aimd-text-secondary); font-size: var(--aimd-font-size-xs); }

.aimd-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-4) ${space6};
  border-top: 1px solid var(--aimd-border-subtle);
  background: var(--aimd-bg-secondary);
}
.aimd-modal-btn {
  all: unset;
  cursor: pointer;
  user-select: none;
  padding: var(--aimd-space-2) var(--aimd-space-4);
  border-radius: var(--aimd-radius-md);
  border: 1px solid var(--aimd-border-default);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
  color: var(--aimd-text-primary);
  background: var(--aimd-bg-primary);
  transition: all var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.aimd-modal-btn:hover { background: var(--aimd-interactive-hover); border-color: var(--aimd-border-strong); }
.aimd-modal-btn--primary {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
  border-color: transparent;
}
.aimd-modal-btn--primary:hover { background: var(--aimd-interactive-primary-hover); }
.aimd-modal-btn--danger { border-color: var(--aimd-state-error-border); }

/* =========================
   Settings tab (legacy parity)
   ========================= */
.settings-content {
  padding: ${space6};
  max-width: 600px;
  margin: 0 auto;
}
.settings-group {
  background: var(--aimd-bg-tertiary);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-xl);
  padding: calc(var(--aimd-space-4) + var(--aimd-space-1));
  margin-bottom: var(--aimd-space-4);
}
.settings-group-title {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
  font-size: 16px;
  font-weight: 600;
  color: var(--aimd-text-primary);
  margin: 0 0 var(--aimd-space-2) 0;
}
.settings-group-title svg { width: 16px; height: 16px; }
.settings-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--aimd-space-3) 0;
  border-bottom: 1px solid var(--aimd-border-subtle);
}
.settings-item:last-child { border-bottom: none; }
.settings-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  padding-right: var(--aimd-space-4);
}
.settings-item-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--aimd-text-primary);
}
.settings-item-desc {
  font-size: 13px;
  color: var(--aimd-text-secondary);
  line-height: 1.4;
}

.toggle-switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--aimd-border-strong);
  transition: .3s cubic-bezier(0.2, 0.8, 0.2, 1);
  border-radius: 99px;
}
.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .3s cubic-bezier(0.2, 0.8, 0.2, 1);
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}
.toggle-switch input:checked + .toggle-slider { background-color: var(--aimd-interactive-primary); }
.toggle-switch input:checked + .toggle-slider:before { transform: translateX(18px); }
.toggle-switch input:focus-visible + .toggle-slider { box-shadow: 0 0 0 2px var(--aimd-bg-primary), 0 0 0 4px var(--aimd-interactive-primary); }

.settings-select,
.settings-number,
.language-select {
  padding: var(--aimd-space-2) var(--aimd-space-3);
  background-color: var(--aimd-bg-secondary);
  color: var(--aimd-text-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-md);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
  transition: all 0.2s ease;
  min-width: 180px;
  flex-shrink: 0;
}
.settings-select,
.language-select { cursor: pointer; }
.settings-number {
  width: 120px;
  height: 40px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  background-color: var(--aimd-bg-surface);
}
.settings-select:hover,
.settings-number:hover,
.language-select:hover { background-color: var(--aimd-interactive-hover); border-color: var(--aimd-border-strong); }
.settings-select:focus-visible,
.settings-number:focus-visible,
.language-select:focus-visible { outline: 2px solid var(--aimd-border-focus); outline-offset: 2px; }

.settings-storage-info { margin-top: var(--aimd-space-2); }
.storage-header { display: flex; justify-content: space-between; align-items: center; gap: var(--aimd-space-2); margin-bottom: var(--aimd-space-2); }
.storage-label { font-size: 13px; color: var(--aimd-text-secondary); }
.storage-value { font-size: 13px; color: var(--aimd-text-primary); font-variant-numeric: tabular-nums; }
.storage-progress-track { width: 100%; height: 8px; background: var(--aimd-border-subtle); border-radius: 999px; overflow: hidden; }
.storage-progress-bar { height: 100%; background: var(--aimd-interactive-primary); width: 0%; }
.storage-progress-bar.warning { background: var(--aimd-color-warning); }
.storage-progress-bar.critical { background: var(--aimd-color-danger); }

.settings-backup-warning {
  margin-top: var(--aimd-space-4);
  padding-top: var(--aimd-space-4);
  border-top: 1px solid var(--aimd-border-subtle);
}
.settings-backup-warning .settings-item-warning-text {
  display: block;
  font-size: 13px;
  color: var(--aimd-text-warning);
  margin-top: var(--aimd-space-1);
}
.export-backup-btn {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-3) var(--aimd-space-4);
  background: var(--aimd-button-secondary-bg);
  color: var(--aimd-button-secondary-text);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.export-backup-btn:hover { background: var(--aimd-button-secondary-hover); border-color: var(--aimd-border-strong); }
.export-backup-btn svg { width: 16px; height: 16px; }

/* =======================
   Sponsor tab (legacy parity)
   ======================= */
.support-content {
  padding: ${space6};
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${space6};
}
.support-section {
  text-align: center;
  padding: calc(var(--aimd-space-4) + var(--aimd-space-1));
  background: var(--aimd-bg-tertiary);
  border-radius: var(--aimd-radius-xl);
  border: 1px solid var(--aimd-border-default);
}
.support-section h3 {
  margin: 0 0 var(--aimd-space-2) 0;
  font-size: 16px;
  color: var(--aimd-text-primary);
  font-weight: 600;
}
.support-section p {
  margin: 0 0 var(--aimd-space-4) 0;
  color: var(--aimd-text-secondary);
  font-size: 13px;
}
.primary-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-3) calc(var(--aimd-space-4) + var(--aimd-space-2));
  background: var(--aimd-button-primary-bg);
  color: var(--aimd-button-primary-text);
  border: none;
  border-radius: var(--aimd-radius-lg);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.2s, box-shadow 0.2s;
  box-shadow: var(--aimd-shadow-sm);
}
.primary-btn:hover { background: var(--aimd-button-primary-hover); box-shadow: var(--aimd-shadow-md); }
.primary-btn svg { width: 16px; height: 16px; }
.qr-cards-row { display: flex; justify-content: center; gap: ${space6}; flex-wrap: wrap; }
.qr-card { display: flex; flex-direction: column; align-items: center; gap: var(--aimd-space-2); }
.qr-card-label, .qr-card-label-link {
  font-size: 12px;
  color: var(--aimd-text-tertiary);
  margin-bottom: var(--aimd-space-1);
  text-decoration: none;
  transition: color 0.2s;
}
.qr-card-label-link:hover { text-decoration: underline; color: var(--aimd-text-link); }
.qr-image-wrapper { padding: var(--aimd-space-3); background: white; border-radius: var(--aimd-radius-lg); box-shadow: var(--aimd-shadow-sm); }
.qr-image { width: 120px; height: 120px; display: block; border-radius: var(--aimd-radius-md); }
`;
}
