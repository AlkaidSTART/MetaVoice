const DEFAULT_STORAGE_BUCKET = "voice";
const DEFAULT_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com";
const DEFAULT_APP_BASE_URL = "http://localhost:3000";
const DEFAULT_FUNASR_MODEL = "auto";
const DEFAULT_FUNASR_LANGUAGE_HINTS = "zh,en,ja,ko";

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

export function getFunAsrApiUrl(): string | null {
  return process.env.FUNASR_API_URL || null;
}

export function getFunAsrApiKey(): string | null {
  return process.env.FUNASR_API_KEY || null;
}

export function getFunAsrModel(): string {
  return process.env.FUNASR_MODEL || DEFAULT_FUNASR_MODEL;
}

export function getFunAsrLanguageHints(): string[] {
  return (process.env.FUNASR_LANGUAGE_HINTS || DEFAULT_FUNASR_LANGUAGE_HINTS)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
