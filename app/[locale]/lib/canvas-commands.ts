import type { Shape } from "./draw-schema";

export type CanvasEditCommand =
  | {
      kind: "move";
      targetHint: string | null;
      position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "left" | "right" | "top" | "bottom";
    }
  | {
      kind: "recolor-warm";
      targetHint: string | null;
      amount: number;
    }
  | {
      kind: "recolor-cool";
      targetHint: string | null;
      amount: number;
    }
  | {
      kind: "none";
    };

type PositionType = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "left" | "right" | "top" | "bottom";

const POSITION_PATTERNS: Array<[PositionType, RegExp]> = [
  ["top-left", /左上角/],
  ["top-right", /右上角/],
  ["bottom-left", /左下角/],
  ["bottom-right", /右下角/],
  ["center", /中间|中央|正中/],
  ["left", /左边|左侧/],
  ["right", /右边|右侧/],
  ["top", /上边|上面|顶部/],
  ["bottom", /下边|下面|底部/],
];

function extractTargetHint(input: string): string | null {
  const trimmed = input.trim();
  const explicit = trimmed.match(/把(.+?)(移到|放到|挪到|颜色|调暖|调冷|变暖|变冷|改成|变成|涂成)/);
  if (explicit?.[1]) {
    const hint = explicit[1].trim();
    if (hint === "它" || hint === "这个" || hint === "刚刚那个") return null;
    return hint;
  }

  if (/它|这个|刚刚那个/.test(trimmed)) return null;
  return null;
}

export function parseCanvasEditCommand(input: string): CanvasEditCommand {
  const normalized = input.replace(/\s+/g, "").trim();
  const targetHint = extractTargetHint(normalized);

  if (/(移到|放到|挪到)/.test(normalized)) {
    for (const [position, pattern] of POSITION_PATTERNS) {
      if (pattern.test(normalized)) {
        return { kind: "move", targetHint, position };
      }
    }
  }

  if (/(调暖一点|暖一点|变暖一点|颜色暖一点)/.test(normalized)) {
    return { kind: "recolor-warm", targetHint, amount: 24 };
  }

  if (/(调冷一点|冷一点|变冷一点|颜色冷一点)/.test(normalized)) {
    return { kind: "recolor-cool", targetHint, amount: 24 };
  }

  return { kind: "none" };
}

export function resolveShapeIdsByHint(shapes: Shape[], hint: string | null, fallbackIds: string[]): string[] {
  if (!hint) return fallbackIds;

  const matched = shapes
    .filter((shape) => {
      const label = shape.label || "";
      const text = shape.text || "";
      return label.includes(hint) || text.includes(hint);
    })
    .map((shape) => shape.id)
    .filter((id): id is string => Boolean(id));

  return matched.length > 0 ? matched : fallbackIds;
}
