import { describe, expect, it } from 'vitest';
import { saveMessagesDialogStyles } from '../save-messages-dialog.css';
import { floatingInputStyles } from '@/content/utils/FloatingInputStyles';
import { readerPanelStyles } from '@/content/utils/ReaderPanelStyles';
import { toolbarStyles } from '@/styles/toolbar.css';
import { modalStyles } from '@/styles/modal.css';
import { Button } from '@/components/Button';

describe('visual consistency contracts', () => {
  it('keeps primary action button baseline height aligned across dialog and modal', () => {
    expect(saveMessagesDialogStyles).toContain('--aimd-dialog-button-height: 36px');
    expect(saveMessagesDialogStyles).toContain('min-height: var(--aimd-dialog-button-height)');
    expect(modalStyles).toContain('min-height: 36px');
  });

  it('provides visible keyboard focus styles for key interactive controls', () => {
    expect(saveMessagesDialogStyles).toContain(':focus-visible');
    expect(floatingInputStyles).toContain('.aimd-float-textarea:focus-visible');
    expect(toolbarStyles).toContain('.aicopy-button:focus-visible');
    expect(Button.getStyles()).toContain('.btn:focus-visible');
  });

  it('keeps reduced-motion guards in interactive style modules', () => {
    expect(floatingInputStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(readerPanelStyles).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
