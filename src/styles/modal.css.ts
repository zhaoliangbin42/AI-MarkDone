/**
 * Modal styles for Shadow DOM
 * Updated to match Rerender and Detail Modal design
 */

export const modalStyles = `
:host {
  font-family: var(--font-sans);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--modal-overlay-bg);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999999;
  animation: overlayFadeIn 0.2s ease;
}

@keyframes overlayFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-container {
  background: var(--modal-surface);
  border-radius: 16px;
  box-shadow: var(--modal-shadow);
  max-width: 900px;
  width: 90%;
  height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  padding: 8px 24px;
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--gray-900);
  letter-spacing: -0.02em;
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--gray-500);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  font-size: 20px;
}

.modal-close:hover {
  background: var(--gray-100);
  color: var(--gray-900);
}

.modal-body {
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.modal-content {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px 32px;
  background: var(--modal-surface);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: auto;
  color: var(--md-on-surface);
  tab-size: 2;
}

.modal-footer {
  padding: 8px 16px;
  border-top: 1px solid var(--gray-200);
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  background: var(--modal-surface);
  flex-shrink: 0;
  border-radius: 0 0 16px 16px;
  min-height: 44px;
}

.modal-button {
  padding: 0px 40px;
  border-radius: 8px;
  border: none;
  background: var(--gray-100);
  color: var(--gray-900);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.15s ease;
}

.modal-button:hover {
  background: var(--gray-200);
  transform: translateY(-1px);
}

.modal-button.primary {
  background: var(--modal-primary-bg);
  color: var(--modal-primary-text);
}

.modal-button.primary:hover {
  background: var(--modal-primary-hover-bg);
  box-shadow: var(--modal-primary-shadow);
  transform: translateY(-1px);
}

`;
