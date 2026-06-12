"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  Sparkles,
  LogIn,
  Mail,
  Lock,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import gsap from "gsap";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const illustrationRef = useRef<HTMLDivElement>(null);
  const particlesContainerRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    const tl = gsap.timeline();
    tl.fromTo(
      titleRef.current,
      { y: -30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
    )
      .fromTo(
        cardRef.current,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
        "-=0.5",
      )
      .fromTo(
        illustrationRef.current,
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 1, ease: "back.out(1.2)" },
        "-=0.6",
      );

    if (particlesContainerRef.current) {
      const container = particlesContainerRef.current;
      const particleColors = [
        "#FFB7C5",
        "#B5D5F5",
        "#B5E8C7",
        "#FFE5A0",
        "#D4C5F5",
      ];
      const particleTypes = ["circle", "square", "triangle", "star"];
      const particleCount = 12;

      for (let i = 0; i < particleCount; i++) {
        const p = document.createElement("div");
        const size = gsap.utils.random(16, 36);
        const color = particleColors[i % particleColors.length];
        const type = particleTypes[i % particleTypes.length];

        p.style.position = "absolute";
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.backgroundColor = color;
        p.style.opacity = "0";
        p.style.left = "calc(50% - 12px)";
        p.style.bottom = "80px";

        if (type === "circle") {
          p.style.borderRadius = "50%";
        } else if (type === "triangle") {
          p.style.backgroundColor = "transparent";
          p.style.width = "0";
          p.style.height = "0";
          p.style.borderLeft = `${size / 2}px solid transparent`;
          p.style.borderRight = `${size / 2}px solid transparent`;
          p.style.borderBottom = `${size}px solid ${color}`;
        } else if (type === "star") {
          p.style.clipPath =
            "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
        } else {
          p.style.borderRadius = "6px";
        }

        container.appendChild(p);

        gsap.fromTo(
          p,
          { x: 0, y: 0, rotation: 0, scale: 0.3, opacity: 0 },
          {
            x: `random(-140, 140)`,
            y: `random(-250, -120)`,
            rotation: `random(-180, 180)`,
            scale: `random(0.8, 1.3)`,
            opacity: `random(0.4, 0.85)`,
            duration: `random(4.5, 7)`,
            delay: i * 0.45,
            repeat: -1,
            ease: "sine.out",
          },
        );
      }
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();

    if (!email.trim() || !password.trim()) {
      setError("请输入邮箱和密码");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("密码长度至少为 6 位");
      setIsLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) {
          setError(
            signUpError.message === "User already registered"
              ? "该邮箱已注册，请直接登录"
              : signUpError.message,
          );
          setIsLoading(false);
          return;
        }
        setIsSignUp(false);
        alert(
          "注册成功！请查看邮箱确认链接，然后登录。如未收到，可直接尝试登录。",
        );
        setIsLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "邮箱或密码错误，请重试"
            : signInError.message,
        );
        setIsLoading(false);
        return;
      }

      gsap.to(cardRef.current, {
        scale: 0.95,
        opacity: 0,
        duration: 0.3,
        onComplete: () => {
          router.push("/canvas");
        },
      });
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 md:py-24 bg-surface font-sans select-none relative overflow-hidden min-h-screen">
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-macaron-blue-light/30 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-sakura-light/40 blur-3xl pointer-events-none" />

      <div className="text-center mb-8 max-w-lg z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FFEAEF] text-sakura border border-[#FFD5DE] rounded-full text-xs font-semibold mb-4 animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-[#E07A8F]" />
          <span className="text-[#B3455C]">七牛云黑客松 MVP 创意作品</span>
        </div>
        <h1
          ref={titleRef}
          className="text-3xl md:text-5xl font-black tracking-tight text-text-primary leading-tight"
        >
          VoiceCanvas
        </h1>
        <p className="mt-3 text-base md:text-lg text-text-secondary font-medium">
          用声音，创作你的世界
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-12 items-center justify-center w-full max-w-4xl z-10">
        {/* Left: Animated Illustration */}
        <div
          ref={illustrationRef}
          className="flex-1 flex flex-col items-center justify-center relative w-full max-w-[320px] aspect-square bg-white border border-border-custom rounded-3xl shadow-lg p-6 overflow-hidden"
        >
          {/* Particles container for flying shapes */}
          <div
            ref={particlesContainerRef}
            className="absolute inset-0 pointer-events-none"
          />

          {/* Main animated mic illustration */}
          <div className="relative w-28 h-28 rounded-full bg-sakura-light border-4 border-white flex items-center justify-center shadow-md z-10">
            <Mic className="w-12 h-12 text-[#B3455C]" />
          </div>
          <div className="mt-6 text-center z-10">
            <p className="text-sm font-bold text-text-primary">
              说出指令，即刻绘图
            </p>
            <p className="text-xs text-text-secondary mt-1">
              “画一个红色的圆形在中间”
            </p>
          </div>
        </div>

        {/* Right: Login Card */}
        <div
          ref={cardRef}
          className="w-full max-w-[380px] bg-white border border-border-custom shadow-xl rounded-3xl p-8 flex flex-col gap-6"
        >
          <div className="text-center lg:text-left">
            <h2 className="text-xl font-bold text-text-primary">
              开启你的创作之旅
            </h2>
            <p className="text-xs text-text-secondary mt-1">
              免除键盘与鼠标，使用纯语音画板表达你的创意
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {/* Google Login */}
            <button
              onClick={() => handleLogin("google")}
              className="flex items-center justify-center gap-3 w-full py-3.5 px-4 bg-[#FAFAF8] hover:bg-[#F2F2EF] border border-[#E0E0DB] rounded-2xl font-bold text-sm text-text-primary transition-all duration-200 active:scale-[0.98] cursor-pointer"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                width="24"
                height="24"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              使用 Google 账号登录
            </button>

            {/* WeChat Login */}
            <button
              onClick={() => handleLogin("wechat")}
              className="flex items-center justify-center gap-3 w-full py-3.5 px-4 bg-[#E5F9EE] hover:bg-[#D5F3E2] border border-[#BDEACF] rounded-2xl font-bold text-sm text-[#2E7D32] transition-all duration-200 active:scale-[0.98] cursor-pointer"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M8.5 12c-.552 0-1-.448-1-1s.448-1 1-1 1 .448 1 1-.448 1-1 1zm7 0c-.552 0-1-.448-1-1s.448-1 1-1 1 .448 1 1-.448 1-1 1zm-4.75 3.5c1.782 0 3.25-1.007 3.25-2.25s-1.468-2.25-3.25-2.25-3.25 1.007-3.25 2.25 1.468 2.25 3.25 2.25zm8.75.5c2.474 0 4.5-1.791 4.5-4s-2.026-4-4.5-4-4.5 1.791-4.5 4 2.026 4 4.5 4zm-2.25-4.75c-.414 0-.75-.336-.75-.75s.336-.75.75-.75.75.336.75.75-.336.75-.75.75zm3.5 0c-.414 0-.75-.336-.75-.75s.336-.75.75-.75.75.336.75.75-.336.75-.75.75z" />
              </svg>
              使用微信账号登录
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-border-custom/60"></div>
            <span className="flex-shrink mx-3 text-xs text-text-disabled font-medium">
              或者
            </span>
            <div className="flex-grow border-t border-border-custom/60"></div>
          </div>

          {/* Guest Access Button (Primary Action) */}
          <button
            onClick={() => handleLogin("guest")}
            className="group flex items-center justify-center gap-2 w-full py-4 px-4 bg-sakura hover:bg-sakura-light text-white hover:text-text-primary rounded-2xl font-extrabold text-sm shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] cursor-pointer"
          >
            作为访客身份体验
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Accessibility Info Footer */}
          <div className="flex gap-2 items-start bg-surface rounded-xl p-3 border border-border-custom/30 text-[11px] text-text-secondary leading-normal">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D32] flex-shrink-0 mt-0.5" />
            <span>
              无障碍模式已默认开启：界面已针对肢体障碍人士与儿童进行了高对比度、大按键及防抖优化。
            </span>
          </div>
        </div>
      </div>

      {/* Slogan Footer */}
      <footer className="mt-16 text-center text-xs text-text-disabled font-medium z-10">
        © 2026 VoiceCanvas · 让创作平权 · 每个人都有表达美的自由
      </footer>
    </div>
  );
}
