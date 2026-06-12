"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useTransition,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Undo2,
  Redo2,
  Trash2,
  Download,
  Save,
  Palette,
  HelpCircle,
  FolderHeart,
  LogOut,
  ChevronRight,
  Sparkles,
  Globe,
} from "lucide-react";
import { CanvasBoardRef } from "@/components/canvas/CanvasBoard";
import CanvasBoard from "@/components/canvas/CanvasBoard";
import MicButton, { MicState } from "@/components/voice/MicButton";
import TranscriptBar from "@/components/voice/TranscriptBar";
import IntentModal from "@/components/voice/IntentModal";
import ToastContainer, { ToastMessage, ToastType } from "@/components/ui/Toast";
import {
  VoiceRecognitionManager,
  COLOR_NAME_MAP,
  type IntentResult,
} from "@/lib/voice/speechRecognition";
import {
  matchVoiceToAction,
  executeAction,
} from "@/lib/voice/voiceActionMapper";
import { fetchArtwork, saveArtworkViaApi } from "@/lib/api/artworks";
import { analyzeIntent, generateImage } from "@/lib/api/voice";
import { createClient } from "@/lib/supabase/client";
import canvasConfetti from "canvas-confetti";

// User profile type used in the canvas page
interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isLoggedIn: boolean;
}

function CanvasContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const artworkIdQuery = searchParams.get("id");
  const [isPending, startTransition] = useTransition();

  // State managers
  const [user, setUser] = useState<UserProfile | null>(null);
  const [artworkId, setArtworkId] = useState<string | null>(null);
  const [artworkTitle, setArtworkTitle] = useState<string>("未命名画作");
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);

  const [micState, setMicState] = useState<MicState>("idle");
  const [transcript, setTranscript] = useState<string>("");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Layout states
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [currentIntent, setCurrentIntent] = useState<IntentResult | null>(null);
  const [isIntentModalOpen, setIsIntentModalOpen] = useState<boolean>(false);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const [currentColor, setCurrentColor] = useState<string>("#B5D5F5"); // default blue
  const [currentColorName, setCurrentColorName] = useState<string>("蓝色");
  const [canvasMode, setCanvasMode] = useState<"canvas" | "ai_generate">(
    "canvas",
  );

  // References
  const canvasRef = useRef<CanvasBoardRef>(null);
  const voiceManagerRef = useRef<VoiceRecognitionManager | null>(null);

  // Toast emitter helper
  const addToast = (message: string, type: ToastType = "info") => {
    const id = "toast_" + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  function translateShapeName(shape: string) {
    return (
      {
        circle: "圆形",
        rect: "方形",
        line: "直线",
        triangle: "三角形",
        star: "五角星",
      }[shape] || shape
    );
  }

  async function handleSaveArtwork() {
    if (!canvasRef.current) return;
    const shapesData = canvasRef.current.getShapesData();
    if (shapesData.length === 0) {
      addToast("当前画布为空，没有内容可以保存。", "warning");
      return;
    }

    const dataUrl = canvasRef.current.exportImage();
    const response = await saveArtworkViaApi({
      id: artworkId,
      title: artworkTitle,
      canvasJson: JSON.stringify(shapesData),
      thumbnailDataUrl: dataUrl,
      tags: ["Canvas"],
      isPublic: true,
    });
    if (response?.artwork) {
      setArtworkId(response.artwork.id);
    }

    canvasConfetti({
      particleCount: 60,
      spread: 50,
      colors: ["#FFB7C5", "#B5D5F5", "#B5E8C7", "#FFE5A0"],
    });

    addToast(`作品 "${artworkTitle}" 保存成功！已同步到广场`, "success");
  }

  async function handleExportPNG() {
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

    try {
      const blob = await (await fetch(dataUrl)).blob();
      const formData = new FormData();
      formData.append(
        "file",
        blob,
        `${artworkTitle || "voicecanvas_artwork"}.png`,
      );

      const response = await fetch("/api/storage/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || "Upload failed");
      }

      addToast("导出图片已自动上传到 voice bucket。", "success");
    } catch (error) {
      console.error(error);
      addToast("本地导出成功，但上传 bucket 失败。", "warning");
    }
  }

  function executeIntent(intent: IntentResult) {
    const { type, canvasOp } = intent;

    if (!canvasOp) {
      setCurrentIntent(intent);
      setIsIntentModalOpen(true);
      setMicState("idle");
      return;
    }

    if (type === "control") {
      const action = canvasOp.action;
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
        handleSaveArtwork();
      } else if (action === "export") {
        handleExportPNG();
      }

      setMicState("success");
      setTimeout(() => setMicState("idle"), 1000);
      return;
    }

    if (type === "canvas") {
      const {
        action,
        shape,
        color,
        colorName,
        position,
        size,
        text: textDetail,
      } = canvasOp;

      if (action === "draw" && shape) {
        canvasRef.current?.addShape(
          shape,
          color || "#B5D5F5",
          position?.anchor || "center",
          size?.scale || "medium",
        );

        if (color) {
          setCurrentColor(color);
          setCurrentColorName(colorName || COLOR_NAME_MAP[color] || "自定义");
        }
        setCanvasMode("canvas");
        addToast(
          `成功绘制了一个${colorName || ""}${translateShapeName(shape)}`,
          "success",
        );
      } else if (action === "text" && textDetail) {
        canvasRef.current?.addShape(
          "text",
          color || "#1A1A1A",
          position?.anchor || "center",
          "medium",
          textDetail,
        );
        addToast(`成功写入文字: "${textDetail}"`, "success");
      }

      setMicState("success");
      setTimeout(() => setMicState("idle"), 1000);
      return;
    }

    setCurrentIntent(intent);
    setIsIntentModalOpen(true);
    setMicState("idle");
  }

  function handleVoiceCommandComplete(text: string) {
    if (!text.trim()) {
      setIsRecording(false);
      setMicState("idle");
      return;
    }

    // Check if the command matches a UI navigation/action first
    const matched = matchVoiceToAction(text);
    if (matched) {
      setIsRecording(false);
      setMicState("success");
      executeAction(matched.action);
      setTimeout(() => setMicState("idle"), 1000);
      return;
    }

    setIsRecording(false);
    setIsProcessing(true);
    setMicState("processing");

    setTimeout(async () => {
      try {
        const intent = await analyzeIntent(text);
        setIsProcessing(false);

        if (intent.confidence >= 0.8 && intent.type !== "ambiguous") {
          executeIntent(intent);
        } else {
          setCurrentIntent(intent);
          setMicState("idle");
          setIsIntentModalOpen(true);
        }
      } catch (error) {
        console.error(error);
        setIsProcessing(false);
        setMicState("error");
        addToast("语音指令解析失败，请再试一次。", "error");
        setTimeout(() => setMicState("idle"), 1200);
      }
    }, 700);
  }

  // 1. Initial configuration: check login and query param
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }
      setUser({
        id: user.id,
        name: user.user_metadata?.name || user.email?.split("@")[0] || "用户",
        email: user.email || "",
        avatarUrl: user.user_metadata?.avatar_url,
        isLoggedIn: true,
      });

      if (artworkIdQuery) {
        const { artwork: art } = await fetchArtwork(artworkIdQuery);
        if (art) {
          setArtworkId(art.id);
          setArtworkTitle(art.title || "未命名画作");
          setTimeout(() => {
            if (canvasRef.current && art.canvas_json) {
              try {
                canvasRef.current.setShapesData(JSON.parse(art.canvas_json));
                addToast("作品加载成功！", "success");
              } catch (e) {
                console.error(e);
                addToast("解析作品数据失败", "error");
              }
            }
          }, 100);
        }
      }
    };

    checkAuth();
  }, [artworkIdQuery, router]);

  // 2. Initialize Voice Recognition Manager
  useEffect(() => {
    const manager = new VoiceRecognitionManager(
      // onResult
      (text, isFinal) => {
        setTranscript(text);
        if (isFinal) {
          handleVoiceCommandComplete(text);
        }
      },
      // onError
      (err) => {
        console.error("Speech Recognition Error:", err);
        if (err.error === "not-allowed") {
          addToast("麦克风权限被拒绝，请在浏览器设置中开启后重试。", "error");
        } else {
          addToast("语音输入遇到问题，请重新录制。", "warning");
        }
        setIsRecording(false);
        setMicState("error");
        setTimeout(() => setMicState("idle"), 1200);
      },
      // onEnd
      () => {
        setIsRecording(false);
        if (micState === "recording") {
          setMicState("idle");
        }
      },
    );

    if (manager.isSupported()) {
      voiceManagerRef.current = manager;
    } else {
      setTimeout(() => {
        addToast(
          "您的浏览器不支持原生语音识别，已激活模拟命令输入栏。",
          "info",
        );
      }, 0);
    }

    return () => {
      if (voiceManagerRef.current) {
        voiceManagerRef.current.stop();
      }
    };
  }, [micState]);

  // 5. Intent Modal callback
  const handleIntentResolution = (option: "canvas" | "ai_generate") => {
    setIsIntentModalOpen(false);

    if (!currentIntent) return;

    if (option === "canvas") {
      // Fallback: draw a star or shape from transcript
      const text = currentIntent.transcript;
      let shape: "star" | "circle" | "rect" = "circle";
      if (text.includes("星")) shape = "star";
      else if (text.includes("方") || text.includes("矩")) shape = "rect";

      canvasRef.current?.addShape(shape, currentColor, "center", "medium");
      addToast(
        `成功绘制了一个${currentColorName}${translateShapeName(shape)}`,
        "success",
      );

      setMicState("success");
      setTimeout(() => setMicState("idle"), 1000);
    } else if (option === "ai_generate") {
      addToast("AI 生图排队中，正在合成场景图像...", "info");
      setMicState("processing");
      setIsProcessing(true);

      const promptKeyword =
        currentIntent.imagePrompt ||
        currentIntent.transcript ||
        "beautiful pastel art";

      generateImage(promptKeyword)
        .then(async (result) => {
          const finalImageUrl = result.storageUrl || result.imageUrl;

          canvasRef.current?.addShape(
            "image",
            "#ffffff",
            "center",
            "large",
            finalImageUrl,
          );

          setIsProcessing(false);
          setMicState("success");
          setCanvasMode("ai_generate");

          canvasConfetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.7 },
          });

          addToast("AI 场景生成并载入画布成功！", "success");
          setTimeout(() => setMicState("idle"), 1200);
        })
        .catch((error) => {
          console.error(error);
          setIsProcessing(false);
          setMicState("error");
          addToast("AI 生图失败，请重试。", "error");
          setTimeout(() => setMicState("idle"), 1200);
        });
    }
  };

  // Trigger recording
  const handleMicTrigger = () => {
    if (isRecording) {
      // Stop recording and process
      setIsRecording(false);
      voiceManagerRef.current?.stop();
    } else {
      // Start recording
      setTranscript("");
      setIsRecording(true);
      setMicState("recording");

      if (voiceManagerRef.current) {
        voiceManagerRef.current.start();
      } else {
        // Fallback input box simulator for non-speech browsers (Safari on some platforms, tests, etc.)
        const simulatedText = prompt(
          "请输入你想执行的绘画指令（语音模拟）：\n例如: '在中间画一个红色的圆形', '画一个黄色的五角星在左边', '撤销', '保存'",
        );
        if (simulatedText) {
          setTranscript(simulatedText);
          handleVoiceCommandComplete(simulatedText);
        } else {
          setIsRecording(false);
          setMicState("idle");
        }
      }
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
    <div className="flex-1 flex flex-col bg-[#FAFAF8] font-sans h-screen select-none overflow-hidden relative">
      {/* Toast Manager */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Disambiguation Modal */}
      <IntentModal
        isOpen={isIntentModalOpen}
        transcript={transcript}
        onSelect={handleIntentResolution}
        onClose={() => {
          setIsIntentModalOpen(false);
          setTranscript("");
        }}
      />

      {/* Header */}
      <header className="h-[56px] bg-white border-b border-border-custom px-4 flex items-center justify-between z-30 shadow-sm">
        {/* Left: Brand Logo & back button */}
        <div className="flex items-center gap-3">
          <span
            className="text-base font-black text-text-primary tracking-tight cursor-pointer"
            onClick={() => router.push("/login")}
            data-action="nav-login"
          >
            VoiceCanvas
          </span>
          <div className="h-4 w-px bg-border-custom" />

          {/* Editable Title */}
          {isEditingTitle ? (
            <input
              type="text"
              value={artworkTitle}
              onChange={(e) => setArtworkTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === "Enter" && handleTitleBlur()}
              className="text-sm font-bold text-text-primary bg-surface border border-sakura rounded px-2 py-0.5 max-w-[150px] outline-none"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-bold text-text-primary hover:text-sakura border border-transparent hover:border-border-custom hover:bg-surface rounded px-2 py-0.5 transition-colors cursor-pointer"
              title="双击或点击重命名"
            >
              {artworkTitle}
            </button>
          )}
        </div>

        {/* Right: Actions & User */}
        <div className="flex items-center gap-3">
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
                src={
                  user.avatarUrl ||
                  "https://api.dicebear.com/7.x/adventurer/svg"
                }
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

      {/* Main workspace section */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Side: Drawing Tool Status Panel */}
        <aside className="w-full md:w-56 bg-white border-r border-border-custom flex md:flex-col justify-between p-4 gap-4 z-10 shrink-0 shadow-inner">
          {/* Tool status */}
          <div className="flex flex-row md:flex-col gap-4 w-full justify-between md:justify-start">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-text-disabled uppercase tracking-wider">
                当前画笔颜色
              </span>
              <div className="flex items-center gap-2 bg-[#FAFAF8] border border-border-custom/40 rounded-xl p-2">
                <div
                  className="w-5 h-5 rounded-md border border-black/10 transition-colors duration-300"
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
                <span>
                  {canvasMode === "canvas" ? "几何绘图" : "AI 智能场景"}
                </span>
              </span>
            </div>
          </div>

          {/* Quick buttons */}
          <div className="flex gap-2 items-center md:flex-col md:items-stretch">
            <div className="flex gap-1">
              <button
                onClick={() => {
                  canvasRef.current?.undo();
                  addToast("撤销操作", "info");
                }}
                disabled={!canUndo}
                data-action="undo"
                className="flex-1 p-2 bg-white hover:bg-surface border border-border-custom hover:border-sakura rounded-xl flex justify-center text-text-secondary disabled:opacity-30 disabled:hover:border-border-custom disabled:hover:bg-white cursor-pointer"
                title="撤销"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  canvasRef.current?.redo();
                  addToast("重做操作", "info");
                }}
                disabled={!canRedo}
                data-action="redo"
                className="flex-1 p-2 bg-white hover:bg-surface border border-border-custom hover:border-sakura rounded-xl flex justify-center text-text-secondary disabled:opacity-30 disabled:hover:border-border-custom disabled:hover:bg-white cursor-pointer"
                title="重做"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleSaveArtwork}
              data-action="save"
              className="flex items-center justify-center gap-1.5 py-2 px-3 border border-border-custom hover:border-sakura rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-surface cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span className="hidden md:inline">保存到库</span>
            </button>
            <button
              onClick={handleExportPNG}
              data-action="export"
              className="flex items-center justify-center gap-1.5 py-2 px-3 border border-border-custom hover:border-sakura rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-surface cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">导出 PNG</span>
            </button>
            <button
              onClick={() => {
                canvasRef.current?.clear();
                addToast("画布已清空", "warning");
              }}
              data-action="clear"
              className="flex items-center justify-center gap-1.5 py-2 px-3 border border-[#FFF0EF] hover:border-[#FFBDB8] hover:bg-[#FFF0EF]/40 rounded-xl text-xs font-bold text-text-secondary hover:text-[#D04D43] cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden md:inline">清空画布</span>
            </button>
          </div>
        </aside>

        {/* Center: Canvas Area */}
        <main className="flex-1 p-4 flex flex-col justify-between overflow-hidden relative min-h-0 bg-surface">
          {/* Canvas Wrapper */}
          <div className="flex-1 relative min-h-0 mb-4">
            <CanvasBoard
              ref={canvasRef}
              onHistoryChange={(undoable, redoable) => {
                setCanUndo(undoable);
                setCanRedo(redoable);
              }}
              onSaveState={() => {
                // Auto-sync history state checks
                if (canvasRef.current) {
                  const status = canvasRef.current.getHistoryStatus();
                  setCanUndo(status.canUndo);
                  setCanRedo(status.canRedo);
                }
              }}
            />

            {/* Quick floating guide */}
            <div className="absolute top-3 left-3 pointer-events-none z-10 flex flex-col gap-1 text-[11px] font-medium text-text-secondary bg-white/85 backdrop-blur border border-border-custom/50 rounded-xl p-3 max-w-[220px]">
              <span className="font-bold text-text-primary text-xs flex gap-1 items-center">
                <HelpCircle className="w-3.5 h-3.5 text-sakura" />{" "}
                语音指令提示：
              </span>
              <span className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-sakura" />
                “画一个红色的圆形在中间”
              </span>
              <span className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-sakura" />
                “在左上角写上‘你好世界’”
              </span>
              <span className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-sakura" />
                “画一个很大的五角星”
              </span>
              <span className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-sakura" />
                “画一个在草地跑的猫咪 (AI)”
              </span>
              <span className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-sakura" />
                “撤销” / “清空” / “保存”
              </span>
            </div>
          </div>

          {/* Bottom Overlay: Controls & Transcript */}
          <div className="flex flex-col gap-2 z-10 select-none">
            {/* Transcript Display */}
            <TranscriptBar
              transcript={transcript}
              isRecording={isRecording}
              isProcessing={isProcessing}
            />

            {/* Voice Control Core Button Area */}
            <div
              className="h-[96px] flex flex-col items-center justify-center relative"
              data-action="mic"
            >
              <MicButton
                state={micState}
                onClick={handleMicTrigger}
                disabled={isProcessing}
              />
              <span className="text-[10px] font-bold text-text-disabled mt-1 text-center">
                {isRecording
                  ? "说出绘图命令，说完了点击按钮"
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
            <p className="text-sm text-text-secondary font-bold">
              正在载入创作工作区...
            </p>
          </div>
        </div>
      }
    >
      <CanvasContent />
    </Suspense>
  );
}
