"use client";

import { useEffect, useRef } from "react";
import { Sparkles, Ear, Wand2 } from "lucide-react";
import { gsap } from "gsap";

type ChildGuideMode = "idle" | "listening" | "thinking" | "appending";

interface ChildGuideCopy {
  title: string;
  speakHint: string;
  appendHint: string;
  listening: string;
  thinking: string;
  appendMode: string;
  examples: {
    scene1: string;
    scene2: string;
    append1: string;
  };
}

interface ChildGuideProps {
  mode: ChildGuideMode;
  hasArtwork: boolean;
  lastTranscript?: string;
  copy: ChildGuideCopy;
}

export default function ChildGuide({ mode, hasArtwork, lastTranscript, copy }: ChildGuideProps) {
  const containerRef = useRef<HTMLElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const transcriptRef = useRef<HTMLParagraphElement>(null);
  const badgesRef = useRef<HTMLDivElement>(null);

  const statusText =
    mode === "listening"
      ? copy.listening
      : mode === "thinking"
        ? copy.thinking
        : hasArtwork
          ? copy.appendMode
          : copy.speakHint;

  // GSAP 动画效果
  useEffect(() => {
    if (!containerRef.current) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      // 入场动画
      const tl = gsap.timeline();
      
      tl.fromTo(containerRef.current, 
        { opacity: 0, y: 20, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.4)' }
      );

      tl.fromTo(iconRef.current,
        { scale: 0, rotation: -180 },
        { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(2)' },
        '-=0.3'
      );

      tl.fromTo([titleRef.current, textRef.current],
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.4, stagger: 0.1, ease: 'power2.out' },
        '-=0.2'
      );

      if (badgesRef.current) {
        tl.fromTo(badgesRef.current.children,
          { opacity: 0, y: 15, scale: 0.8 },
          { opacity: 1, y: 0, scale: 1, duration: 0.35, stagger: 0.08, ease: 'back.out(1.5)' },
          '-=0.1'
        );
      }

      // 持续浮动动画 - 图标
      gsap.to(iconRef.current, {
        y: -4,
        duration: 1.5,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
        delay: 0.5,
      });

      // 持续浮动动画 - badges
      if (badgesRef.current) {
        const badges = Array.from(badgesRef.current.children);
        badges.forEach((badge, index) => {
          gsap.to(badge, {
            y: -2,
            duration: 1.2 + index * 0.15,
            repeat: -1,
            yoyo: true,
            ease: 'power1.inOut',
            delay: index * 0.2 + 0.8,
          });
        });
      }

      // Sparkles 图标旋转
      const sparklesIcon = iconRef.current?.querySelector('.sparkles-icon');
      if (sparklesIcon && mode === 'idle') {
        gsap.to(sparklesIcon, {
          rotation: 10,
          duration: 0.6,
          repeat: -1,
          yoyo: true,
          ease: 'power1.inOut',
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // 状态切换动画
  useEffect(() => {
    if (!iconRef.current) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // 状态切换时的弹跳效果
    gsap.fromTo(iconRef.current,
      { scale: 0.8 },
      { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.5)' }
    );

    // listening 状态的脉冲效果
    if (mode === 'listening') {
      gsap.to(iconRef.current, {
        scale: 1.1,
        duration: 0.5,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      });
    }

    // thinking 状态的旋转效果
    if (mode === 'thinking') {
      gsap.to(iconRef.current.querySelector('.thinking-icon'), {
        rotation: 360,
        duration: 1.5,
        repeat: -1,
        ease: 'none',
      });
    }
  }, [mode]);

  // transcript 出现动画
  useEffect(() => {
    if (!transcriptRef.current || !lastTranscript) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    gsap.fromTo(transcriptRef.current,
      { opacity: 0, y: 10, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'back.out(1.5)' }
    );
  }, [lastTranscript]);

  return (
    <section 
      ref={containerRef}
      className="rounded-3xl border border-sakura/10 bg-gradient-to-br from-white to-sakura-light/20 p-4 shadow-sm shadow-sakura/5"
    >
      <div className="flex items-start gap-3">
        <div 
          ref={iconRef}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sakura-light text-sakura relative overflow-hidden"
        >
          {/* 背景光晕 */}
          <div className="absolute inset-0 bg-gradient-to-br from-sakura/20 to-transparent animate-pulse" />
          
          {mode === "listening" ? (
            <Ear className="h-5 w-5 relative z-10" />
          ) : mode === "thinking" ? (
            <Wand2 className="h-5 w-5 relative z-10 thinking-icon" />
          ) : (
            <Sparkles className="h-5 w-5 relative z-10 sparkles-icon" />
          )}
        </div>
        <div className="min-w-0">
          <h2 ref={titleRef} className="text-sm font-semibold text-text-primary">{copy.title}</h2>
          <p ref={textRef} className="mt-1 text-sm text-text-secondary">{statusText}</p>
          {lastTranscript ? (
            <p 
              ref={transcriptRef}
              className="mt-2 rounded-2xl bg-white/80 px-3 py-2 text-xs text-text-secondary border border-sakura/5"
            >
              &ldquo;{lastTranscript}&rdquo;
            </p>
          ) : null}
        </div>
      </div>

      <div ref={badgesRef} className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-macaron-blue-light px-3 py-1 text-xs text-text-primary shadow-sm hover:shadow-md transition-shadow cursor-default">
          {copy.examples.scene1}
        </span>
        <span className="rounded-full bg-mint-light px-3 py-1 text-xs text-text-primary shadow-sm hover:shadow-md transition-shadow cursor-default">
          {copy.examples.scene2}
        </span>
        <span className="rounded-full bg-butter-light px-3 py-1 text-xs text-text-primary shadow-sm hover:shadow-md transition-shadow cursor-default">
          {hasArtwork ? copy.examples.append1 : copy.appendHint}
        </span>
      </div>
    </section>
  );
}
