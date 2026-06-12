"use client";

import React, { useRef, useEffect } from "react";
import { Mic, Loader2, AlertCircle, Check } from "lucide-react";
import gsap from "gsap";

export type MicState = "idle" | "recording" | "processing" | "error" | "success";

interface MicButtonProps {
  state: MicState;
  onClick: () => void;
  disabled?: boolean;
}

export default function MicButton({ state, onClick, disabled = false }: MicButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const ripple1Ref = useRef<HTMLDivElement>(null);
  const ripple2Ref = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Kill existing animations on mount/update
    gsap.killTweensOf([buttonRef.current, ripple1Ref.current, ripple2Ref.current, ringRef.current]);

    if (state === "recording") {
      // 1. Recording ripples animation (Pulse 1s)
      gsap.set([ripple1Ref.current, ripple2Ref.current], { scale: 1, opacity: 0.8 });
      
      gsap.to(ripple1Ref.current, {
        scale: 1.45,
        opacity: 0,
        duration: 1.4,
        repeat: -1,
        ease: "power1.out",
      });

      gsap.to(ripple2Ref.current, {
        scale: 1.45,
        opacity: 0,
        duration: 1.4,
        delay: 0.7,
        repeat: -1,
        ease: "power1.out",
      });

      // Subtle scale breathing on button
      gsap.to(buttonRef.current, {
        scale: 0.96,
        duration: 0.7,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
    } 
    else if (state === "processing") {
      // 2. Loading rotating ring animation
      gsap.set(ringRef.current, { rotation: 0, opacity: 1, scale: 1.05 });
      gsap.to(ringRef.current, {
        rotation: 360,
        duration: 1.2,
        repeat: -1,
        ease: "none",
      });
      
      // Light bounce on button
      gsap.to(buttonRef.current, {
        scale: 1,
        duration: 0.2,
        ease: "power1.out"
      });
    } 
    else if (state === "error") {
      // 3. Shake animation (左右 shake 4px, 3 times)
      const tl = gsap.timeline();
      tl.to(buttonRef.current, { x: -6, duration: 0.08 })
        .to(buttonRef.current, { x: 6, duration: 0.08 })
        .to(buttonRef.current, { x: -6, duration: 0.08 })
        .to(buttonRef.current, { x: 6, duration: 0.08 })
        .to(buttonRef.current, { x: 0, duration: 0.08 });
      
      gsap.set([ripple1Ref.current, ripple2Ref.current], { opacity: 0 });
    } 
    else if (state === "success") {
      // 4. Success scale pop
      gsap.fromTo(buttonRef.current, 
        { scale: 0.8 },
        { scale: 1.1, duration: 0.25, yoyo: true, repeat: 1, ease: "back.out(1.7)" }
      );
    }
    else {
      // 5. Idle state
      gsap.to(buttonRef.current, {
        scale: 1,
        x: 0,
        duration: 0.3,
        ease: "back.out(2)",
      });
      gsap.set([ripple1Ref.current, ripple2Ref.current], { scale: 1, opacity: 0 });
    }
  }, [state]);

  const handleMouseDown = () => {
    if (state === "idle" && !disabled) {
      gsap.to(buttonRef.current, { scale: 0.9, duration: 0.1 });
    }
  };

  const handleMouseUp = () => {
    if (state === "idle" && !disabled) {
      gsap.to(buttonRef.current, { scale: 1, duration: 0.15, ease: "back.out(2)" });
    }
  };

  // Button style mapping
  const btnStyles = {
    idle: "bg-white border border-border-custom text-text-secondary hover:text-text-primary hover:border-sakura shadow-md",
    recording: "bg-sakura text-white shadow-[#FFB7C5]/40 shadow-xl",
    processing: "bg-macaron-blue-light text-[#4A8ECF] shadow-sm",
    error: "bg-[#FFBDB8] text-[#D04D43] shadow-md",
    success: "bg-mint text-white shadow-[#B5E8C7]/55 shadow-lg",
  }[state];

  // Screen reader instruction label
  const ariaLabel = {
    idle: "麦克风已就绪。点击开始录音",
    recording: "录音中。点击结束录音",
    processing: "系统正在处理您的语音，请稍候",
    error: "指令解析失败，点击重新录音",
    success: "执行成功",
  }[state];

  return (
    <div ref={containerRef} className="relative flex items-center justify-center w-32 h-32 select-none">
      {/* Recording ripple background effects */}
      <div
        ref={ripple1Ref}
        className="absolute w-20 h-20 md:w-24 md:h-24 rounded-full bg-sakura opacity-0 pointer-events-none"
      />
      <div
        ref={ripple2Ref}
        className="absolute w-20 h-20 md:w-24 md:h-24 rounded-full bg-sakura opacity-0 pointer-events-none"
      />

      {/* Processing loading outer ring */}
      {state === "processing" && (
        <div
          ref={ringRef}
          className="absolute w-22 h-22 md:w-26 md:h-26 rounded-full border-2 border-dashed border-[#B5D5F5] opacity-0 pointer-events-none"
        />
      )}

      {/* The actual microphone trigger */}
      <button
        ref={buttonRef}
        onClick={onClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        disabled={disabled || state === "processing"}
        className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-sakura/50 z-10 ${btnStyles} ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
        aria-label={ariaLabel}
        aria-pressed={state === "recording"}
      >
        {state === "idle" && <Mic className="w-8 h-8 md:w-10 md:h-10" />}
        {state === "recording" && <Mic className="w-8 h-8 md:w-10 md:h-10" />}
        {state === "processing" && <Loader2 className="w-8 h-8 md:w-10 md:h-10 animate-spin" />}
        {state === "error" && <AlertCircle className="w-8 h-8 md:w-10 md:h-10" />}
        {state === "success" && <Check className="w-8 h-8 md:w-10 md:h-10 animate-pulse" />}
      </button>
    </div>
  );
}
