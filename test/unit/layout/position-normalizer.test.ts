import { describe, expect, it } from "vitest";

import type { DrawInstruction } from "@lib/draw-schema";
import { normalizeInstructionLayout } from "@lib/layout/position-normalizer";
import { getShapeBounds } from "@lib/layout/shape-bounds";

describe("normalizeInstructionLayout", () => {
  it("clamps out-of-bounds shapes into the canvas", () => {
    const result = normalizeInstructionLayout({
      backgroundColor: "#FFFFFF",
      shapes: [
        {
          type: "circle",
          label: "太阳",
          x: 940,
          y: 20,
          anchor: "center",
          radius: 90,
          fillColor: "#FFD54F",
          z: 1,
        },
      ],
    });

    const bounds = getShapeBounds(result.shapes[0]);
    expect(bounds.maxX).toBeLessThanOrEqual(936);
    expect(bounds.minY).toBeGreaterThanOrEqual(24);
  });

  it("places sky objects in the upper safe region", () => {
    const result = normalizeInstructionLayout({
      backgroundColor: "#FFFFFF",
      shapes: [
        {
          type: "circle",
          label: "太阳",
          x: 480,
          y: 600,
          anchor: "center",
          radius: 55,
          fillColor: "#FFD54F",
          z: 1,
        },
      ],
    });

    expect(result.shapes[0].y).toBeLessThan(260);
    expect(result.shapes[0].x).toBeGreaterThan(650);
  });

  it("nudges overlapping major objects apart", () => {
    const instruction: DrawInstruction = {
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
        {
          type: "circle",
          label: "树",
          x: 480,
          y: 470,
          anchor: "center",
          radius: 80,
          fillColor: "#66BB6A",
          z: 2,
        },
      ],
    };

    const result = normalizeInstructionLayout(instruction);
    const house = getShapeBounds(result.shapes[0]);
    const tree = getShapeBounds(result.shapes[1]);

    expect(Math.abs(house.cx - tree.cx)).toBeGreaterThan(120);
  });

  it("preserves append context and avoids covering existing subject", () => {
    const result = normalizeInstructionLayout(
      {
        backgroundColor: "#FFFFFF",
        shapes: [
          {
            type: "circle",
            label: "小鸟",
            x: 480,
            y: 380,
            anchor: "center",
            radius: 70,
            fillColor: "#90CAF9",
            z: 3,
          },
        ],
      },
      {
        shapes: [
          {
            type: "rectangle",
            label: "房子",
            x: 360,
            y: 330,
            anchor: "top-left",
            width: 240,
            height: 180,
            fillColor: "#FFE0B2",
            z: 1,
          },
        ],
      },
    );

    const bird = getShapeBounds(result.shapes[0]);
    const existingHouse = getShapeBounds({
      type: "rectangle",
      label: "房子",
      x: 360,
      y: 330,
      anchor: "top-left",
      width: 240,
      height: 180,
      fillColor: "#FFE0B2",
      z: 1,
    });

    expect(Math.abs(bird.cx - existingHouse.cx)).toBeGreaterThan(120);
  });
});
