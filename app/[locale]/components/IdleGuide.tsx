'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Mic, Sparkles, Circle, Square, Star } from 'lucide-react';
import { gsap } from 'gsap';

interface IdleGuideProps {
  visible: boolean;
}

// 模拟的语音指令和对应的图形
const runDemoCycle = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  tlRef: React.MutableRefObject<gsap.core.Timeline | null>,
  indexRef: React.MutableRefObject<number>,
  scenarios: Array<{ transcript: string; shape: string; color: string; icon: typeof Circle }>,
  copy: {
    ready: string;
    listening: string;
    thinking: string;
    drawing: string;
    complete: string;
  }
) => {
  if (!canvasRef.current) return;

  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;

  const drawBackground = () => {
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255, 183, 197, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }
  };

  const drawShape = (scenario: (typeof scenarios)[number], progress: number) => {
    drawBackground();

    ctx.strokeStyle = scenario.color;
    ctx.lineWidth = 2.5;
    ctx.fillStyle = `${scenario.color}30`;

    switch (scenario.shape) {
      case 'circle': {
        const radius = Math.max(1, 35 * progress);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        if (progress > 0.3) {
          ctx.fill();
        }
        break;
      }
      case 'rectangle': {
        const w = Math.max(1, 70 * progress);
        const h = Math.max(1, 50 * progress);
        ctx.beginPath();
        ctx.rect(centerX - w / 2, centerY - h / 2, w, h);
        ctx.stroke();
        if (progress > 0.3) {
          ctx.fill();
        }
        break;
      }
      case 'star': {
        const starRadius = Math.max(1, 30 * progress);
        const spikes = 5;
        const outerRadius = starRadius;
        const innerRadius = starRadius / 2;

        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (Math.PI / spikes) * i - Math.PI / 2;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        if (progress > 0.3) {
          ctx.fill();
        }
        break;
      }
    }
  };

  const createDemoTimeline = () => {
    const scenario = scenarios[indexRef.current];

    const tl = gsap.timeline({
      onComplete: () => {
        indexRef.current = (indexRef.current + 1) % scenarios.length;
        gsap.delayedCall(2, () => {
          runDemoCycle(canvasRef, tlRef, indexRef, scenarios, copy);
        });
      },
    });

    drawBackground();

    const statusTextEl = document.querySelector('.status-text') as HTMLParagraphElement | null;
    const progressFillEl = document.querySelector('.progress-fill') as HTMLDivElement | null;

    tl.set('.status-icon', { className: 'status-icon w-10 h-10 rounded-full flex items-center justify-center bg-sakura-light text-sakura' });
    tl.call(() => { if (statusTextEl) statusTextEl.textContent = copy.ready; });
    tl.set('.shape-preview', { opacity: 0 });
    tl.set('.transcript-box', { opacity: 0 });
    tl.set('.progress-bar', { opacity: 0 });
    tl.to({}, { duration: 2 });

    tl.to('.status-icon', {
      className: 'status-icon w-10 h-10 rounded-full flex items-center justify-center bg-macaron-blue-light text-macaron-blue',
      duration: 0.3,
    });
    tl.call(() => { if (statusTextEl) statusTextEl.textContent = copy.listening; }, undefined, '<');
    tl.to('.transcript-box', { opacity: 1, duration: 0.2 });

    const typingDuration = scenario.transcript.length * 120;
    tl.call(() => {
      const transcriptEl = document.querySelector('.transcript-text') as HTMLSpanElement | null;
      if (!transcriptEl) return;

      let index = 0;
      const text = scenario.transcript;
      const typeInterval = setInterval(() => {
        if (index <= text.length) {
          transcriptEl.textContent = text.substring(0, index);
          index++;
          return;
        }
        clearInterval(typeInterval);
      }, 120);
    });

    tl.to({}, { duration: typingDuration / 1000 + 1 });

    tl.to('.status-icon', {
      className: 'status-icon w-10 h-10 rounded-full flex items-center justify-center bg-lavender-light text-lavender',
      duration: 0.3,
    });
    tl.call(() => { if (statusTextEl) statusTextEl.textContent = copy.thinking; }, undefined, '<');
    tl.to('.transcript-box', { opacity: 0, duration: 0.2 }, '<');
    tl.to('.shape-preview', { opacity: 1, duration: 0.3 });
    tl.to({}, { duration: 1.2 });

    tl.to('.status-icon', {
      className: 'status-icon w-10 h-10 rounded-full flex items-center justify-center bg-mint-light text-mint',
      duration: 0.3,
    });
    tl.call(() => { if (statusTextEl) statusTextEl.textContent = copy.drawing; }, undefined, '<');
    tl.to('.progress-bar', { opacity: 1, duration: 0.2 }, '<');

    tl.to({ progress: 0 }, {
      progress: 1,
      duration: 1.5,
      ease: 'power2.out',
      onUpdate() {
        const progress = this.targets()[0].progress;
        drawShape(scenario, progress);
        if (progressFillEl) progressFillEl.style.width = `${progress * 100}%`;
      },
    });

    tl.to('.status-icon', {
      className: 'status-icon w-10 h-10 rounded-full flex items-center justify-center bg-sakura-light text-sakura',
      duration: 0.3,
    }, '+=0.2');
    tl.call(() => { if (statusTextEl) statusTextEl.textContent = copy.complete; }, undefined, '<');
    tl.to('.progress-bar', { opacity: 0, duration: 0.2 }, '<');
    tl.to('.shape-preview', { opacity: 0, duration: 0.2 }, '<');
    tl.to({}, { duration: 1 });
    tl.call(() => drawBackground());

    return tl;
  };

  tlRef.current = createDemoTimeline();
};

export default function IdleGuide({ visible }: IdleGuideProps) {
  const tIdleGuide = useTranslations('idleGuide');
  const containerRef = useRef<HTMLDivElement>(null);
  const demoCanvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const ctxRef = useRef<gsap.Context | null>(null);
  const scenarioIndexRef = useRef(0);

  const demoScenarios = [
    {
      transcript: tIdleGuide('transcript1'),
      shape: 'circle',
      color: '#FF6B6B',
      icon: Circle,
    },
    {
      transcript: tIdleGuide('transcript2'),
      shape: 'rectangle',
      color: '#4DABF7',
      icon: Square,
    },
    {
      transcript: tIdleGuide('transcript3'),
      shape: 'star',
      color: '#FFD43B',
      icon: Star,
    },
  ] as const;

  // 初始化入场动画和背景装饰
  useEffect(() => {
    if (!visible || !containerRef.current) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // 创建 GSAP context
    ctxRef.current = gsap.context(() => {
      // 入场动画
      const entranceTl = gsap.timeline();
      
      entranceTl.fromTo(containerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: 'power2.out' }
      );

      entranceTl.fromTo('.demo-canvas-wrapper',
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.4)' },
        '-=0.3'
      );

      entranceTl.fromTo('.status-indicator',
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
        '-=0.2'
      );

      entranceTl.fromTo('.guide-text',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' },
        '-=0.1'
      );

      entranceTl.fromTo('.hint-text',
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: 'power2.out' },
        '-=0.1'
      );

      // 背景装饰 - 缓慢旋转的圆环
      gsap.to('.deco-ring-1', {
        rotation: 360,
        duration: 12,
        repeat: -1,
        ease: 'none',
      });

      gsap.to('.deco-ring-2', {
        rotation: -360,
        duration: 15,
        repeat: -1,
        ease: 'none',
      });

      gsap.to('.deco-ring-3', {
        rotation: 360,
        duration: 10,
        repeat: -1,
        ease: 'none',
      });

      // 背景装饰图形 - 缓慢浮动
      gsap.to('.deco-shape', {
        y: -8,
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
        stagger: 0.5,
      });

      // 麦克风图标轻微呼吸效果
      gsap.to('.mic-icon-wrapper', {
        scale: 1.05,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      });

      // 延迟运行演示循环
      gsap.delayedCall(0.5, () => {
      runDemoCycle(
        demoCanvasRef,
        timelineRef,
        scenarioIndexRef,
        demoScenarios as Array<{ transcript: string; shape: string; color: string; icon: typeof Circle }>,
        {
          ready: tIdleGuide('ready'),
          listening: tIdleGuide('listening'),
          thinking: tIdleGuide('thinking'),
          drawing: tIdleGuide('drawing'),
          complete: tIdleGuide('complete'),
        }
      );
      });
    }, containerRef);

    return () => {
      ctxRef.current?.revert();
      timelineRef.current?.kill();
    };
  }, [demoScenarios, tIdleGuide, visible]);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none overflow-hidden opacity-0"
    >
      {/* 背景装饰元素 */}
      <div className="absolute inset-0">
        {/* 旋转圆环 - 缓慢 */}
        <div className="deco-ring-1 absolute top-1/4 left-1/4 w-16 h-16 border-2 border-sakura/15 rounded-full" />
        <div className="deco-ring-2 absolute bottom-1/4 right-1/4 w-20 h-20 border-2 border-lavender/10 rounded-full" />
        <div className="deco-ring-3 absolute top-1/3 right-1/3 w-12 h-12 border-2 border-macaron-blue/8 rounded-full" />
        
        {/* 浮动装饰图形 */}
        <div className="deco-shape absolute top-20 left-20 text-sakura/25">
          <Circle className="w-5 h-5" />
        </div>
        <div className="deco-shape absolute bottom-24 left-24 text-lavender/20">
          <Square className="w-4 h-4" />
        </div>
        <div className="deco-shape absolute top-32 right-32 text-macaron-blue/20">
          <Star className="w-4 h-4" />
        </div>
        <div className="deco-shape absolute bottom-32 right-20 text-mint/20">
          <Star className="w-5 h-5" />
        </div>
      </div>

      {/* 演示画布 */}
      <div className="demo-canvas-wrapper relative mb-4 opacity-0">
        <canvas
          ref={demoCanvasRef}
          width={200}
          height={150}
          className="rounded-2xl border border-sakura/15 bg-white/50 shadow-lg"
        />
      </div>

      {/* 状态指示器 */}
      <div className="status-indicator flex items-center gap-3 mb-3 opacity-0">
        {/* 步骤图标 */}
        <div className="mic-icon-wrapper">
          <div className="status-icon w-10 h-10 rounded-full flex items-center justify-center bg-sakura-light text-sakura">
            <Mic className="w-5 h-5" />
          </div>
        </div>

        {/* 状态文字 */}
        <div className="text-center">
          <p className="status-text text-sm font-medium text-text-primary">{tIdleGuide('ready')}</p>
        </div>

        {/* 形状预览 */}
        <div className="shape-preview w-8 h-8 rounded-lg flex items-center justify-center opacity-0 bg-[#FF6B6B]/20">
          <Circle className="w-4 h-4 text-[#FF6B6B]" />
        </div>
      </div>

      {/* 语音识别文字显示 */}
      <div className="transcript-box bg-white/80 backdrop-blur-sm rounded-xl border border-sakura/10 px-4 py-2 shadow-sm mb-3 opacity-0">
        <p className="text-sm text-text-primary font-medium">
          &ldquo;<span className="transcript-text"></span>&rdquo;
        </p>
      </div>

      {/* 进度条 */}
      <div className="progress-bar w-48 h-2 bg-sakura-light/30 rounded-full overflow-hidden mb-3 opacity-0">
        <div className="progress-fill h-full bg-gradient-to-r from-sakura to-lavender rounded-full" style={{ width: '0%' }} />
      </div>

      {/* 引导文字 */}
      <div className="guide-text text-center mt-2 opacity-0">
        <h3 className="text-lg font-bold text-text-primary mb-1">
          VoiceCanvas
        </h3>
        <p className="text-xs text-text-secondary max-w-xs">
          {tIdleGuide('listening')}
        </p>
      </div>

      {/* 示例指令提示 */}
      <div className="hint-text mt-3 flex items-center gap-2 text-xs text-text-disabled opacity-0">
        <Sparkles className="w-3 h-3" />
        <span>{`${tIdleGuide('transcript1')} / ${tIdleGuide('transcript2')} / ${tIdleGuide('transcript3')}`}</span>
      </div>
    </div>
  );
}
