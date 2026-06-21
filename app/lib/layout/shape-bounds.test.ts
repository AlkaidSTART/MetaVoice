import { describe, expect, it } from "vitest";

import type { Shape } from "../draw-schema";
import { getShapeBounds, translateShape } from "./shape-bounds";

describe("shape-bounds", () => {
  it("computes circle bounds from center anchor", () => {
    const shape: Shape = {
      type: "circle",
      x: 100,
      y: 120,
      anchor: "center",
      radius: 30,
      fillColor: "#FFD54F",
      z: 1,
    };

    expect(getShapeBounds(shape)).toEqual({
      minX: 70,
      minY: 90,
      maxX: 130,
      maxY: 150,
      width: 60,
      height: 60,
      cx: 100,
      cy: 120,
    });
  });

  it("computes rectangle bounds from top-left anchor", () => {
    const shape: Shape = {
      type: "rectangle",
      x: 20,
      y: 40,
      anchor: "top-left",
      width: 200,
      height: 80,
      fillColor: "#FFE0B2",
      z: 1,
    };

    expect(getShapeBounds(shape)).toEqual({
      minX: 20,
      minY: 40,
      maxX: 220,
      maxY: 120,
      width: 200,
      height: 80,
      cx: 120,
      cy: 80,
    });
  });

  it("translates line endpoint and origin together", () => {
    const shape: Shape = {
      type: "line",
      x: 10,
      y: 20,
      x2: 70,
      y2: 90,
      anchor: "top-left",
      strokeColor: "#1A1A1A",
      z: 1,
    };

    expect(translateShape(shape, 5, -10)).toMatchObject({
      x: 15,
      y: 10,
      x2: 75,
      y2: 80,
    });
  });
});
