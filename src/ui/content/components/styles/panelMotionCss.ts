export function getPanelMotionCss(): string {
    return `
.panel-window[data-motion-state="opening"]:not([data-motion-runtime]),
.aimd-panel[data-motion-state="opening"]:not([data-motion-runtime]) {
  animation: aimd-panel-pop-in var(--_surface-motion-open-duration, var(--aimd-duration-base)) var(--_surface-motion-open-easing, var(--aimd-ease-out)) both;
}

.panel-window[data-motion-state="closing"],
.aimd-panel[data-motion-state="closing"] {
  animation: aimd-panel-pop-out var(--_surface-motion-close-duration, var(--aimd-duration-fast)) var(--_surface-motion-close-easing, var(--aimd-ease-in-out)) both;
}

.panel-window--reader[data-fullscreen="1"][data-motion-state="opening"]:not([data-motion-runtime]) {
  animation: aimd-reader-fullscreen-fade-in var(--_surface-motion-open-duration, var(--aimd-duration-base)) var(--_surface-motion-open-easing, var(--aimd-ease-out)) both;
}

.panel-window--reader[data-fullscreen="1"][data-motion-state="closing"] {
  animation: aimd-reader-fullscreen-fade-out var(--_surface-motion-close-duration, var(--aimd-duration-fast)) var(--_surface-motion-close-easing, var(--aimd-ease-in-out)) both;
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
  .aimd-panel[data-motion-state="opening"]:not([data-motion-runtime]) {
    animation-duration: var(--_surface-motion-open-duration, 0s);
    animation-timing-function: var(--_surface-motion-open-easing, var(--aimd-ease-in-out));
  }

  .panel-window[data-motion-state="closing"],
  .aimd-panel[data-motion-state="closing"] {
    animation-duration: var(--_surface-motion-close-duration, 0s);
    animation-timing-function: var(--_surface-motion-close-easing, var(--aimd-ease-in-out));
  }

  .panel-window--reader[data-fullscreen="1"][data-motion-state="opening"]:not([data-motion-runtime]) {
    animation-duration: var(--_surface-motion-open-duration, 0s);
    animation-timing-function: var(--_surface-motion-open-easing, var(--aimd-ease-in-out));
  }

  .panel-window--reader[data-fullscreen="1"][data-motion-state="closing"] {
    animation-duration: var(--_surface-motion-close-duration, 0s);
    animation-timing-function: var(--_surface-motion-close-easing, var(--aimd-ease-in-out));
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
