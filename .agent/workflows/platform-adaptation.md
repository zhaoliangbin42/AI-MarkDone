---
description: 新平台适配工作流
---

# 新平台适配工作流

> **触发命令**: `/adapt`
> **使用 Artifact**: `implementation_plan.md` (适配方案), `task.md` (进度跟踪), `walkthrough.md` (完成总结)
> **激活 Skill**: `test-driven-development` (按需), `verification-before-completion` (Build 验证)

---

## Phase 1: DOM 分析

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
    getPlatformName(): string { return '[Platform]'; }
    getThemeDetector(): ThemeDetector { /* ... */ }
    normalizeDOM(element: HTMLElement): void { /* Optional */ }
}
```

> **🛑 用户调试点**
> 
> Adapter 核心方法实现后暂停，请用户：
> 1. 加载扩展到浏览器测试基本注入
> 2. 确认工具栏显示后回复"继续"

---

## Phase 3: 注册配置

### 3.1 注册 Adapter

**文件**: `src/content/adapters/registry.ts`

```typescript
import { [Platform]Adapter } from './[platform]';
this.register(new [Platform]Adapter());
```

### 3.2 更新 manifest.json

```json
{
  "host_permissions": ["https://[platform-domain]/*"],
  "content_scripts": [{"matches": ["https://[platform-domain]/*"]}]
}
```

### 3.3 添加平台图标

**文件**: `src/assets/icons.ts`

---

## Phase 4: 验证测试

```bash
// turbo
npm run build
```

### 功能测试清单

- [ ] 扩展图标在平台页面上变为彩色
- [ ] 工具栏正确注入到 AI 消息
- [ ] Copy Markdown 功能正常
- [ ] 主题切换热更新正常
- [ ] 书签功能正常

---

## Phase 5: 文档更新

### 5.1 更新 CAPABILITY_MATRIX.md

| 文件 | 更新内容 |
|:----|:--------|
| `docs/antigravity/platform/CAPABILITY_MATRIX.md` | 添加新平台功能支持状态 |

### 5.2 更新 CHANGELOG

```markdown
## [x.x.0] - YYYY-MM-DD

### Added
- [Platform] platform support
```

---

## ✅ 完成检查清单

- [ ] Phase 1: DOM 分析完成，Mock HTML 已保存
- [ ] Phase 2: Adapter 实现，用户已调试确认
- [ ] Phase 3: 注册配置完成
- [ ] Phase 4: `npm run build` 成功，功能测试通过
- [ ] Phase 5: 文档已更新

**结束条件**: Build 成功，用户确认新平台功能正常

---

## ⚠️ 常见陷阱与解决方案

### 1. React 输入框同步问题
**现象**：直接修改 `input.value` 后，React 内部状态未更新。
**解决方案**：使用 `Object.getOwnPropertyDescriptor` 绕过 React 的 setter 劫持。

### 2. 抗变脆弱性
**现象**：使用构建哈希类名导致平台更新后插件失效。
**解决方案**：使用语义拓扑锚定（如 `input[type="file"]`）进行相对查找。

### 3. DOM 标准化
**现象**：平台使用非标准 HTML 结构。
**解决方案**：在 Adapter 中实现 `normalizeDOM` 钩子。

---

## 🔗 参考文档

| 文档 | 用途 |
|:----|:-----|
| [CAPABILITY_MATRIX.md](docs/antigravity/platform/CAPABILITY_MATRIX.md) | 平台功能支持矩阵 |
