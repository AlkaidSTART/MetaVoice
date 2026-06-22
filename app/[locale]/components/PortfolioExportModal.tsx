"use client";

import { useState, useEffect, useRef } from "react";
import { X, Download, Check } from "lucide-react";
import gsap from "gsap";
import type { ArtworkRecord } from "@/lib/supabase/db";

interface PortfolioExportModalProps {
  artworks: ArtworkRecord[];
  onClose: () => void;
}

export default function PortfolioExportModal({
  artworks,
  onClose,
}: PortfolioExportModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(3);
  const [gap, setGap] = useState(16);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  // Modal entrance animation
  useEffect(() => {
    if (!modalRef.current) return;

    const overlay = modalRef.current.querySelector(".modal-overlay") as HTMLElement;
    const content = modalRef.current.querySelector(".modal-content") as HTMLElement;

    gsap.fromTo(
      overlay,
      { opacity: 0 },
      { opacity: 1, duration: 0.3, ease: "power2.out" }
    );

    gsap.fromTo(
      content,
      { scale: 0.9, opacity: 0, y: 20 },
      { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.8)" }
    );
  }, []);

  // Calculate masonry layout
  const getMasonryStyles = (): { columnCount: number; gapSize: number } => {
    return {
      columnCount: columns,
      gapSize: gap,
    };
  };

  // Export portfolio as image
  const handleExport = async () => {
    if (!previewRef.current) return;

    setExporting(true);

    try {
      // Create a canvas for the final image
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      // Load all images first
      const images = await Promise.all(
        artworks.map(
          (artwork) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = artwork.thumbnail_url || '';
            })
        )
      );

      // Calculate dimensions for masonry layout
      const padding = 40;
      const labelHeight = 50;
      const columnWidth = 400;
      const totalWidth = columns * columnWidth + (columns - 1) * gap + padding * 2;

      // Pre-calculate image heights maintaining aspect ratio
      const imageHeights = images.map((img) => {
        const aspectRatio = img.height / img.width;
        return columnWidth * aspectRatio;
      });

      // Masonry layout: find shortest column for each image
      const columnHeights: number[] = Array(columns).fill(padding);

      // First pass: calculate total height for each column
      artworks.forEach((_, index) => {
        const shortestColumn = columnHeights.indexOf(Math.min(...columnHeights));
        columnHeights[shortestColumn] += imageHeights[index] + labelHeight + gap;
      });

      const totalHeight = Math.max(...columnHeights) + padding;

      canvas.width = totalWidth;
      canvas.height = totalHeight;

      // Fill background
      ctx.fillStyle = "#FAFAF8";
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      // Second pass: draw images in masonry layout (shortest column algorithm)
      const columnXPositions = Array.from({ length: columns }, (_, i) =>
        padding + i * (columnWidth + gap)
      );
      const currentColumnHeights: number[] = Array(columns).fill(padding);

      artworks.forEach((artwork, index) => {
        const shortestColumn = currentColumnHeights.indexOf(Math.min(...currentColumnHeights));
        const img = images[index];
        const x = columnXPositions[shortestColumn];
        const y = currentColumnHeights[shortestColumn];
        const imgHeight = imageHeights[index];

        // Draw image
        ctx.drawImage(img, x, y, columnWidth, imgHeight);

        // Draw label background
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.fillRect(x, y + imgHeight, columnWidth, labelHeight);

        // Draw label text
        ctx.fillStyle = "#1A1A1A";
        ctx.font = "24px PingFang SC, Microsoft YaHei, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Truncate text if too long
        let title = artwork.title;
        const maxWidth = columnWidth - 40;
        while (ctx.measureText(title).width > maxWidth && title.length > 0) {
          title = title.slice(0, -1);
        }
        if (title !== artwork.title) {
          title += "...";
        }

        ctx.fillText(
          title,
          x + columnWidth / 2,
          y + imgHeight + labelHeight / 2
        );

        currentColumnHeights[shortestColumn] += imgHeight + labelHeight + gap;
      });

      // Download
      const link = document.createElement("a");
      link.download = `VoiceCanvas作品集_${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      setExported(true);
      setTimeout(() => {
        setExported(false);
      }, 2000);
    } catch (error) {
      console.error("导出失败:", error);
    } finally {
      setExporting(false);
    }
  };

  // Close with animation
  const handleClose = () => {
    if (!modalRef.current) return;

    const overlay = modalRef.current.querySelector(".modal-overlay") as HTMLElement;
    const content = modalRef.current.querySelector(".modal-content") as HTMLElement;

    gsap.to(content, {
      scale: 0.9,
      opacity: 0,
      y: 20,
      duration: 0.25,
      ease: "back.in(1.5)",
    });

    gsap.to(overlay, {
      opacity: 0,
      duration: 0.25,
      delay: 0.1,
      onComplete: onClose,
    });
  };

  const masonryStyles = getMasonryStyles();

  return (
    <div ref={modalRef} className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="modal-overlay absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Content */}
      <div className="modal-content relative bg-white rounded-3xl shadow-2xl w-[90vw] max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-text-primary">导出作品集</h2>
            <p className="text-sm text-text-secondary mt-0.5">
              已选择 {artworks.length} 个作品
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-sakura-light/30 text-text-secondary hover:text-text-primary transition-all"
            aria-label="关闭"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Settings */}
        <div className="flex items-center gap-6 px-6 py-4 bg-surface/50 border-b border-border">
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-secondary">列数:</label>
            <select
              value={columns}
              onChange={(e) => setColumns(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg border border-border bg-white text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-sakura/30"
            >
              <option value={2}>2 列</option>
              <option value={3}>3 列</option>
              <option value={4}>4 列</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-secondary">间距:</label>
            <select
              value={gap}
              onChange={(e) => setGap(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg border border-border bg-white text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-sakura/30"
            >
              <option value={8}>紧密 (8px)</option>
              <option value={16}>适中 (16px)</option>
              <option value={24}>宽松 (24px)</option>
            </select>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-sakura-light/5 to-macaron-blue-light/5">
          <div
            ref={previewRef}
            className="bg-bg rounded-2xl p-6 mx-auto shadow-inner overflow-hidden"
            style={{
              columns: masonryStyles.columnCount,
              columnGap: `${masonryStyles.gapSize}px`,
            }}
          >
            {artworks.map((artwork) => (
              <div
                key={artwork.id}
                className="break-inside-avoid mb-4 bg-white rounded-xl overflow-hidden shadow-sm"
              >
                <div className="relative">
                  <img
                    src={artwork.thumbnail_url || ''}
                    alt={artwork.title}
                    className="w-full h-auto"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent pt-8 pb-3 px-3">
                    <p className="text-white text-sm font-medium truncate drop-shadow-sm">
                      {artwork.title}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-surface">
          <button
            onClick={handleClose}
            className="px-5 py-2.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-sakura-light/20 transition-all"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || exported}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-all ${
              exported
                ? "bg-mint hover:bg-mint"
                : "bg-sakura hover:bg-sakura/90"
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {exported ? (
              <>
                <Check className="w-5 h-5" />
                已导出
              </>
            ) : exporting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                导出PNG
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
