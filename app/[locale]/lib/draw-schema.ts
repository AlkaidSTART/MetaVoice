import { z } from "zod";

/**
 * Canvas 绘图指令 Schema（v2）
 *
 * 坐标系：960×720，左上角为原点 (0,0)，x 向右、y 向下。
 * 每个 shape 都有绝对坐标 (x, y)，但可通过 anchor / scale / z 表达
 * 相对语义，让 LLM 输出更稳定的多元素构图。
 *
 * 设计要点：
 * - anchor: 形状的 (x,y) 指代哪个参考点，消除矩形/三角形/文字的锚点歧义
 * - z: 图层顺序，数值越大越靠上（绘制更晚）。默认 0
 * - scale: 仅作语义提示，LLM 仍需输出绝对 width/height/radius
 * - ellipse / polygon / line / text 等扩展类型支持更丰富的图形
 */
const anchorSchema = z
  .enum(["top-left", "center", "bottom-right"])
  .default("top-left")
  .describe("(x,y) 指代的参考点：top-left 左上角、center 几何中心、bottom-right 右下角");

const scaleSchema = z
  .enum(["small", "medium", "large", "xl"])
  .optional()
  .describe("尺寸语义提示（small≈30-50, medium≈80-120, large≈150-220, xl≈260-360）");

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

  // 样式
  fillColor: z.string().optional().describe("填充色（#RRGGBB 或 red/blue 等名称）"),
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

  // 空间语义（帮助 LLM 稳定输出，渲染层据此计算绝对坐标）
  anchor: anchorSchema,
  scale: scaleSchema,
  z: z
    .number()
    .default(0)
    .describe("图层顺序，数值越大越靠上；同 z 按 shapes 数组顺序绘制"),
});

export const drawInstructionSchema = z.object({
  shapes: z.array(shapeSchema),
  backgroundColor: z.string().nullish().describe("画布背景色（#RRGGBB 或名称）"),
});

export type Shape = z.infer<typeof shapeSchema>;
export type DrawInstruction = z.infer<typeof drawInstructionSchema>;
