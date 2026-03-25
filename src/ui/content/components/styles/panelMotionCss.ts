export function getPanelMotionCss(): string {
    return `
.panel-window[data-motion-state="opening"]:not([data-motion-runtime]),
.aimd-panel[data-motion-state="opening"]:not([data-motion-runtime]) {
  animation: aimd-panel-pop-in 300ms var(--aimd-ease-out) both;
}

.panel-window[data-motion-state="closing"],
.aimd-panel[data-motion-state="closing"] {
  animation: aimd-panel-pop-out 240ms ease-in both;
}

.panel-window--reader[data-fullscreen="1"][data-motion-state="opening"]:not([data-motion-runtime]) {
  animation: aimd-reader-fullscreen-fade-in 300ms var(--aimd-ease-out) both;
}

.panel-window--reader[data-fullscreen="1"][data-motion-state="closing"] {
  animation: aimd-reader-fullscreen-fade-out 240ms ease-in both;
}

@keyframes aimd-panel-pop-in {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.95);
  }
  72% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.015);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes aimd-panel-pop-out {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  18% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.02);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.95);
  }
}

@keyframes aimd-reader-fullscreen-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes aimd-reader-fullscreen-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .panel-window[data-motion-state="opening"]:not([data-motion-runtime]),
  .panel-window[data-motion-state="closing"],
  .aimd-panel[data-motion-state="opening"]:not([data-motion-runtime]),
  .aimd-panel[data-motion-state="closing"] {
    animation-duration: 80ms;
    animation-timing-function: linear;
  }

  .panel-window--reader[data-fullscreen="1"][data-motion-state="opening"]:not([data-motion-runtime]),
  .panel-window--reader[data-fullscreen="1"][data-motion-state="closing"] {
    animation-duration: 80ms;
    animation-timing-function: linear;
  }

  @keyframes aimd-panel-pop-in {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(1);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }

  @keyframes aimd-panel-pop-out {
    from {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    to {
      opacity: 0;
      transform: translate(-50%, -50%) scale(1);
    }
  }
}
`;
}
