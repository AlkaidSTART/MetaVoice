"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Trash2,
  ImageOff,
  User,
  LogOut,
} from "lucide-react";
import gsap from "gsap";
import { authDB, artworkDB, Artwork, User as UserType } from "../lib/db";

export default function GalleryPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserType | null>(null);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);

  const headerRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // 加载作品列表
  const loadArtworks = async (userId: string) => {
    try {
      const userArtworks = await artworkDB.getByUserId(userId);
      // 按创建时间倒序排列
      userArtworks.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setArtworks(userArtworks);
    } catch (error) {
      console.error("加载作品失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 检查用户登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await authDB.getCurrentUser();
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        loadArtworks(currentUser.id);
      }
    };
    checkAuth();
  }, [router]);

  // 页面入场动画
  useEffect(() => {
    if (!user || loading) return;

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.fromTo(
      headerRef.current,
      { y: -20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5 }
    )
      .fromTo(
        gridRef.current?.children || [],
        { y: 30, opacity: 0, scale: 0.95 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.5,
          stagger: 0.08,
          ease: "back.out(1.2)",
        },
        "-=0.3"
      );

    return () => {
      tl.kill();
    };
  }, [user, loading, artworks]);

  // 处理登出
  const handleLogout = async () => {
    await authDB.logout();
    router.push("/login");
  };

  // 下载作品
  const handleDownload = (artwork: Artwork) => {
    try {
      const link = document.createElement("a");
      link.download = `${artwork.title}.png`;
      link.href = artwork.thumbnail;
      link.click();
    } catch (error) {
      console.error("下载失败:", error);
    }
  };

  // 删除作品
  const handleDelete = async (artworkId: string) => {
    try {
      await artworkDB.delete(artworkId);
      setArtworks(artworks.filter(a => a.id !== artworkId));
    } catch (error) {
      console.error("删除失败:", error);
    }
  };

  // 返回画布
  const handleBackToCanvas = () => {
    router.push("/canvas");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-text-secondary animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg via-sakura-light/5 to-macaron-blue-light/5">
      {/* Header */}
      <header
        ref={headerRef}
        className="h-14 bg-surface/80 backdrop-blur-sm border-b border-sakura/10 flex items-center justify-between px-6 sticky top-0 z-10"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={handleBackToCanvas}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-sakura-light/20 transition-all"
            aria-label="返回画布"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm hidden sm:inline">返回画布</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sakura-light to-sakura/30 flex items-center justify-center shadow-sm">
            <span className="text-sakura font-bold text-sm">VC</span>
          </div>
          <span className="font-semibold text-text-primary">VoiceCanvas</span>
        </div>

        <div className="flex items-center gap-3">
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
      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-text-primary">我的图库</h1>
            <p className="text-sm text-text-secondary mt-1">
              共 {artworks.length} 个作品
            </p>
          </div>

          {/* Gallery Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-text-secondary animate-pulse">加载作品中...</div>
            </div>
          ) : artworks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-full bg-sakura-light/30 flex items-center justify-center mb-4">
                <ImageOff className="w-8 h-8 text-sakura/50" />
              </div>
              <p className="text-text-secondary">暂无作品</p>
              <button
                onClick={handleBackToCanvas}
                className="mt-4 px-4 py-2 rounded-xl bg-sakura hover:bg-sakura/90 text-white font-medium text-sm transition-all"
              >
                开始创作
              </button>
            </div>
          ) : (
            <div
              ref={gridRef}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              {artworks.map((artwork) => (
                <div
                  key={artwork.id}
                  className="bg-white rounded-2xl border border-sakura/10 shadow-sm hover:shadow-md hover:border-sakura/20 transition-all overflow-hidden group"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[4/3] bg-surface">
                    <img
                      src={artwork.thumbnail}
                      alt={artwork.title}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4 gap-2">
                      <button
                        onClick={() => handleDownload(artwork)}
                        className="p-2 rounded-full bg-white/90 hover:bg-white text-text-primary transition-all"
                        aria-label="下载作品"
                        title="下载"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(artwork.id)}
                        className="p-2 rounded-full bg-white/90 hover:bg-white text-error transition-all"
                        aria-label="删除作品"
                        title="删除"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-text-primary truncate">
                      {artwork.title}
                    </h3>
                    <p className="text-xs text-text-secondary mt-1">
                      {new Date(artwork.createdAt).toLocaleDateString("zh-CN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}