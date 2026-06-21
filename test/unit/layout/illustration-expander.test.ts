import { describe, expect, it } from "vitest";

import type { DrawInstruction } from "@lib/draw-schema";
import { expandIllustrationComponents } from "@lib/layout/illustration-expander";

describe("expandIllustrationComponents", () => {
  it("expands a sun into multiple child-friendly shapes", () => {
    const input: DrawInstruction = {
      backgroundColor: "#FFFFFF",
      shapes: [
        {
          type: "circle",
          label: "太阳",
          x: 800,
          y: 120,
          anchor: "center",
          radius: 55,
          fillColor: "#FFD54F",
          z: 1,
        },
      ],
    };

    const result = expandIllustrationComponents(input);
    expect(result.shapes.length).toBeGreaterThan(2);
    expect(result.shapes.some((shape) => shape.label?.includes("太阳光芒"))).toBe(true);
    expect(result.shapes.some((shape) => shape.glow)).toBe(true);
  });

  it("expands a cloud into a soft ellipse cluster", () => {
    const input: DrawInstruction = {
      backgroundColor: "#FFFFFF",
      shapes: [
        {
          type: "ellipse",
          label: "云",
          x: 260,
          y: 140,
          anchor: "center",
          rx: 60,
          ry: 30,
          fillColor: "#FFFFFF",
          z: 2,
        },
      ],
    };

    const result = expandIllustrationComponents(input);
    expect(result.shapes.length).toBeGreaterThanOrEqual(3);
    expect(result.shapes.every((shape) => shape.type === "ellipse")).toBe(true);
  });

  it("expands a house into wall, roof, door, and windows", () => {
    const input: DrawInstruction = {
      backgroundColor: "#FFFFFF",
      shapes: [
        {
          type: "rectangle",
          label: "房子",
          x: 360,
          y: 400,
          anchor: "top-left",
          width: 240,
          height: 150,
          fillColor: "#FFE0B2",
          z: 1,
        },
      ],
    };

    const result = expandIllustrationComponents(input);
    expect(result.shapes.length).toBeGreaterThanOrEqual(5);
    expect(result.shapes.some((shape) => shape.label?.includes("屋顶"))).toBe(true);
    expect(result.shapes.some((shape) => shape.label?.includes("窗户"))).toBe(true);
  });

  it("expands a tree into trunk and layered crown", () => {
    const input: DrawInstruction = {
      backgroundColor: "#FFFFFF",
      shapes: [
        {
          type: "circle",
          label: "树",
          x: 220,
          y: 410,
          anchor: "center",
          radius: 78,
          fillColor: "#66BB6A",
          z: 2,
        },
      ],
    };

    const result = expandIllustrationComponents(input);
    expect(result.shapes.length).toBeGreaterThanOrEqual(4);
    expect(result.shapes.some((shape) => shape.label?.includes("树干"))).toBe(true);
    expect(result.shapes.filter((shape) => shape.label?.includes("树冠")).length).toBeGreaterThanOrEqual(2);
  });

  it("leaves unrelated shapes untouched", () => {
    const input: DrawInstruction = {
      backgroundColor: "#FFFFFF",
      shapes: [
        {
          type: "circle",
          label: "球",
          x: 200,
          y: 200,
          anchor: "center",
          radius: 40,
          fillColor: "#FF8A80",
          z: 1,
        },
      ],
    };

    const result = expandIllustrationComponents(input);
    expect(result.shapes).toHaveLength(1);
    expect(result.shapes[0].label).toBe("球");
  });
});
