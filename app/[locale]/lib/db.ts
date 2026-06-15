/**
 * IndexedDB 存储模块
 * 用于用户登录注册和作品存储
 */

const DB_NAME = "VoiceCanvasDB";
const DB_VERSION = 2; // 升级版本以添加新表

// 数据库表名
export const STORES = {
  USERS: "users",
  ARTWORKS: "artworks",
  SESSIONS: "sessions",
  PROMPT_HISTORY: "promptHistory", // 新增：提示词历史表
} as const;

// 用户数据结构
export interface User {
  id: string;
  email: string;
  name: string;
  password: string; // 实际项目中应该加密存储
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 作品数据结构
export interface Artwork {
  id: string;
  userId: string;
  title: string;
  thumbnail: string; // base64 或 URL
  canvasData: string; // JSON 字符串
  createdAt: Date;
  updatedAt: Date;
}

// 会话数据结构
export interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

// 提示词历史数据结构
export interface PromptHistory {
  id: string;
  userId: string | null; // 支持未登录用户
  prompt: string; // 用户输入的提示词
  canvasParams: string; // canvas参数 JSON 字符串
  similarityScore: number; // 相似度分数（用于排序）
  usageCount: number; // 使用次数
  createdAt: Date;
  updatedAt: Date;
}

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  // 初始化数据库
  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error("Failed to open database"));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建用户表
        if (!db.objectStoreNames.contains(STORES.USERS)) {
          const userStore = db.createObjectStore(STORES.USERS, { keyPath: "id" });
          userStore.createIndex("email", "email", { unique: true });
        }

        // 创建作品表
        if (!db.objectStoreNames.contains(STORES.ARTWORKS)) {
          const artworkStore = db.createObjectStore(STORES.ARTWORKS, { keyPath: "id" });
          artworkStore.createIndex("userId", "userId", { unique: false });
          artworkStore.createIndex("createdAt", "createdAt", { unique: false });
        }

        // 创建会话表
        if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
          const sessionStore = db.createObjectStore(STORES.SESSIONS, { keyPath: "id" });
          sessionStore.createIndex("userId", "userId", { unique: false });
        }

        // 创建提示词历史表
        if (!db.objectStoreNames.contains(STORES.PROMPT_HISTORY)) {
          const promptStore = db.createObjectStore(STORES.PROMPT_HISTORY, { keyPath: "id" });
          promptStore.createIndex("userId", "userId", { unique: false });
          promptStore.createIndex("prompt", "prompt", { unique: false });
          promptStore.createIndex("usageCount", "usageCount", { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  // 通用添加方法
  async add<T>(storeName: string, data: T): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to add data to ${storeName}`));
    });
  }

  // 通用更新方法
  async put<T>(storeName: string, data: T): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to update data in ${storeName}`));
    });
  }

  // 通用获取方法
  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to get data from ${storeName}`));
    });
  }

  // 通过索引获取
  async getByIndex<T>(storeName: string, indexName: string, value: string): Promise<T | undefined> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.get(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to get data from ${storeName} by index`));
    });
  }

  // 获取所有数据
  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to get all data from ${storeName}`));
    });
  }

  // 删除数据
  async delete(storeName: string, key: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete data from ${storeName}`));
    });
  }

  // 清空表
  async clear(storeName: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
    });
  }
}

// 导出单例
export const db = new IndexedDBManager();

// 用户认证相关方法
export const authDB = {
  // 注册用户
  async register(email: string, password: string, name: string): Promise<User> {
    const existingUser = await db.getByIndex<User>(STORES.USERS, "email", email);
    if (existingUser) {
      throw new Error("该邮箱已被注册");
    }

    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      password, // 实际项目中应该加密
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.add(STORES.USERS, user);
    return user;
  },

  // 登录
  async login(email: string, password: string): Promise<User> {
    const user = await db.getByIndex<User>(STORES.USERS, "email", email);
    if (!user) {
      throw new Error("用户不存在");
    }
    if (user.password !== password) {
      throw new Error("密码错误");
    }

    // 创建会话
    const session: Session = {
      id: `session_${Date.now()}`,
      userId: user.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天过期
    };
    await db.add(STORES.SESSIONS, session);

    return user;
  },

  // 获取当前用户
  async getCurrentUser(): Promise<User | null> {
    const sessions = await db.getAll<Session>(STORES.SESSIONS);
    const validSession = sessions.find(s => new Date(s.expiresAt) > new Date());
    
    if (!validSession) return null;
    
    const user = await db.get<User>(STORES.USERS, validSession.userId);
    return user || null;
  },

  // 登出
  async logout(): Promise<void> {
    const sessions = await db.getAll<Session>(STORES.SESSIONS);
    for (const session of sessions) {
      await db.delete(STORES.SESSIONS, session.id);
    }
  },
};

// 作品相关方法
export const artworkDB = {
  // 保存作品
  async save(artwork: Omit<Artwork, "id" | "createdAt" | "updatedAt">): Promise<Artwork> {
    const newArtwork: Artwork = {
      ...artwork,
      id: `artwork_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.add(STORES.ARTWORKS, newArtwork);
    return newArtwork;
  },

  // 获取用户的所有作品
  async getByUserId(userId: string): Promise<Artwork[]> {
    const allArtworks = await db.getAll<Artwork>(STORES.ARTWORKS);
    return allArtworks.filter(a => a.userId === userId);
  },

  // 更新作品
  async update(id: string, updates: Partial<Artwork>): Promise<void> {
    const artwork = await db.get<Artwork>(STORES.ARTWORKS, id);
    if (!artwork) {
      throw new Error("作品不存在");
    }

    const updatedArtwork = {
      ...artwork,
      ...updates,
      updatedAt: new Date(),
    };

    await db.put(STORES.ARTWORKS, updatedArtwork);
  },

  // 删除作品
  async delete(id: string): Promise<void> {
    await db.delete(STORES.ARTWORKS, id);
  },
};

// 字符串相似度计算（Levenshtein距离）
function calculateSimilarity(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  // 初始化矩阵
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // 填充矩阵
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // 删除
        matrix[i][j - 1] + 1,      // 插入
        matrix[i - 1][j - 1] + cost // 替换
      );
    }
  }

  // 计算相似度分数 (0-1)
  const maxLen = Math.max(len1, len2);
  return 1 - (matrix[len1][len2] / maxLen);
}

// 提示词历史相关方法
export const promptHistoryDB = {
  // 保存提示词和canvas参数
  async save(prompt: string, canvasParams: object, userId: string | null = null): Promise<PromptHistory> {
    const newHistory: PromptHistory = {
      id: `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      prompt: prompt.trim(),
      canvasParams: JSON.stringify(canvasParams),
      similarityScore: 0,
      usageCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.add(STORES.PROMPT_HISTORY, newHistory);
    return newHistory;
  },

  // 查找相似提示词
  async findSimilar(prompt: string, userId: string | null = null, threshold: number = 0.7): Promise<PromptHistory | null> {
    const allHistory = await db.getAll<PromptHistory>(STORES.PROMPT_HISTORY);
    
    // 过滤用户相关的记录（未登录用户只匹配userId为null的记录）
    const filteredHistory = userId 
      ? allHistory.filter(h => h.userId === userId || h.userId === null)
      : allHistory.filter(h => h.userId === null);

    // 计算相似度并排序
    const sortedHistory = filteredHistory
      .map(h => ({
        ...h,
        similarityScore: calculateSimilarity(prompt.trim().toLowerCase(), h.prompt.toLowerCase())
      }))
      .sort((a, b) => b.similarityScore - a.similarityScore);

    // 找到相似度高于阈值的记录
    const matched = sortedHistory.find(h => h.similarityScore >= threshold);
    
    if (matched) {
      // 更新使用次数
      const existing = await db.get<PromptHistory>(STORES.PROMPT_HISTORY, matched.id);
      if (existing) {
        existing.usageCount += 1;
        existing.similarityScore = matched.similarityScore;
        existing.updatedAt = new Date();
        await db.put(STORES.PROMPT_HISTORY, existing);
      }
      
      return { ...matched, canvasParams: existing?.canvasParams || matched.canvasParams };
    }

    return null;
  },

  // 获取所有提示词历史（按使用次数排序）
  async getAll(userId: string | null = null): Promise<PromptHistory[]> {
    const allHistory = await db.getAll<PromptHistory>(STORES.PROMPT_HISTORY);
    
    const filtered = userId 
      ? allHistory.filter(h => h.userId === userId || h.userId === null)
      : allHistory.filter(h => h.userId === null);

    return filtered.sort((a, b) => b.usageCount - a.usageCount);
  },

  // 更新提示词记录的canvas参数
  async updateParams(id: string, canvasParams: object): Promise<void> {
    const history = await db.get<PromptHistory>(STORES.PROMPT_HISTORY, id);
    if (!history) {
      throw new Error("提示词记录不存在");
    }

    history.canvasParams = JSON.stringify(canvasParams);
    history.updatedAt = new Date();
    
    await db.put(STORES.PROMPT_HISTORY, history);
  },

  // 删除提示词记录
  async delete(id: string): Promise<void> {
    await db.delete(STORES.PROMPT_HISTORY, id);
  },

  // 清空所有提示词历史
  async clear(): Promise<void> {
    await db.clear(STORES.PROMPT_HISTORY);
  },
};
