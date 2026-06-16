"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Send, CheckCircle, XCircle, RefreshCw, QrCode, ChevronLeft, ChevronRight } from 'lucide-react';
import { gsap } from 'gsap';

interface WeChatBotPanelProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export default function WeChatBotPanel({ canvasRef }: WeChatBotPanelProps) {
  const [status, setStatus] = useState({
    ready: false,
    hasTargetContact: false,
    targetContactName: null as string | null,
  });
  const [isSending, setIsSending] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const parseJsonSafely = useCallback(async (response: Response) => {
    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${text.slice(0, 120)}`);
    }
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      gsap.set(panel, { width: isExpanded ? 240 : 72 });
      return;
    }

    gsap.to(panel, {
      width: isExpanded ? 240 : 72,
      duration: 0.35,
      ease: 'power2.out',
    });
  }, [isExpanded]);

  // 获取机器人状态
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/wechat/send');
      const data = await parseJsonSafely(response);
      setStatus(data);
    } catch {
      setStatus({ ready: false, hasTargetContact: false, targetContactName: null });
    }
  }, [parseJsonSafely]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchStatus();
    }, 0);
    const interval = setInterval(fetchStatus, 5000);
    return () => {
      window.clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchStatus]);

  // 发送画布内容到微信
  const handleSendToWeChat = async () => {
    if (!canvasRef.current) {
      return;
    }

    if (!status.ready) {
      alert('机器人未就绪');
      return;
    }

    if (!status.hasTargetContact) {
      alert('请先在微信中发送"绑定"指令');
      return;
    }

    setIsSending(true);

    try {
      // 将画布转换为图片
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png');
      
      // 转换为 Blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      
      // 创建 FormData
      const formData = new FormData();
      formData.append('image', blob, 'canvas.png');
      
      // 发送到 API
      const result = await fetch('/api/wechat/send', {
        method: 'POST',
        body: formData,
      });
      
      const data = await parseJsonSafely(result);
      
      if (data.success) {
        setLastSent(new Date().toLocaleString());
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Send error:', error);
      alert('发送失败');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      ref={panelRef}
      className="h-full w-[72px] shrink-0 overflow-hidden rounded-3xl border border-sakura/10 bg-surface/92 shadow-lg shadow-sakura/5 backdrop-blur-sm"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-sakura/10 px-3 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-mint-light text-mint">
              <MessageCircle className="h-4 w-4" />
            </div>
            {isExpanded && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">微信机器人</p>
                <p className="text-[11px] text-text-secondary">
                  {status.ready ? '已连接' : '待连接'}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-sakura-light/20 hover:text-text-primary"
            aria-label={isExpanded ? '收起微信机器人面板' : '展开微信机器人面板'}
            aria-pressed={isExpanded}
          >
            {isExpanded ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center gap-3 px-2 py-3">
          <div className="flex w-full items-center justify-center rounded-2xl border border-sakura/10 bg-white/80 px-2 py-3">
            {status.ready ? (
              <CheckCircle className="h-5 w-5 text-mint" />
            ) : (
              <XCircle className="h-5 w-5 text-text-disabled" />
            )}
            {isExpanded && (
              <div className="ml-2 min-w-0 flex-1">
                <p className="text-xs text-text-secondary">机器人状态</p>
                <p className="truncate text-sm font-medium text-text-primary">
                  {status.ready ? '已连接' : '未连接'}
                </p>
              </div>
            )}
          </div>

          {isExpanded && (
            <div className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-y-auto pr-1">
              <div className="rounded-2xl bg-white/85 p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-text-secondary">目标联系人</span>
                  <button
                    onClick={fetchStatus}
                    className="rounded-lg p-1 transition-colors hover:bg-sakura-light/20"
                    aria-label="刷新状态"
                  >
                    <RefreshCw className={`h-4 w-4 text-text-disabled ${status.ready ? '' : 'animate-spin'}`} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {status.hasTargetContact ? (
                    <>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sakura-light text-xs font-medium text-sakura">
                        {status.targetContactName?.charAt(0) || '?'}
                      </div>
                      <span className="truncate text-sm text-text-primary">{status.targetContactName}</span>
                    </>
                  ) : (
                    <span className="text-sm text-text-disabled">未绑定</span>
                  )}
                </div>
                {!status.hasTargetContact && (
                  <p className="mt-2 text-xs text-text-disabled">
                    请向机器人发送 &quot;绑定&quot; 指令
                  </p>
                )}
              </div>

              {lastSent && (
                <div className="rounded-2xl border border-mint/20 bg-mint-light/50 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-mint" />
                    <span className="text-xs text-mint">最近发送于 {lastSent}</span>
                  </div>
                </div>
              )}

              {!status.ready && (
                <div className="rounded-2xl border border-butter/20 bg-butter-light/50 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-butter" />
                    <span className="text-sm text-text-primary">启动机器人</span>
                  </div>
                  <p className="text-xs text-text-secondary">在终端运行 `npm run wechaty`</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-sakura/10 p-2">
          <button
            onClick={handleSendToWeChat}
            disabled={!status.ready || !status.hasTargetContact || isSending}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-medium transition-all ${
              status.ready && status.hasTargetContact && !isSending
                ? 'bg-mint text-white shadow-sm hover:bg-mint/90'
                : 'bg-text-disabled text-white cursor-not-allowed'
            }`}
            aria-label="发送到微信"
          >
            <Send className={`h-4 w-4 ${isSending ? 'animate-pulse' : ''}`} />
            {isExpanded ? (isSending ? '发送中...' : '发送到微信') : null}
          </button>
        </div>
      </div>
    </div>
  );
}
