const DEFAULT_STORAGE_BUCKET_PUBLIC = "public";
const DEFAULT_STORAGE_BUCKET_PRIVATE = "private";
const DEFAULT_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com";
const DEFAULT_APP_BASE_URL = "http://localhost:3000";
const DEFAULT_LLM_MODEL = "qwen3.7-max";
const DEFAULT_LLM_TEMPERATURE = 0.7;
const DEFAULT_LLM_MAX_TOKENS = 4096;

export function getRequiredEnv(name: string): string {
  const value = normalizeEnvValue(process.env[name]);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function normalizeEnvValue(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase().includes("placeholder")) {
    return "";
  }

  return trimmed;
}

export function getOptionalEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = normalizeEnvValue(process.env[name]);
    if (value) {
      return value;
    }
  }

  return null;
}

export function getAppBaseUrl(): string {
  return normalizeEnvValue(process.env.NEXT_PUBLIC_APP_URL) || DEFAULT_APP_BASE_URL;
}

export function getStorageBucketName(bucketType: "public" | "private" = "public"): string {
  if (bucketType === "private") {
    return normalizeEnvValue(process.env.SUPABASE_STORAGE_BUCKET_PRIVATE) || DEFAULT_STORAGE_BUCKET_PRIVATE;
  }
  return normalizeEnvValue(process.env.SUPABASE_STORAGE_BUCKET_PUBLIC) || DEFAULT_STORAGE_BUCKET_PUBLIC;
}

export function getDashScopeBaseUrl(): string {
  return normalizeEnvValue(process.env.DASHSCOPE_BASE_URL) || DEFAULT_DASHSCOPE_BASE_URL;
}

export function getDashScopeApiKey(): string | null {
  return getOptionalEnv("DASHSCOPE_API_KEY");
}

export function getLlmModel(): string {
  return normalizeEnvValue(process.env.LLM_MODEL) || DEFAULT_LLM_MODEL;
}

export function getLlmTemperature(): number {
  const temp = parseFloat(process.env.LLM_TEMPERATURE || "");
  return isNaN(temp) ? DEFAULT_LLM_TEMPERATURE : temp;
}

export function getLlmMaxTokens(): number {
  const tokens = parseInt(process.env.LLM_MAX_TOKENS || "", 10);
  return isNaN(tokens) ? DEFAULT_LLM_MAX_TOKENS : tokens;
}
