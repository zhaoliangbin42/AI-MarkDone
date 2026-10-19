import type { ShortcutCommandId } from '../../../../../core/shortcuts';

export const SHORTCUT_COMMAND_LABELS: Record<ShortcutCommandId, string> = {
    'selection.copyMarkdown': 'keyboardCommandCopy',
    'selection.annotate': 'keyboardCommandAnnotate',
    'selection.highlight': 'keyboardCommandHighlight',
    'selection.highlight.blue': 'keyboardCommandHighlightBlue',
    'selection.highlight.yellow': 'keyboardCommandHighlightYellow',
    'selection.highlight.red': 'keyboardCommandHighlightRed',
    'prompts.openSuggestions': 'keyboardCommandSuggestions',
    'prompts.openLibrary': 'keyboardCommandLibrary',
    'navigation.previous': 'keyboardCommandPrevious',
    'navigation.next': 'keyboardCommandNext',
};
