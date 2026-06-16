"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, Mail, Lock, User, Eye, EyeOff, ArrowRight } from "lucide-react";
import gsap from "gsap";
import { authDB } from "../lib/db";

// 樱花花瓣组件
function SakuraPetal({ index }: { index: number }) {
  const petalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!petalRef.current) return;

    const startX = Math.random() * 100;
    const duration = 8 + Math.random() * 8;
    const delay = Math.random() * 10;
    const size = 8 + Math.random() * 12;

    gsap.set(petalRef.current, {
      left: `${startX}%`,
      top: "-20px",
      width: size,
      height: size,
    });

    const tl = gsap.timeline({ repeat: -1, delay });
    tl.to(petalRef.current, {
      y: window.innerHeight + 40,
      x: `+=${(Math.random() - 0.5) * 200}`,
      rotation: 360 + Math.random() * 720,
      duration,
      ease: "none",
    });

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div
      ref={petalRef}
      className="absolute pointer-events-none"
      style={{
        background: "radial-gradient(circle, #FFB7C5 0%, #FFE4EA 100%)",
        borderRadius: "50% 0 50% 0",
        opacity: 0.5,
      }}
    />
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });

  // 入场动画
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.fromTo(
      logoRef.current,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.7)" }
    )
      .fromTo(
        titleRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5 },
        "-=0.3"
      )
      .fromTo(
        subtitleRef.current,
        { y: 15, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4 },
        "-=0.2"
      )
      .fromTo(
        cardRef.current,
        { y: 40, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.2)" },
        "-=0.2"
      );

    return () => {
      tl.kill();
    };
  }, []);

  // 切换登录/注册时的动画
  const animateSwitch = useCallback(() => {
    if (!cardRef.current) return;
    gsap.fromTo(
      cardRef.current,
      { scale: 0.98, opacity: 0.8 },
      { scale: 1, opacity: 1, duration: 0.3, ease: "power2.out" }
    );
  }, []);

  const handleSetIsLogin = (val: boolean) => {
    if (val !== isLogin) {
      setIsLogin(val);
      setError(null);
      requestAnimationFrame(() => animateSwitch());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // 按钮按下动画
    if (cardRef.current) {
      gsap.to(cardRef.current, {
        scale: 0.99,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: "power1.inOut",
      });
    }

    try {
      if (isLogin) {
        await authDB.login(formData.email, formData.password);
        router.push("/canvas");
      } else {
        if (!formData.name.trim()) {
          throw new Error("请输入用户名");
        }
        await authDB.register(
          formData.email,
          formData.password,
          formData.name
        );
        router.push("/canvas");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请重试");
      // 错误震动动画
      if (cardRef.current) {
        gsap.to(cardRef.current, {
          x: -8,
          duration: 0.08,
          yoyo: true,
          repeat: 5,
          ease: "power1.inOut",
          onComplete: () => gsap.set(cardRef.current, { x: 0 }),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    try {
      await authDB.register(
        `guest_${Date.now()}@voicecanvas.temp`,
        "guest",
        "访客用户"
      );
      router.push("/canvas");
    } catch (err) {
      setError("访客登录失败，请重试");
    }
  };

  // 输入框聚焦动画
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    gsap.to(e.target, {
      boxShadow: "0 0 0 3px rgba(255,183,197,0.3)",
      duration: 0.2,
    });
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    gsap.to(e.target, {
      boxShadow: "none",
      duration: 0.2,
    });
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-bg via-sakura-light/20 to-macaron-blue-light/20 flex items-center justify-center p-4 relative overflow-hidden"
    >
      {/* 樱花飘落 */}
      {Array.from({ length: 15 }).map((_, i) => (
        <SakuraPetal key={i} index={i} />
      ))}

      {/* 背景光晕 */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-sakura/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-48 h-48 bg-sakura/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-macaron-blue/10 rounded-full blur-2xl" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div
            ref={logoRef}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-sakura-light to-sakura/30 mb-4 shadow-lg shadow-sakura/20"
          >
            <Mic className="w-10 h-10 text-sakura" />
          </div>
          <h1
            ref={titleRef}
            className="text-4xl font-bold text-text-primary mb-2"
          >
            VoiceCanvas
          </h1>
          <p ref={subtitleRef} className="text-text-secondary">
            用声音，创作你的世界
          </p>
        </div>

        {/* 登录/注册表单 */}
        <div
          ref={cardRef}
          className="bg-white/80 backdrop-blur-lg rounded-3xl p-8 shadow-xl border border-sakura/10"
        >
          {/* 切换按钮 */}
          <div className="flex mb-6 bg-sakura-light/30 rounded-xl p-1">
            <button
              type="button"
              onClick={() => handleSetIsLogin(true)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                isLogin
                  ? "bg-white text-sakura shadow-md shadow-sakura/20"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Lock className="w-4 h-4" />
              登录
            </button>
            <button
              type="button"
              onClick={() => handleSetIsLogin(false)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                !isLogin
                  ? "bg-white text-sakura shadow-md shadow-sakura/20"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <User className="w-4 h-4" />
              注册
            </button>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  用户名
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-lg bg-sakura-light/50 flex items-center justify-center">
                    <User className="w-4 h-4 text-sakura" />
                  </div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    placeholder="请输入用户名"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-sakura focus:border-sakura transition-all"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                邮箱
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-lg bg-sakura-light/50 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-sakura" />
                </div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder="请输入邮箱"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-sakura focus:border-sakura transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                密码
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-lg bg-sakura-light/50 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-sakura" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder="请输入密码"
                  className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-sakura focus:border-sakura transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-lg bg-sakura-light/30 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-sakura-light/50 transition-all"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
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
              <div className="p-4 rounded-xl bg-error/15 border border-error/30 flex items-start gap-2">
                <Lock className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            {/* 登录/注册按钮 */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 px-6 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 shadow-lg ${
                loading
                  ? "bg-text-disabled cursor-not-allowed"
                  : "bg-gradient-to-r from-sakura to-sakura/80 hover:from-sakura/90 hover:to-sakura hover:shadow-xl hover:shadow-sakura/30 active:scale-[0.98]"
              }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  {isLogin ? "登录" : "注册"}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* 分隔线 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-sakura/20" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-white/80 text-text-secondary text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-sakura rounded-full" />
                或者
                <span className="w-2 h-2 bg-sakura rounded-full" />
              </span>
            </div>
          </div>

          {/* 访客登录 */}
          <button
            type="button"
            onClick={handleGuestLogin}
            className="w-full py-3.5 px-6 rounded-xl font-semibold border-2 border-sakura/30 text-text-primary hover:border-sakura hover:bg-sakura-light/20 hover:text-sakura transition-all flex items-center justify-center gap-2"
          >
            <Mic className="w-5 h-5" />
            作为访客体验
          </button>

          <p className="mt-4 text-center text-sm text-text-secondary">
            访客模式下作品不会保存到云端
          </p>
        </div>

        {/* 底部信息 */}
        <div className="mt-8 text-center">
          <p className="text-sm text-text-secondary">
            © 2025 VoiceCanvas · 让每个人都能创作
          </p>
        </div>
      </div>
    </div>
  );
}
