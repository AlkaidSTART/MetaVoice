import { z } from "zod";

/**
 * Canvas 绘图指令 Schema（v3 · 数据驱动光影）
 *
 * 坐标系：960×720，左上角为原点 (0,0)，x 向右、y 向下。
 *
 * 视觉增强（全部 optional，向下兼容）：
 * - gradient:  渐变填充，替代纯色 fillColor。radial 模拟球体光照，linear 模拟天空/草地/水面
 * - shadow:    投影阴影，模拟立体感与地面投影
 * - glow:      发光光晕，用于太阳/灯泡/萤火虫等光源体
 * - highlight: 球体表面高光斑，模拟反光
 * - vignette:  顶层全局暗角，增加画面聚焦感
 */

const anchorSchema = z
  .enum(["top-left", "center", "bottom-right"])
  .default("top-left")
  .describe("(x,y) 指代的参考点：top-left 左上角、center 几何中心、bottom-right 右下角");

const scaleSchema = z
  .enum(["small", "medium", "large", "xl"])
  .optional()
  .describe("尺寸语义提示（small≈30-50, medium≈80-120, large≈150-220, xl≈260-360）");

// 渐变填充：radial 模拟球体光照（中心亮→边缘暗），linear 模拟天空/草地/水面
const gradientSchema = z.object({
  type: z.enum(["radial", "linear"]).describe("radial 径向（球体光照）、linear 线性（天空/草地）"),
  stops: z
    .array(
      z.object({
        offset: z.number().min(0).max(1).describe("色阶位置 0-1"),
        color: z.string().describe("颜色 #RRGGBB 或 #RRGGBBAA 或 rgba()"),
      })
    )
    .min(2)
    .max(5)
    .describe("2-5 个色阶，从 offset=0 到 offset=1"),
  angle: z
    .number()
    .optional()
    .describe("仅 linear：渐变方向角度（度），0=向上、90=向右、180=向下，默认 180（上→下）"),
});

// 投影阴影：模拟立体感与地面投影
const shadowSchema = z.object({
  color: z.string().describe("阴影色，建议 rgba(0,0,0,0.25~0.4)"),
  blur: z.number().min(0).max(40).describe("模糊半径 0-40，越大越柔和"),
  offsetX: z.number().describe("水平偏移，光源在左上则正值"),
  offsetY: z.number().describe("垂直偏移，地面投影用正值"),
});

// 发光光晕：用于太阳、灯泡、萤火虫等
const glowSchema = z.object({
  color: z.string().describe("光晕色 #RRGGBB 或 rgba()"),
  blur: z.number().min(5).max(60).describe("光晕扩散半径 5-60"),
});

// 球体表面高光斑：模拟反光
const highlightSchema = z.object({
  x: z.number().min(-1).max(1).describe("高光中心相对形状几何中心的水平偏移，-1~1（-1 最左，1 最右）"),
  y: z.number().min(-1).max(1).describe("垂直偏移，-1~1（-1 最上，1 最下），光源在左上则负值"),
  radius: z.number().min(1).describe("高光半径 px"),
  opacity: z.number().min(0).max(1).describe("不透明度 0-1，建议 0.4-0.8"),
});

export const shapeSchema = z.object({
  type: z.enum([
    "rectangle",
    "circle",
    "ellipse",
    "line",
    "triangle",
    "polygon",
    "text",
  ]),
  // 元素稳定标识：多轮创作中用于寻址（移动/改色/删除）与撤销栈定位。
  // 首次渲染时若缺失，由客户端 canvas-state 补一个短 id；不影响渲染。
  id: z.string().optional().describe("元素稳定标识（多轮编辑寻址用），渲染无关"),
  // 语义标签：如 "太阳"/"树冠"/"小狗"。供 LLM 指代消解与后续选中 UI，
  // 渲染层忽略此字段。多轮 add 时由 LLM 输出，方便「把它移到左上角」解析。
  label: z.string().optional().describe("语义标签（如 太阳/树冠），用于指代与选中，渲染忽略"),
  x: z.number().describe("X 坐标 (0-960)，配合 anchor 解读"),
  y: z.number().describe("Y 坐标 (0-720)，配合 anchor 解读"),

  // 尺寸/形状参数（按 type 选填）
  width: z.number().optional().describe("rectangle/triangle 的宽度"),
  height: z.number().optional().describe("rectangle/triangle 的高度"),
  radius: z.number().optional().describe("circle 的半径"),
  rx: z.number().optional().describe("ellipse 的水平半径"),
  ry: z.number().optional().describe("ellipse 的垂直半径"),
  x2: z.number().optional().describe("line 终点 X"),
  y2: z.number().optional().describe("line 终点 Y"),
  points: z
    .array(z.number())
    .optional()
    .describe("polygon 顶点坐标，平铺为 [x1,y1,x2,y2,...]，至少 6 个数（3 个顶点）"),

  // 文本
  text: z.string().optional().describe("text 类型的文字内容"),
  fontSize: z.number().optional().describe("文字字号 px，默认 24"),
  fontWeight: z
    .union([z.literal("normal"), z.literal("bold")])
    .optional()
    .describe("文字粗细，默认 normal"),

  // 样式（fillColor 为兜底纯色；若提供 gradient 则优先用渐变）
  fillColor: z.string().optional().describe("填充色（#RRGGBB 或名称）。若有 gradient 则被渐变覆盖"),
  strokeColor: z.string().optional().describe("描边色（#RRGGBB 或名称）"),
  strokeWidth: z.number().optional().describe("描边宽度，默认 2"),
  opacity: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("不透明度 0-1，用于云朵、阴影等半透明叠加，默认 1"),
  rotation: z
    .number()
    .optional()
    .describe("旋转角度（度），围绕几何中心顺时针旋转，默认 0"),

  // 视觉增强字段
  gradient: gradientSchema.optional().describe("渐变填充：radial 球体光照 / linear 天空草地"),
  shadow: shadowSchema.optional().describe("投影阴影，模拟立体感与地面投影"),
  glow: glowSchema.optional().describe("发光光晕，用于太阳/灯泡等光源体"),
  highlight: highlightSchema.optional().describe("球体表面高光斑，模拟反光"),

  // 空间语义（帮助 LLM 稳定输出，渲染层据此计算绝对坐标）
  anchor: anchorSchema,
  scale: scaleSchema,
  z: z
    .number()
    .default(0)
    .describe("图层顺序，数值越大越靠上；同 z 按 shapes 数组顺序绘制"),
});

// 顶层全局氛围
const vignetteSchema = z.object({
  strength: z
    .number()
    .min(0)
    .max(1)
    .describe("边缘暗角强度 0-1，0.3-0.5 常用，增加画面聚焦感"),
});

export const drawInstructionSchema = z.object({
  shapes: z.array(shapeSchema),
  backgroundColor: z.string().nullish().describe("画布背景色（#RRGGBB 或名称）"),
  vignette: vignetteSchema.optional().describe("全局边缘暗角，增加画面聚焦感"),
});

export type Shape = z.infer<typeof shapeSchema>;
export type DrawInstruction = z.infer<typeof drawInstructionSchema>;
