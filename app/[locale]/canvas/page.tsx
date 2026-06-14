'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Image,
  LogOut,
  User,
  RotateCcw,
  RotateCw,
  FilePlus,
  Trash2,
  Save,
  Download,
  Sparkles,
} from 'lucide-react';
import { gsap } from 'gsap';
import { useRouter } from 'next/navigation';
import { authDB, artworkDB } from '../lib/db';
import type { User as UserType } from '../lib/db';
import { DrawInstruction } from '../lib/draw-schema';
import XfyunVoiceInput from '../components/XfyunVoiceInput';
import SaveModal from '../components/SaveModal';
import Toast from '../components/Toast';

export default function CanvasPage() {
  const router = useRouter();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const voiceAreaRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const [sessionDescription, setSessionDescription] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [currentArtworkId, setCurrentArtworkId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [micState, setMicState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [user, setUser] = useState<UserType | null>(null);
  const [brushVisible, setBrushVisible] = useState(false);
  const [brushPosition, setBrushPosition] = useState({ x: 0, y: 0 });

  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error' | 'warning' | 'info'; message: string }[]>([]);
  const toastIdCounter = useRef(0);

  // 加载用户信息
  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await authDB.getCurrentUser();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const addToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    const id = `${Date.now()}-${toastIdCounter.current++}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleLogout = useCallback(async () => {
    await authDB.logout();
    router.push('/login');
  }, [router]);

  const handleTranscriptChange = useCallback((newTranscript: string) => {
    setTranscript(newTranscript);
  }, []);

  const handleFinalResult = useCallback((finalTranscript: string) => {
    if (finalTranscript.trim()) {
      setSessionDescription(finalTranscript);
      setMicState('idle');
      addToast('success', '识别结果已填入绘图描述');
    }
  }, [addToast]);

  // 移动画笔到指定位置
  const moveBrush = useCallback((x: number, y: number, duration: number = 0.3) => {
    return new Promise<void>((resolve) => {
      setBrushVisible(true);
      gsap.to(brushPosition, {
        x,
        y,
        duration,
        ease: 'power2.out',
        onComplete: resolve,
      });
    });
  }, [brushPosition]);

  // 绘制单个图形（不带清除画布）
  const drawSingleShape = useCallback((ctx: CanvasRenderingContext2D, shape: DrawInstruction['shapes'][0]) => {
    ctx.beginPath();
    
    switch (shape.type) {
      case 'rectangle': {
        const w = shape.width || 100;
        const h = shape.height || 100;
        if (shape.fillColor) {
          ctx.fillStyle = shape.fillColor;
          ctx.fillRect(shape.x, shape.y, w, h);
        }
        if (shape.strokeColor) {
          ctx.strokeStyle = shape.strokeColor;
          ctx.lineWidth = shape.strokeWidth || 2;
          ctx.strokeRect(shape.x, shape.y, w, h);
        }
        break;
      }
      case 'circle': {
        const r = shape.radius || 50;
        ctx.arc(shape.x, shape.y, r, 0, Math.PI * 2);
        if (shape.fillColor) {
          ctx.fillStyle = shape.fillColor;
          ctx.fill();
        }
        if (shape.strokeColor) {
          ctx.strokeStyle = shape.strokeColor;
          ctx.lineWidth = shape.strokeWidth || 2;
          ctx.stroke();
        }
        break;
      }
      case 'line': {
        const endX = shape.x2 || shape.x + 100;
        const endY = shape.y2 || shape.y;
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = shape.strokeColor || '#000';
        ctx.lineWidth = shape.strokeWidth || 2;
        ctx.stroke();
        break;
      }
      case 'triangle': {
        const triWidth = shape.width || 100;
        const triHeight = shape.height || 100;
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x + triWidth / 2, shape.y - triHeight);
        ctx.lineTo(shape.x + triWidth, shape.y);
        ctx.closePath();
        if (shape.fillColor) {
          ctx.fillStyle = shape.fillColor;
          ctx.fill();
        }
        if (shape.strokeColor) {
          ctx.strokeStyle = shape.strokeColor;
          ctx.lineWidth = shape.strokeWidth || 2;
          ctx.stroke();
        }
        break;
      }
      case 'text': {
        ctx.font = '20px PingFang SC, Microsoft YaHei, sans-serif';
        ctx.fillStyle = shape.fillColor || '#000';
        ctx.fillText(shape.text || '', shape.x, shape.y);
        break;
      }
    }
  }, []);

  // 绘制图形到 Canvas（带画笔动画和累积效果）
  const drawShapes = useCallback(async (instructions: DrawInstruction) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置固定 Canvas 尺寸
    const fixedWidth = 800;
    const fixedHeight = 600;
    canvas.width = fixedWidth;
    canvas.height = fixedHeight;

    // 绘制背景
    if (instructions.backgroundColor) {
      ctx.fillStyle = instructions.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 绘制每个图形（带画笔动画，累积效果）
    for (let shapeIndex = 0; shapeIndex < instructions.shapes.length; shapeIndex++) {
      const shape = instructions.shapes[shapeIndex];
      
      // 先绘制之前所有已完成的图形（累积显示）
      for (let i = 0; i < shapeIndex; i++) {
        drawSingleShape(ctx, instructions.shapes[i]);
      }

      switch (shape.type) {
        case 'rectangle': {
          const w = shape.width || 100;
          const h = shape.height || 100;
          await moveBrush(shape.x, shape.y);
          
          // 绘制矩形轮廓动画（累积式）
          for (let i = 0; i <= 100; i += 5) {
            // 清除当前图形区域，保留其他已完成图形
            ctx.clearRect(shape.x - 5, shape.y - 5, w + 10, h + 10);
            
            // 重新绘制背景
            if (instructions.backgroundColor) {
              ctx.fillStyle = instructions.backgroundColor;
              ctx.fillRect(shape.x - 5, shape.y - 5, w + 10, h + 10);
            }
            
            // 重新绘制之前的图形
            for (let j = 0; j < shapeIndex; j++) {
              drawSingleShape(ctx, instructions.shapes[j]);
            }
            
            // 绘制当前图形的进度
            const progress = i / 100;
            const currentW = w * progress;
            const currentH = h * progress;
            
            ctx.beginPath();
            ctx.moveTo(shape.x, shape.y);
            ctx.lineTo(shape.x + currentW, shape.y);
            ctx.lineTo(shape.x + currentW, shape.y + currentH);
            ctx.lineTo(shape.x, shape.y + currentH);
            ctx.closePath();
            
            if (shape.fillColor && progress > 0.5) {
              const fillProgress = (progress - 0.5) * 2;
              ctx.fillStyle = shape.fillColor;
              ctx.globalAlpha = fillProgress;
              ctx.fill();
              ctx.globalAlpha = 1;
            }
            
            ctx.strokeStyle = shape.strokeColor || '#000';
            ctx.lineWidth = shape.strokeWidth || 2;
            ctx.stroke();
            
            await new Promise(resolve => requestAnimationFrame(resolve));
          }
          
          // 最终绘制完整矩形
          drawSingleShape(ctx, shape);
          await moveBrush(shape.x + w, shape.y + h, 0.2);
          break;
        }

        case 'circle': {
          const r = shape.radius || 50;
          await moveBrush(shape.x, shape.y - r);
          
          // 绘制圆形动画（累积式）
          for (let i = 0; i <= 100; i += 5) {
            // 清除当前图形区域
            ctx.clearRect(shape.x - r - 5, shape.y - r - 5, r * 2 + 10, r * 2 + 10);
            
            // 重新绘制背景
            if (instructions.backgroundColor) {
              ctx.fillStyle = instructions.backgroundColor;
              ctx.fillRect(shape.x - r - 5, shape.y - r - 5, r * 2 + 10, r * 2 + 10);
            }
            
            // 重新绘制之前的图形
            for (let j = 0; j < shapeIndex; j++) {
              drawSingleShape(ctx, instructions.shapes[j]);
            }
            
            // 绘制当前图形的进度
            const progress = i / 100;
            ctx.beginPath();
            ctx.arc(shape.x, shape.y, r, 0, Math.PI * 2 * progress);
            ctx.strokeStyle = shape.strokeColor || '#000';
            ctx.lineWidth = shape.strokeWidth || 2;
            ctx.stroke();
            
            if (shape.fillColor && progress > 0.5) {
              const fillProgress = (progress - 0.5) * 2;
              ctx.beginPath();
              ctx.arc(shape.x, shape.y, r, 0, Math.PI * 2);
              ctx.fillStyle = shape.fillColor;
              ctx.globalAlpha = fillProgress;
              ctx.fill();
              ctx.globalAlpha = 1;
            }
            
            await new Promise(resolve => requestAnimationFrame(resolve));
          }
          
          // 最终绘制完整圆形
          drawSingleShape(ctx, shape);
          await moveBrush(shape.x + r, shape.y, 0.2);
          break;
        }

        case 'line': {
          const endX = shape.x2 || shape.x + 100;
          const endY = shape.y2 || shape.y;
          const minX = Math.min(shape.x, endX);
          const maxX = Math.max(shape.x, endX);
          const minY = Math.min(shape.y, endY);
          const maxY = Math.max(shape.y, endY);
          
          await moveBrush(shape.x, shape.y);
          
          // 绘制直线动画（累积式）
          for (let i = 0; i <= 100; i += 5) {
            // 清除当前图形区域
            ctx.clearRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);
            
            // 重新绘制背景
            if (instructions.backgroundColor) {
              ctx.fillStyle = instructions.backgroundColor;
              ctx.fillRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);
            }
            
            // 重新绘制之前的图形
            for (let j = 0; j < shapeIndex; j++) {
              drawSingleShape(ctx, instructions.shapes[j]);
            }
            
            // 绘制当前图形的进度
            const progress = i / 100;
            const currentX = shape.x + (endX - shape.x) * progress;
            const currentY = shape.y + (endY - shape.y) * progress;
            
            ctx.beginPath();
            ctx.moveTo(shape.x, shape.y);
            ctx.lineTo(currentX, currentY);
            ctx.strokeStyle = shape.strokeColor || '#000';
            ctx.lineWidth = shape.strokeWidth || 2;
            ctx.stroke();
            
            await new Promise(resolve => requestAnimationFrame(resolve));
          }
          
          // 最终绘制完整直线
          drawSingleShape(ctx, shape);
          await moveBrush(endX, endY, 0.2);
          break;
        }

        case 'triangle': {
          const triWidth = shape.width || 100;
          const triHeight = shape.height || 100;
          const baseX = shape.x;
          const baseY = shape.y;
          
          await moveBrush(baseX, baseY);
          
          // 绘制三角形动画（累积式）
          for (let i = 0; i <= 100; i += 5) {
            // 清除当前图形区域
            ctx.clearRect(baseX - 5, baseY - triHeight - 5, triWidth + 10, triHeight + 10);
            
            // 重新绘制背景
            if (instructions.backgroundColor) {
              ctx.fillStyle = instructions.backgroundColor;
              ctx.fillRect(baseX - 5, baseY - triHeight - 5, triWidth + 10, triHeight + 10);
            }
            
            // 重新绘制之前的图形
            for (let j = 0; j < shapeIndex; j++) {
              drawSingleShape(ctx, instructions.shapes[j]);
            }
            
            // 绘制当前图形的进度
            const progress = i / 100;
            const currentW = triWidth * progress;
            const currentH = triHeight * progress;
            
            ctx.beginPath();
            ctx.moveTo(baseX, baseY);
            ctx.lineTo(baseX + currentW / 2, baseY - currentH);
            ctx.lineTo(baseX + currentW, baseY);
            ctx.closePath();
            
            if (shape.fillColor && progress > 0.5) {
              const fillProgress = (progress - 0.5) * 2;
              ctx.fillStyle = shape.fillColor;
              ctx.globalAlpha = fillProgress;
              ctx.fill();
              ctx.globalAlpha = 1;
            }
            
            ctx.strokeStyle = shape.strokeColor || '#000';
            ctx.lineWidth = shape.strokeWidth || 2;
            ctx.stroke();
            
            await new Promise(resolve => requestAnimationFrame(resolve));
          }
          
          // 最终绘制完整三角形
          drawSingleShape(ctx, shape);
          await moveBrush(baseX + triWidth, baseY, 0.2);
          break;
        }

        case 'text': {
          await moveBrush(shape.x, shape.y);
          
          // 文字逐字显示动画（累积式）
          const text = shape.text || '';
          for (let i = 0; i <= text.length; i++) {
            // 清除当前文字区域
            const textWidth = ctx.measureText(text).width;
            ctx.clearRect(shape.x - 5, shape.y - 25, textWidth + 10, 30);
            
            // 重新绘制背景
            if (instructions.backgroundColor) {
              ctx.fillStyle = instructions.backgroundColor;
              ctx.fillRect(shape.x - 5, shape.y - 25, textWidth + 10, 30);
            }
            
            // 重新绘制之前的图形
            for (let j = 0; j < shapeIndex; j++) {
              drawSingleShape(ctx, instructions.shapes[j]);
            }
            
            // 绘制当前文字进度
            ctx.font = '20px PingFang SC, Microsoft YaHei, sans-serif';
            ctx.fillStyle = shape.fillColor || '#000';
            ctx.fillText(text.substring(0, i), shape.x, shape.y);
            
            await new Promise(resolve => setTimeout(resolve, 80));
          }
          
          await moveBrush(shape.x + (ctx.measureText(text).width || 0), shape.y, 0.2);
          break;
        }
      }
    }

    // 绘制完成后隐藏画笔
    setTimeout(() => {
      setBrushVisible(false);
    }, 500);

    // 添加绘制完成动画
    gsap.fromTo(
      canvas,
      { scale: 0.98, opacity: 0.9 },
      { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.4)' }
    );
  }, [moveBrush, drawSingleShape]);

  // 初始化Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置固定尺寸
    const fixedWidth = 800;
    const fixedHeight = 600;
    canvas.width = fixedWidth;
    canvas.height = fixedHeight;

    // 初始化白色背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // 保存到图库（带命名）
  const handleSaveClick = useCallback(() => {
    const defaultTitle = sessionDescription.substring(0, 30) || '未命名作品';
    setSaveTitle(defaultTitle);
    setSaveModalOpen(true);
  }, [sessionDescription]);

  const handleSaveConfirm = useCallback(async (title: string) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      addToast('error', '无法获取画布内容');
      return;
    }

    try {
      const thumbnail = canvas.toDataURL('image/png');
      const canvasData = JSON.stringify({
        width: canvas.width,
        height: canvas.height,
        description: sessionDescription,
        timestamp: Date.now(),
      });

      if (currentArtworkId) {
        await artworkDB.update(currentArtworkId, {
          title,
          thumbnail,
          canvasData,
        });
      } else {
        await artworkDB.save({
          userId: user?.id || 'guest',
          title,
          thumbnail,
          canvasData,
        });
      }

      setSaveModalOpen(false);
      setHasUnsavedChanges(false);
      addToast('success', '作品已保存到图库');
    } catch (error) {
      console.error('保存失败:', error);
      addToast('error', '保存失败，请重试');
    }
  }, [canvasRef, sessionDescription, currentArtworkId, user, addToast]);

  // 新建画布（自动保存当前作品）
  const handleNewCanvas = useCallback(async () => {
    // 如果有未保存的更改，先自动保存
    if (hasUnsavedChanges) {
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          const thumbnail = canvas.toDataURL('image/png');
          const canvasData = JSON.stringify({
            width: canvas.width,
            height: canvas.height,
            description: sessionDescription,
            timestamp: Date.now(),
          });
          const defaultTitle = sessionDescription.substring(0, 30) || '未命名作品';

          if (currentArtworkId) {
            await artworkDB.update(currentArtworkId, {
              title: defaultTitle,
              thumbnail,
              canvasData,
            });
          } else {
            await artworkDB.save({
              userId: user?.id || 'guest',
              title: defaultTitle,
              thumbnail,
              canvasData,
            });
          }
          addToast('info', '当前作品已自动保存');
        } catch (error) {
          console.error('自动保存失败:', error);
        }
      }
    }

    // 清空画布和状态
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    setSessionDescription('');
    setTranscript('');
    setCurrentArtworkId(null);
    setHasUnsavedChanges(false);
    addToast('success', '已创建新画布');
  }, [hasUnsavedChanges, canvasRef, sessionDescription, currentArtworkId, user, addToast]);

  // 导出 PNG
  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      addToast('error', '无法获取画布内容');
      return;
    }

    try {
      const link = document.createElement('a');
      const title = sessionDescription.substring(0, 30) || 'drawing';
      link.download = `${title}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      addToast('success', '图片已导出');
    } catch (error) {
      console.error('导出 PNG 失败:', error);
      addToast('error', '导出失败');
    }
  }, [canvasRef, sessionDescription, addToast]);

  // 清空画布
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    setHasUnsavedChanges(true);
    addToast('success', '画布已清空');
  }, [canvasRef, addToast]);

  // 打开图库
  const openGallery = useCallback(() => {
    router.push('/gallery');
  }, [router]);

  // 处理开始绘图
  const handleStartDrawing = useCallback(async () => {
    if (!sessionDescription.trim()) {
      addToast('warning', '请先输入绘图描述');
      return;
    }

    setIsDrawing(true);
    addToast('info', '正在生成绘图...');

    try {
      const response = await fetch('/api/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: sessionDescription }),
      });

      if (!response.ok) {
        throw new Error('绘图生成失败');
      }

      const instructions: DrawInstruction = await response.json();
      drawShapes(instructions);
      setHasUnsavedChanges(true);
      addToast('success', '绘图完成，记得保存作品');
    } catch (error) {
      console.error('Draw error:', error);
      addToast('error', '绘图失败，请重试');
    } finally {
      setIsDrawing(false);
    }
  }, [sessionDescription, drawShapes, addToast]);

  if (!user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-text-secondary animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg via-sakura-light/5 to-macaron-blue-light/5 flex flex-col">
      {/* Toast 通知区域 */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            onClose={removeToast}
          />
        ))}
      </div>

      {/* Header */}
      <header
        ref={headerRef}
        className="h-14 bg-surface/80 backdrop-blur-sm border-b border-sakura/10 flex items-center justify-between px-6"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sakura-light to-sakura/30 flex items-center justify-center shadow-sm">
            <span className="text-sakura font-bold text-sm">VC</span>
          </div>
          <span className="font-semibold text-text-primary">VoiceCanvas</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openGallery}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-sakura-light/20 transition-all"
            aria-label="打开图库"
          >
            <Image className="w-5 h-5" />
            <span className="text-sm hidden sm:inline">图库</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-sakura-light/20 transition-all"
            aria-label="登出"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm hidden sm:inline">登出</span>
          </button>

          <div className="flex items-center gap-2 pl-3 border-l border-border">
            <div className="w-8 h-8 rounded-full bg-sakura-light flex items-center justify-center">
              <User className="w-4 h-4 text-sakura" />
            </div>
            <span className="text-sm text-text-primary hidden sm:inline font-medium">
              {user.name}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-auto p-4">
        {/* Canvas Area with Sidebar */}
        <div className="flex gap-4 items-start">
          {/* Canvas Container */}
          <div
            ref={canvasAreaRef}
            className="relative bg-gradient-to-br from-white to-sakura-light/10 rounded-3xl border border-sakura/15 shadow-xl shadow-sakura/8 overflow-hidden"
            style={{ width: '800px', height: '600px' }}
          >
            {/* 背景装饰网格 */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'radial-gradient(circle, #FFB7C5 0.5px, transparent 0.5px)',
                backgroundSize: '32px 32px',
              }}
            />

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0"
              style={{ width: '100%', height: '100%' }}
              role="img"
              aria-label="绘图画布 - 通过语音指令控制绘图"
            />

            {/* 画笔指针 */}
            <div
              className={`absolute pointer-events-none transition-opacity duration-300 ${brushVisible ? 'opacity-100' : 'opacity-0'}`}
              style={{
                left: brushPosition.x,
                top: brushPosition.y,
                transform: 'translate(-50%, -50%)',
                zIndex: 100,
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="drop-shadow-lg"
              >
                {/* 画笔杆 */}
                <rect
                  x="10"
                  y="8"
                  width="4"
                  height="12"
                  rx="1"
                  fill="#8B4513"
                  stroke="#5D3A1A"
                  strokeWidth="0.5"
                />
                {/* 画笔金属箍 */}
                <rect
                  x="9"
                  y="5"
                  width="6"
                  height="4"
                  rx="1"
                  fill="#C0C0C0"
                  stroke="#808080"
                  strokeWidth="0.5"
                />
                {/* 画笔笔尖 */}
                <path
                  d="M10 2L12 0L14 2L12 24Z"
                  fill="#FFB7C5"
                  stroke="#FF6B8A"
                  strokeWidth="0.5"
                />
                {/* 笔尖高光 */}
                <path
                  d="M11 2L12 0.5L12.5 2"
                  fill="white"
                  opacity="0.6"
                />
              </svg>
              {/* 画笔光晕效果 */}
              <div
                className="absolute inset-0 -m-2 rounded-full animate-ping"
                style={{
                  background: 'radial-gradient(circle, rgba(255, 183, 197, 0.4) 0%, transparent 70%)',
                }}
              />
            </div>

            {/* 右上角装饰 - 操作提示 */}
            <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm rounded-xl border border-sakura/10 shadow-sm px-4 py-2">
              <p className="text-xs text-text-secondary">
                试试说：
                <span className="text-sakura font-medium ml-1">
                  &quot; 画一个红色圆形&quot;
                </span>
              </p>
            </div>
          </div>

          {/* Sidebar Toolbar */}
          <div
            ref={toolbarRef}
            className="bg-surface/95 backdrop-blur-sm rounded-2xl border border-sakura/10 shadow-lg p-3 flex flex-col gap-1"
          >
            {/* 撤销 */}
            <button
              onClick={() => addToast('info', '撤销功能开发中')}
              className="p-3 rounded-xl text-text-secondary hover:text-text-primary hover:bg-sakura-light/20 transition-all"
              aria-label="撤销"
              title="撤销"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* 重做 */}
            <button
              onClick={() => addToast('info', '重做功能开发中')}
              className="p-3 rounded-xl text-text-secondary hover:text-text-primary hover:bg-sakura-light/20 transition-all"
              aria-label="重做"
              title="重做"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            <div className="w-full h-px bg-border my-1" />

            {/* 新建画布 */}
            <button
              onClick={handleNewCanvas}
              className="p-3 rounded-xl text-text-secondary hover:text-lavender hover:bg-lavender-light/20 transition-all"
              aria-label="新建画布"
              title="新建画布"
            >
              <FilePlus className="w-5 h-5" />
            </button>

            {/* 清空画布 */}
            <button
              onClick={clearCanvas}
              className="p-3 rounded-xl text-text-secondary hover:text-error hover:bg-error/10 transition-all"
              aria-label="清空画布"
              title="清空画布"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            <div className="w-full h-px bg-border my-1" />

            {/* 保存到图库 */}
            <button
              onClick={handleSaveClick}
              className="p-3 rounded-xl text-text-secondary hover:text-mint hover:bg-mint-light/20 transition-all"
              aria-label="保存到图库"
              title="保存到图库"
            >
              <Save className="w-5 h-5" />
            </button>

            {/* 导出 PNG */}
            <button
              onClick={exportPNG}
              className="p-3 rounded-xl text-text-secondary hover:text-macaron-blue hover:bg-macaron-blue-light/20 transition-all"
              aria-label="导出 PNG"
              title="导出 PNG"
            >
              <Download className="w-5 h-5" />
            </button>

            <div className="w-full h-px bg-border my-1" />

            {/* 当前颜色指示 */}
            <div className="flex flex-col items-center gap-1 p-2">
              <div className="w-6 h-6 rounded-full bg-sakura border-2 border-white shadow-sm" />
              <span className="text-xs text-text-secondary font-medium">樱花粉</span>
            </div>

            <div className="w-full h-px bg-border my-1" />

            {/* 模式标签 */}
            <div className="px-3 py-2 rounded-full bg-sakura-light text-sakura text-xs font-semibold text-center">
              绘图模式
            </div>
          </div>
        </div>

        {/* Description Area - 缩小高度 */}
        <div
          ref={descriptionRef}
          className="w-full max-w-3xl mt-4"
        >
          <section className="rounded-3xl border border-sakura/10 bg-white/90 shadow-sm shadow-sakura/5">
            <div className="flex items-center gap-2 px-5 pt-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lavender/20 text-lavender">
                <Sparkles className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-text-primary">
                绘图描述
              </h2>
            </div>

            <div className="p-4 pt-2">
              <textarea
                value={sessionDescription}
                onChange={(event) => setSessionDescription(event.target.value)}
                placeholder="输入绘图描述..."
                className="min-h-[60px] max-h-[100px] w-full resize-none rounded-xl border border-border bg-surface px-4 py-2 text-sm text-text-primary outline-none transition-all placeholder:text-text-disabled focus:border-sakura focus:ring-2 focus:ring-sakura/30"
                aria-label="绘图描述输入框"
              />

              {/* 绘图 Agent 按钮 */}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleStartDrawing}
                  disabled={!sessionDescription.trim() || isDrawing}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                    sessionDescription.trim() && !isDrawing
                      ? 'bg-lavender hover:bg-lavender/90 text-white shadow-sm'
                      : 'bg-text-disabled text-white cursor-not-allowed'
                  }`}
                  aria-label="开始绘图"
                >
                  <Sparkles className={`w-4 h-4 ${isDrawing ? 'animate-spin' : ''}`} />
                  {isDrawing ? '绘制中...' : '开始绘图'}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Voice Control Area - 缩小高度 */}
        <div
          ref={voiceAreaRef}
          className="w-full max-w-3xl mt-4 mb-4"
        >
          {/* 语音输入组件 */}
          <XfyunVoiceInput
            onTranscriptChange={handleTranscriptChange}
            onFinalResult={handleFinalResult}
            transcript={transcript}
          />
        </div>
      </div>

      {/* Save Modal */}
      <SaveModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleSaveConfirm}
        title={saveTitle}
        onTitleChange={setSaveTitle}
      />
    </div>
  );
}
