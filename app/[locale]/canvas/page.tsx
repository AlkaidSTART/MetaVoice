'use client';

import { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { useTranslations } from 'next-intl';
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
  Sun,
  Home,
  Flower2,
  Star,
  Cat,
  Palette,
  Brush,
  Circle,
  Square,
  Triangle,
  Type,
  LineChart,
} from 'lucide-react';
import { gsap } from 'gsap';
import { useRouter, useSearchParams } from 'next/navigation';
import { authDB, artworkDB, promptHistoryDB, Artwork } from '../lib/db';
import type { User as UserType } from '../lib/db';
import { DrawInstruction, Shape } from '../lib/draw-schema';
import {
  AddBatchHistoryEntry,
  applyAddMany,
  coolShapesByIds,
  deserializeState,
  emptyState,
  ensureIds,
  moveShapesByIds,
  removeShapeById,
  serializeState,
  stateFromInstruction,
  warmShapesByIds,
  type CanvasState,
} from '../lib/canvas-state';
import { parseCanvasEditCommand, resolveShapeIdsByHint } from '../lib/canvas-commands';
import {
  applySketchJitter,
  flattenPathSegments,
  flattenShapeOutline,
  getPathBounds,
  pathArcLength,
  pointAtArcLength,
  strokeJitteredPolyline,
} from '../lib/path-geometry';
import XfyunVoiceInput from '../components/XfyunVoiceInput';
import SaveModal from '../components/SaveModal';
import Toast from '../components/Toast';
import LanguageSwitcher from '../components/LanguageSwitcher';
import WeChatBotPanel from '../components/WeChatBotPanel';
import ChildGuide from '../components/ChildGuide';
import IdleGuide from '../components/IdleGuide';

export default function CanvasPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tCanvas = useTranslations('canvas');
  const tTeaching = useTranslations('teaching');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const voiceAreaRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const thinkingIndicatorRef = useRef<HTMLDivElement>(null);

  const [sessionDescription, setSessionDescription] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [currentArtworkId, setCurrentArtworkId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const [brushVisible, setBrushVisible] = useState(false);
  // 画笔位置：用 ref 持有（GSAP 直接改 ref.current），由 gsap.ticker 每帧
  // 同步到画笔 DOM 的 style，绕开 React 重渲染。旧实现把 state 对象直接
  // 交给 gsap.set 原地修改、却不触发 setState，画笔跟随依赖无关重渲染才偶尔刷新，
  // 时序不稳。改用 ref + ticker 后画笔逐帧准确跟随曲线轨迹。
  const brushRef = useRef<HTMLDivElement>(null);
  const brushPosition = useRef({ x: 0, y: 0 });
  const [isThinking, setIsThinking] = useState(false);
  const [canvasState, setCanvasState] = useState<CanvasState>(emptyState());
  const [history, setHistory] = useState<AddBatchHistoryEntry[]>([]);
  const [isAppending, setIsAppending] = useState(false);
  const [activeShapeIds, setActiveShapeIds] = useState<string[]>([]);

  const CANVAS_WIDTH = 960;
  const CANVAS_HEIGHT = 720;

  const parseJsonSafely = useCallback(async (response: Response) => {
    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${text.slice(0, 120)}`);
    }
  }, []);

  // 预设模板数据 - 使用图标代替 emoji
  const presetTemplates = [
    { icon: 'Sun', title: '日出日落', prompt: '画一个美丽的日出场景，太阳从地平线升起' },
    { icon: 'Home', title: '建筑房屋', prompt: '画一栋可爱的小房子' },
    { icon: 'Flower2', title: '花朵植物', prompt: '画一朵漂亮的樱花' },
    { icon: 'Star', title: '星星月亮', prompt: '画一个满天星空的夜晚' },
    { icon: 'Cat', title: '可爱动物', prompt: '画一只橘色的小猫' },
    { icon: 'Palette', title: '抽象艺术', prompt: '画一些几何图形组成的图案' },
  ];

  // 预设 Canvas 动画图形
  const presetShapes = [
    { type: 'circle', color: '#FFB7C5', size: 30 },
    { type: 'square', color: '#B5D5F5', size: 25 },
    { type: 'triangle', color: '#B5E8C7', size: 35 },
    { type: 'star', color: '#FFE5A0', size: 28 },
    { type: 'line', color: '#D4C5F5', length: 80 },
  ];

  const [currentPresetIndex, setCurrentPresetIndex] = useState(0);
  const presetIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const shapeAnimationRef = useRef<number | null>(null);

  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error' | 'warning' | 'info'; message: string }[]>([]);
  const toastIdCounter = useRef(0);

  // 存储编辑参数，供后续使用
  const [editArtworkId, setEditArtworkId] = useState<string | null>(null);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId) {
      setEditArtworkId(editId);
    }
  }, [searchParams]);

  // 加载用户信息
  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await authDB.getCurrentUser();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  // 用户和编辑ID都就绪后，加载作品
  useEffect(() => {
    if (!editArtworkId || !user) return;

    const loadArtwork = async () => {
      try {
        const artwork = await artworkDB.getByUserId(user.id);
        const targetArtwork = artwork.find(a => a.id === editArtworkId);
        if (targetArtwork) {
          await loadArtworkForEdit(targetArtwork);
        }
      } catch (error) {
        console.error('加载作品失败:', error);
        addToast('error', '加载作品失败');
      }
    };

    // 使用 setTimeout 确保 loadArtworkForEdit 已经定义
    setTimeout(loadArtwork, 0);
  }, [editArtworkId, user]);

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

  // 绘制预设动画图形
  const drawPresetShape = useCallback((ctx: CanvasRenderingContext2D, shapeType: string, color: string, size: number, x: number, y: number, progress: number) => {
    ctx.save();
    ctx.globalAlpha = 0.6 + (0.4 * Math.sin(progress * 0.1));
    
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    switch (shapeType) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(x, y, size * progress, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'square':
        const squareSize = size * progress;
        ctx.fillRect(x - squareSize / 2, y - squareSize / 2, squareSize, squareSize);
        break;
      case 'triangle':
        const triSize = size * progress;
        ctx.beginPath();
        ctx.moveTo(x, y - triSize);
        ctx.lineTo(x - triSize, y + triSize);
        ctx.lineTo(x + triSize, y + triSize);
        ctx.closePath();
        ctx.fill();
        break;
      case 'star':
        const starSize = size * progress;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const x1 = x + Math.cos(angle) * starSize;
          const y1 = y + Math.sin(angle) * starSize;
          if (i === 0) ctx.moveTo(x1, y1);
          else ctx.lineTo(x1, y1);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(x - size, y);
        ctx.lineTo(x + size * progress, y);
        ctx.stroke();
        break;
    }
    
    ctx.restore();
  }, []);

  // Canvas 预设动画循环
  const animatePresetShapes = useCallback(function runPresetShapesAnimation() {
    const canvas = canvasRef.current;
    if (!canvas || !isThinking) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // 清除画布
    ctx.clearRect(0, 0, width, height);
    
    // 绘制多个漂浮的预设图形
    const centerX = width / 2;
    const centerY = height / 2;
    const time = Date.now() / 1000;
    
    presetShapes.forEach((shape, index) => {
      const angle = (index * (Math.PI * 2)) / presetShapes.length + time * 0.2;
      const radius = 100 + (index * 30);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius + Math.sin(time + index) * 20;
      const progress = 0.5 + 0.5 * Math.sin(time * 2 + index);
      
      drawPresetShape(ctx, shape.type, shape.color, shape.size || 30, x, y, progress);
    });
    
    shapeAnimationRef.current = requestAnimationFrame(runPresetShapesAnimation);
  }, [isThinking, presetShapes, drawPresetShape]);

  // 启动预设模板轮播动画和 Canvas 动画
  const startPresetAnimation = useCallback(() => {
    setCurrentPresetIndex(0);
    // 每2秒切换一个预设模板
    presetIntervalRef.current = setInterval(() => {
      setCurrentPresetIndex((prev) => (prev + 1) % presetTemplates.length);
    }, 2000);
    // 启动 Canvas 图形动画
    shapeAnimationRef.current = requestAnimationFrame(animatePresetShapes);
  }, [presetTemplates.length, animatePresetShapes]);

  // 停止预设模板轮播动画
  const stopPresetAnimation = useCallback(() => {
    if (presetIntervalRef.current) {
      clearInterval(presetIntervalRef.current);
      presetIntervalRef.current = null;
    }
    if (shapeAnimationRef.current) {
      cancelAnimationFrame(shapeAnimationRef.current);
      shapeAnimationRef.current = null;
    }
    // 清除 Canvas 画布
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
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
      addToast('success', tCanvas('voiceRecognized'));
    }
  }, [addToast, tCanvas]);

  // 把 anchor=center/bottom-right 的语义坐标转换为"左上角"绝对坐标
  // 这样渲染层统一以左上角为锚点，避免歧义
  const toTopLeft = useCallback((shape: Shape) => {
    const anchor = shape.anchor;
    if (anchor === 'top-left' || !anchor) {
      return { x: shape.x, y: shape.y };
    }
    switch (shape.type) {
      case 'circle':
      case 'ellipse':
      case 'polygon':
        // 已是几何中心
        return anchor === 'center' ? { x: shape.x, y: shape.y } : { x: shape.x, y: shape.y };
      case 'rectangle':
      case 'triangle': {
        const w = shape.width || 100;
        const h = shape.height || 100;
        if (anchor === 'center') return { x: shape.x - w / 2, y: shape.y - h / 2 };
        return { x: shape.x - w, y: shape.y - h }; // bottom-right
      }
      case 'text': {
        // text 的 center 近似按宽度居中（测量需在调用时进行，这里仅近似平移）
        return { x: shape.x, y: shape.y };
      }
      default:
        return { x: shape.x, y: shape.y };
    }
  }, []);

  // 计算单个 shape 的几何包围盒（左上角坐标系），用于动画裁剪与画笔定位
  const getShapeBounds = useCallback((shape: Shape) => {
    const tl = toTopLeft(shape);
    switch (shape.type) {
      case 'rectangle':
      case 'triangle': {
        const w = shape.width || 100;
        const h = shape.height || 100;
        return { x: tl.x, y: tl.y, w, h, cx: tl.x + w / 2, cy: tl.y + h / 2 };
      }
      case 'circle': {
        const r = shape.radius || 50;
        return { x: shape.x - r, y: shape.y - r, w: r * 2, h: r * 2, cx: shape.x, cy: shape.y };
      }
      case 'ellipse': {
        const rx = shape.rx || 50;
        const ry = shape.ry || 30;
        return { x: shape.x - rx, y: shape.y - ry, w: rx * 2, h: ry * 2, cx: shape.x, cy: shape.y };
      }
      case 'line': {
        const endX = shape.x2 ?? shape.x + 100;
        const endY = shape.y2 ?? shape.y;
        const minX = Math.min(shape.x, endX);
        const maxX = Math.max(shape.x, endX);
        const minY = Math.min(shape.y, endY);
        const maxY = Math.max(shape.y, endY);
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
      }
      case 'polygon': {
        const pts = shape.points || [];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i + 1 < pts.length; i += 2) {
          minX = Math.min(minX, pts[i]);
          minY = Math.min(minY, pts[i + 1]);
          maxX = Math.max(maxX, pts[i]);
          maxY = Math.max(maxY, pts[i + 1]);
        }
        if (!isFinite(minX)) return { x: shape.x, y: shape.y, w: 100, h: 100, cx: shape.x, cy: shape.y };
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
      }
      case 'path': {
        // path：遍历所有指令段的端点与控制点取 min/max
        return getPathBounds(shape);
      }
      case 'text': {
        // 粗略估算
        const size = shape.fontSize || 24;
        const len = (shape.text || '').length;
        return { x: shape.x, y: shape.y - size, w: len * size * 0.6, h: size * 1.4, cx: shape.x + (len * size * 0.6) / 2, cy: shape.y - size / 2 };
      }
      default:
        return { x: shape.x, y: shape.y, w: 100, h: 100, cx: shape.x, cy: shape.y };
    }
  }, [toTopLeft]);

  const getGroupBounds = useCallback((shapes: Shape[]) => {
    if (shapes.length === 0) {
      return { x: 0, y: 0, w: 0, h: 0, cx: CANVAS_WIDTH / 2, cy: CANVAS_HEIGHT / 2 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const shape of shapes) {
      const bounds = getShapeBounds(shape);
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.w);
      maxY = Math.max(maxY, bounds.y + bounds.h);
    }

    return {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
    };
  }, [getShapeBounds]);

  const resolvePositionCenter = useCallback((position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'left' | 'right' | 'top' | 'bottom') => {
    const marginX = 160;
    const marginY = 140;

    switch (position) {
      case 'top-left':
        return { x: marginX, y: marginY };
      case 'top-right':
        return { x: CANVAS_WIDTH - marginX, y: marginY };
      case 'bottom-left':
        return { x: marginX, y: CANVAS_HEIGHT - marginY };
      case 'bottom-right':
        return { x: CANVAS_WIDTH - marginX, y: CANVAS_HEIGHT - marginY };
      case 'left':
        return { x: marginX, y: CANVAS_HEIGHT / 2 };
      case 'right':
        return { x: CANVAS_WIDTH - marginX, y: CANVAS_HEIGHT / 2 };
      case 'top':
        return { x: CANVAS_WIDTH / 2, y: marginY };
      case 'bottom':
        return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - marginY };
      case 'center':
      default:
        return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    }
  }, []);

  // 解析填充样式：优先 gradient，否则 fallback 到 fillColor 纯色
  // 返回 string 或 CanvasGradient，可直接赋给 ctx.fillStyle
  const resolveFillStyle = useCallback(
    (ctx: CanvasRenderingContext2D, shape: Shape, bounds: { x: number; y: number; w: number; h: number; cx: number; cy: number }): string | CanvasGradient | null => {
      const g = shape.gradient;
      if (g && g.stops.length >= 2) {
        if (g.type === 'radial') {
          // 径向渐变：从几何中心向最远顶点扩散，模拟球体光照
          const maxR = Math.max(bounds.w, bounds.h) / 2;
          const r = Math.max(1, maxR);
          const grad = ctx.createRadialGradient(bounds.cx, bounds.cy, 0, bounds.cx, bounds.cy, r);
          for (const stop of g.stops) {
            grad.addColorStop(Math.max(0, Math.min(1, stop.offset)), stop.color);
          }
          return grad;
        }
        // linear：按 angle 计算起点终点（默认 180 = 上→下）
        const angle = ((g.angle ?? 180) * Math.PI) / 180;
        const dx = Math.sin(angle);
        const dy = -Math.cos(angle);
        const half = Math.max(bounds.w, bounds.h) / 2;
        const x1 = bounds.cx - dx * half;
        const y1 = bounds.cy - dy * half;
        const x2 = bounds.cx + dx * half;
        const y2 = bounds.cy + dy * half;
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        for (const stop of g.stops) {
          grad.addColorStop(Math.max(0, Math.min(1, stop.offset)), stop.color);
        }
        return grad;
      }
      return shape.fillColor || null;
    },
    []
  );

  // 把单个 shape 静态绘制到给定 ctx（完整、不带动画）
  // 支持 anchor 解析、rotation、opacity、渐变、投影阴影、发光、高光
  const drawSingleShape = useCallback((ctx: CanvasRenderingContext2D, shape: Shape) => {
    const bounds = getShapeBounds(shape);
    const rotation = shape.rotation || 0;
    const opacity = shape.opacity ?? 1;

    ctx.save();
    if (opacity !== 1) ctx.globalAlpha = opacity;

    // 围绕几何中心旋转
    if (rotation) {
      ctx.translate(bounds.cx, bounds.cy);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-bounds.cx, -bounds.cy);
    }

    const lineW = shape.strokeWidth || 2;

    // 发光光晕：用大 shadowBlur 二次绘制一个透明主体，制造柔和光晕
    if (shape.glow) {
      ctx.save();
      ctx.shadowColor = shape.glow.color;
      ctx.shadowBlur = shape.glow.blur;
      ctx.fillStyle = shape.glow.color;
      drawShapePath(ctx, shape);
      ctx.fill();
      ctx.restore();
    }

    // 投影阴影：设到 ctx，主体 fill/stroke 时自动应用
    if (shape.shadow) {
      ctx.shadowColor = shape.shadow.color;
      ctx.shadowBlur = shape.shadow.blur;
      ctx.shadowOffsetX = shape.shadow.offsetX;
      ctx.shadowOffsetY = shape.shadow.offsetY;
    }

    // 主体绘制（渐变优先，否则纯色）
    const fill = resolveFillStyle(ctx, shape, bounds);
    const stroke = shape.strokeColor;

    // text 类型无几何路径，直接 fillText（仍受 shadow/opacity 影响）
    if (shape.type === 'text') {
      const size = shape.fontSize || 24;
      const weight = shape.fontWeight === 'bold' ? 'bold ' : '';
      ctx.font = `${weight}${size}px PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = fill || '#1A1A1A';
      ctx.fillText(shape.text || '', shape.x, shape.y);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineW;
        ctx.strokeText(shape.text || '', shape.x, shape.y);
      }
      ctx.restore();
      return;
    }

    const fillThenStroke = () => {
      if (fill) {
        ctx.fillStyle = fill;
        drawShapePath(ctx, shape);
        ctx.fill();
      }
      // 阴影只应用一次：填充后立即清除，避免描边又叠一层阴影
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineW;
        drawShapePath(ctx, shape);
        ctx.stroke();
      }
    };

    // sketch 手绘风格：对任意几何形状（circle/rect/path/...）叠加种子化抖动 +
    // 线宽脉动描边，让画面「像人类自然画图」而非笔直线条拼凑。
    // 文字不做 sketch（避免不可读）；sketch.roughness=0 等价关闭。
    if (shape.sketch && shape.type !== 'text') {
      const { points: outline, closed } = flattenShapeOutline(shape, toTopLeft);
      if (outline.length >= 2) {
        const { points: jittered, widthScale } = applySketchJitter(outline, shape.sketch);
        // 闭合形状先按抖动轮廓填充（用平滑路径填充，保证填充区域干净）
        if (fill && closed) {
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.moveTo(jittered[0].x, jittered[0].y);
          for (let i = 1; i < jittered.length; i++) ctx.lineTo(jittered[i].x, jittered[i].y);
          ctx.closePath();
          ctx.fill();
        }
        // 清除阴影后用抖动折线描边（带线宽脉动）
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        if (stroke) {
          ctx.strokeStyle = stroke;
          strokeJitteredPolyline(ctx, jittered, widthScale, lineW, closed);
        } else if (!closed) {
          // 开放曲线且无显式描边色：用 fillColor 兜底描边，保证曲线可见
          ctx.strokeStyle = typeof fill === 'string' ? fill : '#1A1A1A';
          strokeJitteredPolyline(ctx, jittered, widthScale, lineW, closed);
        }
        // sketch 分支不走 fillThenStroke，直接收尾（匹配顶部 ctx.save）
        ctx.restore();
        return;
      }
    }

    fillThenStroke();

    // 高光斑：球体表面反光（光源方向的亮斑）
    if (shape.highlight) {
      const hl = shape.highlight;
      const hx = bounds.cx + hl.x * (bounds.w / 2);
      const hy = bounds.cy + hl.y * (bounds.h / 2);
      const hr = Math.max(1, hl.radius);
      const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
      hg.addColorStop(0, `rgba(255,255,255,${hl.opacity})`);
      hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      // 用 clip 限制高光不溢出形状边界
      drawShapePath(ctx, shape);
      ctx.clip();
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }, [getShapeBounds, resolveFillStyle, toTopLeft]);

  // 构建 shape 的路径（不填充、不描边），供 fill/stroke/clip 复用
  // 注意：line 类型无闭合路径，text 用 fillText 直接绘制（此处仅处理几何形状）
  function drawShapePath(ctx: CanvasRenderingContext2D, shape: Shape) {
    switch (shape.type) {
      case 'rectangle': {
        const w = shape.width || 100;
        const h = shape.height || 100;
        const { x, y } = toTopLeft(shape);
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        break;
      }
      case 'circle': {
        const r = Math.max(1, shape.radius || 50);
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, r, 0, Math.PI * 2);
        break;
      }
      case 'ellipse': {
        const rx = Math.max(1, shape.rx || 50);
        const ry = Math.max(1, shape.ry || 30);
        ctx.beginPath();
        ctx.ellipse(shape.x, shape.y, rx, ry, 0, 0, Math.PI * 2);
        break;
      }
      case 'line': {
        const endX = shape.x2 ?? shape.x + 100;
        const endY = shape.y2 ?? shape.y;
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(endX, endY);
        break;
      }
      case 'triangle': {
        const w = shape.width || 100;
        const h = shape.height || 100;
        const { x, y } = toTopLeft(shape);
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        break;
      }
      case 'polygon': {
        const pts = shape.points || [];
        if (pts.length < 6) return;
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i + 1 < pts.length; i += 2) {
          ctx.lineTo(pts[i], pts[i + 1]);
        }
        ctx.closePath();
        break;
      }
      case 'path': {
        const segs = shape.segments || [];
        if (segs.length === 0) return;
        ctx.beginPath();
        let started = false;
        let firstPt: { x: number; y: number } | null = null;
        for (const seg of segs) {
          switch (seg.cmd) {
            case 'M': {
              const mx = seg.x ?? shape.x;
              const my = seg.y ?? shape.y;
              ctx.moveTo(mx, my);
              started = true;
              if (!firstPt) firstPt = { x: mx, y: my };
              break;
            }
            case 'L': {
              if (!started) { ctx.moveTo(shape.x, shape.y); started = true; }
              ctx.lineTo(seg.x ?? shape.x, seg.y ?? shape.y);
              break;
            }
            case 'Q': {
              if (!started) { ctx.moveTo(shape.x, shape.y); started = true; }
              ctx.quadraticCurveTo(seg.x1 ?? shape.x, seg.y1 ?? shape.y, seg.x ?? shape.x, seg.y ?? shape.y);
              break;
            }
            case 'C': {
              if (!started) { ctx.moveTo(shape.x, shape.y); started = true; }
              ctx.bezierCurveTo(
                seg.x1 ?? shape.x, seg.y1 ?? shape.y,
                seg.x2 ?? shape.x, seg.y2 ?? shape.y,
                seg.x ?? shape.x, seg.y ?? shape.y,
              );
              break;
            }
            case 'Z': {
              if (shape.closed) ctx.closePath();
              break;
            }
          }
        }
        break;
      }
      // text 无几何路径，由调用方特殊处理
      default:
        break;
    }
  }

  // 计算当前进度下画笔应该在的位置
  const getBrushPositionAtProgress = useCallback((shape: Shape, progress: number): { x: number; y: number } => {
    switch (shape.type) {
      case 'rectangle': {
        const w = shape.width || 100;
        const h = shape.height || 100;
        const { x, y } = toTopLeft(shape);
        const cw = w * progress;
        const ch = h * progress;
        // 矩形：从左上角开始，顺时针移动
        if (progress <= 0.25) {
          return { x: x + cw, y: y };
        } else if (progress <= 0.5) {
          return { x: x + w, y: y + ch };
        } else if (progress <= 0.75) {
          return { x: x + w - (progress - 0.5) * w * 2, y: y + h };
        } else {
          return { x: x, y: y + h - (progress - 0.75) * h * 2 };
        }
      }
      case 'circle': {
        const r = Math.max(1, shape.radius || 50);
        const angle = -Math.PI / 2 + Math.PI * 2 * progress;
        return {
          x: shape.x + Math.cos(angle) * r,
          y: shape.y + Math.sin(angle) * r,
        };
      }
      case 'ellipse': {
        const rx = Math.max(1, shape.rx || 50);
        const ry = Math.max(1, shape.ry || 30);
        const angle = -Math.PI / 2 + Math.PI * 2 * progress;
        return {
          x: shape.x + Math.cos(angle) * rx,
          y: shape.y + Math.sin(angle) * ry,
        };
      }
      case 'line': {
        const endX = shape.x2 ?? shape.x + 100;
        const endY = shape.y2 ?? shape.y;
        return {
          x: shape.x + (endX - shape.x) * progress,
          y: shape.y + (endY - shape.y) * progress,
        };
      }
      case 'triangle': {
        const w = shape.width || 100;
        const h = shape.height || 100;
        const { x, y } = toTopLeft(shape);
        const seg = [w, Math.hypot(w / 2, h), h];
        const total = seg.reduce((a, b) => a + b, 0);
        let remain = total * progress;
        
        // 左下 -> 右下（底边）
        const d1 = Math.min(remain, seg[0]);
        if (d1 > 0) {
          if (remain <= seg[0]) {
            return { x: x + remain, y: y + h };
          }
          remain -= d1;
        }
        
        // 右下 -> 顶（右斜边）
        const d2 = Math.min(remain, seg[1]);
        if (d2 > 0) {
          const t = d2 / seg[1];
          if (remain <= seg[1]) {
            const t2 = remain / seg[1];
            return { x: x + w - (w / 2) * t2, y: y + h - h * t2 };
          }
          remain -= d2;
        }
        
        // 顶 -> 左下（左斜边）
        const t = remain / seg[2];
        return { x: x + (w / 2) * (1 - t), y: y + h - h * (1 - t) };
      }
      case 'polygon': {
        const pts = shape.points || [];
        if (pts.length < 6) return { x: shape.x, y: shape.y };
        const verts: [number, number][] = [];
        for (let i = 0; i + 1 < pts.length; i += 2) verts.push([pts[i], pts[i + 1]]);

        const dist: number[] = [];
        let total = 0;
        for (let i = 0; i < verts.length; i++) {
          const [ax, ay] = verts[i];
          const [bx, by] = verts[(i + 1) % verts.length];
          const d = Math.hypot(bx - ax, by - ay);
          dist.push(d);
          total += d;
        }
        // 防御退化 polygon（周长为 0）导致后续 remain/d 除零
        if (total <= 0) return { x: verts[0][0], y: verts[0][1] };

        let remain = total * progress;
        for (let i = 0; i < verts.length && remain > 0; i++) {
          const [ax, ay] = verts[i];
          const [bx, by] = verts[(i + 1) % verts.length];
          const d = dist[i];
          if (remain >= d) {
            remain -= d;
          } else {
            const t = d > 0 ? remain / d : 0;
            return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
          }
        }
        return { x: verts[0][0], y: verts[0][1] };
      }
      case 'path': {
        // path：沿曲线弧长定位画笔，确保画笔沿贝塞尔轨迹移动（而非直线）
        const segs = shape.segments || [];
        if (segs.length === 0) return { x: shape.x, y: shape.y };
        const flat = flattenPathSegments(segs, shape.closed ?? false);
        if (flat.length === 0) return { x: shape.x, y: shape.y };
        const total = pathArcLength(flat);
        if (total <= 0) return { x: flat[0].x, y: flat[0].y };
        return pointAtArcLength(flat, total * progress);
      }
      case 'text': {
        // 文字：从左到右移动
        return { x: shape.x, y: shape.y };
      }
      default:
        return { x: shape.x, y: shape.y };
    }
  }, [toTopLeft]);

  // 把单个 shape 按 progress (0-1) 绘制"生长中"的预览（描边渐进 + 后半段淡入填充）
  const drawProgressiveShape = useCallback((ctx: CanvasRenderingContext2D, shape: Shape, progress: number) => {
    const opacity = shape.opacity ?? 1;
    const stroke = shape.strokeColor || '#1A1A1A';
    const lineW = shape.strokeWidth || 2;

    ctx.save();
    if (opacity !== 1) ctx.globalAlpha = opacity;

    switch (shape.type) {
      case 'rectangle': {
        const w = shape.width || 100;
        const h = shape.height || 100;
        const { x, y } = toTopLeft(shape);
        const cw = w * progress;
        const ch = h * progress;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineW;
        ctx.strokeRect(x, y, cw, ch);
        if (shape.fillColor && progress > 0.5) {
          ctx.globalAlpha = opacity * (progress - 0.5) * 2;
          ctx.fillStyle = shape.fillColor;
          ctx.fillRect(x, y, cw, ch);
        }
        break;
      }
      case 'circle': {
        const r = Math.max(1, shape.radius || 50);
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineW;
        ctx.stroke();
        if (shape.fillColor && progress > 0.5) {
          ctx.globalAlpha = opacity * (progress - 0.5) * 2;
          ctx.beginPath();
          ctx.arc(shape.x, shape.y, r, 0, Math.PI * 2);
          ctx.fillStyle = shape.fillColor;
          ctx.fill();
        }
        break;
      }
      case 'ellipse': {
        const rx = Math.max(1, shape.rx || 50);
        const ry = Math.max(1, shape.ry || 30);
        ctx.beginPath();
        ctx.ellipse(shape.x, shape.y, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineW;
        ctx.stroke();
        if (shape.fillColor && progress > 0.5) {
          ctx.globalAlpha = opacity * (progress - 0.5) * 2;
          ctx.beginPath();
          ctx.ellipse(shape.x, shape.y, rx, ry, 0, 0, Math.PI * 2);
          ctx.fillStyle = shape.fillColor;
          ctx.fill();
        }
        break;
      }
      case 'line': {
        const endX = shape.x2 ?? shape.x + 100;
        const endY = shape.y2 ?? shape.y;
        const cx = shape.x + (endX - shape.x) * progress;
        const cy = shape.y + (endY - shape.y) * progress;
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(cx, cy);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineW;
        ctx.stroke();
        break;
      }
      case 'triangle': {
        const w = shape.width || 100;
        const h = shape.height || 100;
        const { x, y } = toTopLeft(shape);
        // 沿三条边按周长进度描边
        const seg = [w, Math.hypot(w / 2, h), h]; // 底边→斜边（近似）
        const total = seg.reduce((a, b) => a + b, 0);
        let remain = total * progress;
        ctx.beginPath();
        ctx.moveTo(x, y + h);
        // 左下 -> 右下（底边）
        const d1 = Math.min(remain, seg[0]);
        if (d1 > 0) { ctx.lineTo(x + d1, y + h); remain -= d1; }
        else { ctx.stroke(); break; }
        // 右下 -> 顶（右斜边）
        const d2 = Math.min(remain, seg[1]);
        if (d2 > 0) {
          const t = d2 / seg[1];
          ctx.lineTo(x + w - (w / 2) * t, y + h - h * t);
          remain -= d2;
        } else { ctx.stroke(); break; }
        // 顶 -> 左下（左斜边）
        const d3 = Math.min(remain, seg[2]);
        if (d3 > 0) {
          const t = d3 / seg[2];
          ctx.lineTo(x + (w / 2) * (1 - t), y + h - h * (1 - t));
        }
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineW;
        ctx.stroke();
        if (shape.fillColor && progress > 0.6) {
          ctx.globalAlpha = opacity * (progress - 0.6) * 2.5;
          drawSingleShape(ctx, { ...shape, strokeColor: undefined });
        }
        break;
      }
      case 'polygon': {
        const pts = shape.points || [];
        if (pts.length < 6) break;
        const verts: [number, number][] = [];
        for (let i = 0; i + 1 < pts.length; i += 2) verts.push([pts[i], pts[i + 1]]);
        // 计算总周长
        const dist: number[] = [];
        let total = 0;
        for (let i = 0; i < verts.length; i++) {
          const [ax, ay] = verts[i];
          const [bx, by] = verts[(i + 1) % verts.length];
          const d = Math.hypot(bx - ax, by - ay);
          dist.push(d);
          total += d;
        }
        let remain = total * progress;
        ctx.beginPath();
        ctx.moveTo(verts[0][0], verts[0][1]);
        for (let i = 0; i < verts.length && remain > 0; i++) {
          const [ax, ay] = verts[i];
          const [bx, by] = verts[(i + 1) % verts.length];
          const d = dist[i];
          if (remain >= d) {
            ctx.lineTo(bx, by);
            remain -= d;
          } else {
            const t = remain / d;
            ctx.lineTo(ax + (bx - ax) * t, ay + (by - ay) * t);
            remain = 0;
          }
        }
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineW;
        ctx.stroke();
        if (shape.fillColor && progress > 0.7) {
          ctx.globalAlpha = opacity * (progress - 0.7) * 3.3;
          drawSingleShape(ctx, { ...shape, strokeColor: undefined });
        }
        break;
      }
      case 'path': {
        const segs = shape.segments || [];
        if (segs.length === 0) break;
        // path 按弧长进度截断绘制：离散化整个 path → 按进度取前 N 个点描边
        const flat = flattenPathSegments(segs, shape.closed ?? false);
        if (flat.length < 2) break;
        const total = pathArcLength(flat);
        if (total <= 0) break;
        const targetLen = total * progress;
        // 截断到目标弧长（含最后一个插值点）
        let remain = targetLen;
        ctx.beginPath();
        ctx.moveTo(flat[0].x, flat[0].y);
        for (let i = 1; i < flat.length; i++) {
          const segLen = Math.hypot(flat[i].x - flat[i - 1].x, flat[i].y - flat[i - 1].y);
          if (remain >= segLen) {
            ctx.lineTo(flat[i].x, flat[i].y);
            remain -= segLen;
          } else {
            const t = segLen > 0 ? remain / segLen : 0;
            ctx.lineTo(flat[i - 1].x + (flat[i].x - flat[i - 1].x) * t, flat[i - 1].y + (flat[i].y - flat[i - 1].y) * t);
            break;
          }
        }
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineW;
        ctx.stroke();
        // 闭合 path 在接近完成时淡入填充
        if (shape.closed && shape.fillColor && progress > 0.7) {
          ctx.globalAlpha = opacity * (progress - 0.7) * 3.3;
          drawSingleShape(ctx, { ...shape, strokeColor: undefined });
        }
        break;
      }
      case 'text': {
        const size = shape.fontSize || 24;
        const weight = shape.fontWeight === 'bold' ? 'bold ' : '';
        ctx.font = `${weight}${size}px PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillStyle = shape.fillColor || '#1A1A1A';
        const text = shape.text || '';
        const charCount = Math.max(1, Math.round(text.length * progress));
        ctx.fillText(text.substring(0, charCount), shape.x, shape.y);
        break;
      }
    }

    ctx.restore();
  }, [drawSingleShape, toTopLeft]);

  const redrawFromState = useCallback((state: CanvasState) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = state.backgroundColor || '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const ordered = [...state.shapes].sort((a, b) => {
      const za = a.z ?? 0;
      const zb = b.z ?? 0;
      return za - zb;
    });

    for (const shape of ordered) {
      drawSingleShape(ctx, shape);
    }

    if (state.vignette?.strength) {
      const grad = ctx.createRadialGradient(
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2,
        Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.3,
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2,
        Math.max(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.75
      );
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(0,0,0,${Math.max(0, Math.min(1, state.vignette.strength)) * 0.6})`);
      ctx.save();
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }
  }, [drawSingleShape]);

  // 加载作品进行编辑
  const loadArtworkForEdit = useCallback(async (artwork: Artwork) => {
    const state = deserializeState(artwork.canvasData);
    if (state) {
      setCanvasState(state);
      setCurrentArtworkId(artwork.id);
      setSaveTitle(artwork.title);
      setHasUnsavedChanges(false);
      addToast('success', '已加载作品，可继续创作');
      // 重绘画布
      redrawFromState(state);
    } else {
      // 如果无法解析canvasData，尝试从thumbnail恢复
      addToast('warning', '作品数据异常，已创建新画布');
    }
  }, [addToast, redrawFromState]);

  // 绘制图形到 Canvas（双缓冲 + 画笔动画）
  //
  // 核心改进：用离屏 canvas 作为「已提交图层」，每个元素动画完成后才 commit。
  // 每个动画帧只做：离屏层整体拷贝到主画布 → 叠加当前正在生长的元素。
  // 彻底消除旧实现用 clearRect 局部清除导致的「误伤重叠元素」问题。
  const drawShapes = useCallback(async (instructions: DrawInstruction) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // 离屏提交层（与主画布同尺寸）
    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_WIDTH;
    offscreen.height = CANVAS_HEIGHT;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    // 背景
    const bgColor = instructions.backgroundColor || '#FFFFFF';
    offCtx.fillStyle = bgColor;
    offCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 按 z（图层）升序排序；同 z 保持原数组顺序
    const ordered = instructions.shapes
      .map((s, idx) => ({ s, idx }))
      .sort((a, b) => {
        const za = a.s.z ?? 0;
        const zb = b.s.z ?? 0;
        return za - zb || a.idx - b.idx;
      })
      .map((x) => x.s);

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const waitFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    for (let i = 0; i < ordered.length; i++) {
      const shape = ordered[i];
      const bounds = getShapeBounds(shape);

      // 显示画笔
      setBrushVisible(true);
      // 画笔移动到元素起点
      const startPos = getBrushPositionAtProgress(shape, 0);
      gsap.set(brushPosition.current, { x: startPos.x, y: startPos.y });

      if (prefersReduced) {
        // 减弱运动：直接画到离屏层并 commit
        drawSingleShape(offCtx, shape);
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.drawImage(offscreen, 0, 0);
        continue;
      }

      // 动画：每帧从离屏层整体拷贝 + 叠加当前元素的生长进度
      const STEPS = 24;
      for (let step = 0; step <= STEPS; step++) {
        const progress = step / STEPS;
        // 主画布 = 已提交层（含背景 + 之前所有完成的元素）
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.drawImage(offscreen, 0, 0);
        // 叠加当前正在生长的元素
        drawProgressiveShape(ctx, shape, progress);
        
        // 实时更新画笔位置跟随绘制进度
        const brushPos = getBrushPositionAtProgress(shape, progress);
        gsap.set(brushPosition.current, { x: brushPos.x, y: brushPos.y });
        
        await waitFrame();
      }

      // 动画结束：把当前元素 commit 到离屏层（成为永久已提交层的一部分）
      drawSingleShape(offCtx, shape);
      // 最终主画布也同步显示完整状态
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.drawImage(offscreen, 0, 0);

      // 画笔移动到元素终点
      const endPos = getBrushPositionAtProgress(shape, 1);
      gsap.to(brushPosition.current, {
        x: endPos.x,
        y: endPos.y,
        duration: 0.2,
        ease: 'power2.out',
      });
    }

    // 全局氛围：vignette 边缘暗角，增加画面聚焦感
    // 同时应用到离屏层（保证导出/保存时也带暗角）和主画布
    if (instructions.vignette && instructions.vignette.strength > 0) {
      const strength = Math.max(0, Math.min(1, instructions.vignette.strength));
      const applyVignette = (targetCtx: CanvasRenderingContext2D) => {
        const grad = targetCtx.createRadialGradient(
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2,
          Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.3,
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2,
          Math.max(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.75
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${strength * 0.6})`);
        targetCtx.save();
        targetCtx.fillStyle = grad;
        targetCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        targetCtx.restore();
      };
      applyVignette(offCtx);
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.drawImage(offscreen, 0, 0);
    }

    // 完成后隐藏画笔
    setTimeout(() => {
      setBrushVisible(false);
    }, 500);

    // 绘制完成微动效
    gsap.fromTo(
      canvas,
      { scale: 0.98, opacity: 0.9 },
      { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.4)' }
    );
  }, [drawProgressiveShape, drawSingleShape, getBrushPositionAtProgress, getShapeBounds]);

  const drawAppendBatch = useCallback(async (committedState: CanvasState, incomingShapes: Shape[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_WIDTH;
    offscreen.height = CANVAS_HEIGHT;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    offCtx.fillStyle = committedState.backgroundColor || '#FFFFFF';
    offCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    for (const shape of [...committedState.shapes].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))) {
      drawSingleShape(offCtx, shape);
    }

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.drawImage(offscreen, 0, 0);

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const waitFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    for (const shape of [...incomingShapes].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))) {
      const bounds = getShapeBounds(shape);

      // 显示画笔
      setBrushVisible(true);
      // 画笔移动到元素起点
      const startPos = getBrushPositionAtProgress(shape, 0);
      gsap.set(brushPosition.current, { x: startPos.x, y: startPos.y });

      if (prefersReduced) {
        drawSingleShape(offCtx, shape);
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.drawImage(offscreen, 0, 0);
        continue;
      }

      const steps = 24;
      for (let step = 0; step <= steps; step++) {
        const progress = step / steps;
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.drawImage(offscreen, 0, 0);
        drawProgressiveShape(ctx, shape, progress);
        
        // 实时更新画笔位置跟随绘制进度
        const brushPos = getBrushPositionAtProgress(shape, progress);
        gsap.set(brushPosition.current, { x: brushPos.x, y: brushPos.y });
        
        await waitFrame();
      }

      drawSingleShape(offCtx, shape);
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.drawImage(offscreen, 0, 0);
      
      // 画笔移动到元素终点
      const endPos = getBrushPositionAtProgress(shape, 1);
      gsap.to(brushPosition.current, {
        x: endPos.x,
        y: endPos.y,
        duration: 0.2,
        ease: 'power2.out',
      });
    }

    if (committedState.vignette?.strength) {
      const grad = ctx.createRadialGradient(
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2,
        Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.3,
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2,
        Math.max(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.75
      );
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(0,0,0,${Math.max(0, Math.min(1, committedState.vignette?.strength ?? 0)) * 0.6})`);
      ctx.save();
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }

    setTimeout(() => {
      setBrushVisible(false);
    }, 500);
  }, [drawProgressiveShape, drawSingleShape, getBrushPositionAtProgress, getShapeBounds]);

  // 初始化Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置固定尺寸
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // 初始化白色背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // 画笔位置同步：gsap.ticker 每帧把 brushPosition ref 写入画笔 DOM 的 transform，
  // 绕开 React（位置不进 state）。卸载时移除 ticker，避免泄漏。
  useEffect(() => {
    const syncBrush = () => {
      const el = brushRef.current;
      if (!el) return;
      const { x, y } = brushPosition.current;
      el.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`;
    };
    gsap.ticker.add(syncBrush);
    return () => {
      gsap.ticker.remove(syncBrush);
    };
  }, []);

  // 卸载清理：预设动画的 interval / rAF 若未停止会泄漏并操作已卸载 canvas。
  useEffect(() => {
    return () => {
      stopPresetAnimation();
    };
  }, [stopPresetAnimation]);

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
      const canvasData = serializeState(canvasState);

      if (currentArtworkId) {
        await artworkDB.update(currentArtworkId, {
          title,
          thumbnail,
          canvasData,
        });
      } else {
        const savedArtwork = await artworkDB.save({
          userId: user?.id || 'guest',
          title,
          thumbnail,
          canvasData,
        });
        setCurrentArtworkId(savedArtwork.id);
      }

      setSaveModalOpen(false);
      setHasUnsavedChanges(false);
      addToast('success', '作品已保存到图库');
    } catch (error) {
      console.error('保存失败:', error);
      addToast('error', '保存失败，请重试');
    }
  }, [canvasRef, canvasState, currentArtworkId, user, addToast]);

  // 新建画布（自动保存当前作品）
  const handleNewCanvas = useCallback(async () => {
    // 如果有未保存的更改，先自动保存
    if (hasUnsavedChanges) {
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          const thumbnail = canvas.toDataURL('image/png');
          const canvasData = serializeState(canvasState);
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
    setCanvasState(emptyState());
    setHistory([]);
    setIsAppending(false);
    addToast('success', '已创建新画布');
  }, [hasUnsavedChanges, canvasRef, canvasState, sessionDescription, currentArtworkId, user, addToast]);

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
    setCanvasState(emptyState());
    setHistory([]);
    setIsAppending(false);
    addToast('success', '画布已清空');
  }, [canvasRef, addToast]);

  // 打开图库
  const openGallery = useCallback(() => {
    router.push('/gallery');
  }, [router]);

  const applyLocalEditCommand = useCallback(async (prompt: string) => {
    const command = parseCanvasEditCommand(prompt);
    if (command.kind === 'none') return false;

    const targetIds = resolveShapeIdsByHint(canvasState.shapes, command.targetHint, activeShapeIds);
    if (targetIds.length === 0) {
      addToast('warning', '还没有可调整的对象，请先继续画一个新元素');
      return true;
    }

    let nextState = canvasState;
    if (command.kind === 'move') {
      const targetShapes = canvasState.shapes.filter((shape) => shape.id && targetIds.includes(shape.id));
      const groupBounds = getGroupBounds(targetShapes);
      const targetCenter = resolvePositionCenter(command.position);
      nextState = moveShapesByIds(
        canvasState,
        targetIds,
        targetCenter.x - groupBounds.cx,
        targetCenter.y - groupBounds.cy
      );
      addToast('success', '位置已经调整好了');
    } else if (command.kind === 'recolor-warm') {
      nextState = warmShapesByIds(canvasState, targetIds, command.amount);
      addToast('success', '颜色已经调暖一点了');
    } else if (command.kind === 'recolor-cool') {
      nextState = coolShapesByIds(canvasState, targetIds, command.amount);
      addToast('success', '颜色已经调冷一点了');
    }

    setCanvasState(nextState);
    setActiveShapeIds(targetIds);
    setHasUnsavedChanges(true);
    redrawFromState(nextState);
    return true;
  }, [activeShapeIds, addToast, canvasState, getGroupBounds, redrawFromState, resolvePositionCenter]);

  const handleUndoAdd = useCallback(() => {
    const lastEntry = history[history.length - 1];
    if (!lastEntry) {
      addToast('warning', tTeaching('undoAdd'));
      return;
    }

    let nextState = canvasState;
    for (const shapeId of lastEntry.shapeIds) {
      nextState = removeShapeById(nextState, shapeId);
    }

    setCanvasState(nextState);
    setHistory((prev) => prev.slice(0, -1));
    redrawFromState(nextState);
    setHasUnsavedChanges(true);
    setIsAppending(nextState.shapes.length > 0);
    addToast('success', tTeaching('undoAdd'));
  }, [addToast, canvasState, history, redrawFromState, tTeaching]);

  // 发送画布到微信
  const sendCanvasToWeChat = useCallback(async () => {
    if (!canvasRef.current) return;

    try {
      // 检查机器人状态
      const statusResponse = await fetch('/api/wechat/send');
      const status = await parseJsonSafely(statusResponse);
      
      if (!status.ready || !status.hasTargetContact) {
        return; // 机器人未就绪或未绑定联系人，不发送
      }

      // 将画布转换为图片
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png');
      
      // 转换为 Blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      
      // 创建 FormData
      const formData = new FormData();
      formData.append('image', blob, 'canvas.png');
      
      // 发送到 API
      const result = await fetch('/api/wechat/send', {
        method: 'POST',
        body: formData,
      });
      
      const data = await parseJsonSafely(result);
      
      if (data.success) {
        addToast('success', '已自动发送到微信');
      }
    } catch (error) {
      console.error('Auto send to WeChat error:', error);
    }
  }, [canvasRef, addToast, parseJsonSafely]);

  // 处理开始绘图
  const handleStartDrawing = useCallback(async () => {
    if (!sessionDescription.trim()) {
      addToast('warning', '请先输入绘图描述');
      return;
    }

    const appendMode = canvasState.shapes.length > 0;
    setIsDrawing(true);
    setIsThinking(true);
    setIsAppending(appendMode);
    addToast('info', '正在生成绘图...');

    // 启动预设模板轮播动画
    startPresetAnimation();

    try {
      // 尝试查找相似提示词（阈值 0.9：仅几乎完全相同的指令才复用模板，秒级出图）
      const userId = user?.id || null;
      const similarPrompt = await promptHistoryDB.findSimilar(sessionDescription, userId, 0.9);
      
      let instructions: DrawInstruction;
      
      if (similarPrompt) {
        // 使用历史参数
        instructions = JSON.parse(similarPrompt.canvasParams);
        addToast('info', '找到相似提示词，使用历史结果');
      } else {
        // 调用 API 获取新参数
        const response = await fetch('/api/draw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: sessionDescription,
            appendPrompt: appendMode ? sessionDescription : undefined,
            context: appendMode
              ? {
                  shapes: canvasState.shapes,
                  backgroundColor: canvasState.backgroundColor,
                }
              : undefined,
          }),
        });

        if (!response.ok) {
          throw new Error('绘图生成失败');
        }

        instructions = await response.json();

        // 保存新的提示词和参数到数据库
        await promptHistoryDB.save(sessionDescription, instructions, userId);
      }

      // 停止预设动画
      stopPresetAnimation();
      setIsThinking(false);

      if (!appendMode) {
        const nextState = stateFromInstruction(instructions);
        setCanvasState(nextState);
        setHistory([]);
        await drawShapes(instructions);
      } else {
        const preparedShapes = ensureIds(instructions.shapes);
        const nextState = applyAddMany(canvasState, preparedShapes);
        setCanvasState(nextState);
        setHistory((prev) => [
          ...prev,
          {
            kind: 'add-batch',
            shapeIds: preparedShapes.map((shape) => shape.id!).filter(Boolean),
          },
        ]);
        await drawAppendBatch(canvasState, preparedShapes);
      }

      setHasUnsavedChanges(true);
      addToast('success', '绘图完成，记得保存作品');

      // 自动发送到微信
      await sendCanvasToWeChat();
    } catch (error) {
      console.error('Draw error:', error);
      stopPresetAnimation();
      setIsThinking(false);
      addToast('error', '绘图失败，请重试');
    } finally {
      setIsDrawing(false);
      setIsAppending(false);
    }
  }, [sessionDescription, canvasState, drawShapes, drawAppendBatch, addToast, startPresetAnimation, stopPresetAnimation, user, sendCanvasToWeChat]);

  if (!user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-text-secondary animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
      <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-br from-bg via-sakura-light/5 to-macaron-blue-light/5">
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
        className="h-14 bg-surface/80 backdrop-blur-sm border-b border-sakura/10 flex items-center justify-between px-6 z-[200]"
      >
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
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
      <div className="flex-1 min-h-0 overflow-hidden px-3 pb-3 pt-3">
        <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col gap-3 overflow-hidden">
          {/* Workspace */}
          <div className="flex min-h-0 flex-1 items-center gap-3 overflow-hidden">
            {/* WeChat Bot Sidebar */}
            <WeChatBotPanel canvasRef={canvasRef} />

            {/* Canvas Container */}
            <div
              ref={canvasAreaRef}
              className="relative aspect-[4/3] h-auto max-h-full w-full max-w-[960px] flex-[0_1_960px] overflow-hidden rounded-3xl border border-sakura/15 bg-gradient-to-br from-white to-sakura-light/10 shadow-xl shadow-sakura/8"
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
              className="absolute inset-0 m-auto max-w-full max-h-full"
              style={{ 
                objectFit: 'contain',
                imageRendering: 'crisp-edges'
              }}
              role="img"
              aria-label="绘图画布 - 通过语音指令控制绘图"
            />

            {/* 预设模板动画覆盖层 - AI 思考时显示 */}
            {isThinking && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                {/* 装饰性图形动画 */}
                <div className="relative w-32 h-32 mb-6">
                  <div className="absolute inset-0 border-4 border-sakura/20 rounded-full animate-ping" />
                  <div className="absolute inset-4 border-4 border-lavender/30 rounded-full animate-ping" style={{ animationDelay: '0.3s' }} />
                  <div className="absolute inset-8 border-4 border-macaron-blue/40 rounded-full animate-ping" style={{ animationDelay: '0.6s' }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-12 h-12 text-sakura animate-pulse" />
                  </div>
                </div>

                {/* 预设模板卡片 */}
                <div className="bg-gradient-to-br from-lavender/10 to-macaron-blue/10 rounded-2xl border border-lavender/20 p-6 max-w-md mx-4 shadow-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sakura/30 to-lavender/30 flex items-center justify-center">
                      {(() => {
                        const IconComponent = {
                          Sun,
                          Home,
                          Flower2,
                          Star,
                          Cat,
                          Palette,
                        }[presetTemplates[currentPresetIndex].icon];
                        return IconComponent ? <IconComponent className="w-6 h-6 text-text-primary" /> : null;
                      })()}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-text-primary">{presetTemplates[currentPresetIndex].title}</h3>
                      <p className="text-xs text-text-secondary">灵感示例</p>
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary bg-white/60 rounded-xl p-3 italic">
                    &quot;{presetTemplates[currentPresetIndex].prompt}&quot;
                  </p>
                  <div className="flex justify-center gap-1 mt-4">
                    {presetTemplates.map((_, idx) => (
                      <div
                        key={idx}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          idx === currentPresetIndex ? 'bg-sakura w-4' : 'bg-sakura/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="mt-4 text-sm text-text-secondary">
                  正在思考如何绘制你的作品...
                </p>
              </div>
            )}

            {/* 静息状态引导覆盖层 - 画布空白时显示 */}
            <IdleGuide visible={!isThinking && canvasState.shapes.length === 0} />

            {/* 画笔指针：位置由 brushPosition ref + gsap.ticker 每帧写入 transform，
                避免把位置放进 React state 导致的跟随抖动/滞后。 */}
            <div
              ref={brushRef}
              className={`absolute pointer-events-none transition-opacity duration-300 ${brushVisible ? 'opacity-100' : 'opacity-0'}`}
              style={{
                left: 0,
                top: 0,
                transform: 'translate(-50%, -50%)',
                zIndex: 100,
              }}
            >
              <div className="relative">
                <Brush className="w-8 h-8 text-text-primary drop-shadow-lg" />
                {/* 画笔光晕效果 */}
                <div
                  className="absolute inset-0 -m-2 rounded-full animate-ping"
                  style={{
                    background: 'radial-gradient(circle, rgba(255, 183, 197, 0.4) 0%, transparent 70%)',
                  }}
                />
              </div>
            </div>

            {/* 右上角装饰 - 操作提示 */}
            <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm rounded-xl border border-sakura/10 shadow-sm px-4 py-2">
              <p className="text-xs text-text-secondary">
                试试说：<span className="text-sakura font-medium">画一个圆形</span>
              </p>
            </div>
          </div>

            {/* Toolbar */}
            <div
              ref={toolbarRef}
              className="hidden h-full w-[68px] shrink-0 flex-col justify-between rounded-3xl border border-sakura/10 bg-surface/95 p-2 shadow-lg backdrop-blur-sm xl:flex"
            >
              <div className="flex flex-col gap-1">
                <button
                  onClick={handleUndoAdd}
                  className="rounded-2xl p-3 text-text-secondary transition-all hover:bg-sakura-light/20 hover:text-text-primary"
                  aria-label={tCanvas('undo')}
                  title={tTeaching('undoAdd')}
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
                <button
                  onClick={() => addToast('info', '重做功能开发中')}
                  className="rounded-2xl p-3 text-text-secondary transition-all hover:bg-sakura-light/20 hover:text-text-primary"
                  aria-label="重做"
                  title="重做"
                >
                  <RotateCw className="h-5 w-5" />
                </button>
                <div className="my-1 h-px w-full bg-border" />
                <button
                  onClick={handleNewCanvas}
                  className="rounded-2xl p-3 text-text-secondary transition-all hover:bg-lavender-light/20 hover:text-lavender"
                  aria-label="新建画布"
                  title="新建画布"
                >
                  <FilePlus className="h-5 w-5" />
                </button>
                <button
                  onClick={clearCanvas}
                  className="rounded-2xl p-3 text-text-secondary transition-all hover:bg-error/10 hover:text-error"
                  aria-label="清空画布"
                  title="清空画布"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
                <div className="my-1 h-px w-full bg-border" />
                <button
                  onClick={handleSaveClick}
                  className="rounded-2xl p-3 text-text-secondary transition-all hover:bg-mint-light/20 hover:text-mint"
                  aria-label="保存到图库"
                  title="保存到图库"
                >
                  <Save className="h-5 w-5" />
                </button>
                <button
                  onClick={exportPNG}
                  className="rounded-2xl p-3 text-text-secondary transition-all hover:bg-macaron-blue-light/20 hover:text-macaron-blue"
                  aria-label="导出 PNG"
                  title="导出 PNG"
                >
                  <Download className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="h-6 w-6 rounded-full border-2 border-white bg-sakura shadow-sm" />
                <div className="rounded-full bg-sakura-light px-3 py-1 text-[11px] font-semibold text-sakura">
                  绘图
                </div>
              </div>
            </div>
          </div>

        {/* Description & Voice Area */}
        <div
          ref={descriptionRef}
          className="grid shrink-0 grid-cols-[minmax(0,1fr)_280px] gap-3"
        >
          <div className="flex min-w-0 flex-col gap-3">
          <ChildGuide
            mode={isThinking ? 'thinking' : isAppending ? 'appending' : transcript ? 'listening' : 'idle'}
            hasArtwork={canvasState.shapes.length > 0}
            lastTranscript={transcript || sessionDescription}
            copy={{
              title: tTeaching('title'),
              speakHint: tTeaching('speakHint'),
              appendHint: tTeaching('appendHint'),
              listening: tTeaching('listening'),
              thinking: tTeaching('thinking'),
              appendMode: tTeaching('appendMode'),
              examples: {
                scene1: tTeaching('examples.scene1'),
                scene2: tTeaching('examples.scene2'),
                append1: tTeaching('examples.append1'),
              },
            }}
          />
          <section className="rounded-3xl border border-sakura/10 bg-white/90 shadow-sm shadow-sakura/5">
            <div className="flex items-center gap-2 px-4 pt-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-lavender/20 text-lavender">
                <Sparkles className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-text-primary">绘图描述</h2>
              {isThinking && (
                <div
                  ref={thinkingIndicatorRef}
                  className="ml-auto flex items-center gap-2"
                >
                  <span className="text-xs text-lavender">AI 正在思考</span>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-2 w-2 rounded-full bg-lavender"
                        style={{
                          animation: 'pulse 1.4s ease-in-out infinite',
                          animationDelay: `${i * 0.2}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 pt-2">
              <textarea
                value={sessionDescription}
                onChange={(event) => setSessionDescription(event.target.value)}
                placeholder={tCanvas('transcriptPlaceholder')}
                className="min-h-[56px] w-full resize-none rounded-xl border border-border bg-surface px-4 py-2 text-sm text-text-primary outline-none transition-all placeholder:text-text-disabled focus:border-sakura focus:ring-2 focus:ring-sakura/30"
                aria-label="绘图描述输入框"
              />

              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <span className="rounded-full bg-sakura-light px-2 py-1 text-sakura">单屏布局</span>
                  <span>{canvasState.shapes.length > 0 ? tTeaching('appendHint') : tTeaching('speakHint')}</span>
                </div>
                <button
                  onClick={handleStartDrawing}
                  disabled={!sessionDescription.trim() || isDrawing}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                    sessionDescription.trim() && !isDrawing
                      ? 'bg-lavender text-white shadow-sm hover:bg-lavender/90'
                      : 'cursor-not-allowed bg-text-disabled text-white'
                  }`}
                  aria-label="开始绘图"
                >
                  <Sparkles className={`h-4 w-4 ${isDrawing ? 'animate-spin' : ''}`} />
                  {isDrawing ? '绘制中...' : '开始绘图'}
                </button>
              </div>
            </div>
          </section>
          </div>

          <div
            ref={voiceAreaRef}
            className="rounded-3xl border border-sakura/10 bg-white/90 px-4 py-3 shadow-sm shadow-sakura/5"
          >
            <XfyunVoiceInput
              onTranscriptChange={handleTranscriptChange}
              onFinalResult={handleFinalResult}
              transcript={transcript}
            />
          </div>
        </div>
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
