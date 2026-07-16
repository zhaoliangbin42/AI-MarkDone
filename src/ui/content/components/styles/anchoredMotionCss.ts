export function getAnchoredMotionCss(): string {
    return `
[data-aimd-surface-profile="anchored"][data-motion-state="closing"] {
  animation: aimd-anchored-close var(--_surface-motion-close-duration, var(--aimd-duration-fast)) var(--_surface-motion-close-easing, var(--aimd-ease-in-out)) both;
}

@keyframes aimd-anchored-close {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(var(--aimd-space-1)) scale(0.98);
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-aimd-surface-profile="anchored"][data-motion-state="closing"] {
    animation-duration: var(--_surface-motion-close-duration, var(--aimd-duration-fast));
    animation-timing-function: var(--_surface-motion-close-easing, var(--aimd-ease-in-out));
  }

  @keyframes aimd-anchored-close {
    from { opacity: 1; transform: none; }
    to { opacity: 0; transform: none; }
  }
}
`;
}
