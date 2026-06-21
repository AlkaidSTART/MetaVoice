import type { DrawInstruction, Shape } from "../draw-schema";

const SUN_RE = /太阳/;
const CLOUD_RE = /云/;
const HOUSE_RE = /房子|小屋/;
const TREE_RE = /树/;

function withDefaults(shape: Shape): Shape {
  return {
    ...shape,
    anchor: shape.anchor ?? "center",
    z: shape.z ?? 0,
  };
}

function makeSun(shape: Shape): Shape[] {
  const base = withDefaults(shape);
  const radius = base.radius ?? 55;
  const x = base.x;
  const y = base.y;
  const z = base.z ?? 0;

  return [
    {
      ...base,
      radius: radius * 1.45,
      fillColor: "#FFE08288",
      strokeColor: "#FFD54F",
      strokeWidth: 1,
      glow: { color: "#FFD54F", blur: 26 },
      opacity: 0.55,
      label: "太阳光晕",
      z,
    },
    {
      type: "circle",
      label: "太阳圆盘",
      x,
      y,
      anchor: "center",
      radius,
      fillColor: base.fillColor || "#FFD54F",
      strokeColor: "#FFB300",
      strokeWidth: 3,
      gradient: {
        type: "radial",
        stops: [
          { offset: 0, color: "#FFF8C6" },
          { offset: 0.65, color: "#FFD54F" },
          { offset: 1, color: "#FFB300" },
        ],
      },
      highlight: { x: -0.3, y: -0.35, radius: Math.max(8, radius * 0.18), opacity: 0.55 },
      glow: { color: "#FFD54F", blur: 18 },
      z: z + 1,
    },
    ...Array.from({ length: 8 }, (_, index) => {
      const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / 8;
      const inner = radius + 6;
      const outer = radius + 28;
      return {
        type: "line" as const,
        label: `太阳光芒${index + 1}`,
        x: x + Math.cos(angle) * inner,
        y: y + Math.sin(angle) * inner,
        x2: x + Math.cos(angle) * outer,
        y2: y + Math.sin(angle) * outer,
        anchor: "top-left" as const,
        strokeColor: "#FFC107",
        strokeWidth: 4,
        opacity: 0.9,
        z: z + 2,
      };
    }),
  ];
}

function makeCloud(shape: Shape): Shape[] {
  const base = withDefaults(shape);
  const rx = base.rx ?? Math.max(40, (base.width ?? 120) / 2);
  const ry = base.ry ?? Math.max(22, rx * 0.48);
  const x = base.x;
  const y = base.y;
  const z = base.z ?? 0;

  return [
    {
      type: "ellipse",
      label: "云左",
      x: x - rx * 0.42,
      y: y + ry * 0.08,
      anchor: "center",
      rx: rx * 0.72,
      ry: ry * 0.78,
      fillColor: "#FFFFFF",
      strokeColor: "#E3F2FD",
      strokeWidth: 2,
      opacity: 0.92,
      z,
    },
    {
      type: "ellipse",
      label: "云中",
      x,
      y: y - ry * 0.12,
      anchor: "center",
      rx: rx * 0.84,
      ry: ry,
      fillColor: "#FFFFFF",
      strokeColor: "#E3F2FD",
      strokeWidth: 2,
      opacity: 0.95,
      z: z + 1,
    },
    {
      type: "ellipse",
      label: "云右",
      x: x + rx * 0.42,
      y: y + ry * 0.1,
      anchor: "center",
      rx: rx * 0.68,
      ry: ry * 0.74,
      fillColor: "#FFFFFF",
      strokeColor: "#E3F2FD",
      strokeWidth: 2,
      opacity: 0.92,
      z,
    },
  ];
}

function makeHouse(shape: Shape): Shape[] {
  const base = withDefaults(shape);
  const width = base.width ?? 240;
  const height = base.height ?? 150;
  const x = base.anchor === "center" ? base.x - width / 2 : base.x;
  const y = base.anchor === "center" ? base.y - height / 2 : base.y;
  const z = base.z ?? 0;
  const wallColor = base.fillColor || "#FFE0B2";

  return [
    {
      type: "rectangle",
      label: "房子墙体",
      x,
      y,
      anchor: "top-left",
      width,
      height,
      fillColor: wallColor,
      strokeColor: "#A1887F",
      strokeWidth: 3,
      z,
    },
    {
      type: "polygon",
      label: "房子屋顶",
      x: x + width / 2,
      y,
      anchor: "center",
      points: [x, y, x + width / 2, y - height * 0.62, x + width, y],
      fillColor: "#EF9A9A",
      strokeColor: "#D87A7A",
      strokeWidth: 3,
      z: z + 1,
    },
    {
      type: "rectangle",
      label: "房子门",
      x: x + width * 0.42,
      y: y + height * 0.48,
      anchor: "top-left",
      width: width * 0.16,
      height: height * 0.52,
      fillColor: "#8D6E63",
      strokeColor: "#6D4C41",
      strokeWidth: 2,
      z: z + 2,
    },
    {
      type: "rectangle",
      label: "房子窗户左",
      x: x + width * 0.12,
      y: y + height * 0.2,
      anchor: "top-left",
      width: width * 0.18,
      height: height * 0.2,
      fillColor: "#BBDEFB",
      strokeColor: "#FFFFFF",
      strokeWidth: 2,
      z: z + 2,
    },
    {
      type: "rectangle",
      label: "房子窗户右",
      x: x + width * 0.7,
      y: y + height * 0.2,
      anchor: "top-left",
      width: width * 0.18,
      height: height * 0.2,
      fillColor: "#BBDEFB",
      strokeColor: "#FFFFFF",
      strokeWidth: 2,
      z: z + 2,
    },
  ];
}

function makeTree(shape: Shape): Shape[] {
  const base = withDefaults(shape);
  const radius = base.radius ?? Math.max(55, (base.width ?? 160) / 2);
  const x = base.x;
  const y = base.y;
  const z = base.z ?? 0;
  const crownColor = base.fillColor || "#66BB6A";

  return [
    {
      type: "rectangle",
      label: "树干",
      x: x - radius * 0.18,
      y: y + radius * 0.45,
      anchor: "top-left",
      width: radius * 0.36,
      height: radius * 0.92,
      fillColor: "#8D6E63",
      strokeColor: "#6D4C41",
      strokeWidth: 2,
      z,
    },
    {
      type: "circle",
      label: "树冠左",
      x: x - radius * 0.42,
      y: y - radius * 0.05,
      anchor: "center",
      radius: radius * 0.56,
      fillColor: crownColor,
      strokeColor: "#4CAF50",
      strokeWidth: 2,
      z: z + 1,
    },
    {
      type: "circle",
      label: "树冠中",
      x,
      y: y - radius * 0.25,
      anchor: "center",
      radius: radius * 0.62,
      fillColor: crownColor,
      strokeColor: "#4CAF50",
      strokeWidth: 2,
      highlight: { x: -0.28, y: -0.22, radius: Math.max(8, radius * 0.16), opacity: 0.35 },
      z: z + 2,
    },
    {
      type: "circle",
      label: "树冠右",
      x: x + radius * 0.42,
      y: y - radius * 0.02,
      anchor: "center",
      radius: radius * 0.54,
      fillColor: crownColor,
      strokeColor: "#4CAF50",
      strokeWidth: 2,
      z: z + 1,
    },
  ];
}

function expandShape(shape: Shape): Shape[] {
  const label = shape.label || "";

  if (SUN_RE.test(label)) return makeSun(shape);
  if (CLOUD_RE.test(label)) return makeCloud(shape);
  if (HOUSE_RE.test(label)) return makeHouse(shape);
  if (TREE_RE.test(label)) return makeTree(shape);

  return [shape];
}

export function expandIllustrationComponents(instruction: DrawInstruction): DrawInstruction {
  return {
    ...instruction,
    shapes: instruction.shapes.flatMap(expandShape),
  };
}
