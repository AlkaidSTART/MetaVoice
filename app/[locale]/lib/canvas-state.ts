/**
 * 画布状态机（多轮连续创作核心）
 *
 * 设计目标：
 * - 把「画布上有哪些元素」从一次性渲染参数，升级为可寻址、可持久化、可回滚的状态。
 * - 支持多轮对话：首轮整幅重绘（reset），后续轮只追加（add）。
 * - 为后续元素级操作（move/recolor/delete）预留接口，本轮只实现 reset + add + undo-add。
 *
 * 纯函数 + 类型，与 React 解耦：渲染层只关心 state.shapes，不关心 op 来源。
 */

import type { DrawInstruction, Shape } from "./draw-schema";

/** 画布完整状态：元素列表 + 全局氛围（背景/暗角） */
export interface CanvasState {
  shapes: Shape[];
  backgroundColor: string;
  vignette?: DrawInstruction["vignette"];
}

export interface AddBatchHistoryEntry {
  kind: "add-batch";
  shapeIds: string[];
}

function clampColorChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * 把 HEX 颜色（#RRGGBB 或 #RRGGBBAA）的 RGB 通道送入 mapper 变换，
 * 保留原有 alpha 通道。rgba()/名称等非 HEX 颜色原样返回（不变换）。
 */
function mapHexColor(color: string, mapper: (r: number, g: number, b: number) => [number, number, number]) {
  const match = color.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/);
  if (!match) return color;
  const hex = match[1];
  const alpha = match[2]; // 可选 alpha 通道
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const [nr, ng, nb] = mapper(r, g, b);
  const rgb =
    `#${clampColorChannel(nr).toString(16).padStart(2, "0")}${clampColorChannel(ng).toString(16).padStart(2, "0")}${clampColorChannel(nb).toString(16).padStart(2, "0")}`.toUpperCase();
  return alpha ? rgb + alpha.toUpperCase() : rgb;
}

/**
 * 操作（Command 模式）。
 * 每一轮用户输入会被解析成一组 op，依次 applyOp 到 state。
 * op 同时进入撤销栈，撤销时回退。
 *
 * 本轮实现：reset（首屏）+ add（追加）。
 * TODO（已确认延后）：
 * - move：移动指定 id 的元素
 * - recolor：修改指定 id 的填充/描边色
 * - delete：删除指定 id 的元素
 * - background：换背景色
 */
export type Op =
  | { kind: "reset"; instruction: DrawInstruction }
  | { kind: "add"; shape: Shape };
// | { kind: "move"; id: string; dx: number; dy: number }   // TODO
// | { kind: "recolor"; id: string; fillColor?: string }    // TODO
// | { kind: "delete"; id: string }                         // TODO

/** 生成 8 位短 id（crypto.randomUUID 优先，SSR/老浏览器兜底） */
export function generateShapeId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    }
  } catch {
    /* fallthrough */
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** 为缺失 id 的 shape 补一个稳定 id（读旧记录/LLM 未给 id 时用） */
export function ensureIds(shapes: Shape[]): Shape[] {
  return shapes.map((s) => (s.id ? s : { ...s, id: generateShapeId() }));
}

/** 找出 shapes 里最大的 z 值（缺省按 0），供追加元素避让图层 */
function maxZ(shapes: Shape[]): number {
  let m = 0;
  for (const s of shapes) {
    const z = s.z ?? 0;
    if (z > m) m = z;
  }
  return m;
}

/**
 * 重排 z，保证追加元素始终在已有元素之上（按数组顺序递增）。
 * 仅对 maxZ 之后的元素连续编号，避免改动已有图层关系。
 */
function renumberZForAppend(existing: Shape[], incoming: Shape[]): Shape[] {
  let base = maxZ(existing);
  return incoming.map((s) => ({ ...s, z: ++base }));
}

/** 把 DrawInstruction 转成 CanvasState（首屏 reset 用） */
export function stateFromInstruction(instruction: DrawInstruction): CanvasState {
  return {
    shapes: ensureIds(instruction.shapes),
    backgroundColor: instruction.backgroundColor || "#FFFFFF",
    vignette: instruction.vignette,
  };
}

/** 空状态 */
export function emptyState(): CanvasState {
  return { shapes: [], backgroundColor: "#FFFFFF" };
}

/**
 * 核心 reducer：把一个 op 应用到 state，返回新 state（不可变）。
 *
 * - reset：丢弃全部元素，按 instruction 重建（首屏 / 撤销到最初）。
 * - add：追加单个 shape（已 ensureId + 避让 z）。
 *
 * 未实现的 move/recolor/delete 直接返回原 state（防御性 no-op），
 * 真正接入时在 switch 内补分支即可，调用方无需改动。
 */
export function applyOp(state: CanvasState, op: Op): CanvasState {
  switch (op.kind) {
    case "reset": {
      return stateFromInstruction(op.instruction);
    }
    case "add": {
      const shape = op.shape.id ? op.shape : { ...op.shape, id: generateShapeId() };
      const [renumbered] = renumberZForAppend(state.shapes, [shape]);
      return {
        ...state,
        shapes: [...state.shapes, renumbered],
      };
    }
    default:
      // TODO: move / recolor / delete
      return state;
  }
}

/**
 * 批量追加一组 shapes（一轮多元素 add 的便捷封装）。
 * 内部按数组顺序连续 renumber z，保证图层递增。
 */
export function applyAddMany(state: CanvasState, incoming: Shape[]): CanvasState {
  if (incoming.length === 0) return state;
  const withIds = ensureIds(incoming);
  let base = maxZ(state.shapes);
  const renumbered = withIds.map((s) => ({ ...s, z: ++base }));
  return {
    ...state,
    shapes: [...state.shapes, ...renumbered],
  };
}

/**
 * 撤销 add：从 shapes 尾部移除指定 id 的元素（add 是追加，通常在尾部）。
 * 返回新 state；若不存在该 id，原样返回。
 */
export function removeShapeById(state: CanvasState, id: string): CanvasState {
  if (!state.shapes.some((s) => s.id === id)) return state;
  return { ...state, shapes: state.shapes.filter((s) => s.id !== id) };
}

export function moveShapesByIds(state: CanvasState, ids: string[], dx: number, dy: number): CanvasState {
  if (ids.length === 0) return state;
  const idSet = new Set(ids);
  return {
    ...state,
    shapes: state.shapes.map((shape) => {
      if (!shape.id || !idSet.has(shape.id)) return shape;

      const next: Shape = {
        ...shape,
        x: shape.x + dx,
        y: shape.y + dy,
      };

      if (shape.x2 != null) next.x2 = shape.x2 + dx;
      if (shape.y2 != null) next.y2 = shape.y2 + dy;
      if (shape.points) {
        next.points = shape.points.map((value, index) => value + (index % 2 === 0 ? dx : dy));
      }
      // path 的 segments 控制点也需跟随平移，否则移动 path 会变形
      if (shape.segments) {
        next.segments = shape.segments.map((seg) => {
          const moved = { ...seg };
          if (seg.x != null) moved.x = seg.x + dx;
          if (seg.y != null) moved.y = seg.y + dy;
          if (seg.x1 != null) moved.x1 = seg.x1 + dx;
          if (seg.y1 != null) moved.y1 = seg.y1 + dy;
          if (seg.x2 != null) moved.x2 = seg.x2 + dx;
          if (seg.y2 != null) moved.y2 = seg.y2 + dy;
          return moved;
        });
      }

      return next;
    }),
  };
}

export function warmShapesByIds(state: CanvasState, ids: string[], amount: number): CanvasState {
  if (ids.length === 0) return state;
  const idSet = new Set(ids);
  return {
    ...state,
    shapes: state.shapes.map((shape) => {
      if (!shape.id || !idSet.has(shape.id)) return shape;
      return {
        ...shape,
        fillColor: shape.fillColor
          ? mapHexColor(shape.fillColor, (r, g, b) => [r + amount, g + amount / 3, b - amount / 3])
          : shape.fillColor,
        strokeColor: shape.strokeColor
          ? mapHexColor(shape.strokeColor, (r, g, b) => [r + amount, g + amount / 3, b - amount / 3])
          : shape.strokeColor,
        gradient: shape.gradient
          ? {
              ...shape.gradient,
              stops: shape.gradient.stops.map((stop) => ({
                ...stop,
                color: mapHexColor(stop.color, (r, g, b) => [r + amount, g + amount / 3, b - amount / 3]),
              })),
            }
          : shape.gradient,
      };
    }),
  };
}

export function coolShapesByIds(state: CanvasState, ids: string[], amount: number): CanvasState {
  if (ids.length === 0) return state;
  const idSet = new Set(ids);
  return {
    ...state,
    shapes: state.shapes.map((shape) => {
      if (!shape.id || !idSet.has(shape.id)) return shape;
      return {
        ...shape,
        fillColor: shape.fillColor
          ? mapHexColor(shape.fillColor, (r, g, b) => [r - amount / 3, g + amount / 4, b + amount])
          : shape.fillColor,
        strokeColor: shape.strokeColor
          ? mapHexColor(shape.strokeColor, (r, g, b) => [r - amount / 3, g + amount / 4, b + amount])
          : shape.strokeColor,
        gradient: shape.gradient
          ? {
              ...shape.gradient,
              stops: shape.gradient.stops.map((stop) => ({
                ...stop,
                color: mapHexColor(stop.color, (r, g, b) => [r - amount / 3, g + amount / 4, b + amount]),
              })),
            }
          : shape.gradient,
      };
    }),
  };
}

/**
 * 序列化 CanvasState 用于持久化（IndexedDB artwork.canvasData）。
 * 旧格式只存 description+尺寸，新格式存完整 shapes，读取时兼容。
 */
export function serializeState(state: CanvasState): string {
  return JSON.stringify({
    version: 2,
    shapes: state.shapes,
    backgroundColor: state.backgroundColor,
    vignette: state.vignette,
  });
}

/**
 * 反序列化：兼容旧格式（无 shapes 字段时返回 null，调用方走首屏路径）。
 */
export function deserializeState(canvasData: string): CanvasState | null {
  try {
    const parsed = JSON.parse(canvasData);
    if (parsed && Array.isArray(parsed.shapes)) {
      return {
        shapes: ensureIds(parsed.shapes as Shape[]),
        backgroundColor: parsed.backgroundColor || "#FFFFFF",
        vignette: parsed.vignette,
      };
    }
    return null;
  } catch {
    return null;
  }
}
