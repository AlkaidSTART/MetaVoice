import { getDashScopeApiKey, getDashScopeBaseUrl } from "@/lib/api/config";

type TranscribeResult = {
  transcript: string;
  duration?: number;
  raw?: unknown;
};

/**
 * 确保 base URL 指向 OpenAI 兼容模式根路径
 * 兼容 DASHSCOPE_BASE_URL 设置为:
 *   - https://dashscope.aliyuncs.com/compatible-mode/v1
 *   - https://dashscope.aliyuncs.com
 */
function resolveCompatibleBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, "");
  // 如果已经以 /compatible-mode/v1 结尾，直接使用
  if (trimmed.endsWith("/compatible-mode/v1")) {
    return trimmed;
  }
  // 如果只是域名，补上完整路径
  return `${trimmed}/compatible-mode/v1`;
}

export async function transcribeWithQwenASR(file: File): Promise<TranscribeResult> {
  const apiKey = getDashScopeApiKey();
  const rawBaseUrl = getDashScopeBaseUrl();

  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is not configured");
  }

  const baseUrl = resolveCompatibleBaseUrl(rawBaseUrl);

  // 使用 OpenAI 兼容的 multipart/form-data 格式
  const formData = new FormData();
  formData.append("file", file, file.name || "audio.webm");
  formData.append("model", "qwen3-asr-flash");
  formData.append("language", "zh");

  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    let details: unknown = text;
    try {
      details = JSON.parse(text);
    } catch {
      // 如果不是 JSON，保持为文本
    }

    throw new Error(
      `Qwen ASR request failed: ${response.status} ${JSON.stringify(details)}`,
    );
  }

  const data = await response.json();
  // OpenAI 兼容格式返回 { text: "...", duration?: ... }
  const transcript =
    data?.text ||
    data?.result?.text ||
    data?.output?.text ||
    "";
  const duration =
    data?.duration ||
    data?.result?.duration ||
    undefined;

  return {
    transcript,
    duration: typeof duration === "number" ? duration : undefined,
    raw: data,
  };
}
