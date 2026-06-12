"use client";

import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export default function ToastContainer({ toasts, onClose }: ToastProps) {
  return (
    <div 
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full"
      role="region"
      aria-label="通知栏"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: (id: string) => void }) {
  const { id, type, message, duration = 4000 } = toast;

  useEffect(() => {
    // Error toasts do not auto-dismiss to comply with WCAG/PRD
    if (type === "error") return;

    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, type, duration, onClose]);

  // Color mapping based on UI_STYLE.md
  const styles = {
    success: {
      border: "border-l-4 border-mint",
      bg: "bg-mint-light",
      text: "text-text-primary",
      icon: <CheckCircle2 className="w-5 h-5 text-[#4E9A6F] flex-shrink-0" />,
    },
    error: {
      border: "border-l-4 border-[#FF9E96]", // Slightly darker soft red for WCAG
      bg: "bg-[#FFF0EF]", // Light soft red background
      text: "text-text-primary",
      icon: <AlertCircle className="w-5 h-5 text-[#D04D43] flex-shrink-0" />,
    },
    warning: {
      border: "border-l-4 border-butter",
      bg: "bg-butter-light",
      text: "text-text-primary",
      icon: <AlertTriangle className="w-5 h-5 text-[#D19E2B] flex-shrink-0" />,
    },
    info: {
      border: "border-l-4 border-macaron-blue",
      bg: "bg-macaron-blue-light",
      text: "text-text-primary",
      icon: <Info className="w-5 h-5 text-[#4A8ECF] flex-shrink-0" />,
    },
  }[type];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border border-border-custom/30 ${styles.bg} ${styles.border} transition-standard animate-slide-in-right w-full`}
      style={{
        animation: "slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
    >
      {styles.icon}
      <div className={`flex-1 text-sm font-medium leading-5 ${styles.text}`}>
        {message}
      </div>
      <button
        onClick={() => onClose(id)}
        className="text-text-secondary hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-sakura rounded-md p-0.5"
        aria-label="关闭通知"
      >
        <X className="w-4 h-4" />
      </button>

      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(110%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
