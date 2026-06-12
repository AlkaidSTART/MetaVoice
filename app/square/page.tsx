"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  Download,
  Sparkles,
  Image,
  Users,
  Clock,
  ChevronLeft,
} from "lucide-react";
import gsap from "gsap";
import { getPublicArtworks, ArtworkRecord } from "@/lib/supabase/db";

export default function SquarePage() {
  const router = useRouter();
  const [artworks, setArtworks] = useState<ArtworkRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadArtworks();
  }, []);

  const loadArtworks = async () => {
    setIsLoading(true);
    const data = await getPublicArtworks();
    setArtworks(data);
    setIsLoading(false);
  };

  // GSAP Stagger Entrance
  useEffect(() => {
    if (artworks.length > 0 && gridRef.current) {
      gsap.fromTo(
        gridRef.current.children,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power2.out" },
      );
    }
  }, [artworks]);

  const handleDownload = (artwork: ArtworkRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!artwork.thumbnail_url) return;
    const link = document.createElement("a");
    link.href = artwork.thumbnail_url;
    link.download = `${artwork.title || "artwork"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 30) return `${diffDays} 天前`;
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex-1 flex flex-col bg-surface font-sans select-none min-h-screen">
      {/* Header */}
      <header className="h-14 bg-white border-b border-border-custom px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <button
          onClick={() => router.push("/canvas")}
          className="flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-sakura rounded-md px-2.5 py-1.5 border border-border-custom/50 hover:bg-surface cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>返回画布</span>
        </button>

        <h1 className="text-md font-extrabold text-text-primary tracking-wide absolute left-1/2 transform -translate-x-1/2">
          创作广场
        </h1>

        <button
          onClick={() => router.push("/gallery")}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border-custom hover:border-sakura hover:bg-[#FFEAEF]/40 text-text-secondary hover:text-[#B3455C] rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          <Image className="w-3.5 h-3.5" />
          <span>我的画廊</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Hero Banner */}
        <div className="bg-linear-to-br from-sakura-light via-white to-macaron-blue-light border border-border-custom rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-white border border-border-custom flex items-center justify-center text-sakura shadow-sm shrink-0">
            <Globe className="w-7 h-7 text-[#B3455C]" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-xl font-black text-text-primary">创作广场</h2>
            <p className="text-sm text-text-secondary mt-1">
              发现来自所有创作者的精美作品。保存画作时将自动分享到广场。
            </p>
          </div>
          <button
            onClick={() => router.push("/canvas")}
            className="flex items-center gap-2 px-5 py-2.5 bg-sakura hover:bg-[#FFA5B5] text-white rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>开始创作</span>
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center min-h-[300px]">
            <div className="flex flex-col items-center gap-3">
              <span className="w-8 h-8 border-3 border-sakura/30 border-t-sakura rounded-full animate-spin" />
              <p className="text-sm text-text-secondary font-medium">
                正在加载作品...
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && artworks.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border-custom/80 bg-white rounded-3xl p-12 text-center min-h-87.5 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-macaron-blue-light flex items-center justify-center text-[#2F6196] mb-4">
              <Globe className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-text-primary">
              广场暂无作品
            </h3>
            <p className="text-xs text-text-secondary mt-1.5 max-w-sm">
              还没有人分享作品。成为第一个创作者吧！进入画板画出你的作品并保存即可自动分享到广场。
            </p>
            <button
              onClick={() => router.push("/canvas")}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-macaron-blue hover:bg-[#A3C3E3] text-text-primary rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              立即去创作
            </button>
          </div>
        )}

        {/* Artworks Grid */}
        {!isLoading && artworks.length > 0 && (
          <>
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-text-primary">
                  全部作品
                </h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  共 {artworks.length} 幅作品来自众多创作者
                </p>
              </div>
              <button
                onClick={loadArtworks}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border-custom rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface transition-all cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>刷新</span>
              </button>
            </div>

            <div
              ref={gridRef}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
              role="grid"
            >
              {artworks.map((art) => (
                <div
                  key={art.id}
                  className="group flex flex-col bg-white border border-border-custom rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden relative"
                  role="gridcell"
                  tabIndex={0}
                >
                  {/* Image Preview */}
                  <div className="aspect-4/3 w-full bg-surface relative overflow-hidden border-b border-border-custom/50">
                    {art.thumbnail_url ? (
                      <img
                        src={art.thumbnail_url}
                        alt={art.title || "作品"}
                        className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-disabled">
                        <Image className="w-10 h-10" />
                      </div>
                    )}

                    {/* Download Button */}
                    <div className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={(e) => handleDownload(art, e)}
                        className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-border-custom flex items-center justify-center text-text-secondary hover:text-[#4A8ECF] hover:bg-white shadow transition-all focus:outline-none focus:ring-2 focus:ring-sakura"
                        title="下载图片"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Card Info */}
                  <div className="p-4 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      {art.user_avatar_url ? (
                        <img
                          src={art.user_avatar_url}
                          alt=""
                          className="w-5 h-5 rounded-full border border-border-custom bg-surface"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-macaron-blue-light border border-border-custom flex items-center justify-center">
                          <Users className="w-3 h-3 text-[#2F6196]" />
                        </div>
                      )}
                      <h4 className="text-sm font-bold text-text-primary truncate flex-1">
                        {art.title || "未命名作品"}
                      </h4>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] font-semibold text-text-disabled uppercase bg-surface border border-border-custom/40 px-2 py-0.5 rounded-full">
                        {art.user_name || "匿名用户"}
                      </span>
                      <span className="text-[10px] text-text-secondary font-medium">
                        {formatRelativeTime(art.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
