"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Volume2,
  Wand2,
  AlertCircle,
} from "lucide-react";
import gsap from "gsap";
import { createClient } from "@/lib/supabase/client";

/* ============================================
   Config
   ============================================ */

const COMMANDS = [
  { text: "画一个樱花粉色的星星", color: "#FFB7C5", shape: "star" as const },
  { text: "在左边画一个蓝色圆形", color: "#B5D5F5", shape: "circle" as const },
  { text: "画一个薄荷绿的三角形", color: "#B5E8C7", shape: "triangle" as const },
  { text: "画一个奶油黄的方块", color: "#FFE5A0", shape: "square" as const },
];

interface FloatShape {
  id: number;
  type: "circle" | "star" | "triangle" | "square";
  color: string;
  size: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
}

const FLOATING_SHAPES: FloatShape[] = [
  { id: 1, type: "circle", color: "#FFB7C5", size: 64, x: 8, y: 12, duration: 12, delay: 0 },
  { id: 2, type: "star", color: "#B5D5F5", size: 44, x: 88, y: 8, duration: 15, delay: 1 },
  { id: 3, type: "triangle", color: "#B5E8C7", size: 52, x: 78, y: 72, duration: 13, delay: 2 },
  { id: 4, type: "square", color: "#FFE5A0", size: 36, x: 18, y: 82, duration: 14, delay: 0.5 },
  { id: 5, type: "circle", color: "#D4C5F5", size: 48, x: 52, y: 92, duration: 11, delay: 1.5 },
  { id: 6, type: "star", color: "#FFB7C5", size: 32, x: 92, y: 42, duration: 16, delay: 3 },
  { id: 7, type: "triangle", color: "#B5D5F5", size: 56, x: 4, y: 48, duration: 13, delay: 2.5 },
  { id: 8, type: "square", color: "#B5E8C7", size: 42, x: 62, y: 4, duration: 15, delay: 0.8 },
];

/* ============================================
   Floating Background Shape
   ============================================ */

function FloatingShapeEl({ config }: { config: FloatShape }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.to(ref.current, {
      y: -28,
      rotation: 12,
      duration: config.duration / 2,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
      delay: config.delay,
    });
  }, [config]);

  const renderSvg = () => {
    const s = config.size;
    switch (config.type) {
      case "circle":
        return <circle cx={s / 2} cy={s / 2} r={s / 2} fill={config.color} opacity={0.18} />;
      case "square":
        return <rect width={s} height={s} rx={s * 0.2} fill={config.color} opacity={0.18} />;
      case "triangle": {
        const p = `${s / 2},0 ${s},${s} 0,${s}`;
        return <polygon points={p} fill={config.color} opacity={0.18} />;
      }
      case "star": {
        const pts: string[] = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? s / 2 : s / 4;
          const a = (Math.PI * i) / 5 - Math.PI / 2;
          pts.push(`${s / 2 + Math.cos(a) * r},${s / 2 + Math.sin(a) * r}`);
        }
        return <polygon points={pts.join(" ")} fill={config.color} opacity={0.18} />;
      }
    }
  };

  return (
    <div
      ref={ref}
      className="absolute pointer-events-none"
      style={{ left: `${config.x}%`, top: `${config.y}%` }}
    >
      <svg width={config.size} height={config.size}>{renderSvg()}</svg>
    </div>
  );
}

/* ============================================
   Demo Canvas — Auto-play voice-to-draw flow
   ============================================ */

function DemoCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bubbleTextRef = useRef<HTMLParagraphElement>(null);
  const micRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  // Canvas render helper
  const renderShape = useCallback(
    (shape: string, progress: number, opacity: number, color: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // subtle grid background
      ctx.save();
      ctx.strokeStyle = "#E8E8E4";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();

      if (opacity <= 0.01 || progress <= 0.01) return;

      ctx.save();
      ctx.globalAlpha = opacity;

      const cx = w / 2;
      const cy = h / 2;
      ctx.translate(cx, cy);
      ctx.scale(progress, progress);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.fillStyle = color + "33";

      switch (shape) {
        case "circle": {
          ctx.beginPath();
          ctx.arc(0, 0, 50, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case "star": {
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? 58 : 29;
            const a = (Math.PI * i) / 5 - Math.PI / 2;
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        case "triangle": {
          ctx.beginPath();
          ctx.moveTo(0, -52);
          ctx.lineTo(45, 26);
          ctx.lineTo(-45, 26);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        case "square": {
          const sz = 48;
          ctx.beginPath();
          ctx.roundRect(-sz / 2, -sz / 2, sz, sz, 6);
          ctx.fill();
          ctx.stroke();
          break;
        }
      }
      ctx.restore();
    },
    []
  );

  // Init canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setup = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      renderShape("", 0, 0, "");
    };
    setup();
    const id = requestAnimationFrame(setup);
    return () => cancelAnimationFrame(id);
  }, [renderShape]);

  // Master demo timeline
  useEffect(() => {
    if (!bubbleRef.current || !micRef.current || !dotsRef.current) return;
    if (tlRef.current) tlRef.current.kill();

    const proxy = { progress: 0, opacity: 0 };
    const tl = gsap.timeline({ repeat: -1 });
    tlRef.current = tl;

    COMMANDS.forEach((cmd, i) => {
      const label = `cmd${i}`;

      // Update text
      tl.call(
        () => {
          if (bubbleTextRef.current) {
            bubbleTextRef.current.textContent = `「${cmd.text}」`;
          }
        },
        [],
        label
      );

      // Reset
      tl.set([bubbleRef.current, dotsRef.current], { opacity: 0, y: 12 }, label);
      tl.set(micRef.current, { opacity: 1, scale: 1 }, label);
      tl.set(proxy, { progress: 0, opacity: 0 }, label);

      // Phase 1: bubble in + mic pulse
      tl.to(
        bubbleRef.current,
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
        label
      );
      tl.to(
        micRef.current,
        {
          scale: 1.15,
          duration: 0.4,
          yoyo: true,
          repeat: 3,
          ease: "sine.inOut",
        },
        label
      );

      // Phase 2: processing dots
      tl.to(dotsRef.current, { opacity: 1, y: 0, duration: 0.3 }, `${label}+=0.8`);
      if (dotsRef.current?.children) {
        tl.to(
          Array.from(dotsRef.current.children),
          {
            scale: 1.4,
            opacity: 0.6,
            duration: 0.4,
            stagger: 0.15,
            yoyo: true,
            repeat: 2,
            ease: "sine.inOut",
          },
          `${label}+=1`
        );
      }

      // Phase 3: draw shape
      tl.to(
        proxy,
        {
          progress: 1,
          opacity: 1,
          duration: 0.7,
          ease: "back.out(1.6)",
          onUpdate: () => renderShape(cmd.shape, proxy.progress, proxy.opacity, cmd.color),
        },
        `${label}+=2`
      );

      // Phase 4: hold
      tl.to({}, { duration: 1.2 }, `${label}+=2.8`);

      // Phase 5: fade out
      tl.to(
        [bubbleRef.current, dotsRef.current, micRef.current],
        { opacity: 0, duration: 0.3, ease: "power2.in" },
        `${label}+=4`
      );
      tl.to(
        proxy,
        {
          opacity: 0,
          duration: 0.3,
          ease: "power2.in",
          onUpdate: () => renderShape(cmd.shape, proxy.progress, proxy.opacity, cmd.color),
        },
        `${label}+=4`
      );
    });

    return () => {
      tl.kill();
    };
  }, [renderShape]);

  return (
    <div className="relative w-full max-w-[440px] mx-auto">
      <div className="relative bg-white rounded-3xl shadow-xl shadow-sakura/10 border border-border-custom overflow-hidden">
        {/* Canvas */}
        <div className="relative aspect-[4/3] w-full">
          <canvas ref={canvasRef} className="w-full h-full block" />

          {/* Bottom mic + dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            <div
              ref={micRef}
              className="w-10 h-10 rounded-full bg-sakura flex items-center justify-center shadow-lg"
            >
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div ref={dotsRef} className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-macaron-blue" />
              ))}
            </div>
          </div>
        </div>

        {/* Voice bubble */}
        <div ref={bubbleRef} className="absolute top-4 left-4 right-4">
          <div className="bg-surface/95 backdrop-blur-sm rounded-2xl px-4 py-3 border border-border-custom shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Volume2 className="w-3.5 h-3.5 text-sakura" />
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                语音指令
              </span>
            </div>
            <p ref={bubbleTextRef} className="text-sm text-text-primary font-medium leading-relaxed">
              「{COMMANDS[0].text}」
            </p>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-text-secondary mt-4 font-medium">
        实时演示 · 说出想法，即刻成画
      </p>
    </div>
  );
}

/* ============================================
   Login Page
   ============================================ */

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({ email: "", password: "", name: "" });

  // Entrance animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(rightRef.current, { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8 })
        .fromTo(
          leftRef.current,
          { x: 40, opacity: 0, scale: 0.96 },
          { x: 0, opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.2)" },
          "-=0.6"
        )
        .fromTo(
          leftRef.current?.querySelectorAll(".stagger-item") || [],
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, stagger: 0.1 },
          "-=0.5"
        )
        .fromTo(
          formRef.current,
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: "back.out(1.2)" },
          "-=0.4"
        );
    }, pageRef);

    return () => ctx.revert();
  }, []);

  const animateSwitch = useCallback(() => {
    if (!formRef.current) return;
    gsap.fromTo(
      formRef.current,
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

    if (formRef.current) {
      gsap.to(formRef.current, {
        scale: 0.99,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: "power1.inOut",
      });
    }

    try {
      const supabase = createClient();
      
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        
        if (error) throw error;
        router.push("/canvas");
      } else {
        if (!formData.name.trim()) throw new Error("请输入用户名");
        
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
            },
          },
        });
        
        if (error) throw error;
        router.push("/canvas");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请重试");
      if (formRef.current) {
        gsap.to(formRef.current, {
          x: -8,
          duration: 0.08,
          yoyo: true,
          repeat: 5,
          ease: "power1.inOut",
          onComplete: () => gsap.set(formRef.current, { x: 0 }),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    router.push("/canvas");
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    gsap.to(e.target, {
      boxShadow: "0 0 0 3px rgba(255,183,197,0.25)",
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
      ref={pageRef}
      className="relative min-h-screen w-full bg-surface overflow-x-hidden overflow-y-auto"
      style={{ cursor: "auto" }}
    >
      {/* Floating shapes */}
      {FLOATING_SHAPES.map((s) => (
        <FloatingShapeEl key={s.id} config={s} />
      ))}

      {/* Gradient orbs */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-sakura/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] bg-macaron-blue/8 rounded-full blur-3xl pointer-events-none" />

      {/* Main content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left column: Demo Canvas */}
          <div ref={rightRef} className="hidden lg:flex items-center justify-center">
            <DemoCanvas />
          </div>

          {/* Right column */}
          <div ref={leftRef}>
            <div className="mb-8">
              <div className="stagger-item inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sakura/10 border border-sakura/20 mb-6">
                <Sparkles className="w-3.5 h-3.5 text-sakura" />
                <span className="text-xs font-semibold text-sakura tracking-wide">
                  VoiceCanvas
                </span>
              </div>
              <h1 className="stagger-item text-4xl lg:text-[3.25rem] font-bold text-text-primary leading-[1.15] mb-5">
                用声音，
                <br />
                <span className="text-sakura">创作你的世界</span>
              </h1>
              <p className="stagger-item text-base text-text-secondary leading-relaxed max-w-md">
                无需键盘与鼠标，开口即可绘画。专为肢体障碍人士与儿童设计的纯语音驱动创作工具。
              </p>
            </div>

            {/* Mini features */}
            <div className="stagger-item flex flex-wrap gap-5 mb-8">
              {[
                { icon: Volume2, label: "语音输入" },
                { icon: Wand2, label: "AI 识别" },
                { icon: Sparkles, label: "即刻成画" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white border border-border-custom flex items-center justify-center shadow-sm">
                    <f.icon className="w-4 h-4 text-sakura" />
                  </div>
                  <span className="text-sm text-text-secondary font-medium">
                    {f.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Auth card */}
            <div
              ref={formRef}
              className="bg-white/80 backdrop-blur-md rounded-3xl p-6 lg:p-8 border border-border-custom shadow-lg shadow-sakura/5 max-w-md"
            >
              {/* Tabs */}
              <div className="flex mb-5 bg-surface rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => handleSetIsLogin(true)}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    isLogin
                      ? "bg-white text-sakura shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  登录
                </button>
                <button
                  type="button"
                  onClick={() => handleSetIsLogin(false)}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    !isLogin
                      ? "bg-white text-sakura shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <User className="w-4 h-4" />
                  注册
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">
                      用户名
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-sakura-light/50 flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-sakura" />
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
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-border-custom bg-white focus:outline-none focus:ring-2 focus:ring-sakura/40 focus:border-sakura transition-all text-sm"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">
                    邮箱
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-sakura-light/50 flex items-center justify-center">
                      <Mail className="w-3.5 h-3.5 text-sakura" />
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
                      className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-border-custom bg-white focus:outline-none focus:ring-2 focus:ring-sakura/40 focus:border-sakura transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">
                    密码
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-sakura-light/50 flex items-center justify-center">
                      <Lock className="w-3.5 h-3.5 text-sakura" />
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
                      className="w-full pl-11 pr-11 py-2.5 rounded-xl border border-border-custom bg-white focus:outline-none focus:ring-2 focus:ring-sakura/40 focus:border-sakura transition-all text-sm"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary transition-all"
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 px-5 rounded-xl font-semibold text-white text-sm transition-all flex items-center justify-center gap-2 shadow-md ${
                    loading
                      ? "bg-text-disabled cursor-not-allowed"
                      : "bg-gradient-to-r from-sakura to-sakura/80 hover:shadow-lg hover:shadow-sakura/20 active:scale-[0.98]"
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      处理中...
                    </>
                  ) : (
                    <>
                      {isLogin ? "登录" : "注册"}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="relative py-0.5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border-custom" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-2 bg-white text-xs text-text-disabled">
                      或
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGuest}
                  className="w-full py-2.5 px-5 rounded-xl font-medium text-sm text-text-secondary bg-surface border border-border-custom hover:bg-sakura-light/30 hover:text-sakura hover:border-sakura/30 transition-all"
                >
                  以访客身份体验
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 py-6 text-center">
        <p className="text-xs text-text-disabled">
          © 2025 VoiceCanvas · 让每个人都能创作
        </p>
      </div>
    </div>
  );
}
