/**
 * 路径几何纯函数模块（v4 · 贝塞尔弧线 + 手绘风格）
 *
 * 与 React/Canvas 解耦，参考 canvas-state.ts 的纯函数风格。
 * 渲染层（canvas/page.tsx）在以下四处复用：
 *   - drawShapePath：构建路径（含 sketch 抖动折线化）
 *   - drawProgressiveShape：按弧长进度截断绘制「生长中」预览
 *   - getBrushPositionAtProgress：画笔沿曲线轨迹定位
 *   - getShapeBounds：path 包围盒
 *
 * 设计要点：
 * - 所有随机性来自确定性种子（mulberry32），同一作品渲染/导出像素一致。
 * - 所有函数对退化输入（零长曲线、空 segments）有防御，不抛错、不除零。
 * - 坐标系与渲染层一致：左上角原点，x 向右、y 向下（480×360）。
 */

import type { Segment, Shape, SketchStyle } from "./draw-schema";

export interface Point {
  x: number;
  y: number;
}

/** 包围盒（左上角坐标系），与渲染层 getShapeBounds 返回结构一致 */
export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

/** sketch 抖动后的结果：新折线 + 沿弧长的线宽缩放系数（用于 ctx.lineWidth 脉动） */
export interface SketchResult {
  points: Point[];
  widthScale: number[];
}

// ─── 确定性伪随机（mulberry32）─────────────────────────────
/** 给定整数种子，返回 [0,1) 伪随机数生成器；同种子序列完全可复现 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 1D 平滑噪声：对伪随机序列做线性插值，避免抖动出现高频锯齿 */
function smoothNoise1d(rng: () => number, len: number): number[] {
  if (len <= 0) return [];
  const raw: number[] = [];
  for (let i = 0; i < Math.max(2, len); i++) raw.push(rng() * 2 - 1); // [-1,1]
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    // 在相邻两个噪声样本间线性插值，得到平滑的低频扰动
    const f = (i / Math.max(1, raw.length - 1)) * (raw.length - 1);
    const i0 = Math.floor(f);
    const i1 = Math.min(raw.length - 1, i0 + 1);
    const t = f - i0;
    out.push(raw[i0] * (1 - t) + raw[i1] * t);
  }
  return out;
}

// ─── 贝塞尔离散化 ─────────────────────────────────────────
function quadraticPoint(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function cubicPoint(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): Point {
  const u = 1 - t;
  return {
    x:
      u * u * u * p0.x +
      3 * u * u * t * p1.x +
      3 * u * t * t * p2.x +
      t * t * t * p3.x,
    y:
      u * u * u * p0.y +
      3 * u * u * t * p1.y +
      3 * u * t * t * p2.y +
      t * t * t * p3.y,
  };
}

/**
 * 把单个指令段离散化为折线点（不含起点 prev，仅本段产出的点）。
 * steps 控制贝塞尔的采样数；直线段产出 1 个终点。
 */
function flattenSegment(seg: Segment, prev: Point, steps: number): Point[] {
  switch (seg.cmd) {
    case "M":
    case "L":
      return [{ x: seg.x ?? prev.x, y: seg.y ?? prev.y }];
    case "Q": {
      const c1: Point = { x: seg.x1 ?? prev.x, y: seg.y1 ?? prev.y };
      const end: Point = { x: seg.x ?? prev.x, y: seg.y ?? prev.y };
      const out: Point[] = [];
      const n = Math.max(2, steps);
      for (let i = 1; i <= n; i++) {
        out.push(quadraticPoint(prev, c1, end, i / n));
      }
      return out;
    }
    case "C": {
      const c1: Point = { x: seg.x1 ?? prev.x, y: seg.y1 ?? prev.y };
      const c2: Point = { x: seg.x2 ?? prev.x, y: seg.y2 ?? prev.y };
      const end: Point = { x: seg.x ?? prev.x, y: seg.y ?? prev.y };
      const out: Point[] = [];
      const n = Math.max(2, steps);
      for (let i = 1; i <= n; i++) {
        out.push(cubicPoint(prev, c1, c2, end, i / n));
      }
      return out;
    }
    case "Z":
      return []; // Z 闭合在调用方处理
    default:
      return [];
  }
}

/**
 * 把 path 的 segments 离散化为折线点序列（含起点）。
 * 返回的点序列即曲线轮廓，可用于：sketch 抖动、弧长动画、包围盒。
 *
 * @param closed 是否闭合（true 时末尾回到起点，形成闭合轮廓）
 * @param stepsPerSeg 每个贝塞尔段的采样数，默认 16
 */
export function flattenPathSegments(
  segments: Segment[],
  closed: boolean,
  stepsPerSeg = 16,
): Point[] {
  if (!segments || segments.length === 0) return [];
  let start: Point | null = null;
  let cur: Point | null = null;
  const pts: Point[] = [];

  for (const seg of segments) {
    if (seg.cmd === "M") {
      cur = { x: seg.x ?? 0, y: seg.y ?? 0 };
      if (start === null) start = { ...cur };
      pts.push(cur);
    } else if (seg.cmd === "Z") {
      if (closed && start) {
        // 闭合：补一条回到起点的线段（采样若干点让 sketch 抖动均匀）
        if (cur && start) {
          const n = 8;
          for (let i = 1; i <= n; i++) {
            const t = i / n;
            pts.push({
              x: cur.x + (start.x - cur.x) * t,
              y: cur.y + (start.y - cur.y) * t,
            });
          }
        }
        cur = start;
      }
    } else {
      if (!cur) {
        // 首段非 M：以 (0,0) 兜底起点，避免 prev 为 null
        cur = { x: 0, y: 0 };
        start = { ...cur };
        pts.push(cur);
      }
      const sub = flattenSegment(seg, cur, stepsPerSeg);
      for (const p of sub) pts.push(p);
      cur = sub.length > 0 ? sub[sub.length - 1] : cur;
    }
  }
  return pts;
}

// ─── 弧长定位（画笔沿曲线轨迹）────────────────────────────
/** 计算折线各段累计弧长，返回 [0..total] 单调递增数组（长度 = points.length-1） */
function cumulativeLengths(points: Point[]): { cum: number[]; total: number } {
  const cum: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
    cum.push(total);
  }
  return { cum, total };
}

/**
 * 给定折线与目标弧长，返回该弧长处的点（线性插值）。
 * dist 越界则 clamp 到首/末点。points 为空返回 {0,0}。
 */
export function pointAtArcLength(points: Point[], dist: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0] };
  const { cum, total } = cumulativeLengths(points);
  if (total <= 0) return { ...points[0] };
  if (dist <= 0) return { ...points[0] };
  if (dist >= total) return { ...points[points.length - 1] };

  // 二分查找所在分段
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < dist) lo = mid + 1;
    else hi = mid;
  }
  const segIdx = Math.max(0, lo); // cum[segIdx] >= dist
  const segStart = segIdx === 0 ? 0 : cum[segIdx - 1];
  const segLen = cum[segIdx] - segStart;
  const t = segLen > 0 ? (dist - segStart) / segLen : 0;
  const p0 = points[segIdx];
  const p1 = points[segIdx + 1];
  return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
}

/** 折线总弧长（points.length<2 返回 0） */
export function pathArcLength(points: Point[]): number {
  return cumulativeLengths(points).total;
}

// ─── 任意形状轮廓采样（统一 sketch 抖动入口）──────────────
/**
 * 把任意形状的「轮廓」离散化为折线点序列（顺时针闭合或开放）。
 * 用于给所有形状统一施加 sketch 手绘抖动（不只 path）。
 *
 * - circle/ellipse：均匀采样 48 点，闭合
 * - rectangle：4 角点（可加细分点让抖动更自然），闭合
 * - triangle：3 角点，闭合
 * - polygon：按 points 顶点，闭合
 * - line：起点→终点，开放
 * - path：复用 flattenPathSegments
 * - text：返回空（文字不做 sketch 抖动，避免不可读）
 *
 * @param toTopLeftFn 调用方提供的 anchor→左上角转换函数（rect/triangle 需要）
 */
export function flattenShapeOutline(
  shape: Shape,
  toTopLeftFn: (s: Shape) => { x: number; y: number },
): { points: Point[]; closed: boolean } {
  switch (shape.type) {
    case "circle": {
      const r = Math.max(1, shape.radius || 50);
      const { x, y } = toTopLeftFn(shape);
      const cx = x + r;
      const cy = y + r;
      const pts: Point[] = [];
      const n = 48;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      return { points: pts, closed: true };
    }
    case "ellipse": {
      const rx = Math.max(1, shape.rx || 50);
      const ry = Math.max(1, shape.ry || 30);
      const { x, y } = toTopLeftFn(shape);
      const cx = x + rx;
      const cy = y + ry;
      const pts: Point[] = [];
      const n = 48;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
      }
      return { points: pts, closed: true };
    }
    case "rectangle": {
      const w = shape.width || 100;
      const h = shape.height || 100;
      const { x, y } = toTopLeftFn(shape);
      // 每边插 3 个细分点，让矩形的抖动不是「4 个尖角」而是柔顺曲线
      const sub = 3;
      const pts: Point[] = [];
      for (let i = 0; i <= sub; i++) pts.push({ x: x + (w * i) / sub, y }); // 上边
      for (let i = 1; i <= sub; i++)
        pts.push({ x: x + w, y: y + (h * i) / sub }); // 右边
      for (let i = 1; i <= sub; i++)
        pts.push({ x: x + w - (w * i) / sub, y: y + h }); // 下边
      for (let i = 1; i < sub; i++) pts.push({ x, y: y + h - (h * i) / sub }); // 左边
      return { points: pts, closed: true };
    }
    case "triangle": {
      const w = shape.width || 100;
      const h = shape.height || 100;
      const { x, y } = toTopLeftFn(shape);
      // 顶→右下→左下
      return {
        points: [
          { x: x + w / 2, y },
          { x: x + w, y: y + h },
          { x, y: y + h },
        ],
        closed: true,
      };
    }
    case "polygon": {
      const pts: Point[] = [];
      const raw = shape.points || [];
      for (let i = 0; i + 1 < raw.length; i += 2)
        pts.push({ x: raw[i], y: raw[i + 1] });
      return { points: pts, closed: true };
    }
    case "line": {
      const endX = shape.x2 ?? shape.x + 100;
      const endY = shape.y2 ?? shape.y;
      return {
        points: [
          { x: shape.x, y: shape.y },
          { x: endX, y: endY },
        ],
        closed: false,
      };
    }
    case "path": {
      const segs = shape.segments || [];
      const closed = shape.closed ?? false;
      return { points: flattenPathSegments(segs, closed), closed };
    }
    case "text":
    default:
      return { points: [], closed: false };
  }
}

// ─── path 包围盒 ─────────────────────────────────────────
/**
 * path 的包围盒：遍历所有指令段的端点与控制点取 min/max。
 * 闭合 path 的几何中心即包围盒中心。
 */
export function getPathBounds(shape: Shape): Bounds {
  const segs = shape.segments || [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const consider = (x?: number, y?: number) => {
    if (x == null || y == null) return;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const s of segs) {
    consider(s.x, s.y);
    consider(s.x1, s.y1);
    consider(s.x2, s.y2);
  }
  if (!isFinite(minX)) {
    // 空 segments：退化到锚点
    return { x: shape.x, y: shape.y, w: 0, h: 0, cx: shape.x, cy: shape.y };
  }
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

// ─── sketch 手绘抖动 ─────────────────────────────────────
/**
 * 对折线点施加种子化抖动 + 线宽脉动，模拟手绘。
 *
 * - 法向抖动：每个点沿「与相邻点的垂直方向」偏移 roughness × 像素。
 * - 线宽脉动：widthScale[i] ∈ [1-wobble*0.4, 1+wobble*0.4]，模拟笔压。
 * - 抖动用平滑噪声，避免锯齿；同 seed 完全可复现。
 *
 * roughness=0 时原样返回（widthScale 全 1），等价关闭 sketch。
 */
export function applySketchJitter(
  points: Point[],
  sketch: SketchStyle,
): SketchResult {
  const n = points.length;
  if (n === 0) return { points: [], widthScale: [] };
  if (n === 1) return { points: [{ ...points[0] }], widthScale: [1] };

  const rng = mulberry32(sketch.seed || 1);
  const amp = Math.max(0, sketch.roughness ?? 0.5);
  const wobble = Math.max(0, sketch.wobble ?? 0.3);

  if (amp === 0 && wobble === 0) {
    return {
      points: points.map((p) => ({ ...p })),
      widthScale: points.map(() => 1),
    };
  }

  // 两路平滑噪声（x/y 各一路），相位错开避免方向偏置
  const noiseX = smoothNoise1d(rng, n);
  const noiseY = smoothNoise1d(rng, n);

  const out: Point[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = points[i];
    out[i] = { x: p.x + noiseX[i] * amp, y: p.y + noiseY[i] * amp };
  }

  // 线宽脉动：基于第三路噪声，映射到 [1-0.4w, 1+0.4w]
  const widthScale: number[] = new Array(n);
  if (wobble > 0) {
    const noiseW = smoothNoise1d(rng, n);
    for (let i = 0; i < n; i++) {
      widthScale[i] = 1 + noiseW[i] * 0.4 * wobble;
    }
  } else {
    for (let i = 0; i < n; i++) widthScale[i] = 1;
  }

  return { points: out, widthScale };
}

/**
 * 把折线序列「分段 + 各段宽度」绘制到 ctx（手绘描边专用）。
 * 每两个相邻点之间用对应的平均线宽画一小段直线，
 * 这样线宽脉动才能逐段体现（ctx.lineWidth 不支持沿路径渐变）。
 *
 * @param close 是否在末端闭合回起点
 */
export function strokeJitteredPolyline(
  ctx: CanvasRenderingContext2D,
  pts: Point[],
  widthScale: number[],
  baseWidth: number,
  close: boolean,
): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  if (close) ctx.closePath();
  // 先按平均线宽描一遍主轮廓
  let avgW = 0;
  for (let i = 0; i < widthScale.length; i++) avgW += widthScale[i];
  avgW = (avgW / Math.max(1, widthScale.length)) * baseWidth;
  ctx.lineWidth = Math.max(0.5, avgW);
  ctx.stroke();

  // 若有显著线宽脉动（wobble>0），在粗的区段补描一次，强化笔触粗细
  const hasWobble = widthScale.some((w) => Math.abs(w - 1) > 0.05);
  if (!hasWobble) return;

  // 分段二次描边：仅对宽度 > 平均值的段加粗，模拟笔压加重
  ctx.beginPath();
  let drawing = false;
  for (let i = 1; i < pts.length; i++) {
    const w = (widthScale[i] + widthScale[i - 1]) / 2;
    if (w > 1) {
      if (!drawing) {
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        drawing = true;
      }
      ctx.lineTo(pts[i].x, pts[i].y);
    } else if (drawing) {
      ctx.stroke();
      ctx.beginPath();
      drawing = false;
    }
  }
  if (drawing) ctx.stroke();
}
