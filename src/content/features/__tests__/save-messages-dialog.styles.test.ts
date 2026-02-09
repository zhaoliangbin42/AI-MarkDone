import { describe, expect, it } from 'vitest';
import { saveMessagesDialogStyles } from '../save-messages-dialog.css';

describe('saveMessagesDialogStyles token consistency', () => {
  it('does not contain hardcoded hex colors in dialog style body', () => {
    const hexMatches = saveMessagesDialogStyles.match(/#[0-9a-fA-F]{3,8}/g) || [];
    expect(hexMatches).toHaveLength(0);
  });

  it('defines scoped semantic aliases for dialog controls', () => {
    expect(saveMessagesDialogStyles).toContain('--aimd-dialog-bg');
    expect(saveMessagesDialogStyles).toContain('--aimd-dialog-border');
    expect(saveMessagesDialogStyles).toContain('--aimd-dialog-primary-bg');
    expect(saveMessagesDialogStyles).toContain('--aimd-dialog-hover-bg');
  });
});
