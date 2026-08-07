# ADR-0012-runtime-rpc-failure-semantics

## Status

Accepted

## Context

content surface、detached Reader 与 background 之间原本直接把 `runtime.sendMessage()` 的返回值当成协议响应。浏览器在扩展更新/重载、content context 失效、receiver 尚未建立、service worker 生命周期竞态或请求超时时，不会返回业务层的 `{ ok, data | error }` envelope。调用方却普遍用 `!response.ok`、`null`、`false` 或空数组降级，导致 transport failure 被呈现成“没有文件夹”“session expired”或默认设置，并且设置 UI 可能在写入失败后仍保留 optimistic state。

默认重试也不能作为通用修复：timeout 时消息是否已由 background 执行是未知的，自动重放书签保存、删除、设置写入或发送等 mutation 可能制造重复副作用。

## Decision

- wire protocol error 与 browser transport failure 是两个不同层级：
  - background 的合法 error envelope 继续使用 `ProtocolErrorCode`
  - `src/drivers/shared/rpc.ts` 只负责发送、timeout、异常分类和 response correlation，返回 `RpcCallResult`
  - `src/drivers/shared/clients/clientResult.ts` 是 feature client 的统一入口，返回保留 `protocol | transport` 判别信息的 `RuntimeClientResult<T>`
- response 必须与 request 的 `v`、`id`、`type` 一致，且 success/error envelope 合法；否则是 `INVALID_RESPONSE`，不能进入业务层。
- success envelope 不是业务成功的充分条件。每个 feature client 必须解码自己拥有的 payload；读取响应缺字段、记录结构错误或 mutation 缺少 acknowledgement 时同样返回 `INVALID_RESPONSE`，不得提交本地状态。
- shared driver 不做默认 retry。`delivery: unknown` 的 mutation 不得自动重放；未来只有在 background 引入 operation id 与幂等去重后才能改变该规则。
- toggle 类交互先读取一次 canonical 状态，再调用显式 desired-state `save/remove`；弹窗或异步读取结束后必须复核当前 URL/source revision，不能再次 toggle 或把旧页面结果写入新页面。
- feature presentation 必须显式区分 `loading / ready-empty / error`：
  - last-good 数据在读取失败时保留
  - `CONTEXT_INVALIDATED` 提示刷新页面，其余可恢复读失败提供显式 Retry
  - 设置只有 background 成功确认后才更新 canonical state；写失败时回滚，初始 canonical 读取失败时锁定编辑
  - detached Reader 只把可信的 `session: null` 解释为 expired
- feature 代码不再直接消费 `sendExtRequest`; feature clients 统一通过 `requestRuntimeClient` 投影结果。

## Consequences

- 浏览器断连不再伪装成业务空态，书签、设置和 detached Reader 共享同一失败语义。
- mutation 不会因为 timeout 被隐式执行两次；代价是临时失败需要用户显式恢复。
- 每个新增 RPC consumer 必须为真实 empty 与 transport error 分别建模，并为 failure presentation 添加回归测试。
- 每个 mutation consumer 必须验证 background acknowledgement；快速连续的全量设置写入必须串行地基于最新 confirmed state 合并，防止字段丢失和陈旧 rollback。
- 如果未来需要安全自动重试，必须先在对应 request family 的协议中定义幂等 identity、去重窗口和 delivery 证明，再更新本 ADR 与 `RUNTIME_PROTOCOL.md`。
