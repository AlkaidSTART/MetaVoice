"use client";

import React, { useRef, useEffect } from "react";
import { Sparkles, Palette, CornerDownRight } from "lucide-react";
import gsap from "gsap";

interface IntentModalProps {
  isOpen: boolean;
  transcript: string;
  onSelect: (option: "canvas" | "ai_generate") => void;
  onClose: () => void;
}

export default function IntentModal({
  isOpen,
  transcript,
  onSelect,
  onClose,
}: IntentModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";

      // GSAP entrance transition: pop overlay and elastic scale container
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.25, ease: "power2.out" },
      );
      gsap.fromTo(
        modalRef.current,
        { scale: 0.85, y: 30, opacity: 0 },
        { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: "back.out(1.8)" },
      );
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Handle keyboard/voice simulation directly
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "1") {
        onSelect("canvas");
      } else if (e.key === "2") {
        onSelect("ai_generate");
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intent-modal-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-sm bg-white rounded-3xl p-7 shadow-2xl border border-border-custom flex flex-col gap-6"
      >
        {/* Header */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-sakura tracking-wider uppercase">
            确认你的意图
          </span>
          <h2
            id="intent-modal-title"
            className="text-lg font-bold text-text-primary"
          >
            我听到了...
          </h2>
          <div className="bg-surface border border-border-custom/40 rounded-xl p-3 mt-1.5 italic text-sm text-text-secondary flex gap-2 items-start">
            <CornerDownRight className="w-4 h-4 text-text-disabled mt-0.5 flex-shrink-0" />
            <span>"{transcript}"</span>
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-text-secondary">你想要：</p>

          <div className="grid grid-cols-2 gap-3">
            {/* Option 1: Canvas Drawing */}
            <button
              onClick={() => onSelect("canvas")}
              className="group flex flex-col items-center justify-center gap-3 p-4 border-2 border-macaron-blue hover:bg-macaron-blue-light/20 rounded-2xl transition-standard text-center focus:outline-none focus:ring-4 focus:ring-macaron-blue/30 active:scale-95 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-macaron-blue-light flex items-center justify-center text-[#2F6196] group-hover:scale-110 transition-transform">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-xs font-bold text-text-disabled">
                  按 "1" 选择
                </span>
                <span className="text-sm font-bold text-[#2F6196]">
                  绘制图形
                </span>
              </div>
            </button>

            {/* Option 2: AI Image Generation */}
            <button
              onClick={() => onSelect("ai_generate")}
              className="group flex flex-col items-center justify-center gap-3 p-4 border-2 border-lavender hover:bg-lavender/10 rounded-2xl transition-standard text-center focus:outline-none focus:ring-4 focus:ring-lavender/30 active:scale-95 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#F0ECFC] flex items-center justify-center text-[#6A4BC9] group-hover:scale-110 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-xs font-bold text-text-disabled">
                  按 "2" 选择
                </span>
                <span className="text-sm font-bold text-[#6A4BC9]">
                  AI 生图
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Accessibility Helper Label */}
        <div className="text-center bg-surface border border-border-custom/20 rounded-lg py-1.5 px-3">
          <p className="text-xs font-medium text-text-secondary leading-normal">
            <span className="font-semibold text-text-primary">说"1"或"2"</span>{" "}
            可以通过语音直接选择，或者点击上方按钮。
          </p>
        </div>

        {/* Footer cancel */}
        <button
          onClick={onClose}
          className="text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors py-1 focus:outline-none rounded-md"
        >
          取消指令
        </button>
      </div>
    </div>
  );
}
