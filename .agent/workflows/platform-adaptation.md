
### 1.1 获取页面 HTML

```bash
# 在浏览器中打开平台，使用 DevTools 保存 HTML
# 保存到 mocks/[Platform]/ 目录
```

### 1.2 识别关键选择器

| 需要识别 | 说明 | 示例 |
|:--------|:-----|:-----|
| **消息容器** | AI 回复的根元素 | `model-response`, `article[data-turn]` |
| **消息内容** | 实际 Markdown 内容区域 | `.markdown.prose`, `.model-response-text` |
| **Action Bar** | 复制/点赞按钮区域 | `div[role="group"]`, `.response-footer` |
| **Copy 按钮** | 用于流式完成检测 | `button[aria-label="Copy"]` |
| **用户消息** | 提取用户提问 | `[data-message-author-role="user"]` |
| **主题指示器** | 深色/浅色模式判断 | `html.dark`, `body.dark-theme`, `data-mode` |
| **输入框** | 消息发送功能 | `#prompt-textarea`, `.ql-editor` |
| **发送按钮** | 触发消息发送 | `button[type="submit"]` |

### 1.3 识别主题切换机制

| 平台 | 主题指示器 | 元素 |
|:-----|:----------|:-----|
| ChatGPT | `class="dark"` / `class="light"` | `<html>` |
| Gemini | `class="dark-theme"` / `class="light-theme"` | `<body>` |
| Claude | `data-mode="dark"` / `data-mode="light"` | `<html>` |

---

## Phase 2: Adapter 实现

### 2.1 创建 Adapter 文件

**路径**: `src/content/adapters/[platform].ts`

```typescript
import { SiteAdapter, ThemeDetector } from './base';
import { logger } from '../../utils/logger';
import { Icons } from '../../assets/icons';

export class [Platform]Adapter extends SiteAdapter {
    // 必须实现的方法
    matches(url: string): boolean { /* ... */ }
    getMessageSelector(): string { /* ... */ }
    getMessageContentSelector(): string { /* ... */ }
    getActionBarSelector(): string { /* ... */ }
    getCopyButtonSelector(): string { /* ... */ }
    extractMessageHTML(element: HTMLElement): string { /* ... */ }
    isStreamingMessage(element: HTMLElement): boolean { /* ... */ }
    getMessageId(element: HTMLElement): string | null { /* ... */ }
    getObserverContainer(): HTMLElement | null { /* ... */ }
    getUserPrompts(): string[] { /* ... */ }
    extractUserPrompt(element: HTMLElement): string | null { /* ... */ }
    getInputSelector(): string { /* ... */ }
    getSendButtonSelector(): string { /* ... */ }
    getIcon(): string { /* ... */ }
    getPlatformName(): string { return '[Platform]'; } // 用于书签存储
    getThemeDetector(): ThemeDetector { /* ... */ }
    normalizeDOM(element: HTMLElement): void { /* Optional: Standardise DOM */ }
}
```

### 2.2 实现 ThemeDetector

```typescript
getThemeDetector(): ThemeDetector {
    return {
        detect: () => {
            // 根据平台的主题指示器检测
            const html = document.documentElement;
            const value = html.getAttribute('data-xxx');
            if (value === 'dark') return 'dark';
            if (value === 'light') return 'light';
            return null;
        },
        getObserveTargets: () => [{
            element: 'html',  // 或 'body'
            attributes: ['data-xxx']  // 需要监听的属性
        }],
        hasExplicitTheme: () => {
            return !!document.documentElement.getAttribute('data-xxx');
        }
    };
}
```

### 2.3 可选：覆盖默认方法

| 方法 | 何时覆盖 |
|:----|:--------|
| `isNoiseNode()` | 平台有特殊噪音节点需过滤 |
| `injectToolbar()` | 工具栏注入位置与默认不同 |
| `getFocusProtectionStrategy()` | 平台有焦点抢夺问题 |

---

## Phase 3: 注册配置

### 3.1 注册 Adapter

**文件**: `src/content/adapters/registry.ts`

```typescript
import { [Platform]Adapter } from './[platform]';

// 在构造函数中添加
this.register(new [Platform]Adapter());
```

### 3.2 更新 manifest.json

```json
{
  "host_permissions": [
    "https://[platform-domain]/*"
  ],
  "content_scripts": [{
    "matches": [
      "https://[platform-domain]/*"
    ]
  }]
}
```

### 3.3 更新 Service Worker

**文件**: `src/background/service-worker.ts`

```typescript
const SUPPORTED_HOSTS = [
    'chatgpt.com',
    'gemini.google.com',
    '[platform-domain]'  // 新增
];
```

### 3.4 更新 Popup

**文件**: `src/popup/popup.html`

- 添加平台链接按钮
- 添加平台图标

### 3.5 添加平台图标

**文件**: `src/assets/icons.ts`

```typescript
export const Icons = {
    [platform]: `<svg>...</svg>`
};
```

**书签图标适配**: 添加平台图标后，同步更新 `src/bookmarks/datasource/BookmarkDataSource.ts` 中的 `getPlatformIcon()` 函数。

```typescript
// src/bookmarks/datasource/BookmarkDataSource.ts
function getPlatformIcon(platform?: string): string {
    const p = platform?.toLowerCase() || 'chatgpt';
    switch (p) {
        case 'gemini': return Icons.gemini;
        case 'claude': return Icons.claude;
        case '[platform]': return Icons.[platform]; // 新增
        default: return Icons.chatgpt;
    }
}
```

---

## Phase 4: 验证测试

### 4.1 构建验证

```bash
npm run build
# 确保无 TypeScript 错误
```

### 4.2 功能测试清单

- [ ] 扩展图标在平台页面上变为彩色
- [ ] 工具栏正确注入到 AI 消息
- [ ] Copy Markdown 功能正常
- [ ] 字数统计正常显示
- [ ] 流式消息检测正常
- [ ] 主题切换热更新正常
- [ ] 书签功能正常
- [ ] Reader Panel 正常打开

### 4.3 主题切换测试

1. 在平台设置中切换深色/浅色模式
2. 观察工具栏样式是否立即更新
3. 检查控制台日志：`[ThemeManager] Detected via adapter: dark/light`

---

## Phase 5: 文档更新

### 5.1 更新 CAPABILITY_MATRIX.md

| 文件 | 更新内容 |
|:----|:--------|
| `docs/antigravity/platform/CAPABILITY_MATRIX.md` | 添加新平台功能支持状态 |

### 5.2 创建平台文档

**路径**: `docs/platform-support/[PLATFORM]_IMPLEMENTATION.md`

包含：
- 关键技术决策
- DOM 结构说明
- 选择器参考
- 测试清单
- 与其他平台的对比

### 5.3 更新 CHANGELOG

```markdown
## [x.x.0] - YYYY-MM-DD

### Added
- [Platform] platform support
- Toolbar injection for [Platform] messages
```

---

## 📋 快速检查清单

```
□ Phase 1: DOM 分析
  □ 保存 Mock HTML
  □ 识别所有关键选择器
  □ 识别主题切换机制

□ Phase 2: Adapter 实现
  □ 创建 [platform].ts
  □ 实现所有 abstract 方法
  □ 实现 getThemeDetector()
  □ 根据需要覆盖可选方法

□ Phase 3: 注册配置
  □ 在 registry.ts 注册
  □ 更新 manifest.json
  □ 更新 service-worker.ts
  □ 更新 popup.html
  □ 添加平台图标

□ Phase 4: 验证测试
  □ npm run build 成功
  □ 功能测试通过
  □ 主题切换测试通过

□ Phase 5: 文档更新
  □ CAPABILITY_MATRIX.md
  □ [PLATFORM]_IMPLEMENTATION.md
  □ CHANGELOG.md
```

---

## 🔗 参考文档

| 文档 | 用途 |
|:----|:-----|
| [ADAPTER_CONTRACT.md](../antigravity/platform/ADAPTER_CONTRACT.md) | Adapter 接口完整定义 |
| [CAPABILITY_MATRIX.md](../antigravity/platform/CAPABILITY_MATRIX.md) | 平台功能支持矩阵 |
| [CLAUDE_IMPLEMENTATION.md](CLAUDE_IMPLEMENTATION.md) | Claude 适配参考实现 |

---

## 变更记录

| 版本 | 日期 | 变更内容 |
|:---|:---|:---|
| 1.0.0 | 2026-01-12 | 初始版本，基于 Claude 适配经验 |
