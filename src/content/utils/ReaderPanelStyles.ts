/**
 * Reader Panel UI Styles - Pure Blur Glassmorphism
 * 
 * Inspired by macOS Big Sur translucent design.
 * No solid backgrounds - only blur + transparency.
 * Auto-adapts to light/dark modes.
 */

export const readerPanelStyles = `
/* Panel Overlay - Strong Blur */
.aicopy-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--aimd-bg-overlay-heavy);
  z-index: var(--aimd-z-max);
  backdrop-filter: blur(3px);
}

/* Panel Container - Pure Glassmorphism */
.aicopy-panel {
  position: fixed;
  top: 10%;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 900px;
  height: 80vh;
  
  /* Glass background from tokens */
  background: var(--aimd-panel-bg);
  
  border-radius: var(--aimd-radius-2xl);
  border: 1px solid var(--aimd-border-glass);
  box-shadow: var(--aimd-shadow-xl);
  
  display: flex;
  flex-direction: column;
  z-index: var(--aimd-z-max);
  overflow: hidden;
  animation: modalFadeIn 0.2s ease;
  
  /* Strong blur for background separation */
  backdrop-filter: var(--aimd-glass-blur);
  -webkit-backdrop-filter: var(--aimd-glass-blur);
}

@keyframes modalFadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* Fullscreen Mode */
.aicopy-panel-fullscreen {
  top: 0 !important;
  left: 0 !important;
  transform: none !important;
  width: 100vw !important;
  max-width: none !important;
  height: 100vh !important;
  border-radius: 0 !important;
}

/* Header - Semi-transparent white */
.aicopy-panel-header {
  padding: var(--aimd-space-3) var(--aimd-space-5);
  border-bottom: 1px solid var(--aimd-border-default);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--aimd-panel-header-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  flex-shrink: 0;
}

.aicopy-panel-header-left {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-4);
}

.aicopy-panel-title {
  font-size: var(--aimd-text-2xl);
  font-weight: var(--aimd-font-medium);
  color: var(--aimd-text-primary);
  letter-spacing: -0.01em;
  margin: 0;
  font-family: var(--aimd-font-sans);
}

/* Header Buttons */
.aicopy-panel-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--aimd-radius-md);
  border: none;
  background: transparent;
  color: var(--aimd-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--aimd-text-3xl);
  font-weight: var(--aimd-font-medium);
  transition: background var(--aimd-duration-fast) ease, color var(--aimd-duration-fast) ease;
}

.aicopy-panel-btn:hover {
  background: var(--aimd-interactive-hover);
  color: var(--aimd-text-primary);
}

/* Body - White background for readability */
.aicopy-panel-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--aimd-space-6) var(--aimd-space-8);
  background: transparent;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  overscroll-behavior: contain;
  scroll-behavior: smooth;
}

.aicopy-panel-body .markdown-body {
  max-width: 800px;
  width: 100%;
  overflow-x: auto;
  word-wrap: break-word;
}

/* Dot Pagination Container - Semi-transparent */
.aicopy-pagination {
  padding: var(--aimd-space-3) var(--aimd-space-4);
  border-top: 1px solid var(--aimd-panel-pagination-border);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--dot-gap, 8px);
  
  /* Semi-transparent with blur */
  background: var(--aimd-panel-pagination-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  
  flex-shrink: 0;
  flex-wrap: wrap;
  max-width: 100%;
  
  /* For absolute positioning of trigger button */
  position: relative;
}

/* Dedicated Container for Dots - Structural Isolation */
.aicopy-pagination-dots-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--dot-gap, 8px);
  /* Ensure it takes up space naturally between nav buttons */
  flex-shrink: 0;
}

/* Individual Dot - GPU optimized */
.aicopy-dot {
  width: var(--dot-size, 10px);
  height: var(--dot-size, 10px);
  border-radius: 50%;
  border: 2px solid var(--aimd-text-secondary);
  background: transparent;
  cursor: pointer;
  position: relative;
  
  /* GPU acceleration */
  will-change: transform;
  transform: translateZ(0);
  transition: transform var(--aimd-duration-fast) var(--aimd-ease-in-out),
              border-color var(--aimd-duration-fast) ease,
              background-color var(--aimd-duration-fast) ease;
}

.aicopy-dot:hover {
  transform: scale(1.3) translateZ(0);
  border-color: var(--aimd-text-primary);
}

.aicopy-dot.active {
  width: calc(var(--dot-size, 10px) * 1.4);
  height: calc(var(--dot-size, 10px) * 1.4);
  background: var(--aimd-interactive-primary);
  border-color: var(--aimd-interactive-primary);
  box-shadow: var(--aimd-dot-active-shadow);
}

/* Custom Scrollbar */
.aicopy-panel-body::-webkit-scrollbar {
  width: 8px;
}

.aicopy-panel-body::-webkit-scrollbar-track {
  background: transparent;
}

.aicopy-panel-body::-webkit-scrollbar-thumb {
  background: var(--aimd-scrollbar-thumb);
  border-radius: var(--aimd-radius-sm);
}

.aicopy-panel-body::-webkit-scrollbar-thumb:hover {
  background: var(--aimd-scrollbar-thumb-hover);
}

/* Loading State */
.aicopy-panel-body.loading::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 32px;
  height: 32px;
  border: 3px solid var(--aimd-border-subtle);
  border-top-color: var(--aimd-interactive-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

/* Dark Mode: Now handled by ThemeManager + data-aimd-theme attribute */
/* Removed redundant @media (prefers-color-scheme: dark) block */

/* Navigation Buttons - Inline with Pagination */
.aicopy-nav-button {
  width: 36px;
  height: 36px;
  border-radius: var(--aimd-radius-lg);
  border: none;
  
  /* Transparent by default, match pagination background */
  background: transparent;
  color: var(--aimd-text-secondary);
  font-size: 16px;
  cursor: pointer;
  
  display: flex;
  align-items: center;
  justify-content: center;
  
  transition: all var(--aimd-duration-fast) ease;
  
  /* GPU acceleration */
  will-change: transform;
}

.aicopy-nav-button:hover:not(:disabled) {
  background: var(--aimd-nav-button-hover-bg);
  color: var(--aimd-interactive-primary);
  transform: scale(1.05);
}

.aicopy-nav-button:active:not(:disabled) {
  transform: scale(0.95);
  background: var(--aimd-nav-button-active-bg);
}

.aicopy-nav-button:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

/* Dark mode: Now handled by ThemeManager + semantic tokens */


/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .aicopy-nav-button { transition: none; }
  .aicopy-dot { transition: none; }
  .aicopy-panel { animation: none; }
  .aicopy-panel-body.loading::after { animation: none; }
}
/* Message Consolidation Styles */
.message-user-header {
  display: flex;
  align-items: flex-start;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-4) var(--aimd-space-6);
  background: var(--aimd-bg-secondary);
  border-bottom: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-xl);
  margin: 0 auto 24px;
  max-width: 800px;
  width: 100%;
}


.user-icon, .model-icon {
  width: 32px; /* Increased container size */
  height: 32px; /* Increased container size */
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--aimd-text-secondary);
}

.user-icon svg, .model-icon svg {
  width: 20px; /* Force larger icon size */
  height: 20px;
}

.model-icon {
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-secondary);
  margin-top: 4px;
}

.user-content {
  font-size: 14px;
  color: var(--aimd-text-secondary);
  line-height: 1.5;
  font-weight: 500;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-model-container {
  display: flex;
  gap: var(--aimd-space-4);
  align-items: flex-start;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.message-divider {
  display: none; /* Hidden visually, structure handled by margin */
}

/* Remove focus outline when navigating with keyboard */
.aicopy-panel:focus {
  outline: none;
}

/* Keyboard navigation hint */
.aicopy-keyboard-hint {
  position: absolute;
  right: var(--aimd-space-4);
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: var(--aimd-text-tertiary);
  pointer-events: none;
  user-select: none;
}

/* Dark mode: Now handled by ThemeManager + data-aimd-theme attribute */

`;
