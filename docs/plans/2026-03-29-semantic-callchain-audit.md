# AI-MarkDone Semantic Callchain Audit

Date: 2026-03-29

Status: Working audit

Scope:

- Whole plugin, with ChatGPT as the primary inspection target where interaction volume is highest
- Cross-platform shared services included when they materially affect semantic reuse

Authoring intent:

- Define what the major user-facing semantics currently are
- Check whether semantically identical operations already reuse the same low-level call chain
- Identify the main divergence points
- Evaluate the impact range, refactor range, and regression risk of future convergence work

---

## 1. Why this audit exists

当前仓库里已经形成了几条比较稳定的共享能力链，但上层仍存在一些“语义相同、实现分叉”的问题。  
如果继续在这些分叉点上增量加逻辑，后续会更容易出现：

- 一个入口修了，另一个入口漏修
- 同一内容在 Reader、Source、Export、Bookmarks 中行为不一致
- 平台语义被硬编码到 controller，而不是通过 adapter 或 use-case 收口

本次审计的核心判断原则是：

1. 相同语义应尽量共享同一底层调用链
2. 上层入口只应保留必要的 UI 编排差异
3. 同一语义若存在多个实现，应明确：
   - 哪个是 canonical entrypoint
   - 哪个是历史/辅助/特殊路径

---

## 2. Audit method

本次审计通过三种手段完成：

1. 本地代码主链核对
2. 并行子代理专项审查：
   - markdown 获取与 parser 链
   - Reader / Save Messages / Markdown / PDF 链
   - Bookmark / Toolbar / Source 动作链
3. 交叉验证关键 controller / service / adapter 文件

说明：

- 最终结论以当前工作区代码为准
- 子代理结果只作为辅助证据，不直接替代本地核对

---

## 3. Canonical semantics inventory

当前插件中最重要的用户语义，可以先归成下面几类：

1. 从页面 DOM 提取 markdown
2. 将多个 assistant segment 归并成一轮 conversation turn
3. 基于 turn 读取内容
4. 基于 markdown 做用户消费型展示
5. 基于 markdown 做导出
6. 保存书签
7. 消息级工具栏注入与动作触发

### 3.1 Message markdown extraction

Canonical low-level chain:

- `src/services/copy/copy-markdown.ts`
- `src/services/markdown-parser/createMarkdownParser.ts`
- `src/services/markdown-parser/core/Parser.ts`
- `src/drivers/content/adapters/base.ts`
- `src/drivers/content/adapters/parser/*`

Current semantic contract:

- 输入：平台 adapter + message element
- 输出：这条消息对应的 markdown

Current canonical entrypoint:

- `copyMarkdownFromMessage(adapter, messageElement)`

Current low-level steps:

1. `resolveContentRoot()`
2. clone DOM
3. `adapter.normalizeDOM()`
4. `removeNoiseNodes()`
5. optional `enhanceUnrenderedMath()`
6. create parser
7. parse clone -> markdown

Judgment:

- 这条链已经是当前仓库里最稳定、最适合作为 canonical truth 的低层语义链

### 3.2 Conversation turn grouping

Canonical low-level chain:

- `src/drivers/content/conversation/collectConversationTurnRefs.ts`

Current semantic contract:

- 输入：adapter
- 输出：按“用户看到的一轮对话”分组后的 `ConversationTurnRef[]`

Current canonical entrypoint:

- `collectConversationTurnRefs(adapter)`

Judgment:

- Reader
- Save Messages
- merged turn markdown
- conversation navigation

都已经部分或全部依赖这条链。  
这是当前第二条已经比较收敛的 canonical 语义链。

### 3.3 Turn markdown

Canonical low-level chain:

- `src/services/copy/copy-turn-markdown.ts`

Current semantic contract:

- 输入：一轮 turn 对应的多个 `messageEls`
- 输出：合并后的 assistant markdown

Current canonical entrypoint:

- `copyMarkdownFromTurn(adapter, messageEls)`

Judgment:

- 这是“message markdown extraction”和“conversation turn grouping”之间的桥梁
- 当前很多上层功能共享的是这条 turn 级语义，而不是直接共享单条 message markdown

---

## 4. Semantic-to-callchain matrix

| Semantic | User-facing entrypoints | Current canonical entrypoint | Lowest shared chain | Current divergence | Convergence judgment |
|:--|:--|:--|:--|:--|:--|
| Message markdown extraction | copy, source, bookmark save prep, Reader fallback | `copyMarkdownFromMessage()` | adapter DOM contract -> parser stack | 少量历史辅助转换工具未被主链使用 | 收敛良好 |
| Turn grouping | Reader, Save Messages, turn-based merged markdown, navigation | `collectConversationTurnRefs()` | assistant segments -> turn root grouping | 无明显替代实现 | 收敛良好 |
| Turn markdown | copy merged, source merged, Reader turn content, Save Messages turn content | `copyMarkdownFromTurn()` | `copyMarkdownFromMessage()` over `turn.messageEls` | 无明显平行实现 | 收敛良好 |
| Reader content acquisition | Toolbar Reader | `collectReaderItems()` | `collectConversationTurnRefs()` + `copyMarkdownFromTurn()` | Reader 额外包装成 `ReaderItem` 和 lazy content | 内容源收敛，表示层分叉 |
| Save Messages content acquisition | Save Messages modal | `collectConversationTurns()` | `collectConversationTurnRefs()` + `copyMarkdownFromTurn()` | dialog 打开时快照，时机与 Reader 不同 | 内容源收敛，生命周期不同 |
| Markdown export | Save Messages -> Markdown | `exportTurnsMarkdown()` | `collectConversationTurns()` snapshot | 纯文本格式化链独立 | 合理分叉 |
| PDF export | Save Messages -> PDF | `exportTurnsPdf()` | `collectConversationTurns()` snapshot | markdown -> HTML -> print 链独立 | 合理分叉，但维护成本高 |
| Source display | Toolbar source, Reader source | `getMergedMarkdownForElement()` / `resolveContent()` | same markdown source | 展示入口不同 | 基本收敛 |
| Bookmark save/remove | Toolbar bookmark, Reader header bookmark | none; duplicated orchestration | markdown source shared, persistence shared | controller 级编排重复，平台值硬编码 | 未收敛 |
| Toolbar injection | per-message toolbar | adapter `getToolbarAnchorElement()` / `injectToolbar()` | message discovery + adapter anchor | 无明显替代链 | 收敛良好 |

---

## 5. Detailed findings by domain

### 5.1 Markdown acquisition and parser stack

Relevant files:

- `src/services/copy/copy-markdown.ts`
- `src/services/copy/copy-turn-markdown.ts`
- `src/services/markdown-parser/createMarkdownParser.ts`
- `src/services/markdown-parser/core/Parser.ts`
- `src/drivers/content/adapters/base.ts`
- `src/drivers/content/adapters/parser/*`

What is already good:

- DOM -> markdown 的真正低层逻辑已经集中在 `copyMarkdownFromMessage()`
- 平台差异下沉到 adapter
- parser 差异下沉到 parser adapter
- turn 级内容共享通过 `copyMarkdownFromTurn()` 实现

What is still messy:

- 仓库里还保留着一些不是主链的转换工具：
  - `src/services/copy/html-to-markdown.ts`
  - `src/services/copy/preprocess/table-extractor.ts`
  - `src/services/copy/preprocess/math-extractor.ts` 里的更重路径
- 这些模块当前不属于主运行时 canonical chain，但名字上容易让后续开发误判

Impact range:

- Copy
- Source
- Reader
- Save Messages
- Bookmarks save content

Risk if future work uses the wrong layer:

- 内容语义不一致
- 某些平台特殊节点处理失效
- 代码表面“能跑”，但解析结果和其他入口不同

Assessment:

- 这一层已经接近可以收口
- 后续只需要文档上明确 canonical API，并把非主链模块标成历史/辅助用途

### 5.2 Reader / Save Messages / Markdown / PDF

Relevant files:

- `src/services/reader/collectReaderItems.ts`
- `src/services/reader/types.ts`
- `src/services/export/saveMessagesFacade.ts`
- `src/services/export/saveMessagesMarkdown.ts`
- `src/services/export/saveMessagesPdf.ts`
- `src/services/renderer/renderMarkdown.ts`
- `src/ui/content/export/SaveMessagesDialog.ts`
- `src/ui/content/reader/ReaderPanel.ts`

What is shared:

- Reader 和 Save Messages 的内容来源基本一致：
  - `collectConversationTurnRefs()`
  - `copyMarkdownFromTurn()`

- Markdown export 和 PDF export 也共享同一份 `ChatTurn[]` snapshot

Where they diverge:

- Reader 把内容包装成 `ReaderItem`
- Markdown export 是文本序列化
- PDF export 是 markdown -> HTML -> print
- Reader 展示和 PDF 展示都依赖 `renderMarkdownToSanitizedHtml()`，但外围 shell 和 CSS 完全不同

Semantic judgment:

- “获取内容”这个语义已经共享
- “如何展示给用户”不是同一语义，因此允许分叉

Key risk:

- 当内容提取和渲染分属不同层时，容易误以为“PDF/Reader 问题一定来自内容链”
- 实际上：
  - 内容链可能是对的
  - 问题出在展示/打印链

Assessment:

- 这一层不是“未收敛”
- 更准确地说，是“内容语义已收敛，输出介质语义合理分叉”

### 5.3 Toolbar actions and bookmark semantics

Relevant files:

- `src/ui/content/controllers/MessageToolbarOrchestrator.ts`
- `src/ui/content/bookmarks/BookmarksPanelController.ts`
- `src/ui/content/bookmarks/save/BookmarkSaveDialog.ts`

What is shared:

- Toolbar copy / source / bookmark save prep 都共享 `getMergedMarkdownForElement()`
- `getMergedMarkdownForElement()` 最终共享 `copyMarkdownFromTurn()`
- Bookmark persistence 最终都落在 `BookmarksPanelController.toggleBookmarkFromToolbar()`

What is not shared:

- Reader header bookmark action 和 toolbar bookmark action 各自手写了一遍完整 orchestration
- 两边都在重复：
  - 取 prompt
  - 取 markdown
  - 判断 create / remove
  - create 时打开 `bookmarkSaveDialog`
  - remove 时生成 fallback title
  - 更新局部 UI 状态

Critical semantic mismatch:

- 当前 bookmark action 里 `platform` 仍然被硬编码成 `ChatGPT`
- 但 `MessageToolbarOrchestrator` 实际上是 cross-platform controller

Impact range:

- Toolbar bookmark toggle
- Reader header bookmark toggle
- Bookmarks stored metadata
- 未来任何需要“把一条 turn 保存成 bookmark”的入口

Regression risk if refactored:

- 中高
- 因为这里横跨：
  - toolbar UI state
  - reader item meta state
  - bookmark storage
  - folder selection dialog

Assessment:

- 这是当前最典型的“同语义未真正共享”的层
- 也是最值得作为下一轮 semantic convergence 优先收口的层

### 5.4 Runtime / adapter / controller semantics

Relevant files:

- `src/drivers/content/adapters/base.ts`
- `src/drivers/content/injection/messageDiscovery.ts`
- `src/ui/content/controllers/MessageToolbarOrchestrator.ts`
- `src/drivers/content/conversation/collectConversationTurnRefs.ts`

What is converged:

- message discovery 主要通过 adapter selector + shared discovery 完成
- toolbar injection 主要通过 adapter anchor + shared orchestrator 完成

What is only partially converged:

- “一条 conversation 的规范语义单元”目前主要是 `ConversationTurnRef`
- 但部分 controller 仍会自己缓存 turn map、message order、message position

This is acceptable today because:

- 强力模式链已经移除
- 当前 hidden-only 主链主要围绕：
  - message discovery
  - turn refs
  - turn markdown

Assessment:

- 当前 runtime 层不存在必须马上大改的 semantic split
- 更大的问题还是上层 action use-case 是否共享

---

## 6. Impact scope

如果后续要按这份审计推进“语义收口”，影响范围主要分成三类。

### 6.1 Low-risk / narrow-impact areas

- 文档与注释补充 canonical callchain
- 明确哪些模块是历史/辅助路径
- 为 canonical chain 增加更多回归测试

Expected impact:

- 低
- 主要是降低后续开发误用风险

### 6.2 Medium-risk areas

- Bookmark save/remove 语义收口为单一 shared use-case
- Reader 和 toolbar 复用同一 bookmark orchestration helper
- 平台值改为来自 adapter / runtime，而不是硬编码

Expected impact:

- 中
- 涉及 UI state、bookmark dialog、storage metadata

### 6.3 Higher-risk areas

- 继续压缩 Reader / Save Messages / Source 的 controller 编排层
- 把更多“准备数据”和“展示数据”的逻辑进一步下沉成统一 use-case

Expected impact:

- 中高
- 因为会触及多个用户可见入口

---

## 7. Recommended change scope

如果后续按“最小风险”推进，我建议改动范围按下面顺序收。

### Phase 1: Canonical documentation and test locking

Goal:

- 明确 canonical chain
- 给未来改动一个约束面

Change scope:

- docs
- focused tests around:
  - `copyMarkdownFromMessage`
  - `copyMarkdownFromTurn`
  - `collectConversationTurnRefs`
  - Reader / Save Messages shared content expectations

Risk:

- 低

### Phase 2: Bookmark semantic convergence

Goal:

- 把“保存当前 turn 为 bookmark”收口成一个共享 use-case

Suggested refactor boundary:

- keep UI orchestration light in `MessageToolbarOrchestrator`
- move the duplicated bookmark save/remove flow into one shared helper or content-facing service

Likely files:

- `src/ui/content/controllers/MessageToolbarOrchestrator.ts`
- `src/ui/content/bookmarks/BookmarksPanelController.ts`
- possibly a new shared bookmark action helper/service

Risk:

- 中
- 这是下一轮最值得做、但必须带着回归测试做的收口项

### Phase 3: Presentation-chain clarity

Goal:

- 不强行统一 Reader 与 PDF 的展示链
- 但要在文档与测试里明确：
  - 内容来源必须一致
  - 表示层允许分叉

Risk:

- 低到中
- 更多是治理与验证，不一定需要大量实现改动

---

## 8. Regression risk assessment

### If we do nothing

Risks:

- 新入口可能绕开 canonical markdown chain
- bookmark 语义继续漂移
- 平台值硬编码继续污染 cross-platform 逻辑

Severity:

- 中

### If we refactor too broadly

Risks:

- Reader / Save Messages / PDF 被一起误伤
- toolbar 行为出现细微但高频的回归
- 平台适配层的责任被重新打乱

Severity:

- 中高

### Best risk posture

Recommended:

1. 先把 canonical semantic map 写清楚
2. 先动 bookmark 这一层
3. 不要为了“表面统一”去强行合并 Reader 和 PDF 渲染链
4. 始终围绕：
   - 内容语义统一
   - 展示语义允许分叉

---

## 9. Final judgment

当前项目还**没有从整体语义层完全收口**，但已经有了一个非常明确的主轴：

- canonical message markdown chain
- canonical turn grouping chain
- canonical turn markdown chain

这三条已经足够构成插件的“内容语义骨架”。

当前最主要的收口缺口不是 markdown 本身，而是：

- bookmark save/remove action 仍然没有统一成单一 use-case
- 个别 controller 还在自己拼接相同语义的流程

所以从全局上看：

- **内容语义层：已经基本成型**
- **动作语义层：还没有完全收口**

最合适的下一步不是大重构，而是围绕 bookmark 这一层做一轮小而准的 semantic convergence。

---

## 10. Recommended next document

如果继续推进，下一份最值得写的文档是：

- `Bookmark Save Semantic Convergence Design`

它应只回答：

1. “保存当前 turn 为书签”的 canonical semantic 是什么
2. Toolbar 和 Reader 如何共享同一个 use-case
3. platform、folder、title、ui-state 各自由谁负责
4. 改动范围和回归验证怎么锁

