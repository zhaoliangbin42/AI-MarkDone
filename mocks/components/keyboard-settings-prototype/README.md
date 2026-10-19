# Keyboard settings interaction prototype

Run `npm run dev -- --host 127.0.0.1` and open:

`http://127.0.0.1:5173/mocks/components/keyboard-settings-prototype/index.html?view=settings&locale=zh_CN`

This page mounts the existing Bookmarks/Settings fixture, real sidebar, Buttons
view and shared styles. Only the keyboard panel and its model are prototype code.
All changes live in memory; reload resets them. It does not integrate shortcuts
into the extension or alter the real `app_settings` record.

Try recording a chord for Add annotation, then the same chord for Highlight.
The second editor offers replacement and disables the old binding atomically.
Disabled bindings retain their chord; re-enabling and per-command reset both
check conflicts again. Global disable preserves all chords. Restore all uses an
inline confirmation. The backslash autocomplete switch remains independent.

The test area simulates context selection and prompt insertion, never sends a
message or performs a real feature action. External shortcut detection is a
known limitation; the panel checks internal scope overlap and common reserved keys.
