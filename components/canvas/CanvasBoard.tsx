"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import gsap from "gsap";

export interface CanvasShape {
  id: string;
  type: "circle" | "rect" | "line" | "triangle" | "star" | "text" | "image";
  x: number;
  y: number;
  color: string;
  size: number;
  text?: string;
  imageUrl?: string;
  opacity: number;
  renderScale: number;
  fill?: boolean;
  strokeProgress?: number;
}

type PenState = {
  x: number;
  y: number;
  visible: boolean;
};

export interface CanvasBoardRef {
  addShape: (
    shapeType: CanvasShape["type"],
    color: string | undefined,
    positionName: string,
    sizeScale: "small" | "medium" | "large",
    detail?: string,
    options?: {
      fill?: boolean;
      pixelSize?: number;
    },
  ) => Promise<CanvasShape | null>;
  createSceneSketch: (prompt: string) => Promise<CanvasShape[]>;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  exportImage: () => string;
  getHistoryStatus: () => { canUndo: boolean; canRedo: boolean };
  setShapesData: (shapes: CanvasShape[]) => void;
  getShapesData: () => CanvasShape[];
}

interface CanvasBoardProps {
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onSaveState?: (shapes: CanvasShape[]) => void;
  initialShapes?: CanvasShape[];
}

const SIZE_MAP = {
  small: 50,
  medium: 110,
  large: 220,
};

const DEFAULT_STROKE = "#1A1A1A";

const ANCHOR_MAP: Record<
  string,
  (w: number, h: number) => { x: number; y: number }
> = {
  center: (w, h) => ({ x: w / 2, y: h / 2 }),
  left: (w, h) => ({ x: w * 0.25, y: h / 2 }),
  right: (w, h) => ({ x: w * 0.75, y: h / 2 }),
  top: (w, h) => ({ x: w / 2, y: h * 0.25 }),
  bottom: (w, h) => ({ x: w / 2, y: h * 0.75 }),
  "top-left": (w, h) => ({ x: w * 0.25, y: h * 0.25 }),
  "top-right": (w, h) => ({ x: w * 0.75, y: h * 0.25 }),
  "bottom-left": (w, h) => ({ x: w * 0.25, y: h * 0.75 }),
  "bottom-right": (w, h) => ({ x: w * 0.75, y: h * 0.75 }),
};

function withDefaults(shape: CanvasShape): CanvasShape {
  return {
    ...shape,
    color: shape.color || DEFAULT_STROKE,
    fill: shape.fill ?? false,
    strokeProgress: shape.strokeProgress ?? 1,
    opacity: shape.opacity ?? 1,
    renderScale: shape.renderScale ?? 1,
  };
}

function getPolylinePoint(
  points: Array<{ x: number; y: number }>,
  progress: number,
) {
  const segments = [];
  let total = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    segments.push({ start, end, length });
    total += length;
  }

  if (total === 0) {
    return points[0];
  }

  let target = total * progress;
  for (const segment of segments) {
    if (target <= segment.length) {
      const ratio = segment.length === 0 ? 0 : target / segment.length;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
        y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
      };
    }
    target -= segment.length;
  }

  return points[points.length - 1];
}

function getPathPoint(shape: CanvasShape, progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  const size = shape.size * shape.renderScale;

  if (shape.type === "circle") {
    const angle = -Math.PI / 2 + Math.PI * 2 * p;
    return {
      x: shape.x + Math.cos(angle) * (size / 2),
      y: shape.y + Math.sin(angle) * (size / 2),
    };
  }

  if (shape.type === "rect") {
    const half = size / 2;
    const perimeter = size * 4;
    let distance = perimeter * p;

    if (distance <= size) {
      return { x: shape.x - half + distance, y: shape.y - half };
    }
    distance -= size;
    if (distance <= size) {
      return { x: shape.x + half, y: shape.y - half + distance };
    }
    distance -= size;
    if (distance <= size) {
      return { x: shape.x + half - distance, y: shape.y + half };
    }
    distance -= size;
    return { x: shape.x - half, y: shape.y + half - distance };
  }

  if (shape.type === "line") {
    return {
      x: shape.x - size / 2 + size * p,
      y: shape.y,
    };
  }

  if (shape.type === "triangle") {
    const r = size / 2;
    return getPolylinePoint(
      [
        { x: shape.x, y: shape.y - r },
        { x: shape.x - r * Math.sin(Math.PI / 3), y: shape.y + r / 2 },
        { x: shape.x + r * Math.sin(Math.PI / 3), y: shape.y + r / 2 },
        { x: shape.x, y: shape.y - r },
      ],
      p,
    );
  }

  if (shape.type === "star") {
    const outerR = size / 2;
    const innerR = outerR * 0.4;
    let angle = (Math.PI / 2) * 3;
    const step = Math.PI / 5;
    const points = [{ x: shape.x, y: shape.y - outerR }];

    for (let index = 0; index < 10; index += 1) {
      const radius = index % 2 === 0 ? outerR : innerR;
      points.push({
        x: shape.x + Math.cos(angle) * radius,
        y: shape.y + Math.sin(angle) * radius,
      });
      angle += step;
    }
    points.push({ x: shape.x, y: shape.y - outerR });

    return getPolylinePoint(points, p);
  }

  if (shape.type === "text") {
    const width = Math.max(size * 1.2, (shape.text?.length || 1) * 18);
    return {
      x: shape.x - width / 2 + width * p,
      y: shape.y + size * 0.2,
    };
  }

  return { x: shape.x, y: shape.y };
}

function tracePolyline(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  progress: number,
) {
  if (!points.length) return;

  const segments = [];
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    segments.push({ start, end, length });
    total += length;
  }

  let remaining = total * progress;
  ctx.moveTo(points[0].x, points[0].y);

  for (const segment of segments) {
    if (remaining <= 0) break;
    const step = Math.min(remaining, segment.length);
    const ratio = segment.length === 0 ? 0 : step / segment.length;
    ctx.lineTo(
      segment.start.x + (segment.end.x - segment.start.x) * ratio,
      segment.start.y + (segment.end.y - segment.start.y) * ratio,
    );
    remaining -= step;
  }
}

function traceShape(
  ctx: CanvasRenderingContext2D,
  shape: CanvasShape,
  progress: number,
) {
  const p = Math.max(0, Math.min(1, progress));
  const size = shape.size * shape.renderScale;

  ctx.beginPath();

  if (shape.type === "circle") {
    ctx.arc(
      shape.x,
      shape.y,
      size / 2,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * p,
    );
    return;
  }

  if (shape.type === "rect") {
    const half = size / 2;
    const perimeter = size * 4;
    let distance = perimeter * p;
    ctx.moveTo(shape.x - half, shape.y - half);
    const edges = [
      { x: shape.x + half, y: shape.y - half, len: size },
      { x: shape.x + half, y: shape.y + half, len: size },
      { x: shape.x - half, y: shape.y + half, len: size },
      { x: shape.x - half, y: shape.y - half, len: size },
    ];
    let current = { x: shape.x - half, y: shape.y - half };

    for (const edge of edges) {
      if (distance <= 0) break;
      const step = Math.min(distance, edge.len);
      const ratio = step / edge.len;
      const next = {
        x: current.x + (edge.x - current.x) * ratio,
        y: current.y + (edge.y - current.y) * ratio,
      };
      ctx.lineTo(next.x, next.y);
      current = step === edge.len ? { x: edge.x, y: edge.y } : next;
      distance -= step;
    }
    return;
  }

  if (shape.type === "line") {
    ctx.moveTo(shape.x - size / 2, shape.y);
    ctx.lineTo(shape.x - size / 2 + size * p, shape.y);
    return;
  }

  if (shape.type === "triangle") {
    const r = size / 2;
    tracePolyline(
      ctx,
      [
        { x: shape.x, y: shape.y - r },
        { x: shape.x - r * Math.sin(Math.PI / 3), y: shape.y + r / 2 },
        { x: shape.x + r * Math.sin(Math.PI / 3), y: shape.y + r / 2 },
        { x: shape.x, y: shape.y - r },
      ],
      p,
    );
    return;
  }

  if (shape.type === "star") {
    const outerR = size / 2;
    const innerR = outerR * 0.4;
    let angle = (Math.PI / 2) * 3;
    const step = Math.PI / 5;
    const points = [{ x: shape.x, y: shape.y - outerR }];
    for (let index = 0; index < 10; index += 1) {
      const radius = index % 2 === 0 ? outerR : innerR;
      points.push({
        x: shape.x + Math.cos(angle) * radius,
        y: shape.y + Math.sin(angle) * radius,
      });
      angle += step;
    }
    points.push({ x: shape.x, y: shape.y - outerR });
    tracePolyline(ctx, points, p);
    return;
  }

  if (shape.type === "text" && shape.text) {
    const width = Math.max(size * 1.2, shape.text.length * 18);
    ctx.moveTo(shape.x - width / 2, shape.y + size * 0.2);
    ctx.lineTo(shape.x - width / 2 + width * p, shape.y + size * 0.2);
  }
}

const CanvasBoard = forwardRef<CanvasBoardRef, CanvasBoardProps>(
  ({ onHistoryChange, onSaveState, initialShapes = [] }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const shapesRef = useRef<CanvasShape[]>(initialShapes.map(withDefaults));
    const historyRef = useRef<CanvasShape[][]>([initialShapes.map(withDefaults)]);
    const historyIndexRef = useRef(0);

    const [shapes, setShapes] = useState<CanvasShape[]>(shapesRef.current);
    const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
    const [loadedImages, setLoadedImages] = useState<
      Record<string, HTMLImageElement>
    >({});
    const [pen, setPen] = useState<PenState>({ x: 0, y: 0, visible: false });

    const syncShapes = (nextShapes: CanvasShape[]) => {
      const normalized = nextShapes.map(withDefaults);
      shapesRef.current = normalized;
      setShapes(normalized);
      return normalized;
    };

    const syncHistoryFlags = (canUndo: boolean, canRedo: boolean) => {
      onHistoryChange?.(canUndo, canRedo);
    };

    const pushHistory = (nextShapes: CanvasShape[]) => {
      const normalized = nextShapes.map(withDefaults);
      const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      nextHistory.push(normalized);
      historyRef.current = nextHistory;
      historyIndexRef.current = nextHistory.length - 1;
      syncShapes(normalized);
      syncHistoryFlags(nextHistory.length > 1, false);
      onSaveState?.(normalized);
      return normalized;
    };

    useEffect(() => {
      if (typeof window === "undefined" || !containerRef.current) return;
      const updateSize = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(rect.width, 300),
          height: Math.max(rect.height, 350),
        });
      };
      updateSize();
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }, []);

    useEffect(() => {
      shapes.forEach((shape) => {
        if (
          shape.type === "image" &&
          shape.imageUrl &&
          !loadedImages[shape.imageUrl]
        ) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = shape.imageUrl;
          img.onload = () => {
            setLoadedImages((prev) => ({ ...prev, [shape.imageUrl!]: img }));
          };
        }
      });
    }, [shapes, loadedImages]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      ctx.strokeStyle = "#E8E8E4";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < dimensions.width; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, dimensions.height);
        ctx.stroke();
      }
      for (let y = 0; y < dimensions.height; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(dimensions.width, y);
        ctx.stroke();
      }

      shapes.forEach((rawShape) => {
        const shape = withDefaults(rawShape);
        ctx.save();
        ctx.globalAlpha = shape.opacity;
        ctx.strokeStyle = shape.color;
        ctx.fillStyle = shape.color;
        ctx.lineWidth = shape.type === "text" ? 3 : 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (shape.type === "image" && shape.imageUrl) {
          const img = loadedImages[shape.imageUrl];
          if (img) {
            const drawW = Math.min(dimensions.width * 0.8, shape.size * 2.5);
            const drawH = drawW * (img.height / img.width);
            ctx.drawImage(img, shape.x - drawW / 2, shape.y - drawH / 2, drawW, drawH);
          }
          ctx.restore();
          return;
        }

        if (shape.type === "text" && shape.text) {
          ctx.font = `bold ${Math.max(18, shape.size * 0.35)}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const reveal = Math.max(
            1,
            Math.round(shape.text.length * (shape.strokeProgress || 1)),
          );
          ctx.fillText(shape.text.slice(0, reveal), shape.x, shape.y);
          traceShape(ctx, shape, shape.strokeProgress || 1);
          ctx.stroke();
          ctx.restore();
          return;
        }

        traceShape(ctx, shape, shape.strokeProgress || 1);
        ctx.stroke();

        if (shape.fill && (shape.strokeProgress || 1) >= 1) {
          if (shape.type === "circle") {
            ctx.beginPath();
            ctx.arc(shape.x, shape.y, (shape.size * shape.renderScale) / 2, 0, Math.PI * 2);
            ctx.fill();
          } else if (shape.type === "rect") {
            const drawSize = shape.size * shape.renderScale;
            ctx.fillRect(shape.x - drawSize / 2, shape.y - drawSize / 2, drawSize, drawSize);
          } else if (shape.type === "triangle" || shape.type === "star") {
            traceShape(ctx, shape, 1);
            ctx.fill();
          }
        }

        ctx.restore();
      });

      if (pen.visible) {
        ctx.save();
        ctx.fillStyle = "#FFB7C5";
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pen.x, pen.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }, [dimensions, loadedImages, pen, shapes]);

    const addShape: CanvasBoardRef["addShape"] = async (
      shapeType,
      color,
      positionName,
      sizeScale,
      detail,
      options,
    ) => {
      const anchor = ANCHOR_MAP[positionName] || ANCHOR_MAP.center;
      const pos = anchor(dimensions.width, dimensions.height);
      const shape: CanvasShape = {
        id: `shp_${Math.random().toString(36).slice(2, 9)}`,
        type: shapeType,
        x: pos.x,
        y: pos.y,
        color: color || DEFAULT_STROKE,
        size: options?.pixelSize || SIZE_MAP[sizeScale] || SIZE_MAP.medium,
        text: shapeType === "text" ? detail : undefined,
        imageUrl: shapeType === "image" ? detail : undefined,
        opacity: 0.6,
        renderScale: 0.96,
        fill: options?.fill ?? shapeType === "text",
        strokeProgress: shapeType === "image" ? 1 : 0,
      };

      if (shapeType === "image") {
        pushHistory([...shapesRef.current, shape]);
        return withDefaults(shape);
      }

      const nextShapes = [...shapesRef.current, shape];
      syncShapes(nextShapes);

      return new Promise<CanvasShape>((resolve) => {
        const state = { progress: 0, opacity: 0.6, scale: 0.96 };
        gsap.to(state, {
          progress: 1,
          opacity: 1,
          scale: 1,
          duration: 0.65,
          ease: "back.out(1.6)",
          onUpdate: () => {
            const point = getPathPoint(shape, state.progress);
            setPen({ x: point.x, y: point.y, visible: true });
            syncShapes(
              nextShapes.map((item) =>
                item.id === shape.id
                  ? {
                      ...item,
                      strokeProgress: state.progress,
                      opacity: state.opacity,
                      renderScale: state.scale,
                    }
                  : item,
              ),
            );
          },
          onComplete: () => {
            setPen((current) => ({ ...current, visible: false }));
            const finalized = withDefaults({
              ...shape,
              strokeProgress: 1,
              opacity: 1,
              renderScale: 1,
            });
            pushHistory([...nextShapes.slice(0, -1), finalized]);
            resolve(finalized);
          },
        });
      });
    };

    const createSceneSketch: CanvasBoardRef["createSceneSketch"] = async (prompt) => {
      const lower = prompt.toLowerCase();
      const created: CanvasShape[] = [];
      const addSketch = async (
        type: CanvasShape["type"],
        position: string,
        size: "small" | "medium" | "large",
        color?: string,
        detail?: string,
        fill?: boolean,
      ) => {
        const shape = await addShape(type, color, position, size, detail, { fill });
        if (shape) created.push(shape);
      };

      if (/(太阳|sun)/.test(lower)) {
        await addSketch("circle", "top-right", "small", "#FFE5A0", undefined, false);
      }
      if (/(云|sky)/.test(lower)) {
        await addSketch("line", "top", "large", "#B5D5F5", undefined, false);
      }
      if (/(海|sea|beach)/.test(lower)) {
        await addSketch("line", "bottom", "large", "#B5D5F5", undefined, false);
      }
      if (/(山|mountain)/.test(lower)) {
        await addSketch("triangle", "center", "large", "#6B6B6B", undefined, false);
      }
      if (/(树|forest)/.test(lower)) {
        await addSketch("line", "left", "medium", "#1A1A1A", undefined, false);
        await addSketch("circle", "left", "small", "#B5E8C7", undefined, false);
      }
      if (/(花|flower)/.test(lower)) {
        await addSketch("star", "center", "small", "#FFB7C5", undefined, false);
      }
      if (/(猫|兔子|房子|boat|船)/.test(lower)) {
        await addSketch("rect", "center", "medium", "#1A1A1A", undefined, false);
      }
      if (!created.length) {
        await addSketch("text", "center", "medium", "#1A1A1A", "场景草图", true);
      }
      return created;
    };

    const undo = () => {
      if (historyIndexRef.current <= 0) return;
      historyIndexRef.current -= 1;
      const nextShapes = historyRef.current[historyIndexRef.current];
      syncShapes(nextShapes);
      syncHistoryFlags(historyIndexRef.current > 0, true);
      onSaveState?.(nextShapes);
    };

    const redo = () => {
      if (historyIndexRef.current >= historyRef.current.length - 1) return;
      historyIndexRef.current += 1;
      const nextShapes = historyRef.current[historyIndexRef.current];
      syncShapes(nextShapes);
      syncHistoryFlags(true, historyIndexRef.current < historyRef.current.length - 1);
      onSaveState?.(nextShapes);
    };

    const clear = () => {
      pushHistory([]);
    };

    const exportImage = () => {
      const canvas = canvasRef.current;
      return canvas ? canvas.toDataURL("image/png") : "";
    };

    const getHistoryStatus = () => ({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1,
    });

    const setShapesData = (nextShapes: CanvasShape[]) => {
      const normalized = nextShapes.map(withDefaults);
      historyRef.current = [normalized];
      historyIndexRef.current = 0;
      syncShapes(normalized);
      syncHistoryFlags(false, false);
    };

    const getShapesData = () => shapesRef.current.map(withDefaults);

    useImperativeHandle(ref, () => ({
      addShape,
      createSceneSketch,
      undo,
      redo,
      clear,
      exportImage,
      getHistoryStatus,
      setShapesData,
      getShapesData,
    }));

    return (
      <div
        ref={containerRef}
        className="w-full h-full relative border border-border-custom rounded-2xl bg-white shadow-inner overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="block w-full h-full cursor-default"
          role="img"
          aria-label="语音创作画布。您说的绘图命令将在此处渲染。"
        />
      </div>
    );
  },
);

CanvasBoard.displayName = "CanvasBoard";
export default CanvasBoard;
