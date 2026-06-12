# VoiceCanvas · 技术设计文档（TDD）

> **项目**：七牛云三天黑客松 MVP  
> **技术栈**：Next.js 15 · Supabase · Prisma · Vercel AI SDK · Qwen 系列模型  
> **版本**：v1.0  
> **日期**：2025-06

---

## 1. 系统架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser（Client）                         │
│                                                                   │
│  ┌──────────┐   ┌────────────────┐   ┌──────────────────────┐   │
│  │ Mic Button│──▶│ Web Audio API  │──▶│  Vercel AI SDK       │   │
│  └──────────┘   │ (MediaRecorder)│   │  useObject/useChat   │   │
│                 └────────────────┘   └──────────┬───────────┘   │
│                                                  │               │
│  ┌────────────────────────────────────────────┐  │               │
│  │            HTML5 Canvas (Konva.js)          │◀─┤               │
│  │  · 几何图形图层                              │  │               │
│  │  · AI 生图图层                               │  │               │
│  └────────────────────────────────────────────┘  │               │
│                                                   │               │
│  ┌─────────────────┐   ┌──────────────────────┐  │               │
│  │ IntentModal      │   │ TranscriptBar（字幕） │  │               │
│  └─────────────────┘   └──────────────────────┘  │               │
└──────────────────────────────────────────────────┼──────────────┘
                                                   │
                          HTTPS / Next.js API Route │
                                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js Server (App Router)                  │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ /api/voice/      │  │ /api/intent/     │  │ /api/image/   │  │
│  │ transcribe       │  │ analyze          │  │ generate      │  │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘  │
│           │                     │                     │          │
│           ▼                     ▼                     ▼          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Vercel AI SDK Core                         │ │
│  │   streamText / generateObject / generateText                 │ │
│  └──────────┬──────────────────┬──────────────────┬────────────┘ │
│             │                  │                  │              │
│             ▼                  ▼                  ▼              │
│    Qwen3-ASR-Flash     Qwen3.7-Max           Qwen-Image-2.0      │
│    (阿里云 DashScope)   (意图理解)            (AI 生图)           │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              Prisma ORM  ←→  Supabase PostgreSQL           │   │
│  │         + Supabase Auth  +  Supabase Storage              │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 技术选型说明

| 层级      | 技术                | 版本   | 选型理由                                  |
| --------- | ------------------- | ------ | ----------------------------------------- |
| 框架      | Next.js App Router  | 16.x   | SSR + API Route 一体化，Vercel 部署零配置 |
| AI SDK    | Vercel AI SDK       | 4.x    | 流式输出、结构化生成，内置 Qwen provider  |
| ASR       | Qwen3-ASR-Flash     | latest | 中文识别精度高，API 响应快（<1s）         |
| 意图理解  | Qwen3.7-Max         | latest | 强推理能力，支持结构化 JSON 输出          |
| AI 生图   | Qwen-Image-2.0      | latest | 阿里云统一 API，语义一致性佳              |
| Canvas 库 | Konva.js            | 9.x    | 支持图层、对象选中、JSON 序列化           |
| ORM       | Prisma              | 7.x    | 类型安全，迁移管理，Supabase 兼容         |
| 数据库    | Supabase PostgreSQL | —      | 提供 Auth + Storage + 实时订阅            |
| Auth      | Supabase Auth       | —      | 内置 OAuth，与 Prisma 无缝集成            |
| 样式      | Tailwind CSS        | 5.x    | 快速原型，响应式                          |
| 状态管理  | Zustand             | 5.x    | 轻量，画布状态管理                        |
| 部署      | Vercel              | —      | 黑客松首选，全球 CDN                      |

---

## 3. 语音处理流水线（核心设计）

### 3.1 完整数据流

```
用户按住 Mic Button
        │
        ▼
MediaRecorder.start()   ← Web Audio API，浏览器原生
        │ (录音结束 / 用户松开)
        ▼
Blob (audio/webm)
        │
        ▼  POST /api/voice/transcribe
┌───────────────────────────┐
│  Qwen3-ASR-Flash          │
│  via DashScope Audio API  │
│  返回: { text: "..." }    │
└───────────────────────────┘
        │ transcript text
        ▼  POST /api/intent/analyze
┌────────────────────────────────────────────┐
│  Qwen3.7-Max (generateObject)              │
│  System Prompt: 解析绘图指令，返回 JSON      │
│  返回: IntentResult (见 3.2)               │
└────────────────────────────────────────────┘
        │
        ▼
   confidence > 0.85?
   ┌─── YES ──────────────────────────────────┐
   │                                          │
   │  intent.type === 'canvas'?               │
   │     YES → 直接执行 Canvas 操作           │
   │     NO  → 显示 IntentModal（选1或选2）    │
   └──────────────────────────────────────────┘
   └─── NO  → 显示 IntentModal + 原始字幕，让用户确认
```

### 3.2 IntentResult 数据结构

```typescript
// 由 Qwen3.7-Max generateObject 返回的结构化数据
interface IntentResult {
  type: "canvas" | "ai_generate" | "control" | "ambiguous";
  confidence: number; // 0-1

  // Canvas 指令
  canvasOp?: {
    action:
      | "draw"
      | "move"
      | "resize"
      | "delete"
      | "clear"
      | "undo"
      | "redo"
      | "save"
      | "export"
      | "text";
    shape?: "circle" | "rect" | "line" | "triangle" | "star";
    color?: string; // CSS 颜色值，如 "#FF6B9D"
    position?: {
      anchor:
        | "center"
        | "left"
        | "right"
        | "top"
        | "bottom"
        | "top-left"
        | "top-right"
        | "bottom-left"
        | "bottom-right";
      offsetX?: number;
      offsetY?: number;
    };
    size?: {
      width?: number;
      height?: number;
      radius?: number;
      scale?: "small" | "medium" | "large"; // 模糊尺寸
    };
    text?: string;
  };

  // AI 生图指令
  imagePrompt?: string; // 优化后的生图提示词（中英文混合）

  // 原始转录文本
  transcript: string;
}
```

### 3.3 System Prompt 设计（Qwen3.7-Max）

```
你是一个绘图指令解析器。用户的输入是语音转录文本，你需要将其解析为结构化的绘图操作。

规则：
1. 如果用户描述几何形状（圆、方、线、三角形等）→ type: "canvas"
2. 如果用户描述场景、风景、具象事物（动物、人物、自然景观）→ type: "ai_generate"
3. 如果是控制指令（撤销、清空、保存、导出）→ type: "control"
4. 无法判断 → type: "ambiguous"，confidence < 0.7

颜色解析：将中文颜色名（红/蓝/绿/粉/黄/黑/白/橙/紫）转为 HEX 色值。
马卡龙色系：粉色→#FFB7C5，蓝色→#B5D5F5，绿色→#B5E8C7，黄色→#FFE5A0

位置解析：
- "中间/中央" → center
- "左边/左侧" → left
- "右边/右侧" → right
- "上面/顶部" → top
- "下面/底部" → bottom

尺寸解析：
- "很大/大大的" → scale: "large" (width: 300, height: 300)
- "普通/默认" → scale: "medium" (width: 150, height: 150)
- "很小/小小的" → scale: "small" (width: 80, height: 80)
- 带数字："100像素" → width: 100

对 ai_generate 类型，将中文描述优化为图像生成提示词。

仅返回 JSON，不要任何额外说明。
```

---

## 4. API 路由设计

### 4.1 路由总览

```
app/
├── api/
│   ├── voice/
│   │   └── transcribe/     POST  语音文件 → 转录文本
│   ├── intent/
│   │   └── analyze/        POST  文本 → IntentResult
│   ├── image/
│   │   └── generate/       POST  提示词 → 图片 URL / Base64
│   ├── artworks/
│   │   ├── route.ts         GET(列表) / POST(创建)
│   │   └── [id]/
│   │       └── route.ts     GET / PUT / DELETE
│   └── auth/
│       └── callback/        GET  Supabase OAuth 回调
```

### 4.2 关键路由实现

#### POST /api/voice/transcribe

```typescript
// app/api/voice/transcribe/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audioFile = formData.get("audio") as File;

  // 调用 DashScope Qwen3-ASR-Flash
  const response = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen3-asr-flash",
        input: {
          audio_format: "webm",
          sample_rate: 16000,
        },
        parameters: {
          language_hints: ["zh", "en"],
        },
      }),
    },
  );

  const data = await response.json();
  return NextResponse.json({
    transcript: data.output.results[0].transcription,
    duration: data.output.results[0].duration,
  });
}
```

#### POST /api/intent/analyze

```typescript
// app/api/intent/analyze/route.ts
import { generateObject } from "ai";
import { createQwen } from "qwen-ai-provider"; // community provider
import { z } from "zod";

const qwen = createQwen({
  apiKey: process.env.DASHSCOPE_API_KEY,
});

const IntentSchema = z.object({
  type: z.enum(["canvas", "ai_generate", "control", "ambiguous"]),
  confidence: z.number().min(0).max(1),
  canvasOp: z.optional(
    z.object({
      action: z.enum([
        "draw",
        "move",
        "resize",
        "delete",
        "clear",
        "undo",
        "redo",
        "save",
        "export",
        "text",
      ]),
      shape: z.optional(z.enum(["circle", "rect", "line", "triangle", "star"])),
      color: z.optional(z.string()),
      position: z.optional(
        z.object({
          anchor: z.enum([
            "center",
            "left",
            "right",
            "top",
            "bottom",
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
          ]),
        }),
      ),
      size: z.optional(
        z.object({
          width: z.optional(z.number()),
          height: z.optional(z.number()),
          radius: z.optional(z.number()),
          scale: z.optional(z.enum(["small", "medium", "large"])),
        }),
      ),
      text: z.optional(z.string()),
    }),
  ),
  imagePrompt: z.optional(z.string()),
  transcript: z.string(),
});

export async function POST(req: Request) {
  const { transcript } = await req.json();

  const { object } = await generateObject({
    model: qwen("qwen-max"),
    schema: IntentSchema,
    system: SYSTEM_PROMPT, // 见 3.3
    prompt: transcript,
  });

  return Response.json(object);
}
```

#### POST /api/image/generate

```typescript
// app/api/image/generate/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  const response = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: "wanx2.1-t2i-turbo", // Qwen Image 2.0
        input: { prompt },
        parameters: {
          size: "1024*1024",
          n: 1,
          style: "<auto>",
        },
      }),
    },
  );

  const taskData = await response.json();
  const taskId = taskData.output.task_id;

  // 轮询任务结果
  const imageUrl = await pollImageTask(taskId);
  return NextResponse.json({ imageUrl });
}

async function pollImageTask(taskId: string, maxRetries = 30): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      { headers: { Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}` } },
    );
    const data = await res.json();
    if (data.output.task_status === "SUCCEEDED") {
      return data.output.results[0].url;
    }
    if (data.output.task_status === "FAILED") {
      throw new Error("Image generation failed");
    }
  }
  throw new Error("Timeout");
}
```

---

## 5. 数据库设计

### 5.1 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  // Supabase 连接池
  directUrl = env("DIRECT_URL")
}

// ─── 用户（与 Supabase Auth 同步）───────────────────────────────
model User {
  id        String   @id @default(cuid())
  supabaseId String  @unique  // Supabase auth.users.id
  email     String   @unique
  name      String?
  avatarUrl String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  artworks  Artwork[]
  voiceLogs VoiceLog[]

  @@map("users")
}

// ─── 作品────────────────────────────────────────────────────────
model Artwork {
  id          String   @id @default(cuid())
  userId      String
  title       String?  @default("未命名作品")

  // Konva.js 序列化的 JSON 画布数据
  canvasJson  Json?

  // 缩略图 URL（存 Supabase Storage）
  thumbnailUrl String?

  // 作品类型标签
  tags        String[]

  // 是否公开
  isPublic    Boolean  @default(false)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  voiceLogs   VoiceLog[]

  @@index([userId])
  @@map("artworks")
}

// ─── 语音操作日志（用于复盘和分析）─────────────────────────────
model VoiceLog {
  id         String   @id @default(cuid())
  userId     String
  artworkId  String?

  // 原始转录文本
  transcript String

  // 识别到的意图类型
  intentType String   // 'canvas' | 'ai_generate' | 'control' | 'ambiguous'

  // 置信度
  confidence Float

  // 最终执行的操作（序列化 JSON）
  executedAction Json?

  // 是否执行成功
  success    Boolean  @default(true)

  // 耗时（ms）
  latencyMs  Int?

  createdAt  DateTime @default(now())

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  artwork    Artwork? @relation(fields: [artworkId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@map("voice_logs")
}
```

### 5.2 环境变量

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Prisma (Supabase Connection Pooler)
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres

# 阿里云 DashScope
DASHSCOPE_API_KEY=sk-xxx

# Next.js
NEXTAUTH_SECRET=random_secret_string
NEXT_PUBLIC_APP_URL=https://voicecanvas.vercel.app
```

---

## 6. 前端架构设计

### 6.1 目录结构

```
app/
├── (auth)/
│   ├── login/page.tsx          # 登录页
│   └── callback/page.tsx       # OAuth 回调
├── canvas/
│   └── page.tsx                # 核心画布页
├── gallery/
│   └── page.tsx                # 作品图库
├── api/                        # (见第 4 节)
└── layout.tsx                  # 全局布局

components/
├── voice/
│   ├── MicButton.tsx           # 录音按钮（核心交互）
│   ├── TranscriptBar.tsx       # 实时字幕条
│   └── IntentModal.tsx         # 意图确认弹框
├── canvas/
│   ├── CanvasBoard.tsx         # Konva Stage 封装
│   ├── DrawingLayer.tsx        # 几何图形图层
│   ├── ImageLayer.tsx          # AI 生图图层
│   └── CommandHistory.tsx      # 最近指令列表
├── gallery/
│   ├── ArtworkGrid.tsx
│   └── ArtworkCard.tsx
└── ui/
    ├── LoadingSpinner.tsx
    └── Toast.tsx

lib/
├── supabase/
│   ├── client.ts               # 浏览器端 Supabase 客户端
│   └── server.ts               # 服务端 Supabase 客户端
├── prisma.ts                   # Prisma 单例
├── canvas/
│   ├── executor.ts             # IntentResult → Konva 操作
│   └── serializer.ts           # 画布序列化/反序列化
└── voice/
    ├── recorder.ts             # MediaRecorder 封装
    └── pipeline.ts             # 语音处理流水线

stores/
├── canvasStore.ts              # Zustand: 画布状态
├── voiceStore.ts               # Zustand: 录音/转录状态
└── userStore.ts                # Zustand: 用户状态
```

### 6.2 Canvas 执行器（核心逻辑）

```typescript
// lib/canvas/executor.ts
import Konva from "konva";
import { IntentResult } from "@/types";

const SIZE_MAP = { small: 80, medium: 150, large: 300 };
const ANCHOR_MAP = {
  center: (w: number, h: number) => ({ x: w / 2, y: h / 2 }),
  left: (w: number, h: number) => ({ x: w * 0.2, y: h / 2 }),
  right: (w: number, h: number) => ({ x: w * 0.8, y: h / 2 }),
  top: (w: number, h: number) => ({ x: w / 2, y: h * 0.2 }),
  bottom: (w: number, h: number) => ({ x: w / 2, y: h * 0.8 }),
  "top-left": (w: number, h: number) => ({ x: w * 0.2, y: h * 0.2 }),
  "top-right": (w: number, h: number) => ({ x: w * 0.8, y: h * 0.2 }),
  "bottom-left": (w: number, h: number) => ({ x: w * 0.2, y: h * 0.8 }),
  "bottom-right": (w: number, h: number) => ({ x: w * 0.8, y: h * 0.8 }),
};

export function executeCanvasOp(
  layer: Konva.Layer,
  stage: Konva.Stage,
  intent: IntentResult,
): Konva.Shape | null {
  const op = intent.canvasOp!;
  const stageW = stage.width();
  const stageH = stage.height();

  const anchor = op.position?.anchor ?? "center";
  const pos = ANCHOR_MAP[anchor](stageW, stageH);
  const sizeKey = op.size?.scale ?? "medium";
  const sz = SIZE_MAP[sizeKey];
  const fill = op.color ?? "#B5D5F5"; // 默认马卡龙蓝

  let shape: Konva.Shape | null = null;

  switch (op.shape) {
    case "circle":
      shape = new Konva.Circle({
        x: pos.x,
        y: pos.y,
        radius: op.size?.radius ?? sz / 2,
        fill,
        draggable: false,
      });
      break;
    case "rect":
      shape = new Konva.Rect({
        x: pos.x - sz / 2,
        y: pos.y - sz / 2,
        width: op.size?.width ?? sz,
        height: op.size?.height ?? sz,
        fill,
        draggable: false,
      });
      break;
    case "line":
      shape = new Konva.Line({
        points: [pos.x - sz / 2, pos.y, pos.x + sz / 2, pos.y],
        stroke: fill,
        strokeWidth: 4,
      });
      break;
    case "triangle":
      shape = new Konva.RegularPolygon({
        x: pos.x,
        y: pos.y,
        sides: 3,
        radius: sz / 2,
        fill,
        draggable: false,
      });
      break;
    case "star":
      shape = new Konva.Star({
        x: pos.x,
        y: pos.y,
        numPoints: 5,
        innerRadius: sz * 0.2,
        outerRadius: sz / 2,
        fill,
        draggable: false,
      });
      break;
  }

  if (op.action === "text" && op.text) {
    shape = new Konva.Text({
      x: pos.x,
      y: pos.y,
      text: op.text,
      fontSize: sz * 0.3,
      fill,
    });
  }

  if (shape) layer.add(shape);
  return shape;
}
```

### 6.3 MicButton 状态机

```
IDLE ──[按住/点击]──► RECORDING ──[松开/超时]──► PROCESSING
  ▲                                                    │
  │                                              (ASR + Intent)
  └──────────[完成/取消]────────────────────────────── ▼
                                              SHOW_RESULT
                                                    │
                                        [确认选择 1 或 2]
                                                    │
                                              EXECUTING
                                                    │
                                              ──► IDLE
```

---

## 7. Supabase Auth 集成

```typescript
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );
}
```

### Supabase Auth → Prisma User 同步

通过 Supabase Database Webhook，在 `auth.users` 插入时触发 PostgreSQL Function，
将用户数据同步写入 `public.users`（即 Prisma User 表）。

```sql
-- Supabase SQL Editor
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, supabase_id, email, name, avatar_url)
  VALUES (
    gen_random_uuid()::text,
    NEW.id::text,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (supabase_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

---

## 8. Supabase Storage（画布缩略图）

```typescript
// lib/storage.ts
import { createClient } from "@/lib/supabase/client";

export async function uploadThumbnail(
  artworkId: string,
  canvasDataUrl: string,
): Promise<string> {
  const supabase = createClient();

  // Data URL → Blob
  const res = await fetch(canvasDataUrl);
  const blob = await res.blob();

  const path = `thumbnails/${artworkId}.png`;
  const { data, error } = await supabase.storage
    .from("artworks")
    .upload(path, blob, { contentType: "image/png", upsert: true });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("artworks").getPublicUrl(path);

  return publicUrl;
}
```

---

## 9. 错误处理与容错策略

| 场景                | 处理方案                                             |
| ------------------- | ---------------------------------------------------- |
| ASR 转录失败        | 重试 1 次，仍失败则 Toast 提示"未能识别，请再试一次" |
| Intent 置信度 < 0.7 | 强制弹出 IntentModal 让用户手动确认或重新说          |
| AI 生图超时（>30s） | 超时提示 + 提供"重试"按钮                            |
| 用户网络离线        | 检测 navigator.onLine，离线时禁用语音按钮并提示      |
| LLM 返回无效 JSON   | Zod schema 校验失败 → fallback 到 type: 'ambiguous'  |
| Supabase 保存失败   | 本地 localStorage 暂存，网络恢复后自动重传           |

---

## 10. 性能优化策略

- **音频压缩**：MediaRecorder 使用 `audio/webm;codecs=opus`，比 WAV 小 5-10x
- **API 请求合并**：转录成功后立即发送意图分析，不等用户操作
- **Canvas 节流**：Konva 渲染使用 `requestAnimationFrame` 批量更新
- **图片懒加载**：Gallery 使用 `next/image` + Intersection Observer
- **Prisma 连接池**：通过 Supabase Transaction Pooler（PgBouncer）管理连接

---

## 11. 部署流程（Vercel）

```bash
# 1. 推送到 GitHub 触发自动部署
git push origin main

# 2. Vercel 环境变量配置（Dashboard）
# - DASHSCOPE_API_KEY
# - DATABASE_URL / DIRECT_URL
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY

# 3. 数据库迁移
npx prisma migrate deploy

# 4. 生成 Prisma Client
npx prisma generate
```

---

## 12. 三天开发排期

| Day       | 任务                                                        | 交付物                   |
| --------- | ----------------------------------------------------------- | ------------------------ |
| **Day 1** | 环境搭建、Supabase Auth、Prisma Schema、基础 Canvas + Konva | 可登录、有画布的空白页面 |
| **Day 1** | MicButton UI、Web Audio API 录音、ASR API 接入              | 能录音并看到转录文本     |
| **Day 2** | Qwen3.7-Max 意图解析、Canvas Executor、控制指令             | 语音画基础形状全流程通   |
| **Day 2** | IntentModal、AI 生图接入、图层叠加                          | 混合模式完整流程         |
| **Day 3** | Supabase 作品保存、Gallery 页面、PNG 导出                   | 完整产品闭环             |
| **Day 3** | 错误处理、Toast 反馈、容错优化、Demo 准备                   | 可演示 MVP               |
