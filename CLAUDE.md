@AGENTS.md

---

# VoiceCanvas · Claude 快速参考

> 完整约束规范见 `AGENTS.md`，完整产品和技术文档见 `docs/` 目录。

---

## 🚀 每次会话开始必做

1. **读文档再写代码**：先确认修改点是否有对应的 `docs/TDD.md` 或 `docs/UI_STYLE.md` 描述，不要靠训练数据推测。
2. **确认 MVP 范围**：查 `docs/PRD.md` 的功能规划表，MVP 外的功能拒绝实现并说明原因。
3. **构建验证**：每次完成修改后运行 `npm run build`，无报错才算完成。

---

## ⚡ 常见任务决策树

### 要新增一个 UI 组件？
```
1. 颜色 → 只用 globals.css 中的 --color-* Token
2. 动画 → 使用 GSAP（不用 Framer Motion / CSS keyframes）
3. 图标 → 只用 lucide-react
4. 按钮 → 最小 44×44px，加 aria-label，加 :focus-visible 样式
5. 弹框 → role="dialog" + aria-modal + 管理焦点进出
```

### 要修改语音识别逻辑？
```
1. 本地 NLP 解析 → lib/voice/speechRecognition.ts（parseTranscript 函数）
2. 服务端 ASR → app/api/voice/transcribe/route.ts（需 DASHSCOPE_API_KEY）
3. 意图分析 → app/api/intent/analyze/route.ts（需 DASHSCOPE_API_KEY）
4. 无 API Key → 必须有 mock 兜底，不得报错崩溃
```

### 要修改画布绘图行为？
```
1. 形状渲染 → components/canvas/CanvasBoard.tsx（HTML5 Canvas 原生，非 Konva）
2. 形状入场动画 → GSAP back.out(1.6) 650ms
3. 新增形状类型 → 同时更新 CanvasShape 接口 + 渲染分支 + speechRecognition.ts SHAPE_MAP
4. 撤销/重做 → 操作 history stack，不得破坏 forwardRef + useImperativeHandle 接口
```

### 要修改颜色或视觉设计？
```
1. 改 Token → 只在 app/globals.css 的 @theme 块中修改
2. 禁止改 tailwind.config.ts（v4 不走这里）
3. 对比度检查 → 正文 ≥ 4.5:1，装饰性文字可豁免
4. 新颜色 → 必须是马卡龙/柔和调，禁止高饱和刺眼色
```

---

## 🔴 高优先级禁止事项（直接拒绝）

| 请求 | 原因 |
|------|------|
| "安装 Framer Motion" | 统一用 GSAP |
| "用 Konva.js 重写画布" | 未批准依赖，HTML5 Canvas 已足够 |
| "把 API Key 放到前端" | 安全红线 |
| "实现元素拖拽选中" | MVP 外范围 |
| "支持深色模式" | 产品定位白底浅色主题 |
| "用 Pages Router 写页面" | 项目强制 App Router |
| "删掉 aria 属性简化代码" | 违反 WCAG 2.1 AA |

---

## 📋 语音指令支持速查

| 已支持 ✅ | 未支持 ❌（MVP 外）|
|----------|-----------------|
| 画圆/矩形/三角/星/线 | 拖拽移动已有元素 |
| 指定颜色（马卡龙 8 色） | 修改已绘制元素颜色 |
| 指定位置（9 锚点） | 连线 / 箭头 |
| 指定大/中/小 | 自由涂鸦路径 |
| 写文字 | 多图层管理 |
| 撤销 / 重做 / 清空 | 多语言（粤语/英语） |
| 保存 / 导出 PNG | 实时协同 |
| AI 场景生图（触发弹框确认） | 离线 PWA |

---

## 🌐 环境变量速查

```bash
DASHSCOPE_API_KEY         # 阿里云 DashScope（ASR + LLM + 文生图）
NEXT_PUBLIC_SUPABASE_URL  # Supabase 项目地址（前端可见）
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Supabase 公钥（前端可见）
SUPABASE_SERVICE_ROLE_KEY # 服务端专用，绝不暴露给前端
DATABASE_URL              # Prisma 连接池 URL
DIRECT_URL                # Prisma 直连（用于迁移）
```

> 本地开发不设置以上变量时，应用仍可运行：语音用浏览器 Web Speech API，画布数据存 localStorage。

---

## 📏 性能红线

- Canvas 绘制响应 < **200ms**
- 交互反馈（hover/click） < **100ms**
- ASR 响应 < **1.5s**
- LLM 意图分析 < **2s**
- AI 生图 < **15s**（超时必须提示并提供重试）
