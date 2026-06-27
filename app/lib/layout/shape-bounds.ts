import type { Segment, Shape } from "../draw-schema";

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 360;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

function toBounds(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Bounds {
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

function getRectTopLeft(shape: Shape, width: number, height: number) {
  switch (shape.anchor) {
    case "center":
      return { x: shape.x - width / 2, y: shape.y - height / 2 };
    case "bottom-right":
      return { x: shape.x - width, y: shape.y - height };
    case "top-left":
    default:
      return { x: shape.x, y: shape.y };
  }
}

function getPointBounds(
  points: Array<{ x: number; y: number }>,
  fallback: { x: number; y: number },
): Bounds {
  if (points.length === 0) {
    return toBounds(fallback.x, fallback.y, fallback.x, fallback.y);
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  if (!Number.isFinite(minX)) {
    return toBounds(fallback.x, fallback.y, fallback.x, fallback.y);
  }

  return toBounds(minX, minY, maxX, maxY);
}

function getPolygonPoints(shape: Shape) {
  const result: Array<{ x: number; y: number }> = [];
  const raw = shape.points || [];
  for (let index = 0; index < raw.length - 1; index += 2) {
    result.push({ x: raw[index], y: raw[index + 1] });
  }
  return result;
}

function getSegmentPoints(segments: Segment[] | undefined) {
  const result: Array<{ x: number; y: number }> = [];
  for (const segment of segments || []) {
    if (segment.x != null && segment.y != null)
      result.push({ x: segment.x, y: segment.y });
    if (segment.x1 != null && segment.y1 != null)
      result.push({ x: segment.x1, y: segment.y1 });
    if (segment.x2 != null && segment.y2 != null)
      result.push({ x: segment.x2, y: segment.y2 });
  }
  return result;
}

export function getShapeBounds(shape: Shape): Bounds {
  switch (shape.type) {
    case "circle": {
      const radius = shape.radius ?? 50;
      const anchor = shape.anchor || "top-left";
      let cx: number, cy: number;
      if (anchor === "center") {
        cx = shape.x;
        cy = shape.y;
      } else if (anchor === "bottom-right") {
        cx = shape.x - radius;
        cy = shape.y - radius;
      } else {
        cx = shape.x + radius;
        cy = shape.y + radius;
      }
      return toBounds(cx - radius, cy - radius, cx + radius, cy + radius);
    }
    case "ellipse": {
      const rx = shape.rx ?? 60;
      const ry = shape.ry ?? 40;
      const anchor = shape.anchor || "top-left";
      let cx: number, cy: number;
      if (anchor === "center") {
        cx = shape.x;
        cy = shape.y;
      } else if (anchor === "bottom-right") {
        cx = shape.x - rx;
        cy = shape.y - ry;
      } else {
        cx = shape.x + rx;
        cy = shape.y + ry;
      }
      return toBounds(cx - rx, cy - ry, cx + rx, cy + ry);
    }
    case "rectangle":
    case "triangle": {
      const width = shape.width ?? 120;
      const height = shape.height ?? 100;
      const topLeft = getRectTopLeft(shape, width, height);
      return toBounds(
        topLeft.x,
        topLeft.y,
        topLeft.x + width,
        topLeft.y + height,
      );
    }
    case "text": {
      const fontSize = shape.fontSize ?? 28;
      const textWidth = Math.max(
        fontSize,
        (shape.text?.length || 1) * fontSize * 0.65,
      );
      const textHeight = fontSize * 1.2;
      const topLeft = getRectTopLeft(shape, textWidth, textHeight);
      return toBounds(
        topLeft.x,
        topLeft.y,
        topLeft.x + textWidth,
        topLeft.y + textHeight,
      );
    }
    case "line": {
      const x2 = shape.x2 ?? shape.x + 100;
      const y2 = shape.y2 ?? shape.y;
      return toBounds(
        Math.min(shape.x, x2),
        Math.min(shape.y, y2),
        Math.max(shape.x, x2),
        Math.max(shape.y, y2),
      );
    }
    case "polygon": {
      const rawPts = getPolygonPoints(shape);
      if (rawPts.length === 0) {
        return toBounds(shape.x, shape.y, shape.x, shape.y);
      }
      const anchor = shape.anchor || "top-left";
      if (anchor === "top-left") {
        return getPointBounds(rawPts, { x: shape.x, y: shape.y });
      }
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (const p of rawPts) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      const w = maxX - minX;
      const h = maxY - minY;
      if (anchor === "center") {
        return toBounds(
          shape.x - w / 2,
          shape.y - h / 2,
          shape.x + w / 2,
          shape.y + h / 2,
        );
      }
      // bottom-right
      return toBounds(shape.x - w, shape.y - h, shape.x, shape.y);
    }
    case "path":
      return getPointBounds(getSegmentPoints(shape.segments), {
        x: shape.x,
        y: shape.y,
      });
    default:
      return toBounds(shape.x, shape.y, shape.x, shape.y);
  }
}

export function translateShape(shape: Shape, dx: number, dy: number): Shape {
  const translated: Shape = {
    ...shape,
    x: shape.x + dx,
    y: shape.y + dy,
  };

  if (shape.x2 != null) translated.x2 = shape.x2 + dx;
  if (shape.y2 != null) translated.y2 = shape.y2 + dy;
  if (shape.points) {
    translated.points = shape.points.map(
      (value, index) => value + (index % 2 === 0 ? dx : dy),
    );
  }
  if (shape.segments) {
    translated.segments = shape.segments.map((segment) => {
      const next: Segment = { ...segment };
      if (segment.x != null) next.x = segment.x + dx;
      if (segment.y != null) next.y = segment.y + dy;
      if (segment.x1 != null) next.x1 = segment.x1 + dx;
      if (segment.y1 != null) next.y1 = segment.y1 + dy;
      if (segment.x2 != null) next.x2 = segment.x2 + dx;
      if (segment.y2 != null) next.y2 = segment.y2 + dy;
      return next;
    });
  }

  return translated;
}

export function clampShapeIntoCanvas(shape: Shape, padding = 0): Shape {
  const bounds = getShapeBounds(shape);
  let dx = 0;
  let dy = 0;

  if (bounds.minX < padding) dx = padding - bounds.minX;
  if (bounds.maxX > CANVAS_WIDTH - padding)
    dx = CANVAS_WIDTH - padding - bounds.maxX;
  if (bounds.minY < padding) dy = padding - bounds.minY;
  if (bounds.maxY > CANVAS_HEIGHT - padding)
    dy = CANVAS_HEIGHT - padding - bounds.maxY;

  if (dx === 0 && dy === 0) return shape;
  return translateShape(shape, dx, dy);
}

export function overlapRatio(a: Bounds, b: Bounds): number {
  const overlapWidth = Math.max(
    0,
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY),
  );

  if (overlapWidth === 0 || overlapHeight === 0) return 0;

  const overlapArea = overlapWidth * overlapHeight;
  const smallerArea = Math.max(
    1,
    Math.min(a.width * a.height, b.width * b.height),
  );
  return overlapArea / smallerArea;
}
