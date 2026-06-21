import type { DrawInstruction, Shape } from "../draw-schema";
import {
  clampShapeIntoCanvas,
  getShapeBounds,
  overlapRatio,
  translateShape,
} from "./shape-bounds";

export interface LayoutContext {
  shapes?: Shape[];
  backgroundColor?: string;
}

const SKY_LABEL_RE = /太阳|月亮|云|星星|彩虹|天空|鸟/;
const GROUND_LABEL_RE = /草地|地面|路|花|树干|房子|小屋|树/;
const WATER_LABEL_RE = /河|湖|海|鱼|船/;
const HOUSE_LABEL_RE = /房子|小屋/;
const TREE_LABEL_RE = /树/;
const SUN_LABEL_RE = /太阳/;
const MOON_LABEL_RE = /月亮/;
const CLOUD_LABEL_RE = /云/;
const MAJOR_BIRD_LABEL_RE = /鸟/;

type SemanticZone = "sky" | "ground" | "water" | "text" | "generic";

function getLabel(shape: Shape) {
  return shape.label || shape.text || "";
}

function inferZone(shape: Shape): SemanticZone {
  if (shape.type === "text") return "text";
  const label = getLabel(shape);
  if (SKY_LABEL_RE.test(label)) return "sky";
  if (WATER_LABEL_RE.test(label)) return "water";
  if (GROUND_LABEL_RE.test(label)) return "ground";
  return "generic";
}

function isBackgroundStrip(shape: Shape) {
  if (shape.type !== "rectangle") return false;
  const width = shape.width ?? 0;
  const height = shape.height ?? 0;
  return width > 800 || height > 300;
}

function centerShapeAt(shape: Shape, x: number, y: number): Shape {
  const bounds = getShapeBounds(shape);
  return translateShape(shape, x - bounds.cx, y - bounds.cy);
}

function normalizeSemanticZone(shape: Shape, index: number): Shape {
  const zone = inferZone(shape);
  const label = getLabel(shape);
  let next = shape;

  if (zone === "sky") {
    if (SUN_LABEL_RE.test(label)) {
      next = centerShapeAt(next, 800, 120);
    } else if (MOON_LABEL_RE.test(label)) {
      next = centerShapeAt(next, 780, 130);
    } else if (CLOUD_LABEL_RE.test(label)) {
      next = centerShapeAt(next, 180 + (index % 4) * 180, 110 + (index % 2) * 40);
    } else if (MAJOR_BIRD_LABEL_RE.test(label)) {
      next = centerShapeAt(next, 220 + (index % 3) * 180, 170 + (index % 2) * 35);
    }

    const bounds = getShapeBounds(next);
    if (bounds.cy > 260) {
      next = translateShape(next, 0, 220 - bounds.cy);
    }
    return next;
  }

  if (zone === "ground") {
    if (HOUSE_LABEL_RE.test(label)) {
      const bounds = getShapeBounds(next);
      const targetCy = Math.min(520, Math.max(475, bounds.cy));
      next = translateShape(next, 0, targetCy - bounds.cy);
    } else if (TREE_LABEL_RE.test(label)) {
      const bounds = getShapeBounds(next);
      if (bounds.cy < 360) {
        next = translateShape(next, 0, 420 - bounds.cy);
      }
    } else if (!isBackgroundStrip(next)) {
      const bounds = getShapeBounds(next);
      if (bounds.cy < 360) {
        next = translateShape(next, 0, 390 - bounds.cy);
      }
    }
    return next;
  }

  if (zone === "water") {
    const bounds = getShapeBounds(next);
    if (bounds.cy < 320) {
      next = translateShape(next, 0, 380 - bounds.cy);
    }
    return next;
  }

  if (zone === "text") {
    const bounds = getShapeBounds(next);
    if (bounds.cy > 300 && bounds.cy < 520) {
      next = centerShapeAt(next, 480, 640);
    }
    return next;
  }

  return next;
}

function nudgeAway(shape: Shape, blocker: Shape): Shape {
  const baseBounds = getShapeBounds(shape);
  const blockerBounds = getShapeBounds(blocker);
  const directions: Array<[number, number]> = [
    [80, 0],
    [-80, 0],
    [0, -80],
    [0, 80],
  ];

  let bestShape = shape;
  let bestOverlap = overlapRatio(baseBounds, blockerBounds);

  for (const [dxStep, dyStep] of directions) {
    let candidate = shape;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      candidate = clampShapeIntoCanvas(translateShape(candidate, dxStep, dyStep), 24);
      const candidateOverlap = overlapRatio(getShapeBounds(candidate), blockerBounds);
      if (candidateOverlap < bestOverlap) {
        bestOverlap = candidateOverlap;
        bestShape = candidate;
      }
      if (candidateOverlap <= 0.35) {
        return candidate;
      }
    }
  }

  return bestShape;
}

export function normalizeInstructionLayout(
  instruction: DrawInstruction,
  context?: LayoutContext,
): DrawInstruction {
  const blockers = (context?.shapes || []).filter((shape) => !isBackgroundStrip(shape));
  const normalizedShapes: Shape[] = [];

  for (let index = 0; index < instruction.shapes.length; index += 1) {
    const shape = instruction.shapes[index];
    let next = normalizeSemanticZone(shape, index);
    next = clampShapeIntoCanvas(next, 24);

    const localBlockers = [...blockers, ...normalizedShapes].filter((blocker) => !isBackgroundStrip(blocker));
    for (const blocker of localBlockers) {
      const currentBounds = getShapeBounds(next);
      const blockerBounds = getShapeBounds(blocker);
      if (overlapRatio(currentBounds, blockerBounds) > 0.35) {
        next = nudgeAway(next, blocker);
      }
    }

    next = clampShapeIntoCanvas(next, 24);
    normalizedShapes.push(next);
  }

  return {
    ...instruction,
    shapes: normalizedShapes,
  };
}
