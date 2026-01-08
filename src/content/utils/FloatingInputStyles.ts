/**
 * Floating Input UI Styles - Message Sending Feature
 * 
 * Follows the same design language as ReaderPanel:
 * - Pure glassmorphism with blur
 * - Design Tokens only (no hardcoded values)
 * - Smooth animations
 */

export const floatingInputStyles = `
/* Floating Input Container */
.aimd-floating-input {
  position: absolute;
  bottom: 100%;
  left: 10px;
  margin-bottom: var(--aimd-space-2);
  
  width: 400px;
  height: 300px;
  min-width: 280px;
  min-height: 150px;
  
  /* 
   * Max height constraint: prevent exceeding panel bounds in non-fullscreen mode
   * The floating input should not overflow above the panel header
   * calc: available height = panel height - header(~60px) - pagination(~60px) - margins
   */
  max-height: calc(100vh - 20vh - 120px);
  
  /* Glass background */
  background: var(--aimd-panel-bg);
  backdrop-filter: var(--aimd-glass-blur);
  -webkit-backdrop-filter: var(--aimd-glass-blur);
  
  border-radius: var(--aimd-radius-xl);
  border: 1px solid var(--aimd-border-glass);
  box-shadow: var(--aimd-shadow-xl);
  
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  /* Animation */
  animation: floatInputSlideUp 0.2s ease-out;
  transform-origin: bottom left;
}

/* Top-right resize handle */
.aimd-floating-input .aimd-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: ne-resize;
  z-index: 10;
  background: transparent;
  border: none;
  padding: 0;
}

.aimd-floating-input .aimd-resize-handle::before {
  content: '';
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-top: 2px solid var(--aimd-text-tertiary);
  border-right: 2px solid var(--aimd-text-tertiary);
}

@keyframes floatInputSlideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes floatInputSlideDown {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(10px);
  }
}

.aimd-floating-input.collapsing {
  animation: floatInputSlideDown 0.15s ease-in forwards;
}

/* Header with title and collapse button */
.aimd-float-header {
  padding: var(--aimd-space-2) var(--aimd-space-3);
  border-bottom: 1px solid var(--aimd-border-default);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--aimd-panel-header-bg);
  flex-shrink: 0;
}

.aimd-float-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--aimd-text-primary);
  user-select: none;
}

.aimd-float-collapse-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--aimd-radius-md);
  border: none;
  background: transparent;
  color: var(--aimd-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--aimd-duration-fast) ease,
              color var(--aimd-duration-fast) ease;
}

.aimd-float-collapse-btn:hover {
  background: var(--aimd-interactive-hover);
  color: var(--aimd-text-primary);
}

/* Input Area */
.aimd-float-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: var(--aimd-space-3);
}

.aimd-float-textarea {
  flex: 1;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--aimd-text-primary);
  font-size: 14px;
  font-family: var(--aimd-font-sans);
  line-height: 1.6;
  resize: none;
  outline: none;
  overflow-y: auto;
}

.aimd-float-textarea::placeholder {
  color: var(--aimd-text-tertiary);
}

/* Footer with send button */
.aimd-float-footer {
  padding: var(--aimd-space-2) var(--aimd-space-3);
  border-top: 1px solid var(--aimd-border-default);
  display: flex;
  justify-content: flex-end;
  align-items: center;
  background: var(--aimd-panel-header-bg);
  flex-shrink: 0;
}

.aimd-float-send-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--aimd-radius-lg);
  border: none;
  background: var(--aimd-button-primary-bg);
  color: var(--aimd-button-primary-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--aimd-duration-fast) ease,
              transform var(--aimd-duration-fast) ease;
}

.aimd-float-send-btn:hover:not(:disabled) {
  background: var(--aimd-button-primary-hover);
  transform: scale(1.05);
}

.aimd-float-send-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.aimd-float-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.aimd-float-send-btn svg {
  width: 18px;
  height: 18px;
}

/* Trigger Button (absolutely positioned at far-left of pagination) */
.aimd-trigger-btn-wrapper {
  position: absolute;
  left: var(--aimd-space-4);
  top: 50%;
  transform: translateY(-50%);
  z-index: 5;
}

.aimd-trigger-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--aimd-radius-lg);
  border: none;
  background: transparent;
  color: var(--aimd-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--aimd-duration-fast) ease,
              color var(--aimd-duration-fast) ease;
}

.aimd-trigger-btn:hover:not(:disabled) {
  background: var(--aimd-interactive-hover);
  color: var(--aimd-text-primary);
}

.aimd-trigger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.aimd-trigger-btn svg {
  width: 20px;
  height: 20px;
}

/* Trigger button states */
.aimd-trigger-btn.waiting {
  color: var(--aimd-text-tertiary);
}

/* Custom scrollbar for textarea */
.aimd-float-textarea::-webkit-scrollbar {
  width: 6px;
}

.aimd-float-textarea::-webkit-scrollbar-track {
  background: transparent;
}

.aimd-float-textarea::-webkit-scrollbar-thumb {
  background: var(--aimd-scrollbar-thumb);
  border-radius: var(--aimd-radius-sm);
}

.aimd-float-textarea::-webkit-scrollbar-thumb:hover {
  background: var(--aimd-scrollbar-thumb-hover);
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .aimd-floating-input {
    animation: none;
  }
  .aimd-floating-input.collapsing {
    animation: none;
  }
  .aimd-float-send-btn,
  .aimd-float-collapse-btn,
  .aimd-trigger-btn {
    transition: none;
  }
}
`;
