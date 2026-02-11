# Domain 07 附件：innerHTML / insertAdjacentHTML Sink 清单（Round-3）

> 目的：建立可执行的 sink 基线，避免“零散修复、无全局视图”。

## 扫描范围
- 路径：`src/**`
- 模式：`.innerHTML =`、`insertAdjacentHTML(`
- 扫描结果：`68` 个命中

## 高风险（涉及外部/用户可变输入）

1. `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/save-messages.ts:404`
- `printContainer.innerHTML = html`
- `html` 可能来自消息内容拼接，需确保上游已严格 sanitize。

2. `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/MessageSender.ts:196`
- `input.innerHTML = html`
- 直接影响输入框，若来源未净化存在注入面。

3. `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/parsers/math-extractor.ts:302`
- `block.innerHTML = result`
- `result` 来源于解析链路，需核验只含受控片段。

### 当前状态（Round-3 Step6）
- 上述 3 处高风险 `innerHTML` 赋值已替换为 `DOMParser + replaceChildren` 或节点拼装方式（已完成）。
- 同时收敛了 parser 入口的 `tempDiv.innerHTML = html`（math/code/table）到 DOMParser 容器解析。

## 中风险（模板字符串注入点，需确认变量来源）

1. `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/bookmarks/components/SimpleBookmarkPanel.ts`（多处 `modal.innerHTML = \`...\``）
2. `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/bookmarks/components/BookmarkSaveModal.ts`（`modal.innerHTML` / `treeBody.innerHTML`）
3. `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/re-render.ts`（header/body 模板渲染）
4. `/Users/benko/Documents/4-工作/7-OpenSource/AI-MarkDone/src/content/features/SaveMessagesDialog.ts`（header/selector/format 模板渲染）

## 低风险（受控 icon/静态片段/清空）

1. icon 注入：`Icons.*` 常量（如 toolbar/button/floating input）
2. 清空容器：`element.innerHTML = ''`
3. 测试/示例代码：`src/parser-example.ts`

## 后续执行策略（下一批）

1. 先改高风险 3 处：引入统一 sanitize + 安全赋值 helper。
2. 再改中风险模板：逐文件迁移到 `createElement/textContent` 或受控模板渲染器。
3. 最后保留低风险白名单：在测试中显式声明允许项，防止新增未审 sink。
