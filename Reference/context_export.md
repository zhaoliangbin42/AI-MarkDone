# AI Copy Enhance - 书签功能开发上下文导出

> **导出时间**: 2025-12-13  
> **对话ID**: 8d433599-1f04-4dc1-acb0-f238fec99534  
> **目的**: 为新对话提供完整的项目上下文和当前状态

---

## 1. 项目概述

**项目名称**: AI Copy Enhance  
**项目类型**: Chrome 扩展 (Manifest V3)  
**主要功能**: 增强 ChatGPT 和 Gemini 的使用体验

**当前开发目标**: 实现书签功能，允许用户保存和管理 AI 对话

---

## 2. 技术栈

- **语言**: TypeScript
- **构建工具**: Vite 5.x
- **目标平台**: Chrome Extension (Manifest V3)
- **支持网站**: ChatGPT (chatgpt.com) 和 Gemini (gemini.google.com)
- **存储**: chrome.storage.local API

---

## 3. 项目结构

```
AI_Copy_Enhance/
├── src/
│   ├── content/              # 内容脚本
│   │   ├── index.ts         # 主入口
│   │   ├── components/      # UI 组件
│   │   │   └── toolbar.ts   # 工具栏组件
│   │   ├── adapters/        # 平台适配器
│   │   │   ├── base.ts
│   │   │   ├── chatgpt.ts
│   │   │   ├── gemini.ts
│   │   │   └── registry.ts
│   │   └── injectors/       # 注入器
│   ├── bookmarks/           # 书签功能（新增）
│   │   ├── storage/         # 存储层
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── SimpleBookmarkStorage.ts
│   │   └── components/      # UI 组件
│   │       ├── SimpleBookmarkPanel.ts
│   │       └── BookmarkEditModal.ts
│   ├── background/          # 后台脚本
│   │   └── service-worker.ts
│   └── utils/               # 工具函数
│       └── logger.ts
├── public/
│   ├── icons/
│   └── manifest.json
├── dist/                    # 构建输出
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. 核心数据结构

### Bookmark 类型定义

```typescript
export interface Bookmark {
    url: string;                    // 对话 URL
    position: number;               // 消息在对话中的位置
    userMessage: string;            // 用户消息内容
    aiResponse?: string;            // AI 响应内容
    title?: string;                 // 用户自定义标题
    notes?: string;                 // 用户备注
    platform?: 'ChatGPT' | 'Gemini'; // 平台
    timestamp: number;              // 创建时间戳
    urlWithoutProtocol?: string;    // 不含协议的 URL（用于显示）
}
```

### 存储 Key 格式

```typescript
// 单个书签: `bookmark:${url}:${position}`
// 示例: "bookmark:https://chatgpt.com/c/abc123:5"
```

---

## 5. 已实现的功能

### ✅ 已完成

1. **存储层** (`SimpleBookmarkStorage.ts`)
   - `save(bookmark)` - 保存书签
   - `getAllBookmarks()` - 获取所有书签
   - `remove(url, position)` - 删除书签
   - `updateBookmark(url, position, updates)` - 更新书签
   - `clear()` - 清空所有书签

2. **书签面板** (`SimpleBookmarkPanel.ts`)
   - 显示书签列表（flex 布局）
   - 搜索功能（按标题、消息、响应）
   - 平台过滤（ChatGPT/Gemini）
   - 预览详情（模态框）
   - 编辑书签（标题和备注）
   - 删除书签（单个和批量）
   - 导出书签（JSON 格式）
   - 实时同步（storage.onChanged 监听）

3. **编辑模态框** (`BookmarkEditModal.ts`)
   - 编辑标题和备注
   - 保存/取消操作

### ❌ 未完成

1. **导入功能** - 从 JSON 文件导入书签
2. **文件夹管理** - 组织书签到文件夹
3. **页面头部图标** - 在消息头部显示书签状态图标
4. **Popup 面板** - 点击扩展图标显示的弹窗

---

## 6. 关键实现细节

### 6.1 存储实现

使用 `chrome.storage.local` API，每个书签作为独立的 key 存储：

```typescript
// 保存
await chrome.storage.local.set({
    [`bookmark:${url}:${position}`]: bookmark
});

// 获取所有
const allData = await chrome.storage.local.get(null);
const bookmarks = Object.entries(allData)
    .filter(([key]) => key.startsWith('bookmark:'))
    .map(([_, value]) => value as Bookmark);
```

### 6.2 面板架构

- **Shadow DOM** - 隔离样式，避免与页面冲突
- **侧边栏标签** - Bookmarks / Settings / Support
- **Flex 布局** - 书签列表使用 flex 行布局
- **事件委托** - 高效处理大量书签的事件

### 6.3 平台适配

使用适配器模式支持不同平台：

```typescript
// src/content/adapters/base.ts
export abstract class SiteAdapter {
    abstract matches(): boolean;
    abstract getMessageSelector(): string;
    abstract getMessageContentSelector(): string;
    // ...
}
```

---

## 7. 构建和部署

### 构建命令

```bash
npm run build
```

### 构建输出

```
dist/
├── content.js          # 内容脚本
├── background.js       # 后台脚本
├── manifest.json       # 清单文件
└── icons/             # 图标文件
```

### 加载扩展

1. 打开 `chrome://extensions`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `dist` 目录

---

## 8. 已知问题和注意事项

### 8.1 编译问题历史

**问题**: 之前尝试使用 `BookmarkStorage.ts` 和 `BookmarkManager.ts`，但遇到了一些集成问题。

**解决方案**: 回滚到使用 `SimpleBookmarkStorage.ts` 和 `SimpleBookmarkPanel.ts`，这是一个更简单、更稳定的实现。

### 8.2 属性名称变化

**重要**: 不同版本的代码使用了不同的属性名：

- **旧版本**: `conversationUrl`, `messagePosition`, `id`
- **当前版本**: `url`, `position`（无 `id` 字段）

确保在新对话中使用当前版本的属性名。

### 8.3 模块引用

**正确的引用**:
```typescript
import { SimpleBookmarkStorage } from '../storage/SimpleBookmarkStorage';
import { bookmarkEditModal } from './BookmarkEditModal';
```

**错误的引用**（已废弃）:
```typescript
import { bookmarkStorage } from '../storage/BookmarkStorage';  // ❌
import { BookmarkManager } from '../managers/BookmarkManager'; // ❌
```

---

## 9. 下一步开发建议

### 优先级 1: 导入功能

在 `SimpleBookmarkPanel.ts` 中添加导入按钮和逻辑：

```typescript
private handleImport(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        const text = await file.text();
        const bookmarks = JSON.parse(text) as Bookmark[];
        
        // 导入逻辑
        for (const bookmark of bookmarks) {
            await SimpleBookmarkStorage.save(bookmark);
        }
        
        await this.refresh();
    };
    input.click();
}
```

### 优先级 2: 文件夹功能

1. 扩展 `Bookmark` 类型添加 `folderId` 字段
2. 创建 `Folder` 类型和存储逻辑
3. 在面板中添加文件夹选择器

### 优先级 3: 页面头部图标

在 `src/content/injectors/` 创建新的注入器，在消息头部添加书签图标。

---

## 10. 测试指南

### 手动测试步骤

1. **保存书签**
   - 打开 ChatGPT 或 Gemini
   - 在消息工具栏点击书签按钮
   - 填写标题和备注
   - 点击保存

2. **查看书签**
   - 使用快捷键或按钮打开书签面板
   - 验证书签列表显示正确

3. **搜索和过滤**
   - 在搜索框输入关键词
   - 使用平台过滤器

4. **编辑和删除**
   - 点击编辑按钮修改书签
   - 点击删除按钮删除书签
   - 测试批量删除功能

5. **导出**
   - 点击导出按钮
   - 验证下载的 JSON 文件格式正确

---

## 11. 重要文件清单

### 必须保留的文件

```
src/bookmarks/storage/SimpleBookmarkStorage.ts  # 核心存储逻辑
src/bookmarks/storage/types.ts                  # 类型定义
src/bookmarks/storage/constants.ts              # 常量定义
src/bookmarks/components/SimpleBookmarkPanel.ts # 主面板
src/bookmarks/components/BookmarkEditModal.ts   # 编辑模态框
```

### 已删除的文件（不要恢复）

```
src/bookmarks/storage/BookmarkStorage.ts        # 已废弃
src/bookmarks/managers/BookmarkManager.ts       # 已废弃
src/bookmarks/components/BookmarkCreationModal.ts # 已废弃
public/popup.html                               # 已废弃
src/popup/popup.ts                              # 已废弃
```

---

## 12. 给新对话的提示

当你在新对话中继续开发时，请：

1. **首先阅读本文档** - 了解当前状态和架构
2. **查看 task.md** - 了解任务进度
3. **查看 implementation_plan.md** - 了解详细的实现计划
4. **检查代码** - 确认当前使用的是 `SimpleBookmarkStorage` 而不是 `BookmarkStorage`
5. **运行构建** - 确保代码可以正常编译：`npm run build`
6. **测试功能** - 在浏览器中加载扩展并测试现有功能

### 关键命令

```bash
# 类型检查
npm run type-check

# 构建
npm run build

# 开发模式（如果需要）
npm run dev
```

---

## 13. 联系和资源

- **项目路径**: `/Users/benko/Documents/4-工作/7-OpenSource/AI_Copy_Enhance`
- **Artifacts 路径**: `/Users/benko/.gemini/antigravity/brain/8d433599-1f04-4dc1-acb0-f238fec99534/`
- **Chrome 扩展文档**: https://developer.chrome.com/docs/extensions/

---

## 附录：快速参考

### Bookmark 存储格式

```json
{
  "bookmark:https://chatgpt.com/c/abc:5": {
    "url": "https://chatgpt.com/c/abc",
    "position": 5,
    "userMessage": "用户的问题",
    "aiResponse": "AI 的回答",
    "title": "自定义标题",
    "notes": "备注",
    "platform": "ChatGPT",
    "timestamp": 1702468800000,
    "urlWithoutProtocol": "chatgpt.com/c/abc"
  }
}
```

### 常用 API

```typescript
// 保存书签
await SimpleBookmarkStorage.save(bookmark);

// 获取所有书签
const bookmarks = await SimpleBookmarkStorage.getAllBookmarks();

// 删除书签
await SimpleBookmarkStorage.remove(url, position);

// 更新书签
await SimpleBookmarkStorage.updateBookmark(url, position, { title, notes });

// 清空所有书签
await SimpleBookmarkStorage.clear();
```

---

**祝开发顺利！** 🚀
