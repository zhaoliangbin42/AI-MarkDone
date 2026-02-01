/**
 * Shadow DOM styles for toolbar component
 * Notion-style floating toolbar with glassmorphism effect
 * 
 * Updated to use shadow-root design tokens
 */

export const toolbarStyles = `
:host {
  display: block;
  font-family: var(--aimd-font-sans);
  margin-bottom: var(--aimd-space-3);
  
  --gradient-solid-from: var(--aimd-toolbar-gradient-solid-from);
  --gradient-solid-to: var(--aimd-toolbar-gradient-solid-to);
  --gradient-light-from: var(--aimd-toolbar-gradient-light-from);
  --gradient-light-to: var(--aimd-toolbar-gradient-light-to);
  --theme-color: var(--aimd-toolbar-theme-color);
}


/* Notion-style floating toolbar */
.aicopy-toolbar {
  /* Floating card container */
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-1);
  
  /* Why: lower blur improves performance while preserving the glass effect. */
  background: var(--aimd-toolbar-bg);
  backdrop-filter: blur(4px) saturate(150%);
  -webkit-backdrop-filter: blur(4px) saturate(150%);
  
  /* Rounded corners */
  border-radius: 8px;
  
  /* Use box-shadow for both border and elevation - no clipping */
  box-shadow: 
    inset 0 0 0 1px var(--aimd-toolbar-border),  /* Border as inset shadow */
    0 1px 2px var(--aimd-toolbar-shadow-1),       /* Close shadow */
    0 2px 4px var(--aimd-toolbar-shadow-2);       /* Subtle depth */
  
  /* Compact padding */
  padding: 4px;

  /* Ensure clickability */
  z-index: var(--aimd-z-base);
  pointer-events: auto;
  
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.aicopy-toolbar:hover {
  /* Lift on hover with slightly stronger shadow */
  transform: translateY(-1px);
  box-shadow: 
    inset 0 0 0 1px var(--aimd-toolbar-border-strong),  /* Slightly darker border */
    0 2px 4px var(--aimd-toolbar-hover-shadow-1),
    0 4px 8px var(--aimd-toolbar-hover-shadow-2);
}

/* Bookmarked state - entire toolbar highlights */
.aicopy-toolbar.bookmarked {
  background: linear-gradient(135deg, var(--gradient-light-from), var(--gradient-light-to));
  box-shadow: 
    inset 0 0 0 1px var(--theme-color),
    0 1px 2px var(--aimd-toolbar-shadow-1),
    0 2px 4px var(--aimd-toolbar-shadow-2);
}

.aicopy-toolbar.bookmarked:hover {
  transform: translateY(-1px);
  box-shadow: 
    inset 0 0 0 1px var(--theme-color),
    0 2px 4px var(--aimd-toolbar-hover-shadow-1),
    0 4px 8px var(--aimd-toolbar-hover-shadow-2);
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
  background: var(--aimd-toolbar-divider);
  margin: 0 4px;
  flex-shrink: 0;
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
  color: var(--aimd-toolbar-button-text);
  cursor: pointer;
  transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  pointer-events: auto;
  z-index: var(--aimd-z-base);
  overflow: visible; /* CRITICAL: Allow tooltip to overflow button bounds */
}

.aicopy-button:hover {
  background: var(--aimd-toolbar-button-hover-bg);
  color: var(--aimd-toolbar-button-hover-text);
}

.aicopy-button:active {
  transform: scale(0.96);
  background: var(--aimd-toolbar-button-active-bg);
}

.aicopy-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Button hover in bookmarked toolbar - light blue for visibility */
.aicopy-toolbar.bookmarked .aicopy-button:not(.bookmarked):hover {
  background: var(--aimd-toolbar-bookmark-hover-bg);
  color: var(--theme-color);
}

/* Bookmarked state - deeper highlight than toolbar */
.aicopy-button.bookmarked {
  background: linear-gradient(135deg, var(--gradient-solid-from), var(--gradient-solid-to));
  color: var(--aimd-text-on-primary);
}

.aicopy-button.bookmarked:hover {
  background: linear-gradient(135deg, var(--gradient-solid-from), var(--gradient-solid-to));
  color: var(--aimd-text-on-primary);
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
  color: var(--aimd-text-on-primary);
  font-size: 12px;
  white-space: nowrap;
  border-radius: 6px;
  opacity: 0;
  pointer-events: none;
  z-index: var(--aimd-z-dropdown);
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
  color: var(--aimd-toolbar-stats-text);
  white-space: nowrap;
  padding: 0 6px;
  min-width: 60px;
  cursor: default;
  user-select: none;
}
`;
