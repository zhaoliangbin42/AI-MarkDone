# Keyboard settings

Open `/mocks/components/keyboard-settings/index.html?view=settings&locale=zh_CN` using `npm run dev`.

This fixture mounts the production `BookmarksPanel`, `SettingsTabView`, and `KeyboardSettingsView`. The shared workspace fixture handles settings through the real settings service with a simulated background transport. Changes remain in the fixture page. Recording, conflict replacement, disabling, clearing, defaults, and automatic suggestions all use the production controls.

Check light/dark appearance, narrow layouts, keyboard focus, composition, failed-save retry, preset reset, empty-default reset, and reopening the workspace.
