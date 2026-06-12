# VoiceCanvas · UI 设计规范文档

> **项目**：七牛云三天黑客松 MVP  
> **适用范围**：Web 端（桌面 + 移动响应式）  
> **设计原则**：无障碍优先 · 儿童友好 · 简约温和  

---

## 1. 设计理念

### 核心关键词

```
✨ 温暖  ·  清晰  ·  包容  ·  有趣
```

VoiceCanvas 的界面应该像一张干净的白色画纸——本身是安静的、中性的，但当用户开口说话时，它会用温柔的色彩回应。界面不应抢占注意力，而应成为语音和画布之间最透明的桥梁。

### 三个设计原则

**1. 最小干扰**  
页面上永远只有一个"主角"——麦克风按钮。所有其他元素都是辅助。

**2. 即时反馈**  
每一次语音输入都有视觉和动效回应，让用户知道系统听到了他们的话。

**3. 宽容边界**  
按钮足够大（最小 44×44px）、颜色足够柔和（不刺眼）、文字足够清晰（对比度 ≥ 4.5:1）。

---

## 2. 颜色系统

### 2.1 主色板

| Token | 颜色名 | HEX | RGB | 用途 |
|-------|--------|-----|-----|------|
| `--color-bg` | 纯白 | `#FFFFFF` | 255,255,255 | 页面/画布背景 |
| `--color-surface` | 暖白 | `#FAFAF8` | 250,250,248 | 卡片/面板背景 |
| `--color-border` | 浅灰 | `#E8E8E4` | 232,232,228 | 边框/分隔线 |
| `--color-text-primary` | 深灰黑 | `#1A1A1A` | 26,26,26 | 主要文字 |
| `--color-text-secondary` | 中灰 | `#6B6B6B` | 107,107,107 | 辅助文字、标签 |
| `--color-text-disabled` | 浅灰 | `#AEAEAE` | 174,174,174 | 禁用状态文字 |

### 2.2 品牌装饰色（马卡龙调）

| Token | 颜色名 | HEX | 用途 |
|-------|--------|-----|------|
| `--color-sakura` | 樱花粉 | `#FFB7C5` | 麦克风按钮激活态、录音动画 |
| `--color-sakura-light` | 浅樱花 | `#FFE4EA` | 樱花粉浅版、hover 态 |
| `--color-macaron-blue` | 马卡龙蓝 | `#B5D5F5` | 意图弹框强调、画布默认颜色 |
| `--color-macaron-blue-light` | 浅蓝 | `#E3F1FF` | 蓝色信息卡背景 |
| `--color-mint` | 薄荷绿 | `#B5E8C7` | 成功状态、保存确认 |
| `--color-mint-light` | 浅薄荷 | `#E5F9EE` | 成功态背景 |
| `--color-butter` | 奶油黄 | `#FFE5A0` | 警告/提示、Tooltip |
| `--color-butter-light` | 浅奶油 | `#FFF7D6` | 提示卡背景 |
| `--color-lavender` | 薰衣草紫 | `#D4C5F5` | AI 生图模式标识 |

### 2.3 颜色使用规范

```
✅ DO
- 白色背景 + 深灰文字（高对比）
- 装饰色仅用于小面积点缀（按钮、标签、图标）
- 成功/错误/警告使用语义色（薄荷绿/柔红/奶油黄）

❌ DON'T
- 大面积使用马卡龙色作为背景（过于刺激）
- 纯黑 #000000 文字（用 #1A1A1A 代替，更柔和）
- 多种装饰色同时出现在同一区域
```

### 2.4 语义颜色（状态反馈）

| 状态 | 颜色 | HEX |
|------|------|-----|
| 成功/已保存 | 薄荷绿 | `#B5E8C7` |
| 错误/识别失败 | 柔红 | `#FFBDB8` |
| 警告/低置信度 | 奶油黄 | `#FFE5A0` |
| 信息/提示 | 马卡龙蓝 | `#B5D5F5` |
| AI 生图中 | 薰衣草紫 | `#D4C5F5` |

---

## 3. 字体系统

### 3.1 字体家族

```css
/* 中文主字体 */
--font-chinese: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;

/* 英文/数字字体 */
--font-latin: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* 代码字体（日志/字幕） */
--font-mono: 'JetBrains Mono', 'SF Mono', monospace;
```

### 3.2 字号与行高

| Token | 用途 | 字号 | 行高 | 字重 |
|-------|------|------|------|------|
| `text-hero` | 欢迎标题 | 36px | 1.2 | 700 Bold |
| `text-h1` | 页面标题 | 28px | 1.3 | 600 SemiBold |
| `text-h2` | 区块标题 | 22px | 1.4 | 600 SemiBold |
| `text-h3` | 卡片标题 | 18px | 1.4 | 500 Medium |
| `text-body-lg` | 大号正文 | 16px | 1.6 | 400 Regular |
| `text-body` | 正文 | 14px | 1.6 | 400 Regular |
| `text-caption` | 辅助文字 | 12px | 1.5 | 400 Regular |
| `text-transcript` | 语音字幕 | 15px | 1.5 | 500 Medium |

### 3.3 字体使用原则

- 儿童相关提示文字：使用 `text-body-lg`（16px），不小于 14px
- 语音字幕实时回显：使用 `text-transcript`，清晰展示转录内容
- 禁用状态：颜色换为 `--color-text-disabled`，字重不变

---

## 4. 间距与圆角系统

### 4.1 间距基准

以 `4px` 为基础单位，Tailwind 标准 spacing：

```
4px  = gap-1  = p-1
8px  = gap-2  = p-2
12px = gap-3  = p-3
16px = gap-4  = p-4  ← 最常用的内间距
24px = gap-6  = p-6
32px = gap-8  = p-8
48px = gap-12 = p-12
```

### 4.2 圆角

| 场景 | 圆角值 | Tailwind |
|------|--------|---------|
| 按钮（小） | 8px | `rounded-lg` |
| 按钮（大/CTA） | 12px | `rounded-xl` |
| 卡片 | 16px | `rounded-2xl` |
| 弹框/Modal | 20px | `rounded-3xl` |
| 麦克风按钮 | 50% 圆形 | `rounded-full` |
| 标签/Badge | 999px | `rounded-full` |
| 输入框 | 8px | `rounded-lg` |

---

## 5. 核心组件规范

### 5.1 麦克风按钮（最核心 UI 元素）

这是整个产品的灵魂按钮，设计必须：
- **极其醒目**：尺寸大（80×80px），居中放置
- **状态清晰**：4 个视觉状态区分明显
- **动画温柔**：脉冲动画柔和，不突兀

```
状态 1 · IDLE（待机）
  外圆：白色描边（--color-border）
  内圆：白色背景，麦克风图标（--color-text-secondary）
  动画：无

状态 2 · RECORDING（录音中）
  外圆：樱花粉扩散脉冲（scale 1→1.3，opacity 1→0，loop）
  内圆：樱花粉背景（--color-sakura），麦克风图标白色
  动画：脉冲圈 1s ease-in-out infinite，
        内圆轻微缩放 scale(1→0.95，bounce）

状态 3 · PROCESSING（处理中）
  外圆：马卡龙蓝旋转弧（CSS conic-gradient animation）
  内圆：浅蓝背景（--color-macaron-blue-light），加载点点动画
  动画：旋转 1s linear infinite

状态 4 · ERROR（失败）
  外圆：柔红描边，轻微 shake 动画（左右各 4px，3次）
  内圆：柔红背景，感叹号图标
  动画：shake 0.4s ease，结束后 0.8s 自动恢复到 IDLE
```

**尺寸规格**

```
桌面端：80 × 80px（内圆）+ 外圆 max 120px（脉冲峰值）
移动端：68 × 68px（内圆）+ 外圆 max 100px
触控目标：最小 44×44px（WCAG 标准）
```

**Tailwind 基础类**

```html
<button class="
  w-20 h-20 rounded-full
  flex items-center justify-center
  shadow-lg
  transition-all duration-200
  focus:outline-none focus:ring-4 focus:ring-[#FFB7C5]/50
  active:scale-95
">
```

### 5.2 实时字幕条（TranscriptBar）

位于画布底部，实时显示语音转录文字：

```
位置：画布底部固定，距底 16px
高度：48px（单行），最大 3 行自动展开
背景：rgba(255,255,255,0.92) + backdrop-blur(8px)
圆角：12px
边框：1px solid --color-border

文字样式：
- 转录中：--color-text-secondary，末尾光标闪烁
- 转录完成：--color-text-primary，高亮显示识别到的关键词
- 置信度低：--color-butter 背景提示条

动画：fade-in + slide-up（200ms ease-out）
```

### 5.3 意图确认弹框（IntentModal）

当 AI 判断意图需要用户确认时出现：

```
背景遮罩：rgba(0,0,0,0.15) blur(4px)
弹框：
  - 白色背景，圆角 24px
  - 最大宽度 360px，居中
  - padding: 28px
  - shadow: 0 20px 60px rgba(0,0,0,0.12)

内容布局：
  ┌──────────────────────────────┐
  │  🎤 我听到了...              │
  │  "画一只粉色的兔子"          │  ← 转录原文（字幕体）
  │                              │
  │  你想要：                    │
  │  ┌──────────┐ ┌──────────┐  │
  │  │ 1        │ │ 2        │  │
  │  │ 🎨 绘制  │ │ ✨ AI生成│  │
  │  │ 几何图形  │ │ 场景图片  │  │
  │  └──────────┘ └──────────┘  │
  │                              │
  │  [说"1"或"2"来选择]          │  ← 语音提示
  └──────────────────────────────┘

按钮 1（Canvas）：
  边框：马卡龙蓝（--color-macaron-blue）
  选中：蓝色背景，白色文字

按钮 2（AI 生图）：
  边框：薰衣草紫（--color-lavender）
  选中：紫色背景，白色文字

语音选择：说"1"或"选1"→按钮 1，"2"或"选2"→按钮 2
```

### 5.4 Toast 通知

```
位置：右上角（桌面）/ 顶部居中（移动端）
宽度：最大 320px
圆角：12px
padding：12px 16px

类型与样式：
  成功：薄荷绿左边框（4px） + 浅薄荷背景
  错误：柔红左边框 + 浅柔红背景
  提示：马卡龙蓝左边框 + 浅蓝背景
  警告：奶油黄左边框 + 浅奶油背景

动效：slide-in-right（桌面）/ slide-down（移动）200ms
自动消失：4s（成功/提示），不自动消失（错误，需手动关闭）
```

### 5.5 颜色选择器（语音画布当前颜色指示）

不需要用户点击，只展示当前语音选定的颜色：

```
位置：画布工具栏右侧
形态：16px 圆形色块 + 颜色名文字（如"蓝色"）
交互：仅展示，不可点击（纯语音控制）
```

---

## 6. 页面布局规范

### 6.1 核心画布页（/canvas）

```
┌─────────────────────────────────────────────────────┐
│  HEADER（56px）                                      │
│  [Logo: VoiceCanvas]          [用户头像] [图库]      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  CANVAS AREA（最大化）                               │
│  ┌──────────────────────────────────────────────┐   │
│  │                                              │   │
│  │              HTML5 Canvas                    │   │
│  │           （白色背景画布）                    │   │
│  │                                              │   │
│  │                                              │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  TOOLBAR（48px，悬浮在画布上方底部）                  │
│  [撤销] [重做] [清空]    [当前颜色●]  [模式标签]     │
│                                                      │
├──────────────────────────────────────────────────── ┤
│  TRANSCRIPT BAR（自适应高度，最大 80px）              │
│  "画一个蓝色的圆形在中间..."                          │
├─────────────────────────────────────────────────────┤
│  VOICE CONTROL AREA（96px）                          │
│                                                      │
│         ●  [🎤 麦克风按钮 80px]  ●                  │
│              "点击或长按说话"                         │
│                                                      │
└─────────────────────────────────────────────────────┘

移动端：Header 精简（仅 Logo + 头像），Toolbar 折叠到侧边
```

### 6.2 作品图库页（/gallery）

```
┌─────────────────────────────────────────────────────┐
│  HEADER                      [新建作品（语音）] [用户]│
├─────────────────────────────────────────────────────┤
│  我的画作                                            │
│                                                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │
│  │      │ │      │ │      │ │      │               │
│  │ 缩略图│ │ 缩略图│ │ 缩略图│ │ 缩略图│               │
│  │      │ │      │ │      │ │      │               │
│  └──────┘ └──────┘ └──────┘ └──────┘               │
│  作品名称   作品名称  作品名称  作品名称               │
│  2天前      1周前     ...       ...                  │
│                                                      │
└─────────────────────────────────────────────────────┘

Grid：桌面 4列，平板 2列，手机 2列（小卡片）
卡片比例：4:3
悬停效果：scale(1.02) + shadow 加深（200ms）
```

### 6.3 登录页（/login）

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [Logo · VoiceCanvas]                    │
│                                                      │
│         🎤 用声音，创作你的世界                        │
│                                                      │
│    ┌──────────────────────────────────────┐          │
│    │  🎨  插画：麦克风 → 彩色图案飞出  🎨  │          │
│    └──────────────────────────────────────┘          │
│                                                      │
│         [  使用 Google 登录  ]  ← 主按钮              │
│         [  使用微信登录      ]  ← 次按钮（可选）        │
│                                                      │
│         或者  [作为访客体验]（不保存）                  │
│                                                      │
│    © 2025 VoiceCanvas · 让每个人都能创作              │
└─────────────────────────────────────────────────────┘
```

---

## 7. 无障碍设计规范（WCAG 2.1 AA）

### 7.1 颜色对比度

| 组合 | 对比度 | 标准 |
|------|--------|------|
| #1A1A1A 文字 / #FFFFFF 背景 | 18.4:1 | ✅ AAA |
| #6B6B6B 文字 / #FFFFFF 背景 | 5.9:1 | ✅ AA |
| #FFFFFF 文字 / #FFB7C5 背景 | 2.8:1 | ⚠️ 仅用于非关键文字 |
| #1A1A1A 文字 / #FFE4EA 背景 | 14.2:1 | ✅ AAA |

**规则**：所有**正文和功能文字**必须满足 AA 级（4.5:1），仅装饰性文字可豁免。

### 7.2 焦点管理

```css
/* 全局焦点样式：替换浏览器默认蓝色，使用品牌色 */
:focus-visible {
  outline: 3px solid #FFB7C5; /* 樱花粉 */
  outline-offset: 3px;
  border-radius: inherit;
}
```

- 模态框打开时：焦点自动移入模态框
- 模态框关闭时：焦点返回触发元素
- Tab 顺序：Header → 画布 → Toolbar → TranscriptBar → MicButton

### 7.3 ARIA 属性

```html
<!-- 麦克风按钮 -->
<button
  role="button"
  aria-label="语音输入 - 点击开始录音"
  aria-pressed="false"          <!-- 录音中时改为 true -->
  aria-live="polite"
>

<!-- 字幕区域 -->
<div 
  role="status" 
  aria-live="polite" 
  aria-atomic="false"
  aria-label="语音转录实时显示"
>

<!-- 画布 -->
<canvas
  role="img"
  aria-label="绘图画布 - 通过语音指令控制绘图"
>

<!-- 意图弹框 -->
<dialog
  role="dialog"
  aria-modal="true"
  aria-labelledby="intent-modal-title"
>
```

### 7.4 触控目标尺寸

- 最小触控区域：48×48px（超出 WCAG 44px 要求）
- 按钮之间最小间距：8px
- 麦克风按钮：80×80px（超大触控目标，肢体障碍友好）

### 7.5 动画无障碍

```css
/* 尊重用户系统设置：关闭动画 */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. 动效规范

### 8.1 动效原则

- **有意义**：每个动效都传达状态变化，无装饰性动效
- **快速响应**：交互反馈 < 100ms
- **不强迫**：支持 `prefers-reduced-motion`

### 8.2 标准时长

| 类型 | 时长 | 缓动 |
|------|------|------|
| 微交互（hover/active） | 100-150ms | ease |
| 页面元素出现 | 200ms | ease-out |
| 模态框/弹框 | 250ms | cubic-bezier(0.34,1.56,0.64,1) |
| 页面切换 | 300ms | ease-in-out |
| 录音脉冲动画 | 1000ms | ease-in-out infinite |

### 8.3 关键动效定义

```css
/* 录音脉冲 */
@keyframes voicePulse {
  0%   { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(1.4); opacity: 0; }
}

/* Canvas 图形出现 */
@keyframes shapeAppear {
  0%   { opacity: 0; transform: scale(0.8); }
  100% { opacity: 1; transform: scale(1); }
}

/* Toast 进入 */
@keyframes slideInRight {
  from { transform: translateX(110%); opacity: 0; }
  to   { transform: translateX(0);   opacity: 1; }
}

/* 错误 shake */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%      { transform: translateX(-4px); }
  40%      { transform: translateX(4px); }
  60%      { transform: translateX(-4px); }
  80%      { transform: translateX(4px); }
}
```

---

## 9. 响应式断点

```css
/* Tailwind 默认断点 */
sm:  640px   /* 大手机横屏 */
md:  768px   /* 平板 */
lg:  1024px  /* 桌面 */
xl:  1280px  /* 大桌面 */
```

### 布局适配策略

| 元素 | 桌面（≥1024px） | 平板（768-1023px） | 手机（<768px） |
|------|----------------|------------------|--------------|
| 画布高度 | 视口高度-200px | 视口高度-180px | 视口高度-160px |
| 麦克风按钮 | 80×80px | 72×72px | 64×64px |
| 字幕字号 | 15px | 14px | 14px |
| Gallery 列数 | 4列 | 3列 | 2列 |
| Toolbar | 水平展开 | 水平展开 | 图标模式 |

---

## 10. 图标规范

- 图标库：Lucide React（与 Tailwind 配套，轻量开源）
- 尺寸：16px（行内）/ 20px（按钮）/ 24px（主要操作）/ 32px（功能图标）
- 颜色：跟随父元素 `currentColor`，无单独指定

```typescript
// 使用示例
import { Mic, MicOff, Undo2, Redo2, Trash2, Save, Download } from 'lucide-react';

// 关键图标对应关系
Mic       → 录音待机
MicOff    → 录音中（配合动画）
Undo2     → 撤销
Redo2     → 重做
Trash2    → 清空画布
Save      → 保存作品
Download  → 导出 PNG
Sparkles  → AI 生图模式
Palette   → 颜色选择
```

---

## 11. Tailwind 配置补充

```javascript
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: {
        sakura: {
          DEFAULT: '#FFB7C5',
          light:   '#FFE4EA',
        },
        macaron: {
          blue:        '#B5D5F5',
          'blue-light':'#E3F1FF',
          green:       '#B5E8C7',
          'green-light':'#E5F9EE',
          yellow:      '#FFE5A0',
          'yellow-light':'#FFF7D6',
          lavender:    '#D4C5F5',
        },
        surface: '#FAFAF8',
        border:  '#E8E8E4',
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'Hiragino Sans GB', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      animation: {
        'voice-pulse': 'voicePulse 1s ease-in-out infinite',
        'shake': 'shake 0.4s ease',
        'shape-appear': 'shapeAppear 0.2s ease-out',
      },
    },
  },
};
```
