# Domain 12 Visual E2E Checklist (Reusable)

## Scope
- Visual consistency for reader/dialog/toolbar/floating-input across light/dark and target platforms.

## Preconditions
- Use latest build from current branch.
- Ensure browser cache is cleared or extension reloaded.
- Prepare a long mixed-content conversation containing headings, table, blockquote, inline code, fenced code.

## 1. Theme Parity (Light/Dark)
1. Open reader in light mode.
2. Verify code block background is visually distinct but not too dark.
3. Switch to dark mode and verify code block remains readable (no washed-out text).
4. Verify title/table/blockquote hierarchy remains clear in both themes.

## 2. Keyboard Accessibility
1. Use `Tab` to navigate actionable controls in reader/dialog/toolbar.
2. Verify visible focus ring appears on:
   - close buttons
   - action buttons
   - segmented options
   - toolbar buttons
   - floating input controls
3. Ensure focus ring does not permanently persist after mouse interaction.

## 3. Button/Input Consistency
1. Open Save Messages dialog.
2. Verify primary/secondary button height baseline feels consistent (no mixed heights).
3. Verify hover/active/disabled states are coherent and theme-correct.
4. Open floating input and verify textarea focus feedback appears clearly.

## 4. Runtime Feedback Consistency
1. Trigger reader jump highlight.
2. Trigger copy feedback tooltip.
3. Trigger deep-research success/error toast (if available).
4. Confirm feedback colors follow semantic role (primary vs error) and are theme-consistent.

## 5. Cross-Platform Spot Check
Run 1-4 on:
- ChatGPT
- Gemini
- Claude
- DeepSeek

## Pass Criteria
- No raw markdown fences rendered as plain text.
- No obvious color/token mismatch across components in same theme.
- Keyboard focus always visible for interactive elements.
- No regression in code block indentation.

## Failure Logging Template
- Platform:
- Theme:
- Step:
- Expected:
- Actual:
- Screenshot:
- Reproducibility:
