import { describe, expect, it } from "vitest";

import { drawInstructionSchema } from "../../lib/draw-schema";
import { expandIllustrationComponents } from "../../lib/layout/illustration-expander";
import { normalizeInstructionLayout } from "../../lib/layout/position-normalizer";
import { getShapeBounds } from "../../lib/layout/shape-bounds";
import { normalizeInstructionPayload } from "./route";

describe("normalizeInstructionPayload", () => {
  it("fills polygon x/y from point coordinates", () => {
    const normalized = normalizeInstructionPayload({
      backgroundColor: "#FFFFFF",
      shapes: [
        {
          type: "polygon",
          points: [360, 400, 480, 300, 600, 400],
          fillColor: "#EF9A9A",
          strokeColor: "#D87A7A",
          strokeWidth: 3,
          anchor: "top-left",
          z: 2,
        },
      ],
    });

    const parsed = drawInstructionSchema.parse(normalized);
    expect(parsed.shapes[0].x).toBe(480);
    expect(parsed.shapes[0].y).toBeCloseTo(366.6666666667);
  });

  it("fills path x/y from segment coordinates", () => {
    const normalized = normalizeInstructionPayload({
      backgroundColor: "#FFFFFF",
      shapes: [
        {
          type: "path",
          segments: [
            { cmd: "M", x: 120, y: 120 },
            { cmd: "Q", x1: 180, y1: 60, x: 240, y: 120 },
          ],
          strokeColor: "#000000",
          strokeWidth: 4,
          closed: false,
          anchor: "top-left",
          z: 1,
        },
      ],
    });

    const parsed = drawInstructionSchema.parse(normalized);
    expect(parsed.shapes[0].x).toBe(180);
    expect(parsed.shapes[0].y).toBe(100);
  });

  it("falls back to canvas center for text without x/y", () => {
    const normalized = normalizeInstructionPayload({
      backgroundColor: "#FFFFFF",
      shapes: [
        {
          type: "text",
          text: "你好",
          fontSize: 24,
          fillColor: "#1A1A1A",
          anchor: "top-left",
          z: 3,
        },
      ],
    });

    const parsed = drawInstructionSchema.parse(normalized);
    expect(parsed.shapes[0].x).toBe(480);
    expect(parsed.shapes[0].y).toBe(360);
  });

  it("normalizes parsed instruction layout before returning to callers", () => {
    const parsed = drawInstructionSchema.parse(
      normalizeInstructionPayload({
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
      }),
    );

    const normalized = normalizeInstructionLayout(parsed);
    const bounds = getShapeBounds(normalized.shapes[0]);

    expect(bounds.maxX).toBeLessThanOrEqual(936);
    expect(bounds.minY).toBeGreaterThanOrEqual(24);
  });

  it("expands known child-friendly subjects into richer component groups", () => {
    const parsed = drawInstructionSchema.parse(
      normalizeInstructionPayload({
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
      }),
    );

    const result = expandIllustrationComponents(parsed);
    expect(result.shapes.length).toBeGreaterThan(1);
    expect(result.shapes.some((shape) => shape.label?.includes("屋顶"))).toBe(true);
  });
});
