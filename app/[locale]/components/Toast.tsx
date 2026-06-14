"use client";

import { useEffect, useRef } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import gsap from "gsap";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  onClose: (id: string) => void;
  duration?: number;
}

export default function Toast({
  id,
  type,
  message,
  onClose,
  duration = 4000,
}: ToastProps) {
  const toastRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    if (!toastRef.current) return;

    gsap.to(toastRef.current, {
      x: 120,
      opacity: 0,
      scale: 0.9,
      duration: 0.3,
      ease: "back.in(1.5)",
      onComplete: () => onClose(id),
    });
  };

  useEffect(() => {
    if (!toastRef.current) return;

    const tl = gsap.timeline();

    // 弹性入场动画
    tl.fromTo(
      toastRef.current,
      {
        x: 150,
        opacity: 0,
        scale: 0.8,
      },
      {
        x: 0,
        opacity: 1,
        scale: 1,
        duration: 0.4,
        ease: "back.out(1.7)",
      }
    );

    // 图标弹跳动画
    if (iconRef.current) {
      tl.fromTo(
        iconRef.current,
        { scale: 0, rotation: -45 },
        { scale: 1, rotation: 0, duration: 0.3, ease: "back.out(2)" },
        "-=0.2"
      );
    }

    // 进度条动画
    if (progressRef.current && type !== "error" && duration > 0) {
      gsap.fromTo(
        progressRef.current,
        { scaleX: 1 },
        {
          scaleX: 0,
          duration: duration / 1000,
          ease: "linear",
          transformOrigin: "left center",
          onComplete: handleClose,
        }
      );
    }

    return () => {
      tl.kill();
    };
  }, [type, duration]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5" />;
      case "error":
        return <XCircle className="w-5 h-5" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5" />;
      case "info":
        return <Info className="w-5 h-5" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case "success":
        return {
          border: "border-mint",
          bg: "bg-mint-light",
          iconColor: "text-mint",
          progress: "bg-mint",
        };
      case "error":
        return {
          border: "border-error",
          bg: "bg-error/10",
          iconColor: "text-error",
          progress: "bg-error",
        };
      case "warning":
        return {
          border: "border-butter",
          bg: "bg-butter-light",
          iconColor: "text-butter",
          progress: "bg-butter",
        };
      case "info":
        return {
          border: "border-macaron-blue",
          bg: "bg-macaron-blue-light",
          iconColor: "text-macaron-blue",
          progress: "bg-macaron-blue",
        };
    }
  };

  const styles = getStyles();

  return (
    <div
      ref={toastRef}
      className={`relative min-w-[300px] max-w-[400px] rounded-2xl border ${styles.border} ${styles.bg} shadow-lg shadow-black/5 overflow-hidden`}
      role="alert"
    >
      <div className="flex items-start gap-3 p-4">
        <div ref={iconRef} className={`flex-shrink-0 ${styles.iconColor}`}>
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary">{message}</p>
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 text-text-secondary hover:text-text-primary transition-colors p-1 hover:bg-white/50 rounded-lg"
          aria-label="关闭通知"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 进度条 */}
      {type !== "error" && duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5">
          <div
            ref={progressRef}
            className={`h-full ${styles.progress} opacity-50`}
          />
        </div>
      )}
    </div>
  );
}
