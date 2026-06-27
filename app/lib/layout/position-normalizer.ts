import type { DrawInstruction, Shape } from "../draw-schema";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  getShapeBounds,
  overlapRatio,
  translateShape,
} from "./shape-bounds";

export interface LayoutContext {
  shapes?: Shape[];
  backgroundColor?: string;
}

const SKY_LABEL_RE =
  /太阳|月亮|云|星星|彩虹|天空|鸟|燕子|鹰|蝴蝶|蜻蜓|气球|风筝|飞机/;
const GROUND_LABEL_RE =
  /草地|地面|路|花|树干|房子|小屋|树|动物|兔子|猫|狗|熊|狐狸|鹿|松鼠|老鼠|青蛙|鸭子|小鸡|小猪|小羊|牛|马|羊|鸡|鸭|鹅|猪|狮子|老虎|大象|猴子|熊猫|企鹅|恐龙|乌龟|蛇|蜘蛛|蚂蚁|虫子|蜗牛|刺猬|仓鼠|鼹鼠|人|小孩|男孩|女孩|雪人|蘑菇|石头|栅栏|篱笆|桥|凳子|椅子|桌子|秋千|滑梯/;
const WATER_LABEL_RE =
  /河|湖|海|鱼|船|鲸|鲨|海豚|水母|海星|贝壳|螃蟹|虾|章鱼|珊瑚|波浪|水花|喷泉/;
const HOUSE_LABEL_RE = /房子|小屋/;
const TREE_LABEL_RE = /树/;
const SUN_LABEL_RE = /太阳/;
const MOON_LABEL_RE = /月亮/;
const CLOUD_LABEL_RE = /云/;
const BIRD_LABEL_RE = /鸟|燕子|鹰|蝴蝶|蜻蜓/;

const EXPANDED_COMPONENT_RE =
  /光晕|圆盘|光芒|云左|云中|云右|墙体|屋顶|门|窗户|树干|树冠|树枝|树根/;

const COMPONENT_SUFFIXES = [
  "身体",
  "头部",
  "头",
  "耳朵",
  "眼睛",
  "鼻子",
  "嘴巴",
  "腿",
  "脚掌",
  "脚",
  "尾巴",
  "翅膀",
  "角",
  "手臂",
  "手掌",
  "手",
  "躯干",
  "脖子",
  "肚子",
  "背部",
  "胸部",
  "前腿",
  "后腿",
  "左腿",
  "右腿",
  "左眼",
  "右眼",
  "左耳",
  "右耳",
  "左爪",
  "右爪",
  "左翅",
  "右翅",
  "胡须",
  "眉毛",
  "屋顶",
  "墙体",
  "门",
  "窗户",
  "窗",
  "树冠",
  "树干",
  "树枝",
  "树根",
  "光晕",
  "圆盘",
  "光芒",
  "云左",
  "云中",
  "云右",
];

type SemanticZone = "sky" | "ground" | "water" | "text" | "generic";

function getLabel(shape: Shape): string {
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

function isBackgroundStrip(shape: Shape): boolean {
  if (shape.type !== "rectangle") return false;
  const width = shape.width ?? 0;
  const height = shape.height ?? 0;
  return width > 400 || height > 150;
}

function isExpandedComponent(shape: Shape): boolean {
  return EXPANDED_COMPONENT_RE.test(getLabel(shape));
}

function hasComponentSuffix(label: string): boolean {
  if (!label) return false;
  for (const suffix of COMPONENT_SUFFIXES) {
    if (label.endsWith(suffix)) return true;
  }
  return false;
}

function extractGroupKey(label: string): string {
  if (!label) return "";
  let key = label.replace(/\d+$/, "");
  for (const suffix of COMPONENT_SUFFIXES) {
    if (key.endsWith(suffix)) {
      key = key.slice(0, -suffix.length);
      return key || label;
    }
  }
  return key || label;
}

interface ShapeGroup {
  key: string;
  indices: number[];
  centroid: { x: number; y: number };
  zone: SemanticZone;
  isBackground: boolean;
  isExpanded: boolean;
  isComposite: boolean;
  label: string;
}

function buildGroups(shapes: Shape[]): ShapeGroup[] {
  const groupMap = new Map<string, ShapeGroup>();

  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    const label = getLabel(shape);
    let key: string;

    if (isExpandedComponent(shape)) {
      key = `__exp_${i}`;
    } else if (isBackgroundStrip(shape)) {
      key = `__bg_${i}`;
    } else {
      key = extractGroupKey(label) || `__anon_${i}`;
    }

    if (!groupMap.has(key)) {
      const isComposite = hasComponentSuffix(label);
      groupMap.set(key, {
        key,
        indices: [],
        centroid: { x: 0, y: 0 },
        zone: inferZone(shape),
        isBackground: isBackgroundStrip(shape),
        isExpanded: isExpandedComponent(shape),
        isComposite,
        label,
      });
    }
    groupMap.get(key)!.indices.push(i);
  }

  for (const group of groupMap.values()) {
    let sumX = 0;
    let sumY = 0;
    for (const idx of group.indices) {
      const bounds = getShapeBounds(shapes[idx]);
      sumX += bounds.cx;
      sumY += bounds.cy;
    }
    group.centroid = {
      x: sumX / group.indices.length,
      y: sumY / group.indices.length,
    };
  }

  return Array.from(groupMap.values());
}

function distributeInRange(
  index: number,
  count: number,
  rangeStart: number,
  rangeEnd: number,
  padding: number = 30,
): number {
  if (count <= 1) return (rangeStart + rangeEnd) / 2;
  const available = rangeEnd - rangeStart - padding * 2;
  return rangeStart + padding + (available * index) / (count - 1);
}

function clampShapeSize(shape: Shape): Shape {
  const MAX_RADIUS = 90;
  const MAX_RX = 90;
  const MAX_RY = 70;
  const MAX_WIDTH = 300;
  const MAX_HEIGHT = 200;

  switch (shape.type) {
    case "circle": {
      const r = shape.radius ?? 50;
      if (r > MAX_RADIUS) return { ...shape, radius: MAX_RADIUS };
      return shape;
    }
    case "ellipse": {
      const rx = shape.rx ?? 50;
      const ry = shape.ry ?? 30;
      if (rx > MAX_RX || ry > MAX_RY) {
        return { ...shape, rx: Math.min(rx, MAX_RX), ry: Math.min(ry, MAX_RY) };
      }
      return shape;
    }
    case "rectangle":
    case "triangle": {
      const w = shape.width ?? 100;
      const h = shape.height ?? 100;
      if (w > MAX_WIDTH || h > MAX_HEIGHT) {
        return {
          ...shape,
          width: Math.min(w, MAX_WIDTH),
          height: Math.min(h, MAX_HEIGHT),
        };
      }
      return shape;
    }
    default:
      return shape;
  }
}

function getGroupBounds(shapes: Shape[], group: ShapeGroup) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const idx of group.indices) {
    const b = getShapeBounds(shapes[idx]);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    cx: minX + width / 2,
    cy: minY + height / 2,
  };
}

function isGroupOnCanvas(group: ShapeGroup, shapes: Shape[]): boolean {
  const bounds = getGroupBounds(shapes, group);
  const margin = 40;
  return (
    bounds.cx > margin &&
    bounds.cx < CANVAS_WIDTH - margin &&
    bounds.cy > margin &&
    bounds.cy < CANVAS_HEIGHT - margin
  );
}

function isGroupInCorrectZone(group: ShapeGroup, shapes: Shape[]): boolean {
  const bounds = getGroupBounds(shapes, group);
  const zone = group.zone;
  if (zone === "sky") {
    return bounds.cy < CANVAS_HEIGHT * 0.45;
  }
  if (zone === "ground") {
    return bounds.cy > CANVAS_HEIGHT * 0.35;
  }
  if (zone === "water") {
    return bounds.cy > CANVAS_HEIGHT * 0.4;
  }
  return true;
}

function computeGroupTarget(
  group: ShapeGroup,
  zoneIndex: number,
  zoneCount: number,
  shapes: Shape[],
): { x: number; y: number } | null {
  const zone = group.zone;
  const label = group.label;
  const cx = group.centroid.x;
  const cy = group.centroid.y;

  if (
    group.isComposite &&
    isGroupOnCanvas(group, shapes) &&
    isGroupInCorrectZone(group, shapes)
  ) {
    return null;
  }

  if (zone === "sky") {
    if (SUN_LABEL_RE.test(label)) {
      return { x: Math.max(60, Math.min(420, cx)), y: 55 };
    }
    if (MOON_LABEL_RE.test(label)) {
      return { x: Math.max(60, Math.min(420, cx)), y: 60 };
    }
    if (CLOUD_LABEL_RE.test(label)) {
      const x = distributeInRange(zoneIndex, zoneCount, 60, 420);
      const y = 40 + (zoneIndex % 3) * 18;
      return { x, y };
    }
    if (BIRD_LABEL_RE.test(label)) {
      const x = distributeInRange(zoneIndex, zoneCount, 70, 410);
      const y = 50 + (zoneIndex % 3) * 20;
      return { x, y };
    }
    const x = distributeInRange(zoneIndex, zoneCount, 70, 410);
    const y = Math.min(110, Math.max(30, cy));
    return { x, y };
  }

  if (zone === "ground") {
    if (HOUSE_LABEL_RE.test(label)) {
      return { x: Math.max(100, Math.min(380, cx)), y: 245 };
    }
    if (TREE_LABEL_RE.test(label)) {
      const x = distributeInRange(zoneIndex, zoneCount, 60, 420);
      return { x, y: 215 };
    }
    if (!group.isBackground) {
      const x = distributeInRange(zoneIndex, zoneCount, 60, 420);
      const y = Math.min(255, Math.max(210, cy));
      return { x, y };
    }
    return { x: cx, y: cy };
  }

  if (zone === "water") {
    const x = distributeInRange(zoneIndex, zoneCount, 70, 410);
    const y = Math.min(270, Math.max(200, cy));
    return { x, y };
  }

  if (zone === "text") {
    return { x: 240, y: 320 };
  }

  const x = distributeInRange(zoneIndex, zoneCount, 60, 420);
  const y = Math.min(255, Math.max(210, cy));
  return { x, y };
}

function nudgeGroupAway(
  shapes: Shape[],
  group: ShapeGroup,
  blockerGroup: ShapeGroup,
  offset: { dx: number; dy: number },
): { dx: number; dy: number } {
  const gBounds = getGroupBounds(shapes, group);
  const bBounds = getGroupBounds(shapes, blockerGroup);
  const currentOverlap = overlapRatio(
    {
      minX: gBounds.minX + offset.dx,
      minY: gBounds.minY + offset.dy,
      maxX: gBounds.maxX + offset.dx,
      maxY: gBounds.maxY + offset.dy,
      width: gBounds.width,
      height: gBounds.height,
      cx: (gBounds.minX + gBounds.maxX) / 2 + offset.dx,
      cy: (gBounds.minY + gBounds.maxY) / 2 + offset.dy,
    },
    bBounds,
  );

  if (currentOverlap <= 0.3) return offset;

  const directions: Array<[number, number]> = [
    [40, 0],
    [-40, 0],
    [0, -40],
    [0, 40],
    [30, -30],
    [-30, -30],
    [30, 30],
    [-30, 30],
  ];

  let bestOffset = offset;
  let bestOverlap = currentOverlap;

  for (const [dxStep, dyStep] of directions) {
    const candidate = { dx: offset.dx + dxStep, dy: offset.dy + dyStep };
    const candidateBounds = {
      minX: gBounds.minX + candidate.dx,
      minY: gBounds.minY + candidate.dy,
      maxX: gBounds.maxX + candidate.dx,
      maxY: gBounds.maxY + candidate.dy,
      width: gBounds.width,
      height: gBounds.height,
      cx: (gBounds.minX + gBounds.maxX) / 2 + candidate.dx,
      cy: (gBounds.minY + gBounds.maxY) / 2 + candidate.dy,
    };

    if (
      candidateBounds.minX < 10 ||
      candidateBounds.maxX > CANVAS_WIDTH - 10 ||
      candidateBounds.minY < 10 ||
      candidateBounds.maxY > CANVAS_HEIGHT - 10
    ) {
      continue;
    }

    const overlap = overlapRatio(candidateBounds, bBounds);
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestOffset = candidate;
    }
    if (overlap <= 0.3) return candidate;
  }

  return bestOffset;
}

export function normalizeInstructionLayout(
  instruction: DrawInstruction,
  context?: LayoutContext,
): DrawInstruction {
  const shapes = instruction.shapes.map(clampShapeSize);

  const groups = buildGroups(shapes);

  const zoneGroupIndices: Record<string, number[]> = {};
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    if (group.isBackground || group.isExpanded) continue;
    const zone = group.zone;
    if (!zoneGroupIndices[zone]) zoneGroupIndices[zone] = [];
    zoneGroupIndices[zone].push(gi);
  }

  const groupOffsets: Map<number, { dx: number; dy: number }> = new Map();

  for (const zone of Object.keys(zoneGroupIndices)) {
    const indices = zoneGroupIndices[zone];
    for (let i = 0; i < indices.length; i++) {
      const gi = indices[i];
      const group = groups[gi];
      const target = computeGroupTarget(group, i, indices.length, shapes);
      if (target === null) {
        groupOffsets.set(gi, { dx: 0, dy: 0 });
      } else {
        const dx = target.x - group.centroid.x;
        const dy = target.y - group.centroid.y;
        groupOffsets.set(gi, { dx, dy });
      }
    }
  }

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    if (!group.isExpanded) continue;

    let bestParentGi = -1;
    let bestDist = Infinity;
    for (let pj = 0; pj < groups.length; pj++) {
      const parent = groups[pj];
      if (parent.isExpanded || parent.isBackground) continue;
      if (parent.zone !== group.zone) continue;
      if (!groupOffsets.has(pj)) continue;
      const dist = Math.hypot(
        parent.centroid.x - group.centroid.x,
        parent.centroid.y - group.centroid.y,
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestParentGi = pj;
      }
    }
    if (bestParentGi >= 0 && bestDist < 300) {
      groupOffsets.set(gi, groupOffsets.get(bestParentGi)!);
    } else {
      groupOffsets.set(gi, { dx: 0, dy: 0 });
    }
  }

  const distributableGroups = groups.filter(
    (g) => !g.isBackground && groupOffsets.has(groups.indexOf(g)),
  );
  const resolvedOffsets: Map<number, { dx: number; dy: number }> = new Map();

  for (const group of distributableGroups) {
    const gi = groups.indexOf(group);
    let offset = groupOffsets.get(gi) || { dx: 0, dy: 0 };

    for (const blocker of distributableGroups) {
      if (blocker === group) continue;
      const bj = groups.indexOf(blocker);
      if (!resolvedOffsets.has(bj)) continue;

      offset = nudgeGroupAway(shapes, group, blocker, offset);
    }

    resolvedOffsets.set(gi, offset);
  }

  for (const [gi, offset] of resolvedOffsets) {
    groupOffsets.set(gi, offset);
  }

  const result: Shape[] = [...shapes];
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const offset = groupOffsets.get(gi);
    if (!offset) continue;
    if (offset.dx === 0 && offset.dy === 0) continue;
    for (const idx of group.indices) {
      result[idx] = translateShape(result[idx], offset.dx, offset.dy);
    }
  }

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const gBounds = getGroupBounds(result, group);
    let dx = 0;
    let dy = 0;
    if (gBounds.minX < 16) dx = 16 - gBounds.minX;
    if (gBounds.maxX > CANVAS_WIDTH - 16) dx = CANVAS_WIDTH - 16 - gBounds.maxX;
    if (gBounds.minY < 16) dy = 16 - gBounds.minY;
    if (gBounds.maxY > CANVAS_HEIGHT - 16)
      dy = CANVAS_HEIGHT - 16 - gBounds.maxY;
    if (dx !== 0 || dy !== 0) {
      for (const idx of group.indices) {
        result[idx] = translateShape(result[idx], dx, dy);
      }
    }
  }

  return {
    ...instruction,
    shapes: result,
  };
}
