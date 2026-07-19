export function getBookmarksWorkspaceResponsiveCss(): string {
    return `
@media (max-width: 980px) {
  .aimd-panel-header,
  .panel-header {
    min-height: var(--aimd-panel-header-height-compact);
    padding: var(--aimd-panel-header-padding-block-compact) var(--aimd-panel-header-padding-inline-compact);
  }

  .aimd-panel {
    width: min(var(--aimd-panel-wide-max-width), calc(100vw - var(--_bookmarks-panel-edge-offset-mobile)));
    height: min(var(--aimd-panel-wide-max-height), calc(100vh - var(--_bookmarks-panel-edge-offset-mobile)));
    max-height: calc(100vh - var(--_bookmarks-panel-edge-offset-mobile));
  }

  .bookmarks-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .bookmarks-sidebar {
    display: grid;
    width: 100%;
    position: relative;
    border-right: none;
    border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 72%, transparent);
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--_bookmarks-mobile-tab-strip-gap);
    padding: var(--aimd-space-3) var(--aimd-space-4);
    background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
    overflow: hidden;
  }

  .bookmarks-sidebar::before {
    content: '';
    position: absolute;
    inset: var(--aimd-space-3) var(--aimd-space-4);
    border-radius: var(--aimd-radius-2xl);
    background: var(--_bookmarks-mobile-tab-strip-surface);
    border: 1px solid color-mix(in srgb, var(--aimd-border-default) 58%, transparent);
    pointer-events: none;
  }

  .tab-btn {
    position: relative;
    z-index: var(--aimd-z-base);
    min-width: 0;
    min-height: 46px;
    padding: var(--aimd-space-3) var(--aimd-space-2);
    justify-content: center;
    border-radius: var(--aimd-radius-xl);
    text-align: center;
  }

  .tab-btn span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toolbar-row--bookmarks {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--_bookmarks-toolbar-gap);
  }

  .toolbar-row--bookmarks > .toolbar-actions {
    justify-content: flex-end;
  }

  .batch-bar {
    left: calc(var(--aimd-space-3) + var(--aimd-space-1) / 2);
    right: calc(var(--aimd-space-3) + var(--aimd-space-1) / 2);
    bottom: calc(var(--aimd-space-3) + var(--aimd-space-1) / 2);
    flex-wrap: wrap;
  }

  .qr-cards-row,
  .sponsor-qr-grid {
    grid-template-columns: 1fr;
  }

  .sponsor-thanks-list {
    grid-template-columns: 1fr;
  }

  .sponsor-thanks-item:nth-child(2) {
    border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 74%, transparent);
  }

  .sponsor-card {
    padding: var(--aimd-space-5);
  }

  .about-website-card,
  .support-contact-card {
    grid-template-columns: 1fr;
  }

  .about-website-card__button {
    width: 100%;
    min-width: 0;
  }

  .sponsor-action-row {
    justify-content: center;
  }

  .sponsor-cta-button {
    width: 100%;
    min-width: 0;
  }
}

@media (max-width: 720px) {
  .bookmarks-sidebar {
    grid-template-columns: none;
    grid-auto-flow: column;
    grid-auto-columns: minmax(var(--aimd-size-control-icon-panel-nav), 1fr);
    padding: var(--aimd-space-2) var(--aimd-space-3);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
  }

  .bookmarks-sidebar::before {
    inset: var(--aimd-space-2) var(--aimd-space-3);
  }

  .tab-btn {
    min-height: var(--aimd-size-control-icon-panel-nav);
    padding: var(--aimd-space-2);
  }

  .tab-btn span:last-child {
    display: none;
  }

  .settings-panel-scroll {
    padding: var(--aimd-space-4);
  }

  .toolbar-row--bookmarks {
    grid-template-columns: minmax(0, 1fr);
  }

  .toolbar-row--bookmarks > .toolbar-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .settings-card,
  .settings-data-card {
    padding: var(--aimd-space-3);
  }
}

@media (max-width: 560px) {
  .panel-window--bookmarks,
  .aimd-panel {
    width: calc(100vw - var(--aimd-space-2));
    max-width: calc(100vw - var(--aimd-space-2));
    height: calc(100vh - var(--aimd-space-2));
    max-height: calc(100vh - var(--aimd-space-2));
  }

  .settings-panel-scroll {
    padding: var(--aimd-space-3);
    scrollbar-gutter: auto;
  }

  .info-hero,
  .info-section--story,
  .community-card {
    padding: var(--aimd-space-4);
  }

  .info-profile-card,
  .mappamory-story,
  .mappamory-proof,
  .social-follow-card,
  .support-contact-card,
  .about-website-card {
    padding: var(--aimd-space-4);
  }

  .toggle-row,
  .settings-row {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
  }

  .settings-label {
    overflow: visible;
  }

  .toggle-switch,
  .reader-settings-trigger {
    justify-self: start;
  }

  .settings-select-shell,
  .settings-number-field,
  .settings-slider-field,
  .settings-stepper-field {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    justify-self: stretch;
  }

  .settings-select-menu {
    left: 0;
    right: auto;
    width: 100%;
    max-width: 100%;
  }

  .settings-export-width-controls {
    width: 100%;
    flex-flow: column nowrap;
    align-items: stretch;
    justify-self: stretch;
    white-space: normal;
  }

  .settings-export-width-controls .settings-export-width-preset,
  .settings-export-width-controls .settings-export-width-value,
  .settings-export-pixel-ratio-value,
  .settings-export-width-preset .settings-select-trigger {
    width: 100%;
    max-width: 100%;
  }

  .settings-color-swatches {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .settings-backup-warning > .secondary-btn,
  .cloud-backup-row__button {
    max-width: 100%;
  }

  .tree-panel {
    padding-inline: var(--aimd-space-2);
  }

  .tree-item {
    padding-right: var(--aimd-space-2);
  }

  .tree-title-meta {
    grid-template-columns: minmax(0, 1fr);
    gap: calc(var(--aimd-space-1) / 2);
  }

  .tree-main--bookmark .tree-subtitle {
    text-align: left;
  }

  .tree-actions {
    position: static;
    grid-column: 2 / -1;
    justify-self: end;
    display: none;
    transform: none;
  }

  .tree-item:hover .tree-actions,
  .tree-item:focus-within .tree-actions,
  .tree-item[data-selected="1"] .tree-actions {
    display: inline-flex;
    transform: none;
  }

  .batch-bar {
    left: var(--aimd-space-2);
    right: var(--aimd-space-2);
    bottom: var(--aimd-space-2);
  }
}
`;
}
