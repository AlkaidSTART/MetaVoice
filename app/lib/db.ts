/**
 * IndexedDB 存储模块
 * 用于用户登录注册和作品存储
 */

const DB_NAME = "VoiceCanvasDB";
const DB_VERSION = 1;

// 数据库表名
export const STORES = {
  USERS: "users",
  ARTWORKS: "artworks",
  SESSIONS: "sessions",
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
