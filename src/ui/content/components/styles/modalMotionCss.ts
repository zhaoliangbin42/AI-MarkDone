export function getModalMotionCss(): string {
    return `
.mock-modal[data-motion-state="opening"]:not([data-motion-runtime]),
.dialog[data-motion-state="opening"]:not([data-motion-runtime]) {
  animation: aimd-modal-pop-in var(--_surface-motion-open-duration, var(--aimd-duration-base)) var(--_surface-motion-open-easing, var(--aimd-ease-out)) both;
}

.mock-modal[data-motion-state="closing"],
.dialog[data-motion-state="closing"] {
  animation: aimd-modal-pop-out var(--_surface-motion-close-duration, var(--aimd-duration-fast)) var(--_surface-motion-close-easing, var(--aimd-ease-in-out)) both;
}

@keyframes aimd-modal-pop-in {
  0% {
    opacity: 0;
    transform: scale(0.92);
  }
  72% {
    opacity: 1;
    transform: scale(1.02);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes aimd-modal-pop-out {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  18% {
    opacity: 1;
    transform: scale(1.03);
  }
  100% {
    opacity: 0;
    transform: scale(0.92);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mock-modal[data-motion-state="opening"]:not([data-motion-runtime]),
  .dialog[data-motion-state="opening"]:not([data-motion-runtime]) {
    animation-duration: var(--_surface-motion-open-duration, 0s);
    animation-timing-function: var(--_surface-motion-open-easing, var(--aimd-ease-in-out));
  }

  .mock-modal[data-motion-state="closing"],
  .dialog[data-motion-state="closing"] {
    animation-duration: var(--_surface-motion-close-duration, 0s);
    animation-timing-function: var(--_surface-motion-close-easing, var(--aimd-ease-in-out));
  }

  @keyframes aimd-modal-pop-in {
    from {
      opacity: 0;
      transform: scale(1);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes aimd-modal-pop-out {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(1);
    }
  }
}
`;
}
