"use client";

import { useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import type { DrawInstruction } from "../lib/draw-schema";

interface CanvasDrawProps {
  instruction: DrawInstruction | null;
}

export default function CanvasDraw({ instruction }: CanvasDrawProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const drawShape = useCallback(
    (ctx: CanvasRenderingContext2D, shape: DrawInstruction["shapes"][0]) => {
      ctx.save();

      // 设置样式
      if (shape.fillColor) {
        ctx.fillStyle = shape.fillColor;
      }
      if (shape.strokeColor) {
        ctx.strokeStyle = shape.strokeColor;
      }
      if (shape.strokeWidth) {
        ctx.lineWidth = shape.strokeWidth;
      }

      switch (shape.type) {
        case "rectangle":
          if (shape.width && shape.height) {
            if (shape.fillColor) {
              ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
            }
            if (shape.strokeColor) {
              ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
            }
          }
          break;

        case "circle":
          if (shape.radius) {
            ctx.beginPath();
            ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
            if (shape.fillColor) {
              ctx.fill();
            }
            if (shape.strokeColor) {
              ctx.stroke();
            }
          }
          break;

        case "line":
          if (shape.x2 !== undefined && shape.y2 !== undefined) {
            ctx.beginPath();
            ctx.moveTo(shape.x, shape.y);
            ctx.lineTo(shape.x2, shape.y2);
            ctx.stroke();
          }
          break;

        case "triangle":
          if (shape.width && shape.height) {
            ctx.beginPath();
            ctx.moveTo(shape.x, shape.y);
            ctx.lineTo(shape.x + shape.width, shape.y);
            ctx.lineTo(shape.x + shape.width / 2, shape.y + shape.height);
            ctx.closePath();
            if (shape.fillColor) {
              ctx.fill();
            }
            if (shape.strokeColor) {
              ctx.stroke();
            }
          }
          break;

        case "text":
          if (shape.text) {
            ctx.font = "16px var(--font-sans)";
            if (shape.fillColor) {
              ctx.fillText(shape.text, shape.x, shape.y);
            } else {
              ctx.fillStyle = "#1A1A1A";
              ctx.fillText(shape.text, shape.x, shape.y);
            }
          }
          break;
      }

      ctx.restore();
    },
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 设置canvas尺寸
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 设置背景色
    if (instruction?.backgroundColor) {
      ctx.fillStyle = instruction.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 绘制形状
    if (instruction?.shapes && instruction.shapes.length > 0) {
      // 使用GSAP动画绘制每个形状
      instruction.shapes.forEach((shape, index) => {
        gsap.fromTo(
          canvas,
          {
            opacity: 0,
            scale: 0.8,
          },
          {
            opacity: 1,
            scale: 1,
            duration: 0.65,
            delay: index * 0.1,
            ease: "back.out(1.6)",
            onStart: () => {
              drawShape(ctx, shape);
            },
          }
        );
      });
    }
  }, [instruction, drawShape]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-white rounded-2xl overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        role="img"
        aria-label="绘图画布 - 通过语音指令控制绘图"
      />
    </div>
  );
}
