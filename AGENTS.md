<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# VoiceCanvas · Agent & Developer Guide

> **项目**：七牛云三天黑客松 MVP  
> **定位**：面向肢体障碍人士和儿童的**纯语音驱动绘图工具**  
> **完整文档**：参阅 `docs/` 目录下的 PRD.md（产品需求）、TDD.md（技术设计）、UI_STYLE.md（设计规范）

---

## 🛠️ 必须掌握的命令

```bash
npm run dev    # 启动开发服务器（本地调试）
npm run build  # 生产构建并验证 TypeScript 类型
npm run lint   # ESLint 检查（提交前必须通过）
```

> ⚠️ **每次代码修改后必须运行 `npm run build`，确保 TypeScript 无报错才算完成。**

---

## 📁 关键文件速查

| 文件路径 | 职责 |
|---------|------|
| `app/globals.css` | Tailwind v4 主题 token 唯一定义处（颜色、字体变量） |
| `app/layout.tsx` | 根布局，挂载 Inter/JetBrains Mono 字体 |
| `app/login/page.tsx` | 登录落地页，GSAP 浮动粒子动画 |
| `app/canvas/page.tsx` | **核心画布页**，语音→意图→绘制全流程协调者（需包裹 `<Suspense>`） |
| `app/gallery/page.tsx` | 作品图库，GSAP 交错入场卡片 |
| `app/api/voice/transcribe/route.ts` | DashScope ASR 接口骨架 |
| `app/api/intent/analyze/route.ts` | Qwen LLM 意图解析接口骨架 |
| `app/api/image/generate/route.ts` | Wanx 文生图接口骨架 |
| `components/canvas/CanvasBoard.tsx` | HTML5 Canvas 渲染器、撤销/重做栈、GSAP 图形生成动画 |
| `components/voice/MicButton.tsx` | 麦克风按钮，4 种 GSAP 状态动画 |
| `components/voice/TranscriptBar.tsx` | 实时字幕条，关键词高亮 Badge |
| `components/voice/IntentModal.tsx` | 意图确认弹框，GSAP spring 弹出 |
| `components/ui/Toast.tsx` | 全局通知（成功/错误/警告/信息） |
| `lib/voice/speechRecognition.ts` | 浏览器 Web Speech API 封装 + 本地规则 NLP 解析器 |
| `lib/db/mockDb.ts` | localStorage 模拟数据库（作品 + 用户） |
| `docs/PRD.md` | 产品需求文档，MVP 功能边界 |
| `docs/TDD.md` | 技术设计文档，架构、API、数据库 Schema |
| `docs/UI_STYLE.md` | UI 设计规范，颜色/字体/组件/动效标准 |

---

## 🚧 MVP 范围边界（严格遵守）

### ✅ MVP 内——可以实现
- 基础几何形状绘制（圆形、矩形、三角形、五角星、直线）
- 颜色、位置（语义锚点）、尺寸（大/中/小）指定
- 文字写入（基础字体，不支持字体选择）
- 撤销 / 重做 / 清空画布 / 保存 / 导出 PNG
- AI 场景生图（通过 IntentModal 确认后触发 Wanx 模型）
- 混合模式：AI 生图图层 + Canvas 几何叠加
- Supabase Auth 登录（Google/微信/访客）
- 作品历史保存到 Supabase Storage（MVP 中用 localStorage 兜底）

### ❌ MVP 外——禁止在本次黑客松中实现
- 元素选中后的单独移动/缩放（需要选中逻辑，过于复杂）
- 颜色填充已有元素（需指代消解能力）
- 多图层管理 UI
- 自由涂鸦路径（实时坐标追踪）
- 连线 / 箭头（多对象空间推理）
- 多语言支持（粤语、英语）
- 实时协同创作
- PWA / 离线支持

> ⚠️ **若用户要求实现 MVP 外功能，必须明确告知不在本次黑客松范围内，并记录在 PRD.md 的未完成原因栏中。**

---

## 🏗️ 技术栈约束（不得随意更换）

| 层级 | 技术 | 版本 | 备注 |
|------|------|------|------|
| 框架 | Next.js App Router | 16.x | 禁止使用 Pages Router |
| UI | React | 19.x | 仅 Client Components 使用 `"use client"` |
| 样式 | Tailwind CSS | v4 | 使用 `@theme` 语法，不是 `tailwind.config.ts` |
| 动画 | **GSAP** | 3.x | 已安装，是唯一指定的动画库 |
| 图标 | lucide-react | latest | 唯一允许的图标库 |
| Canvas | HTML5 Canvas API | 原生 | 禁止引入 Konva.js（未安装） |
| 语音识别 | Web Speech API（浏览器原生） | — | 服务端为 Qwen3-ASR-Flash |
| 数据库模拟 | localStorage (`lib/db/mockDb.ts`) | — | 生产环境对接 Supabase+Prisma |
| ASR 服务 | Qwen3-ASR-Flash (DashScope) | latest | 需 `DASHSCOPE_API_KEY` |
| LLM | Qwen3.7-Max (DashScope) | latest | 需 `DASHSCOPE_API_KEY` |
| 文生图 | wanx2.1-t2i-turbo (DashScope) | latest | 需 `DASHSCOPE_API_KEY` |
| 部署 | Vercel | — | 通过 GitHub 自动触发 |

> ⚠️ **禁止安装未经批准的新依赖**（如 Framer Motion、Three.js、Konva.js 等）。如确实需要，必须先在需求中说明原因。

---

## 🎨 设计系统约束

### 颜色 Token（所有颜色必须用 Token，禁止写裸 HEX）

```css
/* 定义在 app/globals.css @theme 块内 */
--color-sakura: #FFB7C5;          /* 主品牌色，麦克风激活、focus ring */
--color-sakura-light: #FFE4EA;
--color-macaron-blue: #B5D5F5;    /* 信息色、意图弹框 */
--color-macaron-blue-light: #E3F1FF;
--color-mint: #B5E8C7;            /* 成功状态 */
--color-mint-light: #E5F9EE;
--color-butter: #FFE5A0;          /* 警告/提示 */
--color-butter-light: #FFF7D6;
--color-lavender: #D4C5F5;        /* AI 模式标识 */
--color-surface: #FAFAF8;         /* 页面/卡片背景 */
--color-border-custom: #E8E8E4;   /* 边框分割线 */
--color-text-primary: #1A1A1A;    /* 禁止使用纯黑 #000000 */
--color-text-secondary: #6B6B6B;
--color-text-disabled: #AEAEAE;
```

> ❌ **禁止**：大面积使用马卡龙色作为背景；多种装饰色同时出现在同一区域；使用纯黑 `#000000`。

### 字体
- 中文：`PingFang SC` / `Hiragino Sans GB` / `Microsoft YaHei`
- 英文/数字：`Inter`（已通过 `next/font/google` 加载）
- 代码/字幕：`JetBrains Mono`（已加载）
- 最小正文字号：14px；儿童提示文字不低于 16px。

### 圆角规范
| 场景 | 值 |
|------|-----|
| 小按钮 | 8px (`rounded-lg`) |
| 大按钮/CTA | 12px (`rounded-xl`) |
| 卡片 | 16px (`rounded-2xl`) |
| 弹框/Modal | 20-24px (`rounded-3xl`) |
| 麦克风按钮 | 50% 圆形 (`rounded-full`) |
| 标签/Badge | 999px (`rounded-full`) |

---

## ✨ 动画规范（GSAP 强制要求）

- **所有**交互状态切换、页面入场、循环组件、弹框弹出必须使用 GSAP
- **禁止**在以上场景写复杂 `@keyframes` CSS 动画代替 GSAP
- 简单 hover/active 的颜色/透明度过渡可以用 Tailwind `transition-*`

### 必须实现的 GSAP 动画时序
| 场景 | 时长 | Ease |
|------|------|------|
| 微交互（hover/active） | 100-150ms | `power1.out` |
| 页面元素出现 | 200ms | `power2.out` |
| 弹框弹出 | 350-450ms | `back.out(1.8)` |
| 录音脉冲 ripple | 1400ms | `power1.out` ∞ |
| Canvas 图形生成 | 650ms | `back.out(1.6)` |
| 错误 shake | 400ms | 左右 6px × 4 次 |
| 列表交错入场 | 500ms | `power2.out`, stagger 0.08 |

### 减弱运动支持（必须）
```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```
GSAP timeline 初始化时也应检查 `window.matchMedia('(prefers-reduced-motion: reduce)')` 并跳过动画。

---

## ♿ 无障碍强制要求（WCAG 2.1 AA）

1. **颜色对比度**：所有正文和功能文字对比度 ≥ 4.5:1；装饰性文字可豁免。
2. **焦点样式**：必须使用品牌焦点环，禁止浏览器默认蓝色：
   ```css
   :focus-visible { outline: 3px solid #FFB7C5; outline-offset: 3px; border-radius: inherit; }
   ```
3. **触控目标**：最小 44×44px；按钮间距 ≥ 8px；麦克风按钮必须 ≥ 80×80px。
4. **ARIA 属性**：
   - 麦克风按钮：`aria-pressed`（录音时为 `true`）、`aria-label` 描述当前状态
   - 字幕区：`role="status"` + `aria-live="polite"` + `aria-atomic="false"`
   - 画布：`role="img"` + `aria-label`
   - 意图弹框：`role="dialog"` + `aria-modal="true"` + `aria-labelledby`
5. **焦点管理**：弹框打开时焦点自动移入，关闭时焦点返回触发元素。

---

## 🔌 API 与环境变量边界

### 需要的环境变量（`.env.local`）
```bash
DASHSCOPE_API_KEY=sk-xxx          # 阿里云 DashScope，ASR+LLM+文生图
NEXT_PUBLIC_SUPABASE_URL=...      # Supabase 项目 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=... # Supabase 公钥
SUPABASE_SERVICE_ROLE_KEY=...     # Supabase 服务端密钥（仅服务端）
DATABASE_URL=...                  # Prisma 数据库连接（Supabase 连接池）
DIRECT_URL=...                    # Prisma 直连（迁移用）
```

### API 路由设计原则
- **无 `DASHSCOPE_API_KEY`**：必须返回 mock 数据，不得报错崩溃。本地开发用浏览器 Web Speech API 兜底。
- **API 路由不得泄露密钥**：`DASHSCOPE_API_KEY` 只在服务端使用，前端绝不可见。
- **意图置信度 < 0.7**：强制弹出 IntentModal 让用户手动确认，不直接执行。
- **AI 生图超时（> 30s）**：提示用户并提供重试按钮，不静默失败。
- **ASR 失败**：重试 1 次，仍失败则 Toast 提示「未能识别，请再试一次」。

---

## 🚫 禁止行为清单

| 禁止项 | 原因 |
|-------|------|
| 安装 Framer Motion / Three.js / Konva.js | 未批准依赖；GSAP 已足够 |
| 使用 Tailwind `dark:` 深色模式类 | 产品定位为白底浅色主题 |
| 使用 Pages Router（`pages/` 目录） | 项目强制使用 App Router |
| 写裸 HEX 颜色值（不用 Token） | 破坏设计系统一致性 |
| 将 `DASHSCOPE_API_KEY` 暴露到前端 | 安全漏洞 |
| 在无 `<Suspense>` 的页面使用 `useSearchParams()` | Next.js 16 强制要求 |
| 使用 `tailwind.config.ts` 声明颜色 | v4 仅支持 `@theme` in CSS |
| 删除或简化 `aria-*` 无障碍属性 | 违反 WCAG 2.1 AA |
| 使用纯黑 `#000000` 作为文字颜色 | 用 `--color-text-primary: #1A1A1A` |
| 硬编码中文字符串到组件外部逻辑 | 保持 UI 层和逻辑层分离 |

---

## 🧪 性能目标（非功能性要求）

| 指标 | 目标 |
|------|------|
| ASR 首字延迟 | < 1.5s |
| LLM 意图识别 | < 2s |
| Canvas 绘制响应 | < 200ms |
| AI 生图等待 | < 15s（展示进度动画） |
| 交互反馈延迟 | < 100ms |

---

## 📐 语音指令能力边界

已实现（MVP 已支持）：

| 指令类型 | 示例 |
|---------|------|
| 基础形状 | "画一个圆形" / "画个星星" |
| 颜色指定 | "画一个红色矩形" |
| 位置指定 | "在左边画一个三角形" |
| 尺寸指定 | "画一个很大的圆" / "100像素的方形" |
| 文字写入 | "写上'你好世界'" |
| 撤销/重做 | "撤销" / "重做" |
| 清空/保存/导出 | "清空" / "保存" / "导出" |
| AI 场景生图 | "画一片夕阳下的海边"（触发 IntentModal） |

未实现（明确告知用户，记录在 PRD.md）：

- 元素移动/缩放（需选中机制）
- 颜色修改已有元素（需指代消解）
- 连线/箭头、自由涂鸦、多图层

---

## 🗂️ 项目文档位置

| 文档 | 路径 | 内容 |
|------|------|------|
| 产品需求 | `docs/PRD.md` | 用户故事、功能规划、MVP 范围 |
| 技术设计 | `docs/TDD.md` | 系统架构、API、数据库 Schema、执行器 |
| UI 规范 | `docs/UI_STYLE.md` | 颜色、字体、组件、动效、无障碍 |
| 题目说明 | `docs/题目.md` | 黑客松原始需求 |
