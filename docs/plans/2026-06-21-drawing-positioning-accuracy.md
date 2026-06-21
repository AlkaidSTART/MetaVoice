# Drawing Positioning Accuracy Implementation Plan

> **For Claude / Codex 5.3:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make voice drawing placement reliable: user phrases like "right top", "left side", "beside the house", and "in the sky" should consistently land in the expected canvas region without overflowing or severe overlap.

**Architecture:** Keep the existing LLM draw pipeline, but add a deterministic post-processing layer after `drawInstructionSchema.parse()` and before the instruction is returned or committed to canvas state. The LLM can still propose shapes, but final placement is normalized by code using semantic anchors, safe zones, bounds checks, and simple collision nudges.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod draw schema, native Canvas, Vitest. Do not add dependencies.

---

## Scope

This plan is only for **A: position accuracy**. Do not implement the illustration component library, image generation, or a full element editor here.

Current relevant files:

- `app/api/draw/route.ts`: LLM pipeline and `normalizeInstructionPayload`
- `app/lib/draw-schema.ts`: single source of truth for `Shape` / `DrawInstruction`
- `app/api/draw/prompts/shared.ts`: draw rules sent to the LLM
- `app/api/draw/prompts/coordinate.ts`: coordinate planning prompt
- `app/[locale]/lib/canvas-state.ts`: client state reducer, already supports ids and move helpers
- `app/api/draw/route.test.ts`: existing Vitest route helper tests

Acceptance targets:

- Shapes are clamped so their visible bounds stay inside the 960x720 canvas.
- Obvious semantic regions are stable: top, bottom, left, right, center, top-right, top-left, bottom-right, bottom-left.
- Major objects avoid severe overlap when they share similar generated coordinates.
- Existing append mode keeps new elements above prior z layers but avoids covering the existing subject when possible.
- Tests cover the deterministic layout functions and the API normalization integration.

## Task 1: Add Geometry Bounds Utilities

**Files:**

- Create: `app/lib/layout/shape-bounds.ts`
- Test: `app/lib/layout/shape-bounds.test.ts`

**Step 1: Write failing tests**

Create `app/lib/layout/shape-bounds.test.ts`:

```ts
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

    expect(getShapeBounds(shape)).toEqual({ minX: 70, minY: 90, maxX: 130, maxY: 150, width: 60, height: 60, cx: 100, cy: 120 });
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

    expect(getShapeBounds(shape)).toEqual({ minX: 20, minY: 40, maxX: 220, maxY: 120, width: 200, height: 80, cx: 120, cy: 80 });
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

    expect(translateShape(shape, 5, -10)).toMatchObject({ x: 15, y: 10, x2: 75, y2: 80 });
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- app/lib/layout/shape-bounds.test.ts
```

Expected: FAIL because `shape-bounds.ts` does not exist.

**Step 3: Implement geometry utilities**

Create `app/lib/layout/shape-bounds.ts`.

Requirements:

- Export `CANVAS_WIDTH = 960`, `CANVAS_HEIGHT = 720`.
- Export `type Bounds = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number; cx: number; cy: number }`.
- Export:
  - `getShapeBounds(shape: Shape): Bounds`
  - `translateShape(shape: Shape, dx: number, dy: number): Shape`
  - `clampShapeIntoCanvas(shape: Shape, padding?: number): Shape`
  - `overlapRatio(a: Bounds, b: Bounds): number`

Implementation notes:

- For `circle`, use `radius`, default 50.
- For `ellipse`, use `rx` / `ry`, default 60 / 40.
- For `rectangle` and `triangle`, use `width` / `height`, default 120 / 100.
- For `text`, estimate width as `text.length * fontSize * 0.65`, height as `fontSize * 1.2`; default font size 28.
- For `line`, bounds are min/max of `(x,y)` and `(x2,y2)`.
- For `polygon`, use `points`.
- For `path`, use all segment end/control coordinates.
- Respect `anchor` for rectangle-like shapes. For unsupported or ambiguous cases, fall back to center semantics.
- `translateShape` must update `x`, `y`, `x2`, `y2`, `points`, and `segments` when present.
- `clampShapeIntoCanvas` should compute the shape bounds and translate it enough to keep bounds inside `[padding, width-padding]` and `[padding, height-padding]`.
- Keep these functions pure and independent of React / Canvas APIs.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -- app/lib/layout/shape-bounds.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add app/lib/layout/shape-bounds.ts app/lib/layout/shape-bounds.test.ts
git commit -m "feat: add shape bounds utilities"
```

## Task 2: Add Deterministic Position Normalizer

**Files:**

- Create: `app/lib/layout/position-normalizer.ts`
- Test: `app/lib/layout/position-normalizer.test.ts`

**Step 1: Write failing tests**

Create `app/lib/layout/position-normalizer.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { DrawInstruction } from "../draw-schema";
import { normalizeInstructionLayout } from "./position-normalizer";
import { getShapeBounds } from "./shape-bounds";

describe("normalizeInstructionLayout", () => {
  it("clamps out-of-bounds shapes into the canvas", () => {
    const result = normalizeInstructionLayout({
      backgroundColor: "#FFFFFF",
      shapes: [
        { type: "circle", label: "太阳", x: 940, y: 20, anchor: "center", radius: 90, fillColor: "#FFD54F", z: 1 },
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
        { type: "circle", label: "太阳", x: 480, y: 600, anchor: "center", radius: 55, fillColor: "#FFD54F", z: 1 },
      ],
    });

    expect(result.shapes[0].y).toBeLessThan(260);
    expect(result.shapes[0].x).toBeGreaterThan(650);
  });

  it("nudges overlapping major objects apart", () => {
    const instruction: DrawInstruction = {
      backgroundColor: "#FFFFFF",
      shapes: [
        { type: "rectangle", label: "房子", x: 360, y: 400, anchor: "top-left", width: 240, height: 150, fillColor: "#FFE0B2", z: 1 },
        { type: "circle", label: "树", x: 480, y: 470, anchor: "center", radius: 80, fillColor: "#66BB6A", z: 2 },
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
          { type: "circle", label: "小鸟", x: 480, y: 380, anchor: "center", radius: 70, fillColor: "#90CAF9", z: 3 },
        ],
      },
      {
        shapes: [
          { type: "rectangle", label: "房子", x: 360, y: 330, anchor: "top-left", width: 240, height: 180, fillColor: "#FFE0B2", z: 1 },
        ],
      },
    );

    const bird = getShapeBounds(result.shapes[0]);
    const existingHouse = getShapeBounds({ type: "rectangle", label: "房子", x: 360, y: 330, anchor: "top-left", width: 240, height: 180, fillColor: "#FFE0B2", z: 1 });
    expect(Math.abs(bird.cx - existingHouse.cx)).toBeGreaterThan(120);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- app/lib/layout/position-normalizer.test.ts
```

Expected: FAIL because the normalizer does not exist.

**Step 3: Implement position normalizer**

Create `app/lib/layout/position-normalizer.ts`.

Export:

```ts
import type { DrawInstruction, Shape } from "../draw-schema";

export interface LayoutContext {
  shapes?: Shape[];
  backgroundColor?: string;
}

export function normalizeInstructionLayout(
  instruction: DrawInstruction,
  context?: LayoutContext,
): DrawInstruction;
```

Rules to implement:

- Use `clampShapeIntoCanvas(shape, 24)` on every shape.
- Infer a semantic zone from `shape.label` and simple shape clues:
  - sky: `/太阳|月亮|云|星星|彩虹|天空|鸟/`
  - ground: `/草地|地面|路|花|树干|房子|小屋/`
  - water: `/河|湖|海|鱼|船/`
  - text: `shape.type === "text"`
- For sky objects:
  - If label includes `太阳`, prefer right-top center around `{ x: 800, y: 120 }`.
  - If label includes `月亮`, prefer `{ x: 780, y: 130 }`.
  - If label includes `云`, keep upper region but distribute by current order.
  - Clamp `cy <= 260`.
- For ground objects:
  - Keep bottom half unless they are large background strips.
  - If `房子|小屋`, keep baseline around y 500-560.
  - If `树`, keep trunk/crown near x side regions when overlapping the main subject.
- For text, keep it within the upper or lower caption band; default bottom center if it overlaps the main subject.
- For collision:
  - Compare only visible non-background shapes. Treat huge background rectangles (`width > 800 || height > 300`) as background, not blockers.
  - If `overlapRatio(a, b) > 0.35`, nudge the later shape horizontally away from the earlier shape by 80px increments, then clamp.
  - Try directions `[right, left, up, down]` and choose the first that reduces overlap.
  - Include `context.shapes` as blockers in append mode.
- Preserve `z`, colors, gradients, ids, labels, and all style fields.
- Do not mutate the input instruction.

Keep the algorithm conservative. It should fix obvious mistakes without trying to become a full layout engine.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -- app/lib/layout/position-normalizer.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add app/lib/layout/position-normalizer.ts app/lib/layout/position-normalizer.test.ts
git commit -m "feat: normalize drawing positions"
```

## Task 3: Wire Normalizer Into Draw API

**Files:**

- Modify: `app/api/draw/route.ts`
- Modify: `app/api/draw/route.test.ts`

**Step 1: Add route-level tests**

Extend `app/api/draw/route.test.ts`:

```ts
import { normalizeInstructionLayout } from "../../lib/layout/position-normalizer";
import { getShapeBounds } from "../../lib/layout/shape-bounds";
```

Add tests:

```ts
it("normalizes parsed instruction layout before returning to callers", () => {
  const parsed = drawInstructionSchema.parse(
    normalizeInstructionPayload({
      backgroundColor: "#FFFFFF",
      shapes: [
        { type: "circle", label: "太阳", x: 940, y: 20, anchor: "center", radius: 90, fillColor: "#FFD54F", z: 1 },
      ],
    }),
  );

  const normalized = normalizeInstructionLayout(parsed);
  const bounds = getShapeBounds(normalized.shapes[0]);

  expect(bounds.maxX).toBeLessThanOrEqual(936);
  expect(bounds.minY).toBeGreaterThanOrEqual(24);
});
```

**Step 2: Run test**

Run:

```bash
npm run test -- app/api/draw/route.test.ts
```

Expected: PASS only after Task 2 exists; if not wired yet this direct helper test still passes. Continue to Step 3.

**Step 3: Wire into `generateDrawInstruction`**

In `app/api/draw/route.ts`:

- Import `normalizeInstructionLayout` from `../../lib/layout/position-normalizer`.
- After `const instruction = drawInstructionSchema.parse(normalized);`, add:

```ts
const layoutNormalized = normalizeInstructionLayout(instruction, ctx);
```

- Return `layoutNormalized`.
- Keep existing logs, but update the elapsed log to return after normalizing:

```ts
console.log(`[draw] pipeline=online-critical elapsedMs=${Date.now() - startedAt} appendMode=${appendMode} simple=${useSimpleFlow} layout=normalized`);
return layoutNormalized;
```

**Step 4: Run focused tests**

Run:

```bash
npm run test -- app/api/draw/route.test.ts app/lib/layout/shape-bounds.test.ts app/lib/layout/position-normalizer.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/draw/route.ts app/api/draw/route.test.ts
git commit -m "feat: apply layout normalization to draw api"
```

## Task 4: Tighten Prompt Contract Without Relying On It

**Files:**

- Modify: `app/api/draw/prompts/shared.ts`
- Modify: `app/api/draw/prompts/coordinate.ts`

**Step 1: Update `DRAW_RULES_PROMPT`**

In `app/api/draw/prompts/shared.ts`, add a short section after `【anchor 语义】`:

```text
【语义定位约定】
- 请优先用用户语言中的位置词决定区域：左上/右上/左下/右下/中间/左边/右边/上方/下方。
- 天空元素（太阳、月亮、云、星星、彩虹、鸟）必须在画布上半区；太阳默认右上安全区，不能贴边。
- 地面元素（房子、树、花、草地、道路）必须在画布下半区，并与地面接触或接近。
- 主要主体之间要保留清晰间距，不要把两个主体中心放在同一坐标附近。
```

Do not over-expand the prompt. The deterministic normalizer is the source of truth.

**Step 2: Update coordinate prompt**

In `app/api/draw/prompts/coordinate.ts`, add:

```text
- 不要直接把多个主体放在同一点；如果用户说“旁边/附近”，必须给出左右或上下错开的坐标。
- 对太阳/月亮/云/鸟等天空元素，优先规划在 y<=260 的区域。
- 对房子/树/花/人物/动物等地面主体，优先规划在 y>=330 的区域。
```

**Step 3: Run tests**

Run:

```bash
npm run test -- app/api/draw/route.test.ts app/lib/layout/shape-bounds.test.ts app/lib/layout/position-normalizer.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add app/api/draw/prompts/shared.ts app/api/draw/prompts/coordinate.ts
git commit -m "chore: clarify draw positioning prompt rules"
```

## Task 5: Add Manual QA Fixture Script

**Files:**

- Create: `docs/qa/drawing-positioning-cases.md`

**Step 1: Create QA checklist**

Create `docs/qa/drawing-positioning-cases.md`:

```markdown
# Drawing Positioning QA Cases

Run these on `/canvas` after `npm run dev`.

## Single-scene cases

- `画一个蓝天白云下的小房子，太阳在右上角`
  - Expected: sun is in upper-right safe area, house sits lower center, clouds stay upper half.
- `画一棵树在房子左边`
  - Expected: tree is visibly left of the house and not covering the house.
- `画一条河，河里有一条鱼`
  - Expected: river is lower/middle lower area, fish is inside or near the river.
- `在左上角写上春天`
  - Expected: text is visible and not clipped.

## Append cases

- First: `画一个小房子在草地上`
- Then: `再加一个太阳在右上角`
  - Expected: sun does not cover the house.
- Then: `旁边加一棵树`
  - Expected: tree appears beside the house, not on top of it.

## Failure checks

- No major element should be clipped outside the canvas.
- No two major subjects should share the same center point.
- Background strips may cover large areas; foreground subjects must remain visible.
```

**Step 2: Commit**

```bash
git add docs/qa/drawing-positioning-cases.md
git commit -m "docs: add positioning qa cases"
```

## Task 6: Final Verification

**Files:**

- No new files unless fixing issues found by verification.

**Step 1: Run all tests**

Run:

```bash
npm run test
```

Expected: PASS.

**Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS or only pre-existing unrelated warnings. If lint fails on touched files, fix before continuing.

**Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS. This is mandatory for this repo after code changes.

**Step 4: Optional local browser QA**

Run:

```bash
npm run dev
```

Open `/canvas` or `/zh/canvas` depending on the active route setup and run the cases in `docs/qa/drawing-positioning-cases.md`.

Expected: Drawings are not perfect art yet, but position errors are materially reduced.

**Step 5: Final commit**

If verification required fixes:

```bash
git add <changed-files>
git commit -m "fix: stabilize drawing positioning verification"
```

## Non-Goals

- Do not add Konva, Framer Motion, Three.js, or any other dependency.
- Do not convert the renderer to a full object editor.
- Do not implement direct manipulation UI.
- Do not implement the B plan component library.
- Do not replace the LLM provider.

## Implementation Notes For 5.3 Codex

- The current route already has a small `normalizeInstructionPayload` helper for missing `x/y`. Keep it.
- The new layout normalizer should run after schema parsing so it receives typed, defaulted shapes.
- Prefer pure functions and focused tests. This is positioning infrastructure, not UI polish.
- Use prompt updates only as a support layer. The code normalizer is the reliability layer.
- If a test expectation conflicts with actual renderer semantics, inspect the renderer before changing the test. The renderer uses the same 960x720 coordinate system.
