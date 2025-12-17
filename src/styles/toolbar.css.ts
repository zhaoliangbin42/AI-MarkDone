/**
 * Shadow DOM styles for toolbar component
 * Notion-style floating toolbar with glassmorphism effect
 * 
 * Updated to use design tokens from design-tokens.css
 */

// Import design tokens
import './design-tokens.css';

export const toolbarStyles = `
:host {
  display: block;
  font-family: var(--font-sans);
  margin-bottom: var(--space-3);
  
  /* Light mode theme colors - Blue theme */
  --gradient-solid-from: #3b82f6;
  --gradient-solid-to: #1d4ed8;
  --gradient-light-from: rgba(59, 130, 246, 0.12);
  --gradient-light-to: rgba(29, 78, 216, 0.12);
  --theme-color: #3b82f6;
}

/* Dark mode theme colors */
@media (prefers-color-scheme: dark) {
  :host {
    --gradient-solid-from: #60a5fa;
    --gradient-solid-to: #3b82f6;
    --gradient-light-from: rgba(96, 165, 250, 0.25);
    --gradient-light-to: rgba(59, 130, 246, 0.25);
    --theme-color: #60a5fa;
  }
}

/* Notion-style floating toolbar */
.aicopy-toolbar {
  /* Floating card container */
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  
  /* Glassmorphism */
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  
  /* Rounded corners */
  border-radius: 8px;
  
  /* Use box-shadow for both border and elevation - no clipping */
  box-shadow: 
    inset 0 0 0 1px rgba(0, 0, 0, 0.06),  /* Border as inset shadow */
    0 1px 2px rgba(0, 0, 0, 0.06),         /* Close shadow */
    0 2px 4px rgba(0, 0, 0, 0.04);         /* Subtle depth */
  
  /* Compact padding */
  padding: 4px;
  
  /* Right alignment */
  position: absolute;
  right: 0;
  
  /* Ensure clickability */
  z-index: 100;
  pointer-events: auto;
  
  /* Smooth transitions */
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.aicopy-toolbar:hover {
  /* Lift on hover with slightly stronger shadow */
  transform: translateY(-1px);
  box-shadow: 
    inset 0 0 0 1px rgba(0, 0, 0, 0.08),  /* Slightly darker border */
    0 2px 4px rgba(0, 0, 0, 0.08),
    0 4px 8px rgba(0, 0, 0, 0.06);
}

/* Bookmarked state - entire toolbar highlights */
.aicopy-toolbar.bookmarked {
  background: linear-gradient(135deg, var(--gradient-light-from), var(--gradient-light-to));
  box-shadow: 
    inset 0 0 0 1px var(--theme-color),
    0 1px 2px rgba(0, 0, 0, 0.06),
    0 2px 4px rgba(0, 0, 0, 0.04);
}

.aicopy-toolbar.bookmarked:hover {
  transform: translateY(-1px);
  box-shadow: 
    inset 0 0 0 1px var(--theme-color),
    0 2px 4px rgba(0, 0, 0, 0.08),
    0 4px 8px rgba(0, 0, 0, 0.06);
}

/* Dark mode toolbar */
@media (prefers-color-scheme: dark) {
  .aicopy-toolbar {
    background: rgba(40, 40, 40, 0.98);
    box-shadow: 
      inset 0 0 0 1px rgba(255, 255, 255, 0.08),  /* Border */
      0 1px 2px rgba(0, 0, 0, 0.4),
      0 2px 4px rgba(0, 0, 0, 0.3);
  }
  
  .aicopy-toolbar:hover {
    box-shadow: 
      inset 0 0 0 1px rgba(255, 255, 255, 0.12),
      0 2px 4px rgba(0, 0, 0, 0.5),
      0 4px 8px rgba(0, 0, 0, 0.4);
  }
}

.aicopy-button-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* Visual divider */
.aicopy-divider {
  width: 1px;
  height: 24px;
  background: var(--gray-200);
  margin: 0 4px;
  flex-shrink: 0;
}

@media (prefers-color-scheme: dark) {
  .aicopy-divider {
    background: rgba(255, 255, 255, 0.12);
  }
}

/* Notion-style rounded buttons */
.aicopy-button {
  position: relative; /* CRITICAL: Required for absolute-positioned tooltip */
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--gray-600);
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  pointer-events: auto;
  z-index: 1;
  overflow: visible; /* CRITICAL: Allow tooltip to overflow button bounds */
}

.aicopy-button:hover {
  background: var(--gray-100);
  color: var(--gray-900);
}

.aicopy-button:active {
  transform: scale(0.96);
  background: var(--gray-200);
}

.aicopy-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (prefers-color-scheme: dark) {
  .aicopy-button {
    color: rgba(255, 255, 255, 0.6);
  }
  
  .aicopy-button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
  }
  
  .aicopy-button:active {
    background: rgba(255, 255, 255, 0.12);
  }
}

/* Button hover in bookmarked toolbar - light blue for visibility */
.aicopy-toolbar.bookmarked .aicopy-button:not(.bookmarked):hover {
  background: rgba(59, 130, 246, 0.2);
  color: var(--theme-color);
}

/* Bookmarked state - deeper highlight than toolbar */
.aicopy-button.bookmarked {
  background: linear-gradient(135deg, var(--gradient-solid-from), var(--gradient-solid-to));
  color: white;
}

.aicopy-button.bookmarked:hover {
  background: linear-gradient(135deg, var(--gradient-solid-from), var(--gradient-solid-to));
  color: white;
  opacity: 0.9;
}

/* Feedback tooltip */
.aicopy-button-feedback {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 12px;
  background: var(--theme-color);
  color: white;
  font-size: 12px;
  white-space: nowrap;
  border-radius: 6px;
  opacity: 0;
  pointer-events: none;
  z-index: 1001;
  animation: fadeInOut 1.5s ease;
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translateX(-50%) translateY(0); }
  20% { opacity: 1; transform: translateX(-50%) translateY(-4px); }
  80% { opacity: 1; transform: translateX(-50%) translateY(-4px); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
}

.aicopy-icon {
  width: 16px;
  height: 16px;
  display: block;
}

/* Word count stats - two lines */
.aicopy-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  font-size: 11px;
  line-height: 1.3;
  color: var(--gray-600);
  white-space: nowrap;
  padding: 0 6px;
  min-width: 60px;
  cursor: default;
  user-select: none;
}

@media (prefers-color-scheme: dark) {
  .aicopy-stats {
    color: rgba(255, 255, 255, 0.5);
  }
}
`;