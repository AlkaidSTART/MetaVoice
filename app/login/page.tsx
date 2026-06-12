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
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 md:py-12 bg-surface font-sans select-none relative overflow-hidden h-full">
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
              {isSignUp ? "创建新账号" : "登录你的账号"}
            </h2>
            <p className="text-xs text-text-secondary mt-1">
              {isSignUp
                ? "注册后即可保存作品并与社区分享"
                : "免除键盘与鼠标，使用纯语音画板表达你的创意"}
            </p>
          </div>

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-xs font-bold text-text-secondary"
              >
                邮箱地址
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 bg-surface border border-border-custom rounded-xl text-sm font-medium text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-sakura focus:border-sakura transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-bold text-text-secondary"
              >
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignUp ? "至少 6 位密码" : "输入密码"}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className="w-full pl-10 pr-10 py-3 bg-surface border border-border-custom rounded-xl text-sm font-medium text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-sakura focus:border-sakura transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-secondary transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#FFF0EF] border border-[#FFBDB8] rounded-xl text-xs font-semibold text-[#D04D43]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-sakura hover:bg-[#FFA5B5] disabled:opacity-50 disabled:cursor-not-allowed border border-sakura rounded-2xl font-bold text-sm text-white transition-all duration-200 active:scale-[0.98] cursor-pointer"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>
                {isLoading ? "处理中..." : isSignUp ? "注册并登录" : "登录"}
              </span>
            </button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-xs font-semibold text-text-secondary hover:text-sakura transition-colors cursor-pointer"
            >
              {isSignUp ? "已有账号？点击登录" : "没有账号？点击注册"}
            </button>
          </div>

          <div className="text-center">
            <p className="text-[10px] text-text-disabled leading-relaxed">
              继续即表示同意我们的
              <span className="font-semibold text-text-secondary hover:text-sakura cursor-pointer">
                {" "}
                服务条款{" "}
              </span>
              和
              <span className="font-semibold text-text-secondary hover:text-sakura cursor-pointer">
                {" "}
                隐私政策
              </span>
            </p>
          </div>
        </div>
      </div>

      <footer className="mt-16 text-center text-xs text-text-disabled font-medium z-10">
        &copy; 2026 VoiceCanvas · 让创作平权 · 每个人都有表达美的自由
      </footer>
    </div>
  );
}
