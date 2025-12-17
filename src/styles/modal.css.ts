/**
 * Modal styles for Shadow DOM
 * Updated to match Rerender and Detail Modal design
 */

// Import design tokens
import './design-tokens.css';

export const modalStyles = `
:host {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
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
  background: white;
  border-radius: 16px;
  box-shadow: 
    0 0 0 1px rgba(0, 0, 0, 0.08),
    0 4px 12px rgba(0, 0, 0, 0.12),
    0 16px 48px rgba(0, 0, 0, 0.18),
    0 24px 80px rgba(0, 0, 0, 0.12);
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
  border-bottom: 1px solid #F0F0F0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #1A1A1A;
  letter-spacing: -0.02em;
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #6B7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  font-size: 20px;
}

.modal-close:hover {
  background: #F3F4F6;
  color: #1A1A1A;
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
  background: white;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: auto;
  color: #1A1A1A;
  tab-size: 2;
}

.modal-footer {
  padding: 4px 16px;
  border-top: 1px solid #F0F0F0;
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  background: white;
  flex-shrink: 0;
  border-radius: 0 0 16px 16px;
  min-height: 32px;
}

.modal-button {
  padding: 0px 40px;
  border-radius: 8px;
  border: none;
  background: #F3F4F6;
  color: #1A1A1A;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.modal-button:hover {
  background: #E5E7EB;
}

.modal-button.primary {
  background: #2563EB;
  color: white;
}

.modal-button.primary:hover {
  background: #1D4ED8;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
}

/* ============================================
   DARK MODE - Shadow DOM compatible
   ============================================ */

:host-context(html.dark) .modal-overlay {
  background: rgba(0, 0, 0, 0.8);
}

:host-context(html.dark) .modal-container {
  background: #1E1E1E;
  box-shadow: 
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 4px 12px rgba(0, 0, 0, 0.5),
    0 16px 48px rgba(0, 0, 0, 0.6),
    0 24px 80px rgba(0, 0, 0, 0.4);
}

:host-context(html.dark) .modal-header {
  border-bottom-color: #3F3F46;
}

:host-context(html.dark) .modal-title {
  color: #FFFFFF;
}

:host-context(html.dark) .modal-close {
  color: #A1A1AA;
}

:host-context(html.dark) .modal-close:hover {
  background: #27272A;
  color: #FFFFFF;
}

:host-context(html.dark) .modal-content {
  background: #1E1E1E;
  color: #E3E3E3;
}

:host-context(html.dark) .modal-footer {
  border-top-color: #3F3F46;
  background: #1E1E1E;
}

:host-context(html.dark) .modal-button {
  background: #27272A;
  color: #E3E3E3;
}

:host-context(html.dark) .modal-button:hover {
  background: #3F3F46;
}

:host-context(html.dark) .modal-button.primary {
  background: #3B82F6;
  color: white;
}

:host-context(html.dark) .modal-button.primary:hover {
  background: #2563EB;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
}
`;
