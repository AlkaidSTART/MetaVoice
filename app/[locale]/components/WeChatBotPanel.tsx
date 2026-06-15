"use client";

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Send, CheckCircle, XCircle, RefreshCw, QrCode } from 'lucide-react';

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

  // 获取机器人状态
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/wechat/send');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      setStatus({ ready: false, hasTargetContact: false, targetContactName: null });
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
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
    <div className="w-64 bg-surface/90 backdrop-blur-sm border-l border-sakura/10 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="font-semibold text-text-primary">微信机器人</h3>
        </div>
      </div>

      {/* Status */}
      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {/* Bot Status */}
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">机器人状态</span>
            <button
              onClick={fetchStatus}
              className="p-1 hover:bg-sakura-light/20 rounded-lg transition-colors"
              aria-label="刷新状态"
            >
              <RefreshCw className={`w-4 h-4 text-text-disabled ${status.ready ? '' : 'animate-spin'}`} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {status.ready ? (
              <>
                <CheckCircle className="w-5 h-5 text-mint" />
                <span className="text-sm text-text-primary">已连接</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-text-disabled" />
                <span className="text-sm text-text-disabled">未连接</span>
              </>
            )}
          </div>
        </div>

        {/* Target Contact */}
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <span className="text-sm text-text-secondary">目标联系人</span>
          <div className="mt-2 flex items-center gap-2">
            {status.hasTargetContact ? (
              <>
                <div className="w-8 h-8 rounded-full bg-sakura-light flex items-center justify-center">
                  <span className="text-xs font-medium text-sakura">
                    {status.targetContactName?.charAt(0) || '?'}
                  </span>
                </div>
                <span className="text-sm text-text-primary">{status.targetContactName}</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-text-disabled" />
                <span className="text-sm text-text-disabled">未绑定</span>
              </>
            )}
          </div>
          {!status.hasTargetContact && (
            <p className="text-xs text-text-disabled mt-2">
              请在微信中向机器人发送"绑定"指令
            </p>
          )}
        </div>

        {/* Last Sent */}
        {lastSent && (
          <div className="bg-mint-light/50 rounded-xl p-3 border border-mint/20">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-mint" />
              <span className="text-sm text-mint">
                已发送: {lastSent}
              </span>
            </div>
          </div>
        )}

        {/* QR Code Hint */}
        {!status.ready && (
          <div className="bg-butter-light/50 rounded-xl p-3 border border-butter/20">
            <div className="flex items-center gap-2 mb-2">
              <QrCode className="w-4 h-4 text-butter" />
              <span className="text-sm text-text-primary">启动机器人</span>
            </div>
            <p className="text-xs text-text-secondary">
              在终端运行: npm run wechaty
            </p>
          </div>
        )}
      </div>

      {/* Send Button */}
      <div className="p-4 border-t border-border">
        <button
          onClick={handleSendToWeChat}
          disabled={!status.ready || !status.hasTargetContact || isSending}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
            status.ready && status.hasTargetContact && !isSending
              ? 'bg-green-500 hover:bg-green-600 text-white shadow-sm'
              : 'bg-text-disabled text-white cursor-not-allowed'
          }`}
        >
          <Send className={`w-4 h-4 ${isSending ? 'animate-pulse' : ''}`} />
          {isSending ? '发送中...' : '发送到微信'}
        </button>
      </div>
    </div>
  );
}