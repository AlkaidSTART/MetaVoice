"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { TextPlugin } from "gsap/TextPlugin";

gsap.registerPlugin(TextPlugin);

interface TranscriptBarProps {
  transcript: string;
  isRecording?: boolean;
}

export default function TranscriptBar({
  transcript,
  isRecording = false,
}: TranscriptBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // 光标闪烁动画
  useEffect(() => {
    if (!cursorRef.current) return;

    gsap.to(cursorRef.current, {
      opacity: 0,
      duration: 0.5,
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut",
    });

    return () => {
      gsap.killTweensOf(cursorRef.current);
    };
  }, []);

  // 字符逐个弹出动效
  useEffect(() => {
    if (!containerRef.current || !textRef.current) return;

    // 如果文字为空，不处理
    if (!transcript) {
      charRefs.current = [];
      return;
    }

    // 清空之前的引用
    charRefs.current = [];
  }, [transcript]);

  // 渲染带动效的字符
  const renderAnimatedText = () => {
    if (!transcript) {
      return (
        <span className="text-text-secondary">说出你想绘制的内容...</span>
      );
    }

    return transcript.split("").map((char, index) => {
      const isSpace = char === " ";
      return (
        <span
          key={`${index}-${char}`}
          ref={(el) => {
            if (el && !charRefs.current[index]) {
              charRefs.current[index] = el;
              // 新字符弹入动画
              gsap.fromTo(
                el,
                {
                  opacity: 0,
                  y: 8,
                  scale: 0.8,
                },
                {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  duration: 0.25,
                  delay: index * 0.02,
                  ease: "back.out(2.2)",
                }
              );
            }
          }}
          className="inline-block"
          style={{ minWidth: isSpace ? "0.3em" : undefined }}
        >
          {isSpace ? "\u00A0" : char}
        </span>
      );
    });
  };

  return (
    <div
      ref={containerRef}
      className="h-14 bg-surface/95 backdrop-blur-sm border-t border-border flex items-center px-6 overflow-hidden"
    >
      <div className="flex-1 flex items-center gap-3 min-w-0">
        {/* 录音状态指示器 */}
        <div className="relative flex-shrink-0">
          <div
            className={`w-3 h-3 rounded-full ${
              isRecording ? "bg-sakura" : "bg-text-disabled"
            }`}
          />
          {isRecording && (
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-sakura animate-ping" />
          )}
        </div>

        {/* 文字内容 */}
        <div
          ref={textRef}
          className="flex-1 flex items-center flex-wrap gap-0 min-w-0"
          role="status"
          aria-live="polite"
          aria-atomic="false"
          aria-label="语音转录实时显示"
        >
          <span className="text-sm text-text-primary font-medium tracking-wide">
            {renderAnimatedText()}
          </span>

          {/* 光标 */}
          {isRecording && (
            <span
              ref={cursorRef}
              className="inline-block w-0.5 h-5 bg-sakura ml-0.5 align-middle"
            />
          )}
        </div>
      </div>

      {/* 录音时长/置信度指示 */}
      {isRecording && (
        <div className="flex-shrink-0 ml-4">
          <div className="flex items-center gap-1">
            {/* 声波动画条 */}
            {[12, 20, 16, 24, 14].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-sakura rounded-full"
                style={{
                  height: `${h}px`,
                  animation: `voiceBar 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
