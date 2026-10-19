export type Binding = {
    key: string;
    primary: boolean;
    alt: boolean;
    shift: boolean;
    control?: boolean;
};

export type Command = {
    id: string;
    label: string;
    description: string;
    group: 'selection' | 'reading' | 'writing' | 'workspace';
    scope: 'selection' | 'reading' | 'composer' | 'page';
    defaultBinding: Binding | null;
};

export const COMMANDS: Command[] = [
    {
        id: 'selection.copyMarkdown', label: '复制所选 Markdown',
        description: '将正文选区复制为 Markdown，保留格式。',
        group: 'selection', scope: 'selection',
        defaultBinding: { key: 'c', primary: true, alt: false, shift: true },
    },
    {
        id: 'selection.annotate', label: '添加注释',
        description: '为当前正文选区打开注释编辑器。',
        group: 'selection', scope: 'selection', defaultBinding: null,
    },
    {
        id: 'selection.highlight', label: '默认色高亮',
        description: '使用默认颜色高亮当前正文选区。',
        group: 'selection', scope: 'selection', defaultBinding: null,
    },
    {
        id: 'reading.previous', label: '上一条消息',
        description: '未在输入文字时，定位到上一条消息。',
        group: 'reading', scope: 'reading',
        defaultBinding: { key: 'ArrowLeft', primary: false, alt: false, shift: false },
    },
    {
        id: 'reading.next', label: '下一条消息',
        description: '未在输入文字时，定位到下一条消息。',
        group: 'reading', scope: 'reading',
        defaultBinding: { key: 'ArrowRight', primary: false, alt: false, shift: false },
    },
    {
        id: 'reading.toggleReader', label: '打开 / 关闭 Reader',
        description: '打开当前消息的 Reader，或返回对话。',
        group: 'reading', scope: 'reading', defaultBinding: null,
    },
    {
        id: 'writing.autocomplete', label: '打开提示词候选',
        description: '在 ChatGPT 输入框中主动唤起提示词联想。',
        group: 'writing', scope: 'composer', defaultBinding: null,
    },
    {
        id: 'writing.promptLibrary', label: '打开提示词库',
        description: '在 ChatGPT 输入框中选择并插入提示词。',
        group: 'writing', scope: 'composer', defaultBinding: null,
    },
    {
        id: 'writing.focusComposer', label: '聚焦输入框',
        description: '从阅读区域回到 ChatGPT 输入框。',
        group: 'writing', scope: 'page', defaultBinding: null,
    },
    {
        id: 'workspace.library', label: '打开资料库',
        description: '打开收藏、注释与提示词工作区。',
        group: 'workspace', scope: 'page', defaultBinding: null,
    },
    {
        id: 'workspace.settings', label: '打开设置',
        description: '打开 AI-MarkDone 设置。',
        group: 'workspace', scope: 'page', defaultBinding: null,
    },
    {
        id: 'workspace.export', label: '打开导出面板',
        description: '为当前消息打开导出选项。',
        group: 'workspace', scope: 'reading', defaultBinding: null,
    },
];

const MODIFIER_KEYS = new Set([
    'Alt', 'AltGraph', 'Control', 'Meta', 'Shift', 'OS', 'Fn', 'FnLock',
    'CapsLock', 'NumLock', 'ScrollLock', 'Symbol', 'SymbolLock',
]);

function normalizeKey(key: string): string {
    if (key === ' ' || key === 'Spacebar' || key === 'Space') return 'Space';
    if (key === 'Esc') return 'Escape';
    if (key === 'Left') return 'ArrowLeft';
    if (key === 'Right') return 'ArrowRight';
    if (key === 'Up') return 'ArrowUp';
    if (key === 'Down') return 'ArrowDown';
    return key.length === 1 ? key.toLowerCase() : key;
}

export function normalizeKeyboardEvent(event: KeyboardEvent, isMac: boolean): Binding | null {
    if (event.repeat || event.isComposing || event.keyCode === 229) return null;
    if (!event.key || MODIFIER_KEYS.has(event.key)) return null;
    if (['Dead', 'Process', 'Unidentified'].includes(event.key)) return null;
    if (event.getModifierState?.('AltGraph')) return null;
    if (!isMac && event.metaKey) return null;

    return {
        key: normalizeKey(event.key),
        primary: isMac ? event.metaKey : event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        ...(isMac && event.ctrlKey ? { control: true } : {}),
    };
}

const KEY_LABELS: Record<string, string> = {
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
    Space: 'Space', Escape: 'Esc', Enter: 'Enter', Backspace: '⌫',
    Delete: 'Delete', Tab: 'Tab', Home: 'Home', End: 'End',
    PageUp: 'Page Up', PageDown: 'Page Down',
};

export function formatBinding(binding: Binding, isMac: boolean): string[] {
    const keys: string[] = [];
    if (binding.primary) keys.push(isMac ? '⌘' : 'Ctrl');
    if (binding.control && (isMac || !binding.primary)) keys.push(isMac ? '⌃' : 'Ctrl');
    if (binding.alt) keys.push(isMac ? '⌥' : 'Alt');
    if (binding.shift) keys.push(isMac ? '⇧' : 'Shift');
    const key = normalizeKey(binding.key);
    keys.push(KEY_LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key));
    return keys;
}

export function bindingKey(binding: Binding): string {
    return JSON.stringify([
        Boolean(binding.primary), Boolean(binding.control),
        Boolean(binding.alt), Boolean(binding.shift), normalizeKey(binding.key),
    ]);
}

function scopesOverlap(left: Command['scope'], right: Command['scope']): boolean {
    // The prototype suspends page and reading commands while the composer owns focus.
    return left === 'composer' || right === 'composer' ? left === right : true;
}

export function findConflicts(
    commandId: string,
    candidate: Binding,
    effectiveBindings: Record<string, Binding | null>,
): Command[] {
    const command = COMMANDS.find((item) => item.id === commandId);
    if (!command) return [];
    const candidateKey = bindingKey(candidate);
    return COMMANDS.filter((other) => {
        const binding = effectiveBindings[other.id];
        return other.id !== commandId && binding != null
            && scopesOverlap(command.scope, other.scope)
            && bindingKey(binding) === candidateKey;
    });
}

export function validateBinding(
    binding: Binding,
    isMac: boolean,
): { level: 'ok' | 'warning' | 'blocked'; message: string } {
    const key = normalizeKey(binding.key);
    if (!key || MODIFIER_KEYS.has(key) || ['Dead', 'Process', 'Unidentified'].includes(key)) {
        return { level: 'blocked', message: '请再按一个非修饰键，完成快捷键组合。' };
    }
    if (key === 'Escape' || key === 'Tab') {
        return { level: 'blocked', message: 'Esc 用于取消，Tab 用于切换焦点，请选择其他按键。' };
    }
    if (((binding.primary && !isMac) || binding.control) && binding.alt) {
        return { level: 'blocked', message: 'Ctrl + Alt 可能参与键盘布局与特殊字符输入，请换一组组合键。' };
    }
    if ((isMac && binding.primary && !binding.shift && !binding.control
        && ['q', 'h', 'm', 'Space'].includes(key))
        || (!isMac && binding.alt && ['F4', 'Space'].includes(key))) {
        return { level: 'blocked', message: '这组按键用于系统或应用窗口操作，请选择其他组合。' };
    }
    if (binding.primary && !binding.alt && !binding.control
        && ['l', 't', 'w', 'r', 'n', 'f', 'p'].includes(key)) {
        return { level: 'blocked', message: '这组按键由浏览器用于地址栏、标签页、查找或打印等操作，请换一组。' };
    }
    if (!binding.primary && !binding.alt && !binding.control) {
        if (!binding.shift && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
            return { level: 'ok', message: '方向键仅可用于上一条或下一条消息，输入文字时暂停。' };
        }
        return { level: 'blocked', message: '请加入修饰键，避免影响正常输入。方向键仅供消息导航使用。' };
    }
    if (binding.primary && binding.shift && !binding.alt && !binding.control && key === 'c') {
        return { level: 'warning', message: '部分浏览器将这组按键用于开发者工具。可保存，请在实际浏览器中试按确认。' };
    }
    if (!binding.primary && binding.alt) {
        return { level: 'warning', message: 'Alt / Option 组合可能参与系统操作或特殊字符输入，请试按确认。' };
    }
    return { level: 'ok', message: '可继续检查插件内冲突；系统、浏览器及其他扩展的占用无法完整检测。' };
}
