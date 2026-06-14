const DEFAULT_STORAGE_BUCKET = "voice";
const DEFAULT_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com";
const DEFAULT_APP_BASE_URL = "http://localhost:3000";
const DEFAULT_LLM_MODEL = "qwen3.7-max";
const DEFAULT_LLM_TEMPERATURE = 0.7;
const DEFAULT_LLM_MAX_TOKENS = 4096;

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

// LLM 模型配置
export function getLlmModel(): string {
  return process.env.LLM_MODEL || DEFAULT_LLM_MODEL;
}

export function getLlmTemperature(): number {
  const temp = parseFloat(process.env.LLM_TEMPERATURE || "");
  return isNaN(temp) ? DEFAULT_LLM_TEMPERATURE : temp;
}

export function getLlmMaxTokens(): number {
  const tokens = parseInt(process.env.LLM_MAX_TOKENS || "", 10);
  return isNaN(tokens) ? DEFAULT_LLM_MAX_TOKENS : tokens;
}
