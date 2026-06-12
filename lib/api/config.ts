const DEFAULT_STORAGE_BUCKET = "voice";
const DEFAULT_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com";
const DEFAULT_APP_BASE_URL = "http://localhost:3000";

export function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_BASE_URL;
}

export function getStorageBucketName(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_STORAGE_BUCKET;
}

export function getDashScopeBaseUrl(): string {
  return process.env.DASHSCOPE_BASE_URL || DEFAULT_DASHSCOPE_BASE_URL;
}

export function getDashScopeApiKey(): string | null {
  return process.env.DASHSCOPE_API_KEY || null;
}
