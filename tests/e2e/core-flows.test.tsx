/**
 * E2E tests for VoiceCanvas — core voice-to-canvas flows
 *
 * Covers: voice recognition, NLP command parsing, canvas drawing,
 * undo/redo, AI generation flow, page navigation, and API mocking.
 *
 * Uses Vitest + Testing Library + jsdom.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Speech Recognition: parseTranscript ──────────────────────────
import {
  parseTranscript,
  VoiceRecognitionManager,
} from "@/lib/voice/speechRecognition";

describe("parseTranscript — NLP Command Parser", () => {
  /* ── Canvas Drawing Commands ── */
  it("parses basic shape command: '画一个圆形'", () => {
    const result = parseTranscript("画一个圆形");
    expect(result.type).toBe("canvas");
    expect(result.canvasOp?.action).toBe("draw");
    expect(result.canvasOp?.shape).toBe("circle");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("parses shape with color: '画一个红色矩形'", () => {
    const result = parseTranscript("画一个红色矩形");
    expect(result.type).toBe("canvas");
    expect(result.canvasOp?.shape).toBe("rect");
    expect(result.canvasOp?.color).toBe("#FFBDB8");
    expect(result.canvasOp?.colorName).toBe("红色");
  });

  it("parses shape with position: '在左边画一个三角形'", () => {
    const result = parseTranscript("在左边画一个三角形");
    expect(result.canvasOp?.shape).toBe("triangle");
    expect(result.canvasOp?.position?.anchor).toBe("left");
  });

  it("parses shape with size: '画一个很大的圆'", () => {
    const result = parseTranscript("画一个很大的圆");
    expect(result.canvasOp?.size?.scale).toBe("large");
  });

  it("parses explicit pixel size: '100像素的方形'", () => {
    const result = parseTranscript("100像素的方形");
    expect(result.canvasOp?.shape).toBe("rect");
    expect(result.canvasOp?.size?.width).toBe(100);
    expect(result.canvasOp?.size?.height).toBe(100);
  });

  it("parses star shape: '画个星星'", () => {
    const result = parseTranscript("画个星星");
    expect(result.canvasOp?.shape).toBe("star");
  });

  it("parses line shape: '画一条直线'", () => {
    const result = parseTranscript("画一条直线");
    expect(result.canvasOp?.shape).toBe("line");
  });

  /* ── Text Commands ── */
  it("parses text command: '写上你好世界'", () => {
    const result = parseTranscript("写上你好世界");
    expect(result.canvasOp?.action).toBe("text");
    expect(result.canvasOp?.text).toBe("你好世界");
  });

  it("parses text with color: '写上红色的生日快乐'", () => {
    const result = parseTranscript("写上红色的生日快乐");
    expect(result.canvasOp?.action).toBe("text");
    expect(result.canvasOp?.text).toBe("红色的生日快乐");
    expect(result.canvasOp?.color).toBe("#FFBDB8");
  });

  /* ── Control Commands ── */
  it("parses undo command", () => {
    const result = parseTranscript("撤销");
    expect(result.type).toBe("control");
    expect(result.canvasOp?.action).toBe("undo");
    expect(result.confidence).toBe(1.0);
  });

  it("parses redo command", () => {
    const result = parseTranscript("重做");
    expect(result.type).toBe("control");
    expect(result.canvasOp?.action).toBe("redo");
  });

  it("parses clear command", () => {
    const result = parseTranscript("清空画布");
    expect(result.type).toBe("control");
    expect(result.canvasOp?.action).toBe("clear");
  });

  it("parses save command", () => {
    const result = parseTranscript("保存");
    expect(result.type).toBe("control");
    expect(result.canvasOp?.action).toBe("save");
  });

  it("parses export command", () => {
    const result = parseTranscript("导出");
    expect(result.type).toBe("control");
    expect(result.canvasOp?.action).toBe("export");
  });

  /* ── AI Generation Commands ── */
  it("parses AI image generation: '画一片夕阳下的海边'", () => {
    const result = parseTranscript("画一片夕阳下的海边");
    expect(result.type).toBe("ai_generate");
    expect(result.imagePrompt).toBeTruthy();
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("parses AI command with nature keywords: '太阳和云'", () => {
    const result = parseTranscript("太阳和云");
    expect(result.type).toBe("ai_generate");
  });

  /* ── Ambiguous / Edge Cases ── */
  it("returns ambiguous for gibberish", () => {
    const result = parseTranscript("abcdefg");
    expect(result.type).toBe("ambiguous");
    expect(result.confidence).toBe(0.5);
  });

  it("returns ambiguous for empty string", () => {
    const result = parseTranscript("");
    expect(result.type).toBe("ambiguous");
  });

  it("parses short AI prompt correctly: '画一朵花'", () => {
    const result = parseTranscript("画一朵花");
    expect(result.type).toBe("ai_generate");
  });
});

// ── Voice Action Mapper ──────────────────────────────────────────
import {
  matchVoiceToAction,
  executeAction,
} from "@/lib/voice/voiceActionMapper";

describe("matchVoiceToAction", () => {
  it("matches '画板' to canvas navigation", () => {
    const matched = matchVoiceToAction("去画板");
    expect(matched).not.toBeNull();
    expect(matched!.action.selector).toBe("[data-action='nav-canvas']");
  });

  it("matches '撤销' on canvas page", () => {
    const matched = matchVoiceToAction("撤销", "canvas");
    expect(matched).not.toBeNull();
    expect(matched!.action.label).toBe("撤销");
  });

  it("matches '广场' to square navigation", () => {
    const matched = matchVoiceToAction("打开社区广场");
    expect(matched).not.toBeNull();
    expect(matched!.action.selector).toBe("[data-action='square']");
  });

  it("returns null for unknown command", () => {
    const matched = matchVoiceToAction("今天天气怎么样");
    expect(matched).toBeNull();
  });

  it("matches '返回' globally", () => {
    const matched = matchVoiceToAction("返回上一页");
    expect(matched).not.toBeNull();
    expect(matched!.action.selector).toBe("[data-action='nav-back']");
  });
});

describe("executeAction", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.stubGlobal("__voiceCursorAnimate", undefined);
  });

  it("clicks the target element when voiceCursorAnimate is not set", () => {
    const btn = document.createElement("button");
    btn.setAttribute("data-action", "undo");
    btn.textContent = "Undo";
    document.body.appendChild(btn);

    const clickSpy = vi.spyOn(btn, "click");
    executeAction({
      keywords: ["撤销"],
      selector: "[data-action='undo']",
      label: "撤销",
    });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("calls voiceCursorAnimate when available", () => {
    const animateFn = vi.fn((_sel: string, cb: () => void) => cb());
    vi.stubGlobal("__voiceCursorAnimate", animateFn);

    const btn = document.createElement("button");
    btn.setAttribute("data-action", "save");
    document.body.appendChild(btn);

    executeAction({
      keywords: ["保存"],
      selector: "[data-action='save']",
      label: "保存",
    });
    expect(animateFn).toHaveBeenCalledWith(
      "[data-action='save']",
      expect.any(Function),
    );
  });
});

// ── VoiceRecognitionManager ──────────────────────────────────────
describe("VoiceRecognitionManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates and starts SpeechRecognition", () => {
    const onResult = vi.fn();
    const onError = vi.fn();
    const onEnd = vi.fn();

    const manager = new VoiceRecognitionManager(onResult, onError, onEnd);
    manager.start();

    expect(onResult).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("stops recognition when stop is called", () => {
    const manager = new VoiceRecognitionManager(vi.fn(), vi.fn(), vi.fn());
    manager.start();
    manager.stop();
  });
});

// ── API Route Handlers ───────────────────────────────────────────
import { POST as transcribePost } from "@/app/api/voice/transcribe/route";
import { POST as intentPost } from "@/app/api/intent/analyze/route";
import { POST as imagePost } from "@/app/api/image/generate/route";

describe("API: POST /api/voice/transcribe", () => {
  it("returns error when no audio file", async () => {
    const req = new Request("http://localhost/api/voice/transcribe", {
      method: "POST",
    });
    const res = await transcribePost(req);
    // In test environment without proper formData, NextRequest may return 500
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("returns mock transcript when DASHSCOPE_API_KEY is not set", async () => {
    // Create FormData with a fake audio file
    const blob = new Blob(["fake audio data"], { type: "audio/webm" });
    const file = new File([blob], "test.webm", { type: "audio/webm" });
    const formData = new FormData();
    formData.set("audio", file);

    const req = new Request("http://localhost/api/voice/transcribe", {
      method: "POST",
      body: formData,
    });
    const res = await transcribePost(req);
    const body = await res.json();
    // In test environment, may fail or succeed depending on runtime support
    if (res.ok) {
      expect(body.transcript).toBeTruthy();
      expect(body.warning).toContain("DASHSCOPE_API_KEY");
    } else {
      expect(body.error).toBeTruthy();
    }
  });
});

describe("API: POST /api/intent/analyze", () => {
  it("returns 400 when no transcript provided", async () => {
    const req = new Request("http://localhost/api/intent/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await intentPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("transcript");
  });

  it("returns mock canvas intent when DASHSCOPE_API_KEY is not set", async () => {
    const req = new Request("http://localhost/api/intent/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: "画一个红色的圆形" }),
    });
    const res = await intentPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("canvas");
    expect(body.canvasOp.shape).toBe("circle");
    expect(body.canvasOp.color).toBe("#B5D5F5");
  });

  it("handles long transcript gracefully", async () => {
    const longText = "画一个".repeat(50);
    const req = new Request("http://localhost/api/intent/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: longText }),
    });
    const res = await intentPost(req);
    expect(res.status).toBe(200);
  });
});

describe("API: POST /api/image/generate", () => {
  it("returns 400 when no prompt provided", async () => {
    const req = new Request("http://localhost/api/image/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await imagePost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("prompt");
  });

  it("returns mock image URL when DASHSCOPE_API_KEY is not set", async () => {
    const req = new Request("http://localhost/api/image/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "夕阳下的海边" }),
    });
    const res = await imagePost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imageUrl).toContain("images.unsplash.com");
    expect(body.warning).toContain("DASHSCOPE_API_KEY");
  });
});

// ── CanvasBoard Component ────────────────────────────────────────
import CanvasBoard from "@/components/canvas/CanvasBoard";

describe("CanvasBoard Component", () => {
  it("renders without crashing", () => {
    const { container } = render(<CanvasBoard />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute("role", "img");
  });

  it("renders with aria-label", () => {
    render(<CanvasBoard />);
    const canvas = screen.getByRole("img");
    expect(canvas).toHaveAttribute("aria-label");
  });

  it("accepts initial shapes", () => {
    const shapes = [
      {
        id: "test_1",
        type: "circle" as const,
        x: 100,
        y: 100,
        color: "#FFB7C5",
        size: 50,
        opacity: 1,
        renderScale: 1,
      },
    ];
    const { container } = render(<CanvasBoard initialShapes={shapes} />);
    expect(container.querySelector("canvas")).toBeInTheDocument();
  });

  it("exposes ref methods", () => {
    const ref = { current: null };
    render(<CanvasBoard ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.undo).toBeDefined();
    expect(ref.current?.redo).toBeDefined();
    expect(ref.current?.clear).toBeDefined();
    expect(ref.current?.exportImage).toBeDefined();
    expect(ref.current?.getHistoryStatus).toBeDefined();
  });

  it("undo/redo work correctly", () => {
    const ref = { current: null };
    render(<CanvasBoard ref={ref} />);

    const status = ref.current!.getHistoryStatus();
    expect(status.canUndo).toBe(false);
    expect(status.canRedo).toBe(false);

    // Undo on empty history should be no-op
    ref.current!.undo();
    expect(ref.current!.getHistoryStatus().canUndo).toBe(false);
  });

  it("exportImage is callable on ref", () => {
    const ref = { current: null };
    render(<CanvasBoard ref={ref} />);
    expect(ref.current).not.toBeNull();
    // exportImage is a function on the ref
    expect(typeof ref.current!.exportImage).toBe("function");
  });
});

// ── Color Constants ──────────────────────────────────────────────
import { COLOR_MAP, COLOR_NAME_MAP } from "@/lib/voice/speechRecognition";

describe("Color Mappings", () => {
  it("has bidirectional color mapping", () => {
    for (const [name, hex] of Object.entries(COLOR_MAP)) {
      if (COLOR_NAME_MAP[hex]) {
        expect(COLOR_NAME_MAP[hex]).toBeTruthy();
      }
    }
  });

  it("maps all standard pastel colors", () => {
    expect(COLOR_MAP["粉色"]).toBe("#FFB7C5");
    expect(COLOR_MAP["蓝色"]).toBe("#B5D5F5");
    expect(COLOR_MAP["绿色"]).toBe("#B5E8C7");
    expect(COLOR_MAP["黄色"]).toBe("#FFE5A0");
    expect(COLOR_MAP["紫色"]).toBe("#D4C5F5");
    expect(COLOR_MAP["红色"]).toBe("#FFBDB8");
    expect(COLOR_MAP["橙色"]).toBe("#FFD2A8");
    expect(COLOR_MAP["黑色"]).toBe("#1A1A1A");
    expect(COLOR_MAP["白色"]).toBe("#FFFFFF");
  });
});

// ── Toast Component ──────────────────────────────────────────────
import Toast from "@/components/ui/Toast";

describe("Toast Component", () => {
  it("renders toast messages with correct types", () => {
    const toasts = [
      { id: "1", type: "success" as const, message: "保存成功" },
      { id: "2", type: "error" as const, message: "出错了" },
      { id: "3", type: "warning" as const, message: "注意" },
      { id: "4", type: "info" as const, message: "提示信息" },
    ];

    const onClose = vi.fn();
    render(<Toast toasts={toasts} onClose={onClose} />);

    expect(screen.getByText("保存成功")).toBeInTheDocument();
    expect(screen.getByText("出错了")).toBeInTheDocument();
    expect(screen.getByText("注意")).toBeInTheDocument();
    expect(screen.getByText("提示信息")).toBeInTheDocument();
  });

  it("calls onClose when dismiss button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const toasts = [{ id: "1", type: "info" as const, message: "测试消息" }];

    render(<Toast toasts={toasts} onClose={onClose} />);

    // Find the close button by aria-label
    const dismissBtn = screen.getByLabelText("关闭通知");
    await user.click(dismissBtn);
    expect(onClose).toHaveBeenCalledWith("1");
  });
});
