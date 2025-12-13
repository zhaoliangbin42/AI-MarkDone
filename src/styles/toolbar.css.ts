/**
 * Shadow DOM styles for toolbar component
 * Simple layout with Copy button on left, stats on right
 */
export const toolbarStyles = `
:host {
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin-bottom: 8px;
  
  /* Light mode theme colors */
  --gradient-solid-from: #ad5389;
  --gradient-solid-to: #3c1053;
  --gradient-light-from: rgba(173, 83, 137, 0.12);
  --gradient-light-to: rgba(60, 16, 83, 0.12);
  --theme-color: #ad5389;
  --text-secondary: #6b7280;
  --bg-secondary: rgba(0, 0, 0, 0.05);
}

/* Dark mode theme colors */
@media (prefers-color-scheme: dark) {
  :host {
    --gradient-solid-from: #e091d0;
    --gradient-solid-to: #c084b3;
    --gradient-light-from: rgba(224, 145, 208, 0.25);
    --gradient-light-to: rgba(192, 132, 179, 0.25);
    --theme-color: #e091d0;
    --text-secondary: #9ca3af;
    --bg-secondary: rgba(255, 255, 255, 0.1);
  }
}

.aicopy-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.aicopy-button-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.aicopy-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.aicopy-button:hover {
  background: linear-gradient(135deg, var(--gradient-light-from), var(--gradient-light-to));
  color: var(--theme-color);
}

.aicopy-button:active {
  transform: scale(0.95);
}

.aicopy-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Bookmarked state - highlighted with theme color */
.aicopy-button.bookmarked {
  background: linear-gradient(135deg, var(--gradient-light-from), var(--gradient-light-to));
  color: var(--theme-color);
}

.aicopy-button.bookmarked:hover {
  background: linear-gradient(135deg, var(--gradient-solid-from), var(--gradient-solid-to));
  color: white;
}

/* Tooltip on hover */
.aicopy-button::after {
  content: attr(aria-label);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-8px);
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  font-size: 12px;
  white-space: nowrap;
  border-radius: 6px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 1000;
}

.aicopy-button::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-2px);
  border: 5px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.85);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 1000;
}

.aicopy-button:hover::after,
.aicopy-button:hover::before {
  opacity: 1;
}

/* Click feedback tooltip */
.aicopy-button-feedback {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-8px);
  padding: 6px 10px;
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
  0% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  20% { opacity: 1; transform: translateX(-50%) translateY(-12px); }
  80% { opacity: 1; transform: translateX(-50%) translateY(-12px); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-16px); }
}

.aicopy-icon {
  width: 20px;
  height: 20px;
  display: block;
}

/* Word count stats - right aligned */
.aicopy-stats {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  text-align: right;
  cursor: text;
}

/* Light mode colors */
:host {
  --text-secondary: #6b7280;
  --bg-secondary: rgba(0, 0, 0, 0.05);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  :host {
    --text-secondary: #9ca3af;
    --bg-secondary: rgba(255, 255, 255, 0.1);
  }
}
`;