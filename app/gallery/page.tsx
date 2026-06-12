"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Palette,
  Download,
  Trash2,
  ArrowLeft,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import gsap from "gsap";
import { deleteArtworkViaApi, fetchUserArtworks } from "@/lib/api/artworks";
import type { ArtworkRecord } from "@/lib/supabase/db";
import { createClient } from "@/lib/supabase/client";

export default function GalleryPage() {
  const router = useRouter();
  const [artworks, setArtworks] = useState<ArtworkRecord[]>([]);
  const [userName, setUserName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const gridRef = useRef<HTMLDivElement>(null);

  async function loadData() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setUserName(
      user.user_metadata?.name || user.email?.split("@")[0] || "用户",
    );
    setAvatarUrl(user.user_metadata?.avatar_url || "");

    const data = await fetchUserArtworks();
    setArtworks(data.artworks);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const run = async () => {
        await loadData();
      };
      void run();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // GSAP Stagger Entrance
  useEffect(() => {
    if (artworks.length > 0 && gridRef.current) {
      gsap.fromTo(
        gridRef.current.children,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power2.out" },
      );
    }
  }, [artworks]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("确定要删除这幅画作吗？删除后不可恢复。")) {
      await deleteArtworkViaApi(id);
      // Fade out target element using GSAP
      const card = document.getElementById(`card-${id}`);
      if (card) {
        gsap.to(card, {
          scale: 0.9,
          opacity: 0,
          duration: 0.3,
          onComplete: async () => {
            const data = await fetchUserArtworks();
            setArtworks(data.artworks);
          },
        });
      } else {
        const data = await fetchUserArtworks();
        setArtworks(data.artworks);
      }
    }
  };

  const handleDownload = (artwork: ArtworkRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!artwork.thumbnail_url) return;
    const link = document.createElement("a");
    link.href = artwork.thumbnail_url;
    link.download = `${artwork.title || "未命名作品"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenArtwork = (id: string) => {
    router.push(`/canvas?id=${id}`);
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
    <div className="flex-1 flex flex-col bg-surface font-sans select-none h-full overflow-hidden">
      {/* Header */}
      <header className="h-[56px] bg-white border-b border-border-custom px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <button
          onClick={() => router.push("/canvas")}
          className="flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-sakura rounded-md px-2.5 py-1.5 border border-border-custom/50 hover:bg-surface cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回画布</span>
        </button>

        <h1 className="text-md font-extrabold text-text-primary tracking-wide absolute left-1/2 transform -translate-x-1/2">
          我的画廊
        </h1>

        <div className="flex items-center gap-3">
          {userName && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-secondary hidden md:block">
                {userName}
              </span>
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full border border-sakura bg-sakura-light"
                />
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 flex flex-col gap-4 overflow-y-auto min-h-0">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-text-primary">我的画作</h2>
            <p className="text-xs text-text-secondary mt-1">
              这里保存了您用语音创作的所有艺术品（共 {artworks.length} 幅）
            </p>
          </div>

          <button
            onClick={() => router.push("/canvas")}
            className="flex items-center gap-2 px-4 py-2.5 bg-sakura hover:bg-sakura-light text-white hover:text-text-primary rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Palette className="w-4 h-4" />
            <span>开始创作</span>
          </button>
        </div>

        {/* Empty state */}
        {artworks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border-custom/80 bg-white rounded-3xl p-12 text-center min-h-[350px] shadow-sm animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-sakura-light flex items-center justify-center text-[#B3455C] mb-4">
              <ImageIcon className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-text-primary">
              画廊空空如也
            </h3>
            <p className="text-xs text-text-secondary mt-1.5 max-w-sm">
              你还没有保存过画作。进入画板，按住麦克风，说出：
              <span className="block font-semibold text-sakura mt-1 italic">
                “画一个蓝色的圆形在中间”
              </span>
              然后说“保存”，你的作品就会出现在这里！
            </p>
            <button
              onClick={() => router.push("/canvas")}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-macaron-blue hover:bg-[#A3C3E3] text-text-primary rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              立即去画画
            </button>
          </div>
        ) : (
          /* Artworks Grid */
          <div
            ref={gridRef}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
            role="grid"
          >
            {artworks.map((art) => (
              <div
                key={art.id}
                id={`card-${art.id}`}
                onClick={() => handleOpenArtwork(art.id)}
                className="group flex flex-col bg-white border border-border-custom rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden relative"
                role="gridcell"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleOpenArtwork(art.id)
                }
              >
                {/* Image Preview */}
                <div className="aspect-4/3 w-full bg-surface relative overflow-hidden border-b border-border-custom/50">
                  {art.thumbnail_url ? (
                    <img
                      src={art.thumbnail_url}
                      alt={art.title || "未命名作品"}
                      className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-disabled">
                      <ImageIcon className="w-10 h-10" />
                    </div>
                  )}

                  {/* Floating Action Bar (Pill overlay) */}
                  <div className="absolute bottom-2.5 right-2.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={(e) => handleDownload(art, e)}
                      className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-border-custom flex items-center justify-center text-text-secondary hover:text-[#4A8ECF] hover:bg-white shadow transition-all focus:outline-none focus:ring-2 focus:ring-sakura"
                      title="下载 PNG"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(art.id, e)}
                      className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-border-custom flex items-center justify-center text-text-secondary hover:text-[#D04D43] hover:bg-white shadow transition-all focus:outline-none focus:ring-2 focus:ring-sakura"
                      title="删除作品"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-4 flex flex-col gap-1">
                  <h4 className="text-sm font-bold text-text-primary truncate">
                    {art.title || "未命名作品"}
                  </h4>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] font-semibold text-text-disabled uppercase tracking-wider bg-surface border border-border-custom/40 px-2 py-0.5 rounded-full">
                      {art.tags?.[0] || "Canvas"}
                    </span>
                    <span className="text-[10px] text-text-secondary font-medium">
                      {formatRelativeTime(art.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
