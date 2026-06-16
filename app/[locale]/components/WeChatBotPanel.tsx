"use client";

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { gsap } from 'gsap';

interface WeChatBotPanelProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export default function WeChatBotPanel({ canvasRef }: WeChatBotPanelProps) {
  const [isSending, setIsSending] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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

  const handleSendToWeChat = async () => {
    if (!canvasRef.current) {
      return;
    }

    setIsSending(true);

    try {
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png');
      
      const response = await fetch(imageData);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('image', blob, 'canvas.png');
      
      const result = await fetch('/api/wechat/send', {
        method: 'POST',
        body: formData,
      });
      
      const data = await result.json();
      
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
                <p className="truncate text-sm font-semibold text-text-primary">微信分享</p>
                <p className="text-[11px] text-text-secondary">演示模式</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-sakura-light/20 hover:text-text-primary"
            aria-label={isExpanded ? '收起面板' : '展开面板'}
            aria-pressed={isExpanded}
          >
            {isExpanded ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center gap-3 px-2 py-3">
          <div className="flex w-full items-center justify-center rounded-2xl border border-sakura/10 bg-white/80 px-2 py-3">
            <CheckCircle className="h-5 w-5 text-mint" />
            {isExpanded && (
              <div className="ml-2 min-w-0 flex-1">
                <p className="text-xs text-text-secondary">连接状态</p>
                <p className="truncate text-sm font-medium text-text-primary">已就绪</p>
              </div>
            )}
          </div>

          {isExpanded && (
            <div className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-y-auto pr-1">
              <div className="rounded-2xl bg-white/85 p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-text-secondary">目标联系人</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sakura-light text-xs font-medium text-sakura">
                    演
                  </div>
                  <span className="truncate text-sm text-text-primary">演示用户</span>
                </div>
                <p className="mt-2 text-xs text-text-disabled">
                  当前为演示模式
                </p>
              </div>

              {lastSent && (
                <div className="rounded-2xl border border-mint/20 bg-mint-light/50 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-mint" />
                    <span className="text-xs text-mint">最近发送于 {lastSent}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-sakura/10 p-2">
          <button
            onClick={handleSendToWeChat}
            disabled={isSending}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-medium transition-all ${
              !isSending
                ? 'bg-mint text-white shadow-sm hover:bg-mint/90'
                : 'bg-text-disabled text-white cursor-not-allowed'
            }`}
            aria-label="保存画布"
          >
            <Send className={`h-4 w-4 ${isSending ? 'animate-pulse' : ''}`} />
            {isExpanded ? (isSending ? '保存中...' : '保存画布') : null}
          </button>
        </div>
      </div>
    </div>
  );
}