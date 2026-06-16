/**
 * 客户端绘图 Schema 入口。
 *
 * 历史上这里有一份与 app/lib/draw-schema.ts 几乎相同的副本，仅注释转义不同，
 * 长期会导致两份 schema 漂移（API 端与客户端看到的类型不一致）。
 *
 * 现统一为单一真相源：直接 re-export app/lib/draw-schema.ts。
 * 客户端用相对路径回退到根 app/lib，类型与 API 端完全一致。
 *
 * 注意：`export *` 不会自动 re-export TS 的 type 成员，必须显式 `export type`。
 */
export {
  drawInstructionSchema,
  shapeSchema,
} from "../../../lib/draw-schema";
export type {
  Shape,
  DrawInstruction,
  Segment,
  SketchStyle,
} from "../../../lib/draw-schema";
