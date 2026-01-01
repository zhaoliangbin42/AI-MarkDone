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
  background: rgba(0, 0, 0, 0.3);
  z-index: 999998;
  backdrop-filter: blur(24px) saturate(180%) contrast(120%);
  -webkit-backdrop-filter: blur(24px) saturate(180%) contrast(120%);
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
  
  /* No solid background - pure transparency */
  background: transparent;
  
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  
  display: flex;
  flex-direction: column;
  z-index: 999999;
  overflow: hidden;
  animation: modalFadeIn 0.2s ease;
  
  /* Strong blur for background separation */
  backdrop-filter: blur(30px) saturate(180%) brightness(105%);
  -webkit-backdrop-filter: blur(30px) saturate(180%) brightness(105%);
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
  padding: 12px 20px;
  border-bottom: 1px solid var(--panel-header-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(249, 250, 251, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  flex-shrink: 0;
}

.aicopy-panel-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.aicopy-panel-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  letter-spacing: -0.01em;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  
  /* Text shadow for better readability on blur */
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Header Buttons */
.aicopy-panel-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--duration-fast) ease, color var(--duration-fast) ease;
}

.aicopy-panel-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--text-primary);
}

/* Body - White background for readability */
.aicopy-panel-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 32px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  overscroll-behavior: contain;
  scroll-behavior: smooth;
}

.aicopy-panel-body .markdown-body {
  max-width: 800px;
  width: 100%;
  margin: 24px auto;
  overflow-x: auto;
  word-wrap: break-word;
}

/* Dot Pagination Container - Semi-transparent */
.aicopy-pagination {
  padding: 12px 16px;
  border-top: 1px solid var(--pagination-border);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--dot-gap, 8px);
  
  /* Semi-transparent with blur */
  background: rgba(249, 250, 251, 0.9);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  
  flex-shrink: 0;
  flex-wrap: wrap;
  max-width: 100%;
}

/* Individual Dot - GPU optimized */
.aicopy-dot {
  width: var(--dot-size, 10px);
  height: var(--dot-size, 10px);
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.25);
  background: transparent;
  cursor: pointer;
  position: relative;
  
  /* GPU acceleration */
  will-change: transform;
  transform: translateZ(0);
  transition: transform var(--duration-fast) var(--ease-in-out),
              border-color var(--duration-fast) ease,
              background-color var(--duration-fast) ease;
}

.aicopy-dot:hover {
  transform: scale(1.3) translateZ(0);
  border-color: rgba(0, 0, 0, 0.4);
}

.aicopy-dot.active {
  width: calc(var(--dot-size, 10px) * 1.4);
  height: calc(var(--dot-size, 10px) * 1.4);
  background: var(--interactive-primary);
  border-color: var(--interactive-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

/* Custom Scrollbar */
.aicopy-panel-body::-webkit-scrollbar {
  width: 8px;
}

.aicopy-panel-body::-webkit-scrollbar-track {
  background: transparent;
}

.aicopy-panel-body::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.aicopy-panel-body::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
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
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--interactive-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

/* Dark Mode Auto-Adaptation */
@media (prefers-color-scheme: dark) {
  .aicopy-panel {
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(30px) saturate(180%) brightness(80%);
    -webkit-backdrop-filter: blur(30px) saturate(180%) brightness(80%);
  }
  
  .aicopy-panel-header {
    background: rgba(39, 39, 42, 0.85);
    border-color: rgba(255, 255, 255, 0.06);
  }
  
  .aicopy-panel-body {
    background: rgba(30, 30, 30, 0.95);
  }
  
  .aicopy-pagination {
    background: rgba(39, 39, 42, 0.9);
    border-color: rgba(255, 255, 255, 0.06);
  }
  
  .aicopy-panel-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  
  .aicopy-dot {
    border-color: rgba(255, 255, 255, 0.3);
  }
  
  .aicopy-dot:hover {
    border-color: rgba(255, 255, 255, 0.5);
  }
  
  .aicopy-panel-body::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .aicopy-panel-body::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
}

/* Navigation Buttons - Inline with Pagination */
.aicopy-nav-button {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  
  /* Transparent by default, match pagination background */
  background: transparent;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  
  display: flex;
  align-items: center;
  justify-content: center;
  
  transition: all var(--duration-fast) ease;
  
  /* GPU acceleration */
  will-change: transform;
}

.aicopy-nav-button:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.1);
  color: var(--interactive-primary);
  transform: scale(1.05);
}

.aicopy-nav-button:active:not(:disabled) {
  transform: scale(0.95);
  background: rgba(59, 130, 246, 0.15);
}

.aicopy-nav-button:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .aicopy-nav-button:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.15);
  }
  
  .aicopy-nav-button:active:not(:disabled) {
    background: rgba(59, 130, 246, 0.2);
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .aicopy-nav-button { transition: none; }
  .aicopy-dot { transition: none; }
  .aicopy-panel { animation: none; }
  .aicopy-panel-body.loading::after { animation: none; }
}
`;
