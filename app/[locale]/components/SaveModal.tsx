"use client";

import { useEffect, useRef } from "react";
import { X, Save } from "lucide-react";
import gsap from "gsap";

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
}

export default function SaveModal({
  isOpen,
  onClose,
  onSave,
  title,
  onTitleChange,
}: SaveModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 动画
  useEffect(() => {
    if (!isOpen) return;

    // 背景淡入
    gsap.fromTo(
      backdropRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.3, ease: "power2.out" }
    );

    // Modal弹出
    gsap.fromTo(
      modalRef.current,
      { scale: 0.8, opacity: 0, y: 50 },
      {
        scale: 1,
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: "back.out(1.8)",
      }
    );

    // 自动聚焦输入框
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => {
      gsap.killTweensOf([backdropRef.current, modalRef.current]);
    };
  }, [isOpen]);

  // 关闭动画
  const handleClose = () => {
    gsap.to(backdropRef.current, {
      opacity: 0,
      duration: 0.2,
      ease: "power2.in",
    });

    gsap.to(modalRef.current, {
      scale: 0.8,
      opacity: 0,
      y: 50,
      duration: 0.25,
      ease: "power2.in",
      onComplete: onClose,
    });
  };

  // 处理保存
  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (trimmedTitle) {
      onSave(trimmedTitle);
      handleClose();
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-3xl shadow-xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sakura/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-mint-light flex items-center justify-center">
              <Save className="w-5 h-5 text-mint" />
            </div>
            <h2
              id="save-modal-title"
              className="text-lg font-semibold text-text-primary"
            >
              保存作品
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-sakura-light/20 transition-all"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <label
            htmlFor="artwork-title"
            className="block text-sm font-medium text-text-primary mb-2"
          >
            作品名称
          </label>
          <input
            ref={inputRef}
            id="artwork-title"
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入作品名称..."
            className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-primary outline-none transition-all placeholder:text-text-disabled focus:border-sakura focus:ring-2 focus:ring-sakura/30"
            maxLength={50}
          />
          <p className="text-xs text-text-secondary mt-2">
            最多50个字符
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-surface/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-sakura-light/20 transition-all font-medium text-sm"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
              title.trim()
                ? "bg-mint hover:bg-mint/90 text-white shadow-sm"
                : "bg-text-disabled text-white cursor-not-allowed"
            }`}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}