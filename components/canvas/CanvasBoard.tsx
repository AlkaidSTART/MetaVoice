"use client";

import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";
import gsap from "gsap";

export interface CanvasShape {
  id: string;
  type: "circle" | "rect" | "line" | "triangle" | "star" | "text" | "image";
  x: number;
  y: number;
  color: string;
  size: number;
  text?: string;
  imageUrl?: string;
  opacity: number;
  renderScale: number;
}

export interface CanvasBoardRef {
  addShape: (shapeType: CanvasShape["type"], color: string, positionName: string, sizeScale: "small" | "medium" | "large", detail?: string) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  exportImage: () => string; // Returns data URL
  getHistoryStatus: () => { canUndo: boolean; canRedo: boolean };
  setShapesData: (shapes: CanvasShape[]) => void;
  getShapesData: () => CanvasShape[];
}

interface CanvasBoardProps {
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onSaveState?: (shapes: CanvasShape[]) => void;
  initialShapes?: CanvasShape[];
}

const SIZE_MAP = {
  small: 50,
  medium: 110,
  large: 220,
};

const ANCHOR_MAP: Record<string, (w: number, h: number) => { x: number; y: number }> = {
  center: (w, h) => ({ x: w / 2, y: h / 2 }),
  left: (w, h) => ({ x: w * 0.25, y: h / 2 }),
  right: (w, h) => ({ x: w * 0.75, y: h / 2 }),
  top: (w, h) => ({ x: w / 2, y: h * 0.25 }),
  bottom: (w, h) => ({ x: w / 2, y: h * 0.75 }),
  "top-left": (w, h) => ({ x: w * 0.25, y: h * 0.25 }),
  "top-right": (w, h) => ({ x: w * 0.75, y: h * 0.25 }),
  "bottom-left": (w, h) => ({ x: w * 0.25, y: h * 0.75 }),
  "bottom-right": (w, h) => ({ x: w * 0.75, y: h * 0.75 }),
};

const CanvasBoard = forwardRef<CanvasBoardRef, CanvasBoardProps>(
  ({ onHistoryChange, onSaveState, initialShapes = [] }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const [shapes, setShapes] = useState<CanvasShape[]>(initialShapes);
    const [history, setHistory] = useState<CanvasShape[][]>([initialShapes]);
    const [historyIndex, setHistoryIndex] = useState<number>(0);
    const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
    const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});

    // 1. Sync dimensions with container size
    useEffect(() => {
      if (typeof window === "undefined" || !containerRef.current) return;
      
      const updateSize = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        // Maintain a minimum height of 400px and fill container
        setDimensions({
          width: Math.max(rect.width, 300),
          height: Math.max(rect.height, 350),
        });
      };

      updateSize();
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }, []);

    // 2. Load images for canvas rendering
    useEffect(() => {
      shapes.forEach((shape) => {
        if (shape.type === "image" && shape.imageUrl && !loadedImages[shape.imageUrl]) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = shape.imageUrl;
          img.onload = () => {
            setLoadedImages((prev) => ({ ...prev, [shape.imageUrl!]: img }));
          };
        }
      });
    }, [shapes, loadedImages]);

    // 3. Render loop
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clear Canvas
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Fill premium drawing paper warm color
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Draw subtle background grids for designer aesthetic
      ctx.strokeStyle = "#E8E8E4";
      ctx.lineWidth = 0.5;
      const gridSize = 25;
      
      // Vertical grids
      for (let x = 0; x < dimensions.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, dimensions.height);
        ctx.stroke();
      }
      // Horizontal grids
      for (let y = 0; y < dimensions.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(dimensions.width, y);
        ctx.stroke();
      }

      // Draw all shapes in state
      shapes.forEach((shape) => {
        ctx.save();
        ctx.globalAlpha = shape.opacity;

        const size = shape.size * shape.renderScale;
        if (size <= 0) {
          ctx.restore();
          return;
        }

        ctx.fillStyle = shape.color;
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = 4;

        if (shape.type === "image" && shape.imageUrl) {
          const img = loadedImages[shape.imageUrl];
          if (img) {
            // Draw image scaled
            const drawW = Math.min(dimensions.width * 0.8, size * 2.5);
            const drawH = drawW * (img.height / img.width);
            ctx.drawImage(img, shape.x - drawW / 2, shape.y - drawH / 2, drawW, drawH);
          } else {
            // Loading placeholder while image downloads
            ctx.fillStyle = "#E8E8E4";
            ctx.fillRect(shape.x - 120, shape.y - 120, 240, 240);
            ctx.fillStyle = "#6B6B6B";
            ctx.font = "14px Inter";
            ctx.textAlign = "center";
            ctx.fillText("🎨 正在加载 AI 图像...", shape.x, shape.y);
          }
        } 
        else if (shape.type === "circle") {
          ctx.beginPath();
          ctx.arc(shape.x, shape.y, size / 2, 0, Math.PI * 2);
          ctx.fill();
        } 
        else if (shape.type === "rect") {
          ctx.fillRect(shape.x - size / 2, shape.y - size / 2, size, size);
        } 
        else if (shape.type === "line") {
          ctx.beginPath();
          ctx.moveTo(shape.x - size / 2, shape.y);
          ctx.lineTo(shape.x + size / 2, shape.y);
          ctx.stroke();
        } 
        else if (shape.type === "triangle") {
          ctx.beginPath();
          const r = size / 2;
          ctx.moveTo(shape.x, shape.y - r); // Top
          ctx.lineTo(shape.x - r * Math.sin(Math.PI / 3), shape.y + r / 2); // Bottom Left
          ctx.lineTo(shape.x + r * Math.sin(Math.PI / 3), shape.y + r / 2); // Bottom Right
          ctx.closePath();
          ctx.fill();
        } 
        else if (shape.type === "star") {
          ctx.beginPath();
          const numPoints = 5;
          const outerR = size / 2;
          const innerR = outerR * 0.4;
          let angle = Math.PI / 2 * 3;
          const step = Math.PI / numPoints;

          ctx.moveTo(shape.x, shape.y - outerR);

          for (let i = 0; i < numPoints * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const px = shape.x + Math.cos(angle) * r;
            const py = shape.y + Math.sin(angle) * r;
            ctx.lineTo(px, py);
            angle += step;
          }
          ctx.closePath();
          ctx.fill();
        } 
        else if (shape.type === "text" && shape.text) {
          ctx.font = `bold ${Math.max(16, size * 0.35)}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(shape.text, shape.x, shape.y);
        }

        ctx.restore();
      });
    }, [shapes, dimensions, loadedImages]);

    // 4. Save canvas state to history & call save updates
    const pushHistory = (newShapes: CanvasShape[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newShapes);
      
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setShapes(newShapes);

      // Trigger callbacks
      if (onHistoryChange) {
        onHistoryChange(true, false);
      }
      if (onSaveState) {
        onSaveState(newShapes);
      }
    };

    // 5. Expose Canvas Actions via ref
    useImperativeHandle(ref, () => ({
      addShape: (shapeType, color, positionName, sizeScale, detail) => {
        const anchor = ANCHOR_MAP[positionName] || ANCHOR_MAP["center"];
        const pos = anchor(dimensions.width, dimensions.height);
        const baseSize = SIZE_MAP[sizeScale] || SIZE_MAP["medium"];

        const shapeId = "shp_" + Math.random().toString(36).substring(2, 9);
        const newShape: CanvasShape = {
          id: shapeId,
          type: shapeType,
          x: pos.x,
          y: pos.y,
          color,
          size: baseSize,
          text: detail,
          imageUrl: shapeType === "image" ? detail : undefined,
          opacity: 0,
          renderScale: 0,
        };

        // Create a new shapes list with the new shape initially invisible/unscaled
        const nextShapes = [...shapes, newShape];
        setShapes(nextShapes);

        // GSAP animate entrance (Elastic scale bounce)
        const animState = { scale: 0, opacity: 0 };
        gsap.to(animState, {
          scale: 1,
          opacity: 1,
          duration: 0.65,
          ease: "back.out(1.6)",
          onUpdate: () => {
            setShapes((currentShapes) =>
              currentShapes.map((s) =>
                s.id === shapeId ? { ...s, renderScale: animState.scale, opacity: animState.opacity } : s
              )
            );
          },
          onComplete: () => {
            // Freeze final values and push to history
            setShapes((currentShapes) => {
              const finalized = currentShapes.map((s) =>
                s.id === shapeId ? { ...s, renderScale: 1, opacity: 1 } : s
              );
              pushHistory(finalized);
              return finalized;
            });
          },
        });
      },

      undo: () => {
        if (historyIndex > 0) {
          const nextIndex = historyIndex - 1;
          const nextShapes = history[nextIndex];
          setHistoryIndex(nextIndex);
          setShapes(nextShapes);

          if (onHistoryChange) {
            onHistoryChange(nextIndex > 0, true);
          }
          if (onSaveState) {
            onSaveState(nextShapes);
          }
        }
      },

      redo: () => {
        if (historyIndex < history.length - 1) {
          const nextIndex = historyIndex + 1;
          const nextShapes = history[nextIndex];
          setHistoryIndex(nextIndex);
          setShapes(nextShapes);

          if (onHistoryChange) {
            onHistoryChange(true, nextIndex < history.length - 1);
          }
          if (onSaveState) {
            onSaveState(nextShapes);
          }
        }
      },

      clear: () => {
        pushHistory([]);
      },

      exportImage: () => {
        const canvas = canvasRef.current;
        if (!canvas) return "";
        return canvas.toDataURL("image/png");
      },

      getHistoryStatus: () => ({
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
      }),

      setShapesData: (newShapes: CanvasShape[]) => {
        setShapes(newShapes);
        setHistory([newShapes]);
        setHistoryIndex(0);
        if (onHistoryChange) {
          onHistoryChange(false, false);
        }
      },

      getShapesData: () => shapes,
    }));

    return (
      <div 
        ref={containerRef} 
        className="w-full h-full relative border border-border-custom rounded-2xl bg-white shadow-inner overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="block w-full h-full cursor-default"
          role="img"
          aria-label="语音创作画布。您说的绘图命令将在此处渲染。"
        />
      </div>
    );
  }
);

CanvasBoard.displayName = "CanvasBoard";
export default CanvasBoard;
