"use client";

import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  Download,
  FolderHeart,
  Globe,
  HelpCircle,
  LogOut,
  Palette,
  Redo2,
  Save,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import canvasConfetti from "canvas-confetti";
import CanvasBoard, { CanvasBoardRef } from "@/components/canvas/CanvasBoard";
import MicButton, { MicState } from "@/components/voice/MicButton";
import TranscriptBar from "@/components/voice/TranscriptBar";
import IntentModal from "@/components/voice/IntentModal";
import ToastContainer, { ToastMessage, ToastType } from "@/components/ui/Toast";
import {
  COLOR_NAME_MAP,
  type IntentResult,
} from "@/lib/voice/speechRecognition";
import { CanvasAgent } from "@/lib/voice/canvasAgent";
import { WebSpeechRecognitionManager } from "@/lib/voice/webSpeechRecognition";
import { executeAction, matchVoiceToAction } from "@/lib/voice/voiceActionMapper";
import { fetchArtwork, saveArtworkViaApi } from "@/lib/api/artworks";
import {
  fetchCredits,
  generateImage,
  processWithAgent,
} from "@/lib/api/voice";
import { createClient } from "@/lib/supabase/client";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isLoggedIn: boolean;
}

type FlowStage =
  | ""
  | "正在录音"
  | "正在识别语音"
  | "正在解析指令"
  | "正在绘制草图"
  | "正在自动保存 PNG"
  | "等待高级生成"
  | "正在生成高级图片";

function CanvasContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const artworkIdQuery = searchParams.get("id");
  const [isPending, startTransition] = useTransition();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [artworkId, setArtworkId] = useState<string | null>(null);
  const [artworkTitle, setArtworkTitle] = useState("未命名画作");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [micState, setMicState] = useState<MicState>("idle");
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [flowStage, setFlowStage] = useState<FlowStage>("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isIntentModalOpen, setIsIntentModalOpen] = useState(false);
  const [currentIntent, setCurrentIntent] = useState<IntentResult | null>(null);
  const [pendingImageSource, setPendingImageSource] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [currentColor, setCurrentColor] = useState("#1A1A1A");
  const [currentColorName, setCurrentColorName] = useState("默认描边");
  const [canvasMode, setCanvasMode] = useState<"canvas" | "ai_generate">("canvas");
  const [credits, setCredits] = useState(50);

  const canvasRef = useRef<CanvasBoardRef>(null);
  const canvasAgentRef = useRef<CanvasAgent | null>(null);
  const webSpeechRef = useRef<WebSpeechRecognitionManager | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");

  const addToast = (message: string, type: ToastType = "info") => {
    const id = `toast_${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const setIdleState = () => {
    setIsProcessing(false);
    setFlowStage("");
    setMicState("idle");
  };

  const refreshCredits = async () => {
    try {
      const result = await fetchCredits();
      setCredits(result.credits);
    } catch (error) {
      console.error(error);
    }
  };

  const translateShapeName = (shape: string) =>
    ({
      circle: "圆形",
      rect: "方形",
      line: "直线",
      triangle: "三角形",
      star: "五角星",
      text: "文字",
    })[shape] || shape;

  const saveCurrentArtwork = async (showToast = false) => {
    if (!canvasRef.current) return null;
    const shapesData = canvasRef.current.getShapesData();
    if (!shapesData.length) return null;

    const dataUrl = canvasRef.current.exportImage();
    const response = await saveArtworkViaApi({
      id: artworkId,
      title: artworkTitle,
      canvasJson: JSON.stringify(shapesData),
      thumbnailDataUrl: dataUrl,
      tags: [canvasMode === "ai_generate" ? "AI" : "Canvas"],
      isPublic: true,
    });

    if (response?.artwork) {
      setArtworkId(response.artwork.id);
      if (showToast) {
        addToast(`作品 "${artworkTitle}" 保存成功！`, "success");
      }
    }

    return dataUrl;
  };

  const handleExportPNG = async () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.exportImage();
    if (!dataUrl) {
      addToast("导出失败", "error");
      return;
    }

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${artworkTitle || "voicecanvas_artwork"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("作品已下载到本地！", "success");
  };

  const applyIntentToCanvas = async (intent: IntentResult) => {
    if (!canvasRef.current) return;

    if (canvasAgentRef.current) {
      const success = await canvasAgentRef.current.executeIntent(intent);
      if (success) {
        if (intent.type === "canvas" && intent.canvasOp?.color) {
          setCurrentColor(intent.canvasOp.color);
          setCurrentColorName(intent.canvasOp.colorName || COLOR_NAME_MAP[intent.canvasOp.color] || "自定义");
        }
      }
      return;
    }

    if (intent.type === "ai_generate") {
      await canvasRef.current.createSceneSketch(intent.imagePrompt || intent.transcript);
      addToast("已先生成 Canvas 草图", "success");
      return;
    }

    if (intent.type !== "canvas" || !intent.canvasOp) {
      return;
    }

    const { action, shape, color, colorName, position, size, text, fill } = intent.canvasOp;

    if (action === "draw" && shape) {
      await canvasRef.current.addShape(
        shape,
        color,
        position?.anchor || "center",
        size?.scale || "medium",
        undefined,
        {
          fill: fill ?? false,
          pixelSize: size?.width || size?.radius,
        },
      );
      if (color) {
        setCurrentColor(color);
        setCurrentColorName(colorName || COLOR_NAME_MAP[color] || "自定义");
      } else {
        setCurrentColor("#1A1A1A");
        setCurrentColorName("默认描边");
      }
      addToast(`已绘制${colorName || ""}${translateShapeName(shape)}`, "success");
      return;
    }

    if (action === "text" && text) {
      await canvasRef.current.addShape(
        "text",
        color || "#1A1A1A",
        position?.anchor || "center",
        "medium",
        text,
        { fill: true },
      );
      addToast(`已写入文字 "${text}"`, "success");
    }
  };

  const handleControlIntent = async (intent: IntentResult) => {
    const action = intent.canvasOp?.action;
    if (!action) return;

    if (canvasAgentRef.current) {
      await canvasAgentRef.current.executeIntent(intent);
      return;
    }

    if (action === "undo") {
      canvasRef.current?.undo();
      addToast("已撤销上一步操作", "info");
    } else if (action === "redo") {
      canvasRef.current?.redo();
      addToast("已重做上一步操作", "info");
    } else if (action === "clear") {
      canvasRef.current?.clear();
      addToast("画布已清空", "warning");
    } else if (action === "save") {
      await saveCurrentArtwork(true);
    } else if (action === "export") {
      await handleExportPNG();
    }
  };

  const processTranscript = async (text: string) => {
    if (!text.trim()) {
      setIdleState();
      return;
    }

    const matched = matchVoiceToAction(text);
    if (matched) {
      setMicState("success");
      executeAction(matched.action);
      setTimeout(() => setMicState("idle"), 800);
      setIsProcessing(false);
      setFlowStage("");
      return;
    }

    try {
      setFlowStage("正在解析指令");

      // 使用 Agent 处理语音输入
      const agentResult = await processWithAgent(text);
      const intent = agentResult.intent;
      setCurrentIntent(intent);

      if (intent.type === "control" && intent.canvasOp) {
        await handleControlIntent(intent);
        setMicState("success");
        setIsProcessing(false);
        setFlowStage("");
        setTimeout(() => setMicState("idle"), 800);
        return;
      }

      setFlowStage("正在绘制草图");
      await applyIntentToCanvas(intent);
      setCanvasMode("canvas");

      setFlowStage("正在自动保存 PNG");
      const dataUrl = await saveCurrentArtwork(false);
      if (!dataUrl) {
        throw new Error("Auto-save failed");
      }

      setPendingImageSource(dataUrl);
      setIsIntentModalOpen(true);
      setFlowStage("等待高级生成");
      setMicState("success");
      setIsProcessing(false);
      setTimeout(() => setMicState("idle"), 800);
    } catch (error) {
      console.error(error);
      setMicState("error");
      setIsProcessing(false);
      setFlowStage("");
      addToast("语音指令处理失败，请再试一次。", "error");
      setTimeout(() => setMicState("idle"), 1200);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      setUser({
        id: authUser.id,
        name: authUser.user_metadata?.name || authUser.email?.split("@")[0] || "用户",
        email: authUser.email || "",
        avatarUrl: authUser.user_metadata?.avatar_url,
        isLoggedIn: true,
      });

      await refreshCredits();

      if (artworkIdQuery) {
        const { artwork } = await fetchArtwork(artworkIdQuery);
        if (artwork?.canvas_json && canvasRef.current) {
          setArtworkId(artwork.id);
          setArtworkTitle(artwork.title || "未命名画作");
          canvasRef.current.setShapesData(JSON.parse(artwork.canvas_json));
        }
      }
    };

    void checkAuth();
  }, [artworkIdQuery, router]);

  useEffect(() => {
    if (canvasRef.current && !canvasAgentRef.current) {
      canvasAgentRef.current = new CanvasAgent({
        onToast: (message, type) => addToast(message, type),
        onDrawingComplete: () => {
          setCanvasMode("canvas");
        },
      });
      canvasAgentRef.current.setCanvasRef(canvasRef.current);
    }
  }, [addToast]);

  const handleAdvancedGenerate = async () => {
    if (!currentIntent || !pendingImageSource) return;
    if (credits < 1) {
      addToast("积分不足", "error");
      return;
    }

    try {
      setIsIntentModalOpen(false);
      setIsProcessing(true);
      setMicState("processing");
      setFlowStage("正在生成高级图片");

      const result = await generateImage(
        currentIntent.imagePrompt || currentIntent.transcript,
        pendingImageSource,
      );

      if (typeof result.credits === "number") {
        setCredits(result.credits);
      }

      const finalImageUrl = result.storageUrl || result.imageUrl;
      await canvasRef.current?.addShape("image", "#FFFFFF", "center", "large", finalImageUrl);
      setCanvasMode("ai_generate");
      await saveCurrentArtwork(false);

      canvasConfetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
      });

      addToast("高级图片生成成功", "success");
      setMicState("success");
      setIsProcessing(false);
      setFlowStage("");
      setTimeout(() => setMicState("idle"), 1000);
    } catch (error) {
      console.error(error);
      setMicState("error");
      setIsProcessing(false);
      setFlowStage("");
      addToast("高级图片生成失败", "error");
      setTimeout(() => setMicState("idle"), 1200);
      await refreshCredits();
    }
  };

  const handleMicTrigger = async () => {
    if (isRecording) {
      // 停止录音
      webSpeechRef.current?.stop();
      setIsRecording(false);
      setInterimTranscript("");

      // 如果有最终文本，处理它
      if (transcript.trim()) {
        setIsProcessing(true);
        setMicState("processing");
        setFlowStage("正在解析指令");
        await processTranscript(transcript);
      } else {
        setMicState("idle");
        setFlowStage("");
      }
      return;
    }

    // 开始录音
    setTranscript("");
    setInterimTranscript("");
    setFlowStage("正在录音");
    setIsRecording(true);
    setMicState("recording");

    if (
      typeof window !== "undefined" &&
      window.isSecureContext === false &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      addToast("语音识别需要在 HTTPS 或 localhost 环境中使用。", "error");
      setIsRecording(false);
      setMicState("error");
      setFlowStage("");
      setTimeout(() => setMicState("idle"), 1200);
      return;
    }

    // 使用 Web Speech API 进行实时语音识别
    webSpeechRef.current?.destroy();
    const webSpeechManager = new WebSpeechRecognitionManager({
      onInterim: (text) => {
        // 实时显示用户正在说的内容
        setInterimTranscript(text);
      },
      onFinal: (text) => {
        // 累积最终识别结果
        setTranscript((prev) => prev + text);
        setInterimTranscript("");
      },
      onError: (error) => {
        console.error("Web Speech API error:", error);
        setIsRecording(false);
        setMicState("error");
        setFlowStage("");
        
        // 如果是网络错误，提供备用输入方式
        if (error.includes("网络") || error.includes("network")) {
          const simulatedText = prompt(
            "语音识别网络连接失败，请手动输入绘画指令：",
          );
          if (simulatedText) {
            setTranscript(simulatedText);
            setIsProcessing(true);
            setMicState("processing");
            setFlowStage("正在解析指令");
            processTranscript(simulatedText);
            return;
          }
        }
        
        addToast(error || "语音识别失败，请重试", "error");
        setTimeout(() => setMicState("idle"), 1200);
      },
      onEnd: () => {
        // Web Speech API 自动结束时（如静音检测）
        setIsRecording(false);
        setInterimTranscript("");

        // 如果有识别结果，自动处理
        if (transcript.trim()) {
          setIsProcessing(true);
          setMicState("processing");
          setFlowStage("正在解析指令");
          processTranscript(transcript);
        } else {
          setMicState("idle");
          setFlowStage("");
        }
      },
    });
    webSpeechRef.current = webSpeechManager;

    if (!webSpeechManager.isSupported()) {
      addToast("您的浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器", "error");
      setIsRecording(false);
      setMicState("error");
      setFlowStage("");
      setTimeout(() => setMicState("idle"), 1200);
      return;
    }

    const started = webSpeechManager.start();
    if (!started) {
      addToast("无法启动语音识别，请检查麦克风权限", "error");
      setIsRecording(false);
      setMicState("error");
      setFlowStage("");
      setTimeout(() => setMicState("idle"), 1200);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (!artworkTitle.trim()) {
      setArtworkTitle("未命名画作");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface font-sans h-screen select-none overflow-hidden relative">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <IntentModal
        isOpen={isIntentModalOpen}
        transcript={transcript}
        credits={credits}
        onConfirm={handleAdvancedGenerate}
        onClose={() => {
          setIsIntentModalOpen(false);
          setFlowStage("");
        }}
      />

      <header className="h-[56px] bg-white border-b border-border-custom px-4 flex items-center justify-between z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className="text-base font-black text-text-primary tracking-tight cursor-pointer"
            onClick={() => router.push("/login")}
            data-action="nav-login"
          >
            VoiceCanvas
          </span>
          <div className="h-4 w-px bg-border-custom" />

          {isEditingTitle ? (
            <input
              type="text"
              value={artworkTitle}
              onChange={(event) => setArtworkTitle(event.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(event) => event.key === "Enter" && handleTitleBlur()}
              className="text-sm font-bold text-text-primary bg-surface border border-sakura rounded px-2 py-0.5 max-w-[150px] outline-none"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-bold text-text-primary hover:text-sakura border border-transparent hover:border-border-custom hover:bg-surface rounded px-2 py-0.5 transition-colors cursor-pointer"
            >
              {artworkTitle}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-butter bg-butter-light text-xs font-bold text-text-primary">
            <span>积分 {credits}</span>
            <span className="text-text-secondary">语音 -1 / 高清 -1</span>
          </div>

          <button
            onClick={() => startTransition(() => router.push("/square"))}
            disabled={isPending}
            data-action="square"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border-custom hover:border-lavender hover:bg-[#F0EBFF]/40 text-text-secondary hover:text-[#6A4BC9] rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>创作广场</span>
          </button>
          <button
            onClick={() => startTransition(() => router.push("/gallery"))}
            disabled={isPending}
            data-action="gallery"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border-custom hover:border-sakura hover:bg-[#FFEAEF]/40 text-text-secondary hover:text-[#B3455C] rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            <FolderHeart className="w-3.5 h-3.5" />
            <span>我的作品库</span>
          </button>
          <div className="h-4 w-px bg-border-custom" />
          {user && (
            <div className="flex items-center gap-2">
              <img
                src={user.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg"}
                alt="Avatar"
                className="w-8 h-8 rounded-full border border-sakura bg-sakura-light"
              />
              <button
                onClick={handleLogout}
                data-action="logout"
                className="p-1.5 rounded-full hover:bg-[#FFF0EF] text-text-disabled hover:text-[#D04D43] transition-colors focus:outline-none"
                title="退出登录"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <aside className="w-full md:w-64 bg-white border-r border-border-custom flex md:flex-col justify-between p-4 gap-4 z-10 shrink-0 shadow-inner">
          <div className="flex flex-row md:flex-col gap-4 w-full justify-between md:justify-start">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-text-disabled uppercase tracking-wider">
                当前画笔
              </span>
              <div className="flex items-center gap-2 bg-surface border border-border-custom/40 rounded-xl p-2">
                <div
                  className="w-5 h-5 rounded-md border border-black/10"
                  style={{ backgroundColor: currentColor }}
                />
                <span className="text-xs font-bold text-text-primary">
                  {currentColorName}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-text-disabled uppercase tracking-wider">
                当前模式
              </span>
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold self-start w-fit border ${
                  canvasMode === "canvas"
                    ? "bg-macaron-blue-light text-[#2F6196] border-[#d6e9fc]"
                    : "bg-lavender/10 text-[#6A4BC9] border-[#e4dcfa]"
                }`}
              >
                {canvasMode === "canvas" ? (
                  <Palette className="w-3.5 h-3.5" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{canvasMode === "canvas" ? "Canvas 草图" : "高级图片"}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="rounded-xl border border-border-custom/50 bg-surface p-3">
              <p className="text-[11px] font-bold text-text-disabled uppercase tracking-wider">
                当前流程
              </p>
              <p className="mt-1 text-xs font-medium text-text-primary">
                {"录音 -> Fun-ASR -> Qwen3.7-Max -> Canvas -> 自动保存 -> 高级生成可选"}
              </p>
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => canvasRef.current?.undo()}
                disabled={!canUndo}
                data-action="undo"
                className="flex-1 p-2 bg-white hover:bg-surface border border-border-custom hover:border-sakura rounded-xl flex justify-center text-text-secondary disabled:opacity-30"
                title="撤销"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => canvasRef.current?.redo()}
                disabled={!canRedo}
                data-action="redo"
                className="flex-1 p-2 bg-white hover:bg-surface border border-border-custom hover:border-sakura rounded-xl flex justify-center text-text-secondary disabled:opacity-30"
                title="重做"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => void saveCurrentArtwork(true)}
              data-action="save"
              className="flex items-center justify-center gap-1.5 py-2 px-3 border border-border-custom hover:border-sakura rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-surface"
            >
              <Save className="w-4 h-4" />
              <span>保存到库</span>
            </button>
            <button
              onClick={() => void handleExportPNG()}
              data-action="export"
              className="flex items-center justify-center gap-1.5 py-2 px-3 border border-border-custom hover:border-sakura rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-surface"
            >
              <Download className="w-4 h-4" />
              <span>导出 PNG</span>
            </button>
            <button
              onClick={() => {
                canvasRef.current?.clear();
                addToast("画布已清空", "warning");
              }}
              data-action="clear"
              className="flex items-center justify-center gap-1.5 py-2 px-3 border border-[#FFF0EF] hover:border-[#FFBDB8] hover:bg-[#FFF0EF]/40 rounded-xl text-xs font-bold text-text-secondary hover:text-[#D04D43]"
            >
              <Trash2 className="w-4 h-4" />
              <span>清空画布</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 p-4 flex flex-col justify-between overflow-hidden relative min-h-0 bg-surface">
          <div className="flex-1 relative min-h-0 mb-4">
            <CanvasBoard
              ref={canvasRef}
              onHistoryChange={(undoable, redoable) => {
                setCanUndo(undoable);
                setCanRedo(redoable);
              }}
              onSaveState={() => {
                if (!canvasRef.current) return;
                const status = canvasRef.current.getHistoryStatus();
                setCanUndo(status.canUndo);
                setCanRedo(status.canRedo);
              }}
            />

            <div className="absolute top-3 left-3 pointer-events-none z-10 flex flex-col gap-1 text-[11px] font-medium text-text-secondary bg-white/85 backdrop-blur border border-border-custom/50 rounded-xl p-3 max-w-[260px]">
              <span className="font-bold text-text-primary text-xs flex gap-1 items-center">
                <HelpCircle className="w-3.5 h-3.5 text-sakura" />
                语音提示
              </span>
              <span className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-sakura" />
                “画一个红色的圆形在中间”
              </span>
              <span className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-sakura" />
                “在左上角写上你好世界”
              </span>
              <span className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-sakura" />
                “画一片夕阳下的海边”
              </span>
              <span className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-sakura" />
                先生成 Canvas 草图，再决定是否高级生成
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 z-10 select-none">
            <TranscriptBar
              transcript={transcript}
              interimTranscript={interimTranscript}
              isRecording={isRecording}
              isProcessing={isProcessing}
              stage={flowStage}
            />

            <div
              className="h-[96px] flex flex-col items-center justify-center relative"
              data-action="mic"
            >
              <MicButton
                state={micState}
                onClick={() => void handleMicTrigger()}
                disabled={isProcessing || credits < 1}
              />
              <span className="text-[10px] font-bold text-text-disabled mt-1 text-center">
                {credits < 1
                  ? "积分不足，无法继续录音"
                  : isRecording
                    ? "说出绘图命令，说完后再次点击按钮"
                    : "点击按钮开始说话"}
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function CanvasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-surface h-full">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-sakura border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-text-secondary font-bold">正在载入创作工作区...</p>
          </div>
        </div>
      }
    >
      <CanvasContent />
    </Suspense>
  );
}
