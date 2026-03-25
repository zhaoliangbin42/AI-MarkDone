export function getSharedBackdropMotionCss(): string {
    return `
.panel-stage__overlay[data-motion-state="opening"]:not([data-motion-runtime]),
.aimd-panel-overlay[data-motion-state="opening"]:not([data-motion-runtime]),
.mock-modal-overlay[data-motion-state="opening"]:not([data-motion-runtime]) {
  animation: aimd-overlay-fade-in 180ms var(--aimd-ease-out) both;
}

.panel-stage__overlay[data-motion-state="closing"],
.aimd-panel-overlay[data-motion-state="closing"],
.mock-modal-overlay[data-motion-state="closing"] {
  animation: aimd-overlay-fade-out 150ms ease-in both;
}

@keyframes aimd-overlay-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes aimd-overlay-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .panel-stage__overlay[data-motion-state="opening"]:not([data-motion-runtime]),
  .aimd-panel-overlay[data-motion-state="opening"]:not([data-motion-runtime]),
  .mock-modal-overlay[data-motion-state="opening"]:not([data-motion-runtime]) {
    animation: aimd-overlay-fade-in 80ms linear both;
  }

  .panel-stage__overlay[data-motion-state="closing"],
  .aimd-panel-overlay[data-motion-state="closing"],
  .mock-modal-overlay[data-motion-state="closing"] {
    animation: aimd-overlay-fade-out 80ms linear both;
  }
}
`;
}
