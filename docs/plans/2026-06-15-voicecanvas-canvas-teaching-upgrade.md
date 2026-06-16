# VoiceCanvas Canvas Teaching Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the canvas experience from single-turn demo drawing to child-friendly, multi-turn, voice-first creation aligned with the PRD's "AI voice drawing toy for families" direction.

**Architecture:** Keep the existing two-step drawing pipeline (`/api/draw` planning -> schema JSON) and the native Canvas renderer, but add a stateful canvas layer, incremental append semantics, speech normalization, and child guidance as thin layers around the current flow. Reuse the existing `canvas-state.ts` reducer and current IndexedDB persistence instead of introducing Supabase, Prisma, or element-level editing that the PRD explicitly defers.

**Tech Stack:** Next.js 16 App Router, React 19 client components, next-intl, native Canvas API, GSAP, IndexedDB, zod, DeepSeek via AI SDK, Xfyun iat WebSocket ASR.

---

## Scope Guardrails

- Stay inside PRD boundaries:
  - Support **multi-turn append** and **undo add**, not arbitrary move/recolor/delete UIs.
  - Support **child guidance** and **teaching copy**, not full "绘本模式" yet.
  - Keep current **LLM + geometry rendering** architecture; do not add pixel-image generation.
- Allowed stretch beyond the raw bullet list:
  - Add small supporting helpers, types, and tests needed to make the five requested items stable.
  - Improve telemetry/logging and error copy if they reduce child-facing failure states.
- Explicitly out of scope in this plan:
  - Redo stack with complex branching history
  - Element selection handles / direct manipulation
  - Cloud sync / auth migration
  - Multi-page storybook persistence

## Delivery Order

1. `/api/draw` context + prompt extension contract
2. Canvas state machine wiring + incremental render + undo-add
3. Speech normalization module + Xfyun resilience
4. Child guide UI + teaching i18n namespace
5. End-to-end polish, regression tests, and docs sync

## File Map

**Primary files to modify**
- `app/api/draw/route.ts`
- `app/[locale]/canvas/page.tsx`
- `app/[locale]/components/XfyunVoiceInput.tsx`
- `messages/zh.json`
- `messages/en.json`
- `docs/PRD.md` only if implementation reveals a needed factual correction

**Existing files to reuse**
- `app/[locale]/lib/canvas-state.ts`
- `app/[locale]/lib/draw-schema.ts`
- `app/[locale]/lib/db.ts`
- `app/[locale]/components/Toast.tsx`

**New files to create**
- `app/[locale]/lib/voice-normalize.ts`
- `app/[locale]/components/ChildGuide.tsx`

**Recommended test targets**
- `app/[locale]/lib/voice-normalize.test.ts`
- `app/[locale]/lib/canvas-state.test.ts`
- `app/api/draw/route.test.ts`

---

### Task 1: Lock the Product Contract Against the PRD

**Files:**
- Read: `docs/PRD.md`
- Read: `app/api/draw/route.ts`
- Read: `app/[locale]/canvas/page.tsx`
- Read: `app/[locale]/components/XfyunVoiceInput.tsx`
- Read: `messages/zh.json`
- Read: `messages/en.json`

**Step 1: Extract PRD-backed requirements**

Write a short implementation checklist in the working notes:
- Child-facing product tone
- Voice-first creation with immediate feedback
- Multi-turn scene growth as a bridge toward future storybook mode
- Preserve low-cost geometry rendering
- Avoid features the PRD marks as unimplemented, especially general element editing

**Step 2: Define the acceptance gates**

The implementation is done only if all of the following are true:
- `/api/draw` accepts append context without regressing first-turn behavior
- Canvas can append only new shapes and undo the last add group
- Xfyun flow is normalized for child speech and resilient to one failure/retry
- Child guide content is localized and rendered on the canvas page
- `npm run build` passes

---

### Task 2: Extend `/api/draw` to Accept `context` and `appendPrompt`

**Files:**
- Modify: `app/api/draw/route.ts`
- Test: `app/api/draw/route.test.ts`

**Step 1: Define the request contract**

Update the route to accept:

```ts
type DrawRequest = {
  prompt: string;
  context?: {
    shapes: Shape[];
    backgroundColor?: string;
  };
  appendPrompt?: string;
};
```

Rules:
- `prompt` remains required for backward compatibility.
- `appendPrompt` is optional sugar for multi-turn prompts.
- When `context` exists and contains shapes, treat the request as an append/continuation planning round.

**Step 2: Add a failing route test**

Cover these cases:
- first-turn `{prompt}` still returns valid instruction JSON
- append request `{prompt, context}` keeps prior route shape and does not 400
- empty prompt still 400s

**Step 3: Implement minimal parsing**

Inside `POST`:
- parse `context`
- compute `effectivePrompt = appendPrompt?.trim() || prompt.trim()`
- pass `context` into `planScene`

**Step 4: Update prompt planning semantics**

Refine the multi-turn prompt in `planScene`:
- explain that the user is continuing an existing scene
- request only newly added shapes
- forbid duplication of major existing entities
- prefer labels suitable for future storybook continuity, e.g. "小熊", "气球", "太阳"

**Step 5: Preserve JSON-schema stability**

Do not change `generateDrawJson` output shape. Keep the existing schema strict so the canvas renderer remains stable.

**Step 6: Verify**

Run:

```bash
npm run build
```

Expected:
- route compiles
- no change to current first-turn API consumers

---

### Task 3: Define Append Semantics at the State Layer

**Files:**
- Modify: `app/[locale]/lib/canvas-state.ts`
- Test: `app/[locale]/lib/canvas-state.test.ts`

**Step 1: Add or tighten reducer-level tests**

Cover:
- `reset` replaces all shapes
- `applyAddMany` appends shapes with ids and increasing z
- `removeShapeById` removes only the target shape
- group undo support can be built from a recorded list of added ids

**Step 2: Add a lightweight history type**

Add an explicit history payload for UI integration:

```ts
export interface AddBatchHistoryEntry {
  kind: "add-batch";
  shapeIds: string[];
}
```

This can live in `canvas-state.ts` or adjacent UI state, but the plan should keep it typed.

**Step 3: Do not overbuild**

Keep reducer scope to:
- `reset`
- `add`
- `applyAddMany`
- `removeShapeById`

Do not add speculative move/recolor logic beyond typed placeholders.

---

### Task 4: Wire Canvas Page to the State Machine

**Files:**
- Modify: `app/[locale]/canvas/page.tsx`

**Step 1: Add local canvas session state**

Introduce page-level state:

```ts
const [canvasState, setCanvasState] = useState<CanvasState>(emptyState());
const [history, setHistory] = useState<AddBatchHistoryEntry[]>([]);
const [isAppending, setIsAppending] = useState(false);
```

Use existing helpers from `canvas-state.ts`:
- `emptyState`
- `stateFromInstruction`
- `applyAddMany`
- `removeShapeById`
- `serializeState`
- `deserializeState`

**Step 2: Distinguish first-turn vs append-turn**

Behavior:
- If canvas is empty, current "开始绘图" performs full `reset`.
- If canvas already has shapes, treat the next successful generation as append mode by default.
- Build `/api/draw` request with:
  - `prompt: sessionDescription`
  - `context: {shapes: canvasState.shapes, backgroundColor: canvasState.backgroundColor}`

**Step 3: Replace instruction-only render ownership**

Today the page draws directly from one `DrawInstruction`. Shift ownership so the renderer derives from `canvasState`.

Rules:
- first turn: `setCanvasState(stateFromInstruction(instruction))`
- append turn: `setCanvasState(applyAddMany(previous, instruction.shapes))`
- background remains from the original state unless append returns a meaningful change policy

**Step 4: Record undo-add batches**

After append succeeds:
- capture the added shape ids in one history entry
- push `{kind: "add-batch", shapeIds}` to history

Undo button behavior:
- pop the last batch
- remove all ids from that batch
- redraw canvas from resulting `canvasState`

**Step 5: Persist the full state**

When saving to IndexedDB:
- store serialized `canvasState`, not only width/height/description
- on load/new session, `deserializeState` if possible
- fall back gracefully for old saved artworks

**Step 6: Keep render stable**

Do not mutate the existing shape animation model into a generic editor. Reuse the current "commit to offscreen, animate next shape" pipeline.

---

### Task 5: Add Incremental Rendering Without Repainting the Whole Experience

**Files:**
- Modify: `app/[locale]/canvas/page.tsx`

**Step 1: Separate committed layer and incoming layer**

Refactor `drawShapes` so it can accept:
- `baseShapes`: already committed scene
- `incomingShapes`: newly generated append batch

Render sequence:
1. draw background
2. draw all committed `baseShapes` immediately to offscreen
3. animate only `incomingShapes`
4. commit incoming shapes after each shape finishes

**Step 2: Add a narrow renderer entry point**

Introduce helper signatures like:

```ts
async function renderStateIncrementally(
  committed: Shape[],
  incoming: Shape[],
  backgroundColor: string
): Promise<void>
```

This avoids trying to reinterpret append behavior everywhere else.

**Step 3: Add empty redraw helper**

Add a non-animated redraw path for:
- undo-add
- gallery load
- clear/new canvas

Recommended helper:

```ts
function redrawFromState(state: CanvasState): void
```

**Step 4: Ensure geometry scale remains fixed**

Keep the internal canvas drawing coordinate system at `960x720`, matching the current API contract and avoiding visual distortion.

---

### Task 6: Upgrade Undo from Placeholder to Real `undo add`

**Files:**
- Modify: `app/[locale]/canvas/page.tsx`
- Optional test: `app/[locale]/lib/canvas-state.test.ts`

**Step 1: Replace placeholder toast**

Current undo button still shows "开发中". Replace with:
- real undo when history exists
- warning toast when there is nothing to undo

**Step 2: Limit undo semantics clearly**

This release only supports:
- undo the last append batch
- optionally undo the initial full-scene reset only by "新建画布" or future redo

Do not pretend to support arbitrary per-stroke history.

**Step 3: UX copy**

Use precise child-safe copy:
- zh: "撤回刚刚添加的内容"
- en: "Undo last added part"

---

### Task 7: Add `voice-normalize.ts` for Child Speech Correction

**Files:**
- Create: `app/[locale]/lib/voice-normalize.ts`
- Test: `app/[locale]/lib/voice-normalize.test.ts`

**Step 1: Define the module surface**

Create a small pure module:

```ts
export interface NormalizeResult {
  raw: string;
  normalized: string;
  replacedTokens: string[];
}

export function normalizeVoiceTranscript(input: string): NormalizeResult
export function shouldRetryTranscript(input: string): boolean
```

**Step 2: Implement normalization rules aligned with PRD child usage**

Include:
- whitespace cleanup
- full-width / half-width punctuation cleanup
- repeated filler removal
- common child-ASR substitutions

Examples:
- "画一个 小 兔 子" -> "画一个小兔子"
- "帮我画个气求" -> "帮我画个气球"
- "再加 一个 小鸟 吧" -> "再加一个小鸟吧"

Keep the rules table-driven and easy to extend.

**Step 3: Add defensive retry heuristics**

`shouldRetryTranscript` should return true for likely bad ASR finals such as:
- very short non-command fragments
- meaningless punctuation-only output
- obvious low-information fillers

Do not overfire retries on valid short child prompts like "太阳".

---

### Task 8: Upgrade `XfyunVoiceInput` for Child Speech, Normalization, and Retry Fallback

**Files:**
- Modify: `app/[locale]/components/XfyunVoiceInput.tsx`
- Modify if needed: `app/api/voice/transcribe/route.ts`

**Step 1: Import the normalization module**

Normalize at two points:
- partial display can remain raw/lightly cleaned
- final commit to `onFinalResult` should use normalized output

**Step 2: Tune child-friendly Xfyun parameters**

Within the start packet, evaluate only low-risk parameter changes supported by the current iat mode:
- keep Mandarin
- prefer shorter end-of-speech timeout if it helps children who speak in bursts
- add any available domain/endpoint options only if already supported by the current backend contract

Important:
- do not invent unsupported "童声模型" fields blindly
- if true child-voice acoustic params are unavailable in iat, document that we are using transcript normalization plus UX fallback instead

**Step 3: Add one retry fallback**

Flow:
- if first final transcript is empty or `shouldRetryTranscript(...) === true`, show brief retry state and retry once
- if retry also fails, surface toast/error and keep manual recovery path

**Step 4: Keep voice-first UX**

After a successful final transcript:
- write normalized text into the description input
- preserve the "magic" feeling of immediate child feedback

**Step 5: Reduce dead code while touching the file**

Remove or defer unused manual-input code if it is not part of the current canvas UX, but only if this does not create unrelated churn.

---

### Task 9: Add `ChildGuide.tsx` as the Child-Facing Teaching Surface

**Files:**
- Create: `app/[locale]/components/ChildGuide.tsx`
- Modify: `app/[locale]/canvas/page.tsx`

**Step 1: Define the component responsibilities**

`ChildGuide` should:
- show one short prompt at a time
- encourage children to speak imaginative complete scenes
- reinforce append behavior, e.g. "可以再说：再加一朵云"
- avoid complex settings or dense instructional copy

**Step 2: Recommended props**

```ts
type ChildGuideProps = {
  mode: "idle" | "listening" | "thinking" | "appending";
  hasArtwork: boolean;
  lastTranscript?: string;
};
```

**Step 3: UI content tied to PRD**

Use the PRD's family / child positioning:
- emphasize play, imagination, and being "heard"
- examples should be scene-based, not low-level geometry commands

Examples:
- "说一句完整画面，比如：画一只在云上跳舞的小兔子"
- "想继续丰富画面？试试说：再加一道彩虹"

**Step 4: Place it in the canvas page**

Recommended placement:
- above or adjacent to the voice input area
- lightweight card, not a large modal
- visible in idle state, compact in active states

---

### Task 10: Add `teaching` Namespace to `messages/zh.json` and `messages/en.json`

**Files:**
- Modify: `messages/zh.json`
- Modify: `messages/en.json`

**Step 1: Add a new top-level namespace**

```json
"teaching": {
  "title": "...",
  "speakHint": "...",
  "appendHint": "...",
  "listening": "...",
  "thinking": "...",
  "undoAdd": "...",
  "examples": {
    "scene1": "...",
    "scene2": "...",
    "append1": "..."
  }
}
```

**Step 2: Copy must follow PRD direction**

Chinese copy should sound like a child creation companion, not an accessibility tool admin panel.

English copy should preserve meaning, even if slightly simpler than the Chinese original.

**Step 3: Keep existing `canvas` namespace stable**

Do not move or rename existing keys unless the canvas page already requires it. Additive change only.

---

### Task 11: Connect Canvas Page to next-intl

**Files:**
- Modify: `app/[locale]/canvas/page.tsx`

**Step 1: Replace remaining hardcoded UI copy**

Use `useTranslations()` for:
- child guide copy
- undo-add text
- append-mode hints
- AI thinking / voice status labels that are child-visible

**Step 2: Keep low-risk exceptions**

Strings that are purely debug-facing or temporary developer logs can remain hardcoded if not user-visible.

**Step 3: Use locale-aware examples**

For example prompts:
- zh should stay culturally natural and playful
- en can use equivalent child-friendly examples, not literal awkward translations

---

### Task 12: Align Saved Artwork and Gallery Load With Stateful Canvas

**Files:**
- Modify: `app/[locale]/canvas/page.tsx`
- Modify if needed: `app/[locale]/gallery/page.tsx`
- Modify if needed: `app/[locale]/lib/db.ts`

**Step 1: Save full serialized canvas state**

Persist:
- `shapes`
- `backgroundColor`
- optional `vignette`
- description metadata

**Step 2: Load both old and new records**

If `deserializeState(canvasData)` returns:
- new state -> redraw from state
- null -> fall back to current legacy metadata behavior without crashing

**Step 3: Keep thumbnails working**

Do not change the existing `canvas.toDataURL()` thumbnail path.

---

### Task 13: Regression and Acceptance Tests

**Files:**
- Test: `app/[locale]/lib/voice-normalize.test.ts`
- Test: `app/[locale]/lib/canvas-state.test.ts`
- Test: `app/api/draw/route.test.ts`

**Step 1: Voice normalization tests**

Cover:
- typo correction
- whitespace normalization
- retry heuristic true/false edge cases

**Step 2: State machine tests**

Cover:
- reset state
- append batch preserves z ordering
- undo-add removes exactly the last batch

**Step 3: Route tests**

Cover:
- no-context request
- context append request
- malformed body / missing prompt

**Step 4: Manual product checks**

Checklist:
- first prompt draws a full scene
- second prompt like "再加一朵云" only appends
- undo removes only the last added batch
- localized child guide appears in zh/en
- bad ASR final triggers one retry at most

---

### Task 14: Final Verification and Cleanup

**Files:**
- Modify only if needed after verification

**Step 1: Run verification**

Run:

```bash
npm run build
npm run lint
```

Expected:
- build passes
- lint has no new errors relative to the current baseline

**Step 2: Smoke-test the canvas flow**

Manual scenarios:
1. Visit `/zh/canvas`
2. Speak or type a first scene
3. Append with "再加..."
4. Undo once
5. Save and reload
6. Switch locale to `/en/canvas`

**Step 3: Update docs only if facts changed**

If implementation materially changes factual product capability, add a narrow factual correction to `docs/PRD.md` or `docs/TDD.md`. Do not rewrite broad product strategy during implementation.

---

## Recommended Commit Slices

1. `feat: add draw context contract for append planning`
2. `feat: wire canvas state machine and undo add`
3. `feat: add voice transcript normalization and retry fallback`
4. `feat: add child guide teaching UI and i18n`
5. `chore: add tests for draw context and canvas state`

## Risks and Countermeasures

- **Risk:** LLM duplicates existing scene elements during append.
  - **Countermeasure:** pass concise shape summaries and tighten append prompt constraints.
- **Risk:** Undo behavior becomes confusing if full reset and append history are mixed.
  - **Countermeasure:** scope undo to last add batch only for this release and label it clearly.
- **Risk:** Over-normalization corrupts valid child phrases.
  - **Countermeasure:** keep normalization table small, explicit, and test-backed.
- **Risk:** i18n churn slows delivery.
  - **Countermeasure:** localize only child-visible teaching/status strings in this pass.

## Stretch Items Allowed by This Plan

- Add a subtle append-mode badge on the canvas page when an artwork already exists
- Add a tiny "try saying next..." carousel inside `ChildGuide`
- Emit lightweight debug logs for prompt mode (`reset` vs `append`) during development

## Not Included Even Though Related

- Storybook multi-page navigation
- Real redo branching model
- Direct manipulation of existing shapes
- Cloud sync or server persistence
- New AI model providers

Plan complete and saved to `docs/plans/2026-06-15-voicecanvas-canvas-teaching-upgrade.md`. Two execution options:

**1. Subagent-Driven (this session)** - I execute task groups here, verify after each group, and adjust quickly.

**2. Parallel Session (separate)** - Open a new session with executing-plans for batch implementation against this plan.
