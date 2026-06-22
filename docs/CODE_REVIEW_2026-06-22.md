# VoiceCanvas 代码评审与架构优化报告

> 评审日期：2026-06-22  
> 评审范围：`app/`、`components/`、`lib/`、`app/[locale]/` 下全部 TypeScript/TSX 源码  
> 维度：代码复用性、简洁性、模块化、稳定性

---

## 执行摘要

项目当前存在两套并行实现（根路由 `app/*` 与国际化路由 `app/[locale]/*`），导致大量重复组件、重复类型与重复业务逻辑。核心画布页单文件超过 2100 行，职责混杂；同时 API 层/providers 与 AGENTS.md 中规定的技术栈存在偏差。build 可通过，但 lint 剩余 49 条 warning，且多处存在运行时不稳定风险。

**风险等级：高**（主要源于维护两套实现与超大组件）。

---

## 1. 代码复用性

### 1.1 两套并行路由与组件实现（严重）

| 位置 A（根路由） | 位置 B（locale 路由） | 说明 |
|---|---|---|
| `app/canvas/page.tsx` (764 行) | `app/[locale]/canvas/page.tsx` (2174 行) | 两套画布页，架构完全不同 |
| `components/canvas/CanvasBoard.tsx` | `app/[locale]/components/CanvasDraw.tsx` | 两套 Canvas 渲染器 |
| `components/voice/MicButton.tsx` | `app/[locale]/components/MicButton.tsx` | 两套麦克风按钮 |
| `components/voice/TranscriptBar.tsx` | `app/[locale]/components/TranscriptBar.tsx` | 两套字幕条 |
| `components/ui/Toast.tsx` | `app/[locale]/components/Toast.tsx` | 两套 Toast |
| `lib/voice/VoiceContext.tsx` | `app/[locale]/components/XfyunVoiceInput.tsx` | 两套语音输入状态管理 |
| `lib/voice/speechRecognition.ts` | `app/[locale]/lib/voice-normalize.ts` | 两套语音解析/归一化 |
| `app/lib/draw-schema.ts` | `app/[locale]/lib/draw-schema.ts` | 已改为 re-export，但历史包袱仍在 |
| `app/lib/canvas-state.ts` | `app/[locale]/lib/canvas-state.ts` | 画布状态机重复 |
| `app/lib/canvas-commands.ts` | `app/[locale]/lib/canvas-commands.ts` | 本地编辑命令解析重复 |
| `app/lib/path-geometry.ts` | `app/[locale]/lib/path-geometry.ts` | 几何工具重复 |
| `app/lib/xfyun-signature.ts` | `app/[locale]/lib/xfyun-signature.ts` | 讯飞签名重复 |
| `lib/db/artworkStore.ts` | `app/[locale]/lib/db.ts` | IndexedDB 封装重复且 schema 不同 |

**问题影响**：
- 同一功能修改需要在两处同步，极易遗漏，导致两套实现行为不一致。
- bundle 体积增大，编译时间变长。
- 新成员难以判断哪份是"真相源"。

**建议**：
1. 明确保留一套实现。当前 `app/[locale]/canvas/page.tsx` 功能更完整（支持 i18n、高级动画、追加绘制、撤销栈），建议以其为基准。
2. 将通用组件上提到 `components/` 或 `lib/`，`app/[locale]/` 下只保留与 locale 强相关的页面壳。
3. 对重复 lib 统一收敛到 `lib/` 或 `app/lib/`，删除另一份。

### 1.2 API 层复用不足

- `/api/draw` 使用 `@ai-sdk/openai` + `OPENAI_API_KEY`（默认 DeepSeek 兼容端点），与 AGENTS.md 规定的 DashScope/Qwen3.7-Max 不一致。
- `/api/intent/analyze`、`/api/image/generate`、`/api/voice/transcribe` 已使用 DashScope，但模型名称在多处硬编码（`qwen-max`、`qwen3-asr-flash`），未统一引用 `lib/api/config.ts` 中的 `DEFAULT_LLM_MODEL`。

**建议**：
- 统一 LLM/ASR/文生图调用至 DashScope SDK，删除 OpenAI 兼容路径（除非 deliberate fallback）。
- 将模型名、温度、最大 token 等集中到 `lib/api/config.ts`，API 路由只读取配置。

### 1.3 颜色/常量未充分复用

- `app/globals.css` 中 `body` 硬编码 `#fafaf8` 与 `#1a1a1a`，未使用 `--color-surface`、`--color-text-primary`。
- 业务代码中仍存在大量裸 HEX（如 `#FFB7C5`、`#B5D5F5` 直接写在 className 与 style 中）。
- `COLOR_MAP` 在 `lib/voice/speechRecognition.ts` 和 `lib/dashscope/analyze.ts` 中语义重复。

**建议**：
- CSS 与 JS 共享设计 token；JS 中通过 `tailwindcss/resolveConfig` 或常量对象引用，禁止裸 HEX。

---

## 2. 代码简洁性

### 2.1 超大组件/页面

| 文件 | 行数 | 问题 |
|---|---|---|
| `app/[locale]/canvas/page.tsx` | 2174 | 包含渲染、动画、状态管理、API 调用、认证、导出、微信发送、本地编辑命令解析 |
| `components/canvas/CanvasBoard.tsx` | 692 | 包含 Canvas 渲染、历史栈、动画、几何计算 |
| `app/[locale]/components/XfyunVoiceInput.tsx` | 503 | WebSocket、AudioContext、MediaStream、重试逻辑全部内联 |
| `app/canvas/page.tsx` | 764 | 同样职责混杂 |

**问题影响**：
- 可读性差，单测难以编写。
- 任何小改动都需要理解整页逻辑，回归成本高。

**建议拆分方向**（以 `app/[locale]/canvas/page.tsx` 为例）：
- `hooks/useCanvasAnimation.ts`：画笔动画、双缓冲绘制、生长动画。
- `hooks/useCanvasState.ts`：undo/redo、追加/重置、序列化。
- `hooks/useVoiceSession.ts`：录音流程、 thinking 状态、预设轮播。
- `components/canvas/CanvasRenderer.tsx`：纯渲染逻辑。
- `components/canvas/CanvasToolbar.tsx`：顶部/侧边工具栏。
- `lib/canvas/brushAnimation.ts`、`lib/canvas/progressiveDraw.ts`：GSAP 动画逻辑。

### 2.2 过度工程化的局部逻辑

- `app/[locale]/canvas/page.tsx` 中 `getShapeBounds`、`toTopLeft`、`resolvePositionCenter`、`drawShapePath`、`drawProgressiveShape`、`getBrushPositionAtProgress` 等几何/渲染函数与 `components/canvas/CanvasBoard.tsx` 中的 `getPathPoint`、`traceShape` 高度重复。
- 两套 Canvas 使用不同的坐标约定（`CanvasBoard` 用中心锚点 + size；locale 用左上角锚点 + width/height），增加理解成本。

**建议**：
- 统一 Canvas 坐标模型，抽取 `lib/canvas/geometry.ts` 作为唯一几何工具库。
- 删除 `CanvasBoard` 或 `CanvasDraw` 之一，保留一个渲染器。

### 2.3 重复实现的通知组件

两套 Toast 并存：
- `components/ui/Toast.tsx`：容器式，无 GSAP。
- `app/[locale]/components/Toast.tsx`：单条 GSAP 动画式。

**建议**：统一为单一 Toast 系统，封装 `useToast()` hook。

---

## 3. 代码模块化

### 3.1 职责边界模糊

- `app/[locale]/canvas/page.tsx` 直接调用 `/api/draw`、保存作品、发送微信、解析本地编辑命令，违反"页面只负责编排"的原则。
- `VoiceContext` 本应只管理语音状态，但 `app/canvas/page.tsx` 中的业务处理（`processTranscript`）通过 `registerCommandHandler` 反向注入，导致调试困难。

### 3.2 Layout 拆分散落

布局相关逻辑分散在：
- `app/lib/layout/illustration-expander.ts`
- `app/lib/layout/position-normalizer.ts`
- `app/lib/layout/shape-bounds.ts`
- `lib/layout/illustration-expander.ts`（与上面重复）

单元测试引用的是 `app/lib/layout` 下的版本，但运行时代码也可能引用 `lib/layout` 下的副本，存在漂移风险。

**建议**：
- 删除 `lib/layout/*`，全部收敛到 `app/lib/layout/*`。
- 或统一迁移到 `lib/layout/*` 并让测试同步更新。

### 3.3 数据库/存储抽象不一致

- 服务端使用 Prisma + Supabase。
- 浏览器端同时存在 `lib/db/artworkStore.ts`（单表 artworks）和 `app/[locale]/lib/db.ts`（多表 IndexedDB）。
- `app/[locale]/canvas/page.tsx` 通过 `saveArtworkViaApi` 保存，而 `app/canvas/page.tsx` 与 gallery 页仍可能使用本地 IndexedDB。

**建议**：
- 明确分层：浏览器端抽象 `ArtworkStorage` 接口，Supabase 实现与 IndexedDB 实现可切换。
- 删除重复 IndexedDB 封装。

---

## 4. 代码稳定性

### 4.1 React Hooks 依赖问题（lint warning）

共 49 条 lint warning，其中以下直接影响稳定性：

| 文件 | 位置 | 问题 |
|---|---|---|
| `app/canvas/page.tsx` | 96, 253 | `useEffect` 依赖 `addToast`、`processTranscript`，但二者未用 `useCallback` 包裹，导致每次渲染重新创建函数，可能触发无限重渲染或闭包过期 |
| `app/gallery/page.tsx` | 53 | `useEffect` 缺少 `loadData` 依赖，可能读取到旧的加载函数 |
| `lib/voice/useVoiceCommand.ts` | 68, 97 | `useCallback`/`useEffect` 依赖数组不当 |

**建议**：
- 将事件回调统一用 `useCallback` 包裹，并补全依赖数组。
- 对只触发一次的 effect，若确实不需要依赖，显式注释并禁用规则，而不是遗漏。

### 4.2 Canvas 动画中的状态更新风险

- `components/canvas/CanvasBoard.tsx` 的 `addShape` 在 `gsap.to` 的 `onUpdate` 中调用 `syncShapes`（内部调用 `setShapes`）。
- 虽然当前未触发无限循环，但一旦 `syncShapes` 的依赖或 shape 引用变化，极易导致性能问题或渲染抖动。
- `CanvasBoard` 同时维护 `shapesRef` 和 `shapes` state，双源数据容易不一致。

**建议**：
- 动画中间状态用 ref 或局部变量维护，动画结束后再提交一次 `setShapes`。
- 或抽离为独立 renderer，不通过 React state 驱动每一帧。

### 4.3 错误处理与资源泄漏

- `app/[locale]/components/XfyunVoiceInput.tsx`：WebSocket、AudioContext、MediaStream 清理逻辑集中在 `handleStop`，但组件卸载时未统一调用；若用户直接跳转页面，可能导致资源泄漏。
- `components/canvas/CanvasBoard.tsx`：图片加载 `img.onerror` 未处理，网络失败时画布留空且无反馈。
- `app/[locale]/canvas/page.tsx`：`drawShapes`/`drawAppendBatch` 中大量 `await waitFrame()` 循环未做取消标记，组件卸载后可能继续操作已卸载的 canvas context。

**建议**：
- 所有异步动画携带 `AbortSignal` 或 `isCancelled` 标记，卸载时停止。
- WebSocket/音频资源在 `useEffect` 返回函数中强制释放。

### 4.4 类型与运行时安全

- `parseJsonSafely` 使用 `await response.text()` 再 `JSON.parse`，若响应为二进制或超大流，可能OOM。
- `canvas.toDataURL('image/png')` 在 canvas 被 taint 后会抛出 SecurityError，未捕获。
- `COLOR_MAP` 反向查找 `COLOR_NAME_MAP` 时，自定义颜色会回退到"自定义"，但 UI 仍可能把 `undefined` 当字符串显示。

### 4.5 测试覆盖不足

- 当前测试集中在 `app/lib/layout` 与 `app/api/draw/route.ts` 的 payload 规范化。
- 对核心的 Canvas 渲染、语音状态机、API 路由的 fallback/mock 逻辑、UI 组件几乎无测试。
- `tests/e2e/core-flows.test.tsx` 文件存在但内容未验证是否覆盖完整流程。

---

## 5. 直接优化建议（可按优先级执行）

### 高优先级

1. **统一路由实现**：保留 `app/[locale]/`，删除或重定向根路由重复页面（`app/canvas`、`app/gallery`、`app/login`）。
2. **抽取超大页面**：将 `app/[locale]/canvas/page.tsx` 拆分为 hooks + 子组件，目标单文件 < 400 行。
3. **收敛重复 lib**：删除 `app/[locale]/lib/*` 中的重复副本，统一引用 `app/lib/*` 或 `lib/*`。
4. **修复 lint warning**：特别是 hooks 依赖与 unused vars，减少运行时不稳定因素。
5. **统一设计 token**：替换 globals.css body 与业务代码中的裸 HEX。

### 中优先级

6. **统一 LLM 调用路径**：`/api/draw` 改为调用 DashScope，与 `/api/intent/analyze` 保持一致。
7. **增加动画取消与资源清理**：给 `drawShapes`、`XfyunVoiceInput` 增加 `AbortSignal`/卸载清理。
8. **封装 Toast hook**：合并两套 Toast。
9. **补充单元测试**：覆盖 `canvas-state.ts`、`canvas-commands.ts`、`speechRecognition.ts`、核心 API fallback。

### 低优先级

10. **清理未使用文件**：如 `app/lib/db.ts`（若已被 IndexedDB 实现替代）、`app/page.tsx` 与 `app/[locale]/page.tsx` 的重复。
11. **删除或归档 `components/canvas/CanvasBoard.tsx` 等旧实现**（在确认根路由下线后）。

---

## 6. 结论

VoiceCanvas 已具备完整 MVP 功能，但代码组织处于"双轨并行"状态，复用性与可维护性较差。建议先停止在新功能上的双份实现，按"locale 路由为真相源"统一收敛，再逐步拆分超大组件、修复 hooks 稳定性问题。优化后预计：

- 源码重复率下降 30-40%；
- 核心页面平均行数下降 50% 以上；
- lint warning 归零；
- 运行时不稳定风险（闭包、资源泄漏、动画越界）显著降低。

---

## 7. 本次已直接执行的优化

为提升稳定性与减少 lint noise，已直接修改以下文件（均通过 `npm run build` 与 `npm run lint` 验证）：

| 文件 | 修改内容 | 优化维度 |
|---|---|---|
| `app/globals.css` | `body` 背景色/文字色改用 `--color-surface` / `--color-text-primary`，替换裸 HEX | 复用性 |
| `app/login/page.tsx` | 移除未使用的 `data` 变量（`signInWithPassword` / `signUp`） | 稳定性/简洁性 |
| `app/[locale]/login/page.tsx` | 同上 | 稳定性/简洁性 |
| `app/api/voice/transcribe/route.ts` | 删除未使用的 `localParsed` 与 `parseTranscript` 导入 | 稳定性/简洁性 |
| `app/gallery/page.tsx` | 将 `loadData` 移入 `useEffect` 并补齐 `router` 依赖，消除 hooks 警告 | 稳定性 |
| `app/square/page.tsx` | 将 lucide `Image` 重命名为 `ImageIcon`，消除 `jsx-a11y/alt-text` 误报 | 稳定性 |
| `app/canvas/page.tsx` | `addToast` 用 `useCallback` 包裹；语音指令 handler 改用 ref 指向最新 `processTranscript`，减少 effect 重注册 | 稳定性 |
| `lib/voice/useVoiceCommand.ts` | 移除 `handleCommand` 中未使用的依赖 `onControl`/`onAIGenerate`/`onUnknown` | 稳定性 |

**lint warning 数量：49 → 39**（0 errors）。

> 说明：本次未进行大规模重构（如删除重复路由/组件、拆分超大画布页），因为这些变更涉及产品决策与功能取舍，建议在确认"以 `app/[locale]/` 为唯一真相源"后再执行。

---

*报告生成人：代码评审 Agent*  
*生成时间：2026-06-22*
