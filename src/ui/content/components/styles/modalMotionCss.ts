export function getModalMotionCss(): string {
    return `
.mock-modal[data-motion-state="opening"]:not([data-motion-runtime]),
.dialog[data-motion-state="opening"]:not([data-motion-runtime]) {
  animation: aimd-modal-pop-in 280ms var(--aimd-ease-out) both;
}

.mock-modal[data-motion-state="closing"],
.dialog[data-motion-state="closing"] {
  animation: aimd-modal-pop-out 220ms ease-in both;
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
  .mock-modal[data-motion-state="closing"],
  .dialog[data-motion-state="opening"]:not([data-motion-runtime]),
  .dialog[data-motion-state="closing"] {
    animation-duration: 80ms;
    animation-timing-function: linear;
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
