"use client";

import { useRef, useEffect } from "react";
import { Mic, Loader2, AlertCircle } from "lucide-react";
import gsap from "gsap";

export type MicButtonState = "idle" | "recording" | "processing" | "error";

interface MicButtonProps {
  state: MicButtonState;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export default function MicButton({
  state,
  onClick,
  disabled = false,
  className = "",
}: MicButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pulse1Ref = useRef<HTMLDivElement>(null);
  const pulse2Ref = useRef<HTMLDivElement>(null);
  const pulse3Ref = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  // 处理动画
  useEffect(() => {
    const pulses = [pulse1Ref.current, pulse2Ref.current, pulse3Ref.current];
    const validPulses = pulses.filter(Boolean) as HTMLDivElement[];

    if (!buttonRef.current || validPulses.length === 0 || !iconRef.current) return;

    // 清除之前的动画
    gsap.killTweensOf([...validPulses, iconRef.current, buttonRef.current]);

    switch (state) {
      case "recording": {
        // 多层脉冲扩散动画 - 波浪效果
        validPulses.forEach((pulse, i) => {
          gsap.fromTo(
            pulse,
            { scale: 1, opacity: 0.5 },
            {
              scale: 2.2,
              opacity: 0,
              duration: 1.8,
              delay: i * 0.4,
              ease: "power1.out",
              repeat: -1,
            }
          );
        });

        // 图标呼吸动画
        gsap.to(iconRef.current, {
          scale: 0.92,
          duration: 0.6,
          ease: "power1.inOut",
          yoyo: true,
          repeat: -1,
        });

        // 按钮边框光晕
        gsap.to(buttonRef.current, {
          boxShadow: "0 0 30px rgba(255,183,197,0.5)",
          duration: 1,
          ease: "power1.inOut",
          yoyo: true,
          repeat: -1,
        });
        break;
      }

      case "processing": {
        // 旋转圆环动画
        validPulses.forEach((pulse, i) => {
          gsap.to(pulse, {
            rotation: 360,
            duration: 1.5 - i * 0.2,
            ease: "none",
            repeat: -1,
          });
          gsap.to(pulse, {
            opacity: 0.3 + i * 0.15,
            scale: 1.1 + i * 0.1,
            duration: 0.5,
          });
        });
        break;
      }

      case "error": {
        // 错误震动动画
        gsap.to(buttonRef.current, {
          x: -8,
          duration: 0.08,
          yoyo: true,
          repeat: 7,
          ease: "power1.inOut",
          onComplete: () => {
            gsap.to(buttonRef.current, { x: 0, duration: 0.2 });
          },
        });

        // 图标抖动
        gsap.to(iconRef.current, {
          rotation: -15,
          duration: 0.1,
          yoyo: true,
          repeat: 5,
          ease: "power1.inOut",
          onComplete: () => {
            gsap.to(iconRef.current, { rotation: 0, duration: 0.2 });
          },
        });

        // 红色脉冲
        validPulses.forEach((pulse) => {
          gsap.fromTo(
            pulse,
            { scale: 1, opacity: 0.6 },
            {
              scale: 1.8,
              opacity: 0,
              duration: 0.8,
              ease: "power1.out",
            }
          );
        });
        break;
      }

      case "idle":
      default: {
        // 重置状态
        validPulses.forEach((pulse) => {
          gsap.set(pulse, { scale: 1, opacity: 0, rotation: 0 });
        });
        gsap.set(iconRef.current, { scale: 1, rotation: 0 });
        gsap.to(buttonRef.current, {
          boxShadow: "0 0 0 rgba(255,183,197,0)",
          duration: 0.3,
        });
        break;
      }
    }

    return () => {
      gsap.killTweensOf([...validPulses, iconRef.current, buttonRef.current]);
    };
  }, [state]);

  const getButtonStyles = () => {
    switch (state) {
      case "recording":
        return "bg-sakura text-white";
      case "processing":
        return "bg-macaron-blue-light text-macaron-blue";
      case "error":
        return "bg-error text-white";
      case "idle":
      default:
        return "bg-white text-text-primary border-2 border-border hover:border-sakura hover:text-sakura hover:shadow-lg hover:shadow-sakura/20";
    }
  };

  const getIcon = () => {
    switch (state) {
      case "recording":
        return <Mic className="w-8 h-8" />;
      case "processing":
        return <Loader2 className="w-8 h-8 animate-spin" />;
      case "error":
        return <AlertCircle className="w-8 h-8" />;
      case "idle":
      default:
        return <Mic className="w-8 h-8" />;
    }
  };

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* 多层脉冲 */}
      <div
        ref={pulse1Ref}
        className="absolute w-full h-full rounded-full bg-sakura/30"
        style={{ opacity: 0 }}
      />
      <div
        ref={pulse2Ref}
        className="absolute w-full h-full rounded-full bg-sakura/20"
        style={{ opacity: 0 }}
      />
      <div
        ref={pulse3Ref}
        className="absolute w-full h-full rounded-full bg-sakura/10"
        style={{ opacity: 0 }}
      />

      {/* 按钮 */}
      <button
        ref={buttonRef}
        onClick={onClick}
        disabled={disabled || state === "processing"}
        className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-colors duration-300 ${getButtonStyles()}`}
        aria-label={
          state === "recording"
            ? "停止录音"
            : state === "processing"
              ? "处理中"
              : state === "error"
                ? "点击重试"
                : "开始录音"
        }
        aria-pressed={state === "recording"}
      >
        <div ref={iconRef}>{getIcon()}</div>
      </button>
    </div>
  );
}
